import { graphemes, type Diagnostic, type KanbunDocument, type KanbunUnit } from '../parser/ast.js';
import { physicalRect, union, type LayoutRect, type LogicalRect } from './geometry.js';
import { DOMTextMeasurer, type TextMeasurer, type MeasurementRequest, type TextStyle } from './measurement.js';
import { resolveOptions, type LayoutOptions } from './options.js';
import { positionGroupRuby } from './group-ruby.js';
import type { AnnotationGlyph, ReadingAnnotationKind } from './aki-annotations.js';
import { placeCompoundMarks } from './compound-marks.js';
import { avoidIntercolumnAnnotations } from './intercolumn.js';
import { positionLinks } from './links.js';
import { punctuationClass } from './punctuation.js';
import { shiftOverflowOkurigana, alignShiftedOkurigana } from './okurigana-shift.js';
import { placeAkiAnnotations } from './aki-placement.js';
import { findCollisions, requiredOrigin, type Collision } from './collision.js';
export interface LayoutPart { kind: 'base' | 'punctuation' | 'reading' | 'reread' | 'kaeriten' | 'link'; text: string; annotationKind?: ReadingAnnotationKind; style: TextStyle; textBox?: LayoutRect; anchorIndex?: number; compoundGroup?: number; parentOverlap?: number; overlapParentIndex?: number; annotationLine?: number; nextHeadAligned?: boolean; outsideMainTrack?: boolean; rect: LogicalRect; physical: LayoutRect }
export interface KanbunLayoutUnit {
  node: KanbunUnit; parts: LayoutPart[]; baseRect: LayoutRect; annotationRects: LayoutRect[];
  bounds: LayoutRect; logicalBounds: LogicalRect; advance: number; extraSpacing: number; sourceIndex: number; column: number; flowEnd: number; trailingSpace: number;
}
export interface KanbunLayout { document: KanbunDocument; options: LayoutOptions; units: KanbunLayoutUnit[]; width: number; height: number; padding: number; columns: number; diagnostics: Diagnostic[]; collisions: Collision[] }
interface Draft { node: KanbunUnit; parts: LayoutPart[]; extent: LogicalRect; baseAdvance: number; before: number; after: number }
const kaeritenMap: Record<string, string> = { レ: '㆑', 一: '㆒', 二: '㆓', 三: '㆔', 四: '㆕', 上: '㆖', 中: '㆗', 下: '㆘', 甲: '㆙', 乙: '㆚', 丙: '㆛', 丁: '㆜', 天: '㆝', 地: '㆞', 人: '㆟' };
const cannotStart = /^[、。，．，！？!?：；:;）】〕〉》」』〙〗〟]/u;
const cannotEnd = /[（【〔〈《「『〘〖〝]$/u;
const zeroRect: LayoutRect = { x: 0, y: 0, width: 0, height: 0 };
/** Core geometry is renderer-independent; inject another measurer for non-DOM hosts. */
export async function layoutKanbun(document: KanbunDocument, input: Partial<LayoutOptions> = {}, measurer: TextMeasurer = new DOMTextMeasurer()): Promise<KanbunLayout> {
  const options = resolveOptions(input), o = options, size = o.kanjiFontSize, kanaSize = size * o.annotationScale;
  const diagnostics = [...document.diagnostics];
  const requests: MeasurementRequest[] = [];
  const annotationKinds = new Map<number, ReadingAnnotationKind>();
  const glyphMetrics = new Map<KanbunUnit, Partial<Record<'reading' | 'reread', number[]>>>();
  const definitions = new Map<KanbunUnit, { kind: LayoutPart['kind']; request: number; anchorIndex?: number; compoundGroup?: number }[]>();
  for (const p of document.children) for (const node of p.children) {
    const defs: { kind: LayoutPart['kind']; request: number; anchorIndex?: number; compoundGroup?: number }[] = [];
    const add = (kind: LayoutPart['kind'], text: string, fontSize: number, compound = false, annotationKind?: ReadingAnnotationKind, anchorIndex?: number, compoundGroup?: number) => {
      if (!text) return;
      defs.push({ kind, request: requests.length, anchorIndex, compoundGroup });
      if (annotationKind) annotationKinds.set(requests.length, annotationKind);
      requests.push({ text, style: { fontFamily: kind === 'base' || kind === 'punctuation' ? o.kanjiFontFamily : o.annotationFontFamily, fontSize, writingMode: o.writingMode, letterSpacing: o.letterSpacing, compound, halfWidth: kind === 'punctuation' } });
    };
    const text = (kind: string) => node.annotations.filter(a => a.kind === kind).map(a => a.text).join('');
    // A group remains atomic, but each main glyph has its own fixed-spacing box.
    for (const glyph of node.type === 'group' ? graphemes(node.text) : [node.text]) add(punctuationClass(node.text) ? 'punctuation' : 'base', glyph, size);
    add('reading', text('furigana'), kanaSize, false, 'furigana');
    add('reading', text('okurigana'), kanaSize, false, 'okurigana');
    add('reread', text('rereadFurigana'), kanaSize, false, 'rereadFurigana');
    add('reread', text('rereadOkurigana'), kanaSize, false, 'rereadOkurigana');
    const addMarks = (marks: string, anchorIndex?: number) => {
      const chars = graphemes(marks);
      for (const char of chars) add('kaeriten', o.kaeritenGlyphs === 'unicode' ? kaeritenMap[char] ?? char : char, size * o.kaeritenScale, false, undefined, anchorIndex, chars.length > 1 ? anchorIndex ?? -1 : undefined);
    };
    addMarks(text('kaeriten'));
    const linkMark = node.annotations.find(a => a.kind === 'link');
    if (linkMark) add('link', linkMark.text, size * .5);
    let parentIndex = 0;
    for (const child of node.children ?? []) {
      const marks = child.annotations.filter(a => a.kind === 'kaeriten').map(a => a.text).join('');
      addMarks(marks, parentIndex);
      const childLink = child.annotations.find(a => a.kind === 'link');
      if (childLink) add('link', childLink.text, size * .5, false, undefined, parentIndex);
      parentIndex += graphemes(child.text).length;
    }
    definitions.set(node, defs);
    if ((o.spacingMode === 'aki' && o.akiAnnotationOverflow === 'wrap') || node.type === 'group' || o.shiftOverflowOkurigana) {
      const lanes: Partial<Record<'reading' | 'reread', number[]>> = {};
      for (const def of defs) if (def.kind === 'reading' || def.kind === 'reread') {
        const request = requests[def.request]!;
        lanes[def.kind] = [...(lanes[def.kind] ?? []), ...graphemes(request.text).map(text => { const index = requests.length; requests.push({ text, style: request.style }); annotationKinds.set(index, annotationKinds.get(def.request)!); return index; })];
      }
      glyphMetrics.set(node, lanes);
    }
  }
  const measured = await measurer.measureBatch(requests);
  const drafts = new Map<KanbunUnit, Draft>();
  for (const [node, defs] of definitions) {
    let baseInline = 0, baseBlock = size;
    const parts: LayoutPart[] = [];
    const has = (kind: string) => node.annotations.some(a => a.kind === kind && a.text);
    for (const def of defs) {
      const req = requests[def.request]!, metric = measured[def.request]!, annotationKind = annotationKinds.get(def.request);
      let parentOverlap: number | undefined, overlapParentIndex: number | undefined;
      const rect: LogicalRect = { i: 0, b: 0, inlineSize: metric.inlineSize, blockSize: metric.blockSize };
      if (def.kind === 'punctuation') {
        baseInline = rect.inlineSize; baseBlock = rect.blockSize;
      } else if (def.kind === 'base') {
        const previousParent = node.children?.[parts.filter(p => p.kind === 'base').length - 1];
        let internalMarkSpace = 0, previousEnd = 0;
        let previousMark: typeof defs[number] | undefined;
        if (previousParent) for (const attached of defs.filter(d => d.anchorIndex === parts.filter(p => p.kind === 'base').length - 1)) {
          const metric = measured[attached.request]!;
          if (attached.kind === 'kaeriten') {
            const overlap = previousMark && attached.compoundGroup !== undefined ? (['一','㆒'].includes(requests[previousMark.request]!.text) ? .7 : .3) * requests[attached.request]!.style.fontSize : 0;
            previousEnd += metric.inlineSize - overlap;
            internalMarkSpace = Math.max(internalMarkSpace, previousEnd); previousMark = attached;
          } else internalMarkSpace = Math.max(internalMarkSpace, metric.inlineSize);
        }
        rect.i = baseInline === 0 ? 0 : baseInline + (o.spacingMode === 'aki' ? size * o.baseSpacing : internalMarkSpace);
        rect.inlineSize = Math.max(size, metric.inlineSize); rect.blockSize = Math.max(size, metric.blockSize);
        baseInline = rect.i + rect.inlineSize; baseBlock = Math.max(baseBlock, rect.blockSize);
      }
      else if (def.kind === 'reading' || def.kind === 'reread') {
        const furiganaKind = def.kind === 'reading' ? 'furigana' : 'rereadFurigana';
        const furigana = annotationKind === furiganaKind;
        if (furigana) {
          rect.i = o.furiganaAlign === 'center' ? (baseInline - rect.inlineSize) / 2 : 0;
          if (o.spacingMode === 'aki' && o.akiReadingAlign === 'contextual') {
            const okurigana = has(def.kind === 'reading' ? 'okurigana' : 'rereadOkurigana');
            rect.i = def.kind === 'reading' ? (okurigana ? baseInline - rect.inlineSize : (baseInline - rect.inlineSize) / 2) : (okurigana ? 0 : (baseInline - rect.inlineSize) / 2);
          }
        } else {
          const reading = parts.find(p => p.annotationKind === furiganaKind);
          rect.i = reading ? reading.rect.i + reading.rect.inlineSize : size * o.okuriganaOffset;
        }
        rect.b = def.kind === 'reading' ? -rect.blockSize : baseBlock;
      } else if (def.kind === 'kaeriten') {
        // JAGAT 56: align left edge with base and place after base; reread lane
        // is separate. Compound marks together fit a half-em envelope.
        const parent = def.anchorIndex === undefined ? undefined : parts.filter(p => p.kind === 'base')[def.anchorIndex];
        rect.i = parent ? parent.rect.i + parent.rect.inlineSize : baseInline;
        if (def.compoundGroup !== undefined) {
          const previous = parts.filter(p => p.kind === 'kaeriten' && p.compoundGroup === def.compoundGroup).at(-1);
          if (previous) rect.i = previous.rect.i + previous.rect.inlineSize - (['一','㆒'].includes(previous.text) ? .7 : .3) * req.style.fontSize;
          const pair = defs.filter(d => d.kind === 'kaeriten' && d.compoundGroup === def.compoundGroup).map(d => requests[d.request]!.text).join('');
          if (/^[一㆒][レ㆑]$/u.test(pair)) {
            parentOverlap = req.style.fontSize * .3;
            overlapParentIndex = def.anchorIndex ?? parts.filter(p => p.kind === 'base').length - 1;
            if (!previous) rect.i -= parentOverlap;
          }
        }
        rect.b = baseBlock - rect.blockSize;
      } else if (def.kind === 'link') {
        const parent = def.anchorIndex === undefined ? parts.filter(p => p.kind === 'base').at(-1) : parts.filter(p => p.kind === 'base')[def.anchorIndex];
        rect.inlineSize = size / 2; rect.blockSize = Math.max(1, size / 32);
        rect.i = parent ? parent.rect.i + parent.rect.inlineSize : baseInline;
        rect.b = ((parent?.rect.blockSize ?? baseBlock) - rect.blockSize) / 2;
        // Keep return marks beside the central stroke, using actual font bounds.
        const marks = parts.filter(p => p.kind === 'kaeriten' && p.anchorIndex === def.anchorIndex);
        for (const mark of marks) mark.rect.b = Math.max(mark.rect.b, rect.b + rect.blockSize);
      }
      parts.push({ kind: def.kind, annotationKind, anchorIndex: def.anchorIndex, compoundGroup: def.compoundGroup, parentOverlap, overlapParentIndex, text: req.text, style: req.style, textBox: metric.textBox, rect, physical: { ...zeroRect } });
    }
    if (node.type === 'group') {
      for (const kind of ['reading', 'reread'] as const) {
        const count = graphemes(node.annotations.filter(a => a.kind === (kind === 'reading' ? 'furigana' : 'rereadFurigana')).map(a => a.text).join('')).length;
        const index = parts.findIndex(p => p.kind === kind); if (!count || index < 0) continue;
        const glyphs = (glyphMetrics.get(node)?.[kind] ?? []).map(index => ({ annotationKind: annotationKinds.get(index), text: requests[index]!.text, style: requests[index]!.style, measurement: measured[index]! }));
        const maxBlock = Math.max(...glyphs.map(g => g.measurement.blockSize));
        const positioned = positionGroupRuby(glyphs, baseInline, count, o.groupRubyAlign, kind === 'reading' ? -maxBlock : baseBlock);
        parts.splice(index, parts.filter(p => p.kind === kind).length, ...positioned.map(g => ({ kind, annotationKind: g.annotationKind, text: g.text, style: g.style, textBox: g.measurement.textBox, rect: g.rect, physical: { ...zeroRect } })));
      }
    }
    const extent = union(parts.map(p => p.rect));
    const punctuation = punctuationClass(node.text);
    const before = punctuation === 'open' ? size / 2 : 0, after = punctuation === 'close' || punctuation === 'stop' ? size / 2 : 0;
    drafts.set(node, { node, parts, extent, before, after, baseAdvance: baseInline + (o.spacingMode === 'aki' && ['kanji', 'group', 'whitespace'].includes(node.type) ? size * o.baseSpacing : o.spacingMode === 'beta' ? after : 0) });
  }
  if (o.shiftOverflowOkurigana && o.spacingMode === 'beta') for (const paragraph of document.children) {
    for (let index = 0; index < paragraph.children.length; index++) {
      const draft = drafts.get(paragraph.children[index]!)!;
      const next = paragraph.children.slice(index + 1).find(node => drafts.get(node)!.parts.some(p => p.kind === 'base'));
      const parts = draft.parts.filter(p => p.kind === 'reading');
      if (!next || !parts.some(p => p.annotationKind === 'furigana') || !parts.some(p => p.annotationKind === 'okurigana')) continue;
      const bounds = union(parts.map(p => p.rect));
      if (bounds.inlineSize <= draft.baseAdvance + .05) {
        const start = Math.max(0, Math.min(bounds.i, draft.baseAdvance - bounds.inlineSize));
        for (const part of parts) part.rect.i += start - bounds.i;
      } else shiftOverflowOkurigana(draft.parts, draft.baseAdvance, size * .125);
      draft.extent = union(draft.parts.map(p => p.rect));
    }
  }
  // A common lane width incorporates measured fallback-font widths and both annotations.
  const allDrafts = [...drafts.values()];
  const trackParts = allDrafts.flatMap(d => d.parts).filter(p => !p.nextHeadAligned && p.kind !== 'reread');
  const minB = Math.min(0, ...trackParts.map(p => p.rect.b));
  const maxB = Math.max(size, ...trackParts.map(p => p.rect.b + p.rect.blockSize));
  let pitch = maxB - minB + o.columnGap;
  const units: KanbunLayoutUnit[] = [];
  let column = 0, preceding: (LogicalRect & { kind?: string })[] = [], previous: KanbunLayoutUnit | undefined, inlineExtent = o.columnHeight;
  const gap = size * o.annotationGap;
  // Traditional overhang is ONLY enabled for the documented 3/4-em, okurigana-only
  // convention. Annotation edge tolerance is checked independently.
  const originFor = (d: Draft, min: number, earlier: (LogicalRect & { kind?: string })[], parent = previous) => {
    if (o.spacingMode === 'aki') return min;
    // A stop and its preceding return mark share a typographic cell (JAGAT 56).
    const stop = punctuationClass(d.node.text) === 'stop';
    const obstacles = stop ? earlier.filter(r => !parent?.parts.some(p => p.kind === 'kaeriten' && p.rect.i === r.i && p.rect.b === r.b && p.rect.inlineSize === r.inlineSize && p.rect.blockSize === r.blockSize)) : earlier;
    let origin = requiredOrigin(d.parts.map(p => ({ ...p.rect, kind: p.kind })), obstacles, min, 0, size * o.collisionTolerance);
    if (!punctuationClass(d.node.text) && previous && previous.column === column) origin = requiredOrigin(d.parts.filter(p => p.kind !== 'base').map(p => ({ ...p.rect, kind: p.kind })), previous.parts.filter(p => p.kind !== 'base').map(p => ({ ...p.rect, kind: p.kind })), origin, gap, size * o.collisionTolerance);
    if (!punctuationClass(d.node.text) && (o.collisionPolicy === 'strict' || o.okuriganaOffset !== .75 || previous?.node.annotations.some(a => a.kind === 'furigana' || a.kind === 'rereadFurigana'))) {
      const last = parent;
      if (last && last.column === column) {
        const annotationEnd = Math.max(...last.parts.filter(p => p.kind === 'reading' || p.kind === 'reread').map(p => p.rect.i + p.rect.inlineSize), 0);
        origin = Math.max(origin, annotationEnd); // strict: no kana hangs beside next base
      }
    } else if (!punctuationClass(d.node.text) && previous && !previous.node.annotations.some(a => a.kind === 'furigana' || a.kind === 'rereadFurigana')) {
      const end = Math.max(...previous.parts.filter(p => p.kind === 'reading' || p.kind === 'reread').map(p => p.rect.i + p.rect.inlineSize), 0);
      origin = Math.max(origin, end - Math.min(.25, o.traditionalOverhang) * size);
    }
    return origin;
  };
  const nextColumn = () => { column++; preceding = []; previous = undefined; };
  for (const [pIndex, paragraph] of document.children.entries()) {
    if (pIndex > 0) nextColumn();
    // Boundaries prohibited by line-start/end rules are joined into finite clusters.
    const clusters: KanbunUnit[][] = [];
    let awaitingNextHead = false;
    for (const node of paragraph.children) {
      const lastCluster = clusters.at(-1); const lastNode = lastCluster?.at(-1);
      if (lastCluster && lastNode && (awaitingNextHead || cannotStart.test(node.text) || cannotEnd.test(lastNode.text))) lastCluster.push(node);
      else clusters.push([node]);
      const parts = drafts.get(node)!.parts;
      if (parts.some(p => p.kind === 'base')) awaitingNextHead = false;
      if (parts.some(p => p.nextHeadAligned || (p.kind === 'link' && (p.anchorIndex === undefined || p.anchorIndex === parts.filter(p => p.kind === 'base').length - 1)))) awaitingNextHead = true;
    }
    for (const cluster of clusters) {
      const place = () => {
        let tempRects = [...preceding], last = previous;
        const positioned: { d: Draft; origin: number; extra: number; flowEnd: number; advance: number }[] = [];
        // At an actual column head, place the leading opening marks before
        // the first main box. Their measured advances still keep marks ordered.
        // Recompute after a column break, including consecutive opening marks.
        let openingAdvance = 0, leadingOpenCount = 0;
        if (!last) {
          for (const leading of cluster) {
            if (punctuationClass(leading.text) !== 'open') break;
            leadingOpenCount++;
            if (o.lineStartBracket === 'hang') openingAdvance += drafts.get(leading)!.baseAdvance;
          }
          if (!cluster.some(node => drafts.get(node)!.parts.some(p => p.kind === 'base'))) openingAdvance = 0;
        }
        let main = last && !punctuationClass(last.node.text) ? last : [...units].reverse().find(u => u.column === column && !punctuationClass(u.node.text));
        for (const [nodeIndex, node] of cluster.entries()) {
          const d = drafts.get(node)!;
          const punctuation = punctuationClass(node.text);
          let minimum = last?.flowEnd ?? -openingAdvance;
          if (o.spacingMode === 'beta' && punctuation) {
            minimum -= last?.trailingSpace ?? 0;
            if (punctuation === 'open' && last && punctuationClass(last.node.text) !== 'open') minimum += Math.max(last.trailingSpace, d.before);
          }
          // use local previous for constraints inside a punctuation cluster
          const saved = previous; previous = last;
          const required = originFor(d, minimum, tempRects, main); previous = saved;
          // Fixed-spacing aki never moves the main glyphs to satisfy annotation constraints.
          let origin = o.spacingMode === 'aki' ? minimum : required;
          if (o.spacingMode === 'aki' && punctuation && main) {
            const mainEnd = Math.max(...main.parts.filter(p => p.kind === 'base').map(p => p.rect.i + p.rect.inlineSize));
            origin = punctuation === 'open' ? minimum - d.extent.inlineSize : last && punctuationClass(last.node.text) ? Math.max(mainEnd, ...last.parts.map(p => p.rect.i + p.rect.inlineSize)) : mainEnd;
          }
          const fullSlot = nodeIndex < leadingOpenCount && o.lineStartBracket === 'full';
          const cellSize = Math.max(size, d.extent.inlineSize);
          const advance = fullSlot ? cellSize + (o.spacingMode === 'aki' ? size * o.baseSpacing : 0) : d.baseAdvance;
          // Opening glyphs occupy the latter half of a full cell. The next
          // main glyph starts at the next grid slot, including the aki gap.
          if (fullSlot) origin = Math.max(origin, minimum + cellSize - d.extent.inlineSize);
          const flowEnd = fullSlot ? minimum + advance : o.spacingMode === 'aki' && punctuation && main ? minimum : origin + d.baseAdvance;
          positioned.push({ d, origin, extra: o.spacingMode === 'aki' || fullSlot ? 0 : origin - minimum, flowEnd, advance });
          const shifted = d.parts.map(p => ({ ...p.rect, kind: p.kind, i: p.rect.i + origin }));
          tempRects.push(...shifted);
          last = { parts: d.parts.map((p, i) => ({ ...p, rect: shifted[i]! })), advance, node, column, flowEnd, trailingSpace: d.after, baseRect: { ...zeroRect }, annotationRects: [], bounds: { ...zeroRect }, logicalBounds: union(shifted), extraSpacing: 0, sourceIndex: node.sourceRange.start } as KanbunLayoutUnit;
          if (!punctuation) main = last;
        }
        return positioned;
      };
      let positioned = place();
      let end = Math.max(...positioned.map(p => p.origin + p.d.extent.i + p.d.extent.inlineSize));
      if (end > o.columnHeight + .05 && preceding.length) { nextColumn(); positioned = place(); end = Math.max(...positioned.map(p => p.origin + p.d.extent.i + p.d.extent.inlineSize)); }
      if (end > o.columnHeight + .05) diagnostics.push({ code: 'UNIT_OVERFLOW', message: `不可拆分单元或禁则组合高度 ${end.toFixed(1)}px 超过列高 ${o.columnHeight}px；${o.overflowPolicy === 'expand' ? '页面已扩展以完整显示' : '保留可见溢出，请增大列高'}`, severity: 'warning', sourceRange: { start: cluster[0]!.sourceRange.start, end: cluster.at(-1)!.sourceRange.end } });
      if (o.overflowPolicy === 'expand') inlineExtent = Math.max(inlineExtent, end);
      for (const { d, origin, extra, flowEnd, advance } of positioned) {
        const parts = d.parts.map(p => ({ ...p, rect: { ...p.rect, i: p.rect.i + origin, b: p.rect.b + column * pitch - minB } }));
        // Keep local rectangles for placement constraints, global ones for output.
        preceding.push(...d.parts.map(p => ({ ...p.rect, kind: p.kind, i: p.rect.i + origin })));
        const unit: KanbunLayoutUnit = { node: d.node, parts, baseRect: { ...zeroRect }, annotationRects: [], bounds: { ...zeroRect }, logicalBounds: union(parts.map(p => p.rect)), advance, extraSpacing: extra, sourceIndex: d.node.sourceRange.start, column, flowEnd, trailingSpace: d.after };
        units.push(unit);
        previous = { ...unit, parts: parts.map(p => ({ ...p, rect: { ...p.rect, b: p.rect.b - column * pitch + minB } })) };
      }
    }
  }
  const glyphs = new Map<KanbunUnit, Partial<Record<'reading' | 'reread', AnnotationGlyph[]>>>();
  if (o.spacingMode === 'aki' || o.shiftOverflowOkurigana) {
    // Return to column-local block coordinates before adjusting the annotations.
    for (const unit of units) for (const part of unit.parts) part.rect.b -= unit.column * pitch - minB;
    for (const [node, lanes] of glyphMetrics) {
      const measuredLanes: Partial<Record<'reading' | 'reread', AnnotationGlyph[]>> = {};
      for (const kind of ['reading', 'reread'] as const) measuredLanes[kind] = (lanes[kind] ?? []).map(index => ({ annotationKind: annotationKinds.get(index), text: requests[index]!.text, style: requests[index]!.style, measurement: measured[index]! }));
      glyphs.set(node, measuredLanes);
    }
    if (o.spacingMode === 'aki') placeAkiAnnotations(units.filter(u => !punctuationClass(u.node.text)), o, glyphs, diagnostics);
    if (o.spacingMode === 'aki') placeCompoundMarks(units, size * .125);
    if (o.shiftOverflowOkurigana) alignShiftedOkurigana(units, size * .125);
    // The extra okurigana track occupies the existing inter-column space.
    // It must not expand the main column pitch. Collisions remain explicit.
    const allParts = units.flatMap(u => u.parts).filter(p => !p.nextHeadAligned && !p.outsideMainTrack && p.kind !== 'reread');
    const newMin = Math.min(0, ...allParts.map(p => p.rect.b));
    const newMax = Math.max(size, ...allParts.map(p => p.rect.b + p.rect.blockSize));
    pitch = newMax - newMin + o.columnGap;
    for (const unit of units) {
      for (const part of unit.parts) part.rect.b += unit.column * pitch - newMin;
      unit.logicalBounds = union(unit.parts.map(p => p.rect));
    }
    if (o.overflowPolicy === 'expand') inlineExtent = Math.max(o.columnHeight, ...units.map(u => u.logicalBounds.i + u.logicalBounds.inlineSize));
  }
  if (o.shiftOverflowOkurigana) avoidIntercolumnAnnotations(units, o, glyphs, diagnostics);
  positionLinks(units, o);
  for (const unit of units) unit.logicalBounds = union(unit.parts.map(p => p.rect));
  const columns = units.length ? column + 1 : 0, padding = Math.max(size, -Math.min(0, ...units.map(u => u.logicalBounds.i)));
  const nominalBlockExtent = columns ? columns * pitch - o.columnGap : size;
  // A wide reread on the outermost column may extend past the normal page
  // margin. Extend only that exterior canvas edge, never the column pitch.
  const contentBlockEnd = Math.max(nominalBlockExtent, ...units.flatMap(u => u.parts).map(p => p.rect.b + p.rect.blockSize));
  const blockExtent = nominalBlockExtent + Math.max(0, contentBlockEnd - nominalBlockExtent - padding);
  const width = (o.writingMode === 'vertical-rl' ? blockExtent : inlineExtent) + 2 * padding;
  const height = (o.writingMode === 'vertical-rl' ? inlineExtent : blockExtent) + 2 * padding;
  for (const unit of units) {
    for (const p of unit.parts) p.physical = physicalRect(p.rect, width, padding, o.writingMode);
    unit.baseRect = physicalRect(union(unit.parts.filter(p => p.kind === 'base' || p.kind === 'punctuation').map(p => p.rect)), width, padding, o.writingMode); unit.annotationRects = unit.parts.filter(p => p.kind !== 'base' && p.kind !== 'punctuation').map(p => p.physical); unit.bounds = physicalRect(unit.logicalBounds, width, padding, o.writingMode);
  }
  let punctuationOwner = -1;
  const collisionParts = units.flatMap((u, unit) => {
    if (!punctuationClass(u.node.text)) punctuationOwner = unit;
    let baseIndex = 0;
    return u.parts.map(p => ({ baseIndex: p.kind === 'base' ? baseIndex++ : undefined, parentOverlap: p.parentOverlap, overlapParentIndex: p.overlapParentIndex, rect: p.rect, unit, kind: p.kind, compoundGroup: p.compoundGroup, sharedStopOwner: punctuationClass(u.node.text) === 'stop' && units[punctuationOwner]?.column === u.column ? punctuationOwner : undefined }));
  });
  const collisions = findCollisions(collisionParts, size * o.collisionTolerance);
  if (collisions.length) diagnostics.push({ code: 'COLLISION', message: `检测到 ${collisions.length} 处禁止重叠，请检查布局参数`, severity: 'error', sourceRange: { start: 0, end: document.source.length } });
  return { document, options, units, width, height, padding, columns, diagnostics, collisions };
}

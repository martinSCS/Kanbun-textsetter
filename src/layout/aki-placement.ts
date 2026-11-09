import type { KanbunLayoutUnit, LayoutPart } from './engine.js';
import type { Diagnostic, KanbunUnit } from '../parser/ast.js';
import { union } from './geometry.js';
import type { LayoutOptions } from './options.js';
import { shiftOverflowOkurigana } from './okurigana-shift.js';
import { wrapAkiAnnotation, type AnnotationGlyph } from './aki-annotations.js';
type Lane = 'reading' | 'reread';
interface Run { unit: KanbunLayoutUnit; parts: LayoutPart[]; preferred: number; length: number; lower: number; upper: number }
interface Bound { preferred: number; lower: number; upper: number; length: number }
/** Bounded isotonic projection. Adjacent annotation runs stay ordered and separate.
 * Pooling adjacent violating blocks minimizes total squared displacement. All work
 * is on measured rectangles; no DOM writes, character-count sizing or retry loop.
 */
export function positionAnnotationRuns(bounds: Bound[], gap: number): number[] | undefined {
  const offsets: number[] = []; let offset = 0;
  const blocks: { start: number; end: number; sum: number; count: number; lower: number; upper: number; value: number }[] = [];
  for (let i = 0; i < bounds.length; i++) {
    const bound = bounds[i]!; offsets.push(offset);
    if (bound.lower > bound.upper + .001) return;
    const lower = bound.lower - offset, upper = bound.upper - offset, preferred = bound.preferred - offset;
    blocks.push({ start: i, end: i, sum: preferred, count: 1, lower, upper, value: Math.max(lower, Math.min(upper, preferred)) });
    while (blocks.length > 1 && blocks.at(-2)!.value > blocks.at(-1)!.value + .001) {
      const b = blocks.pop()!, a = blocks.pop()!;
      const merged = { start: a.start, end: b.end, sum: a.sum + b.sum, count: a.count + b.count, lower: Math.max(a.lower, b.lower), upper: Math.min(a.upper, b.upper), value: 0 };
      if (merged.lower > merged.upper + .001) return;
      merged.value = Math.max(merged.lower, Math.min(merged.upper, merged.sum / merged.count)); blocks.push(merged);
    }
    offset += bound.length + gap;
  }
  const result: number[] = [];
  for (const block of blocks) for (let i = block.start; i <= block.end; i++) result[i] = block.value + offsets[i]!;
  return result;
}
/** Earliest feasible placements quantify whether a candidate actually reduces
 * an unsatisfied constraint. Preferences alone never trigger another track. */
function deficit(bounds: Bound[], gap: number): number {
  let end = -Infinity, total = 0;
  for (const bound of bounds) {
    const start = Math.max(bound.lower, end + gap);
    total += Math.max(0, start - bound.upper);
    end = start + bound.length;
  }
  return total;
}
/** Main glyphs have already been placed on a fixed grid. Reposition annotations
 * against actual neighbours, not against hypothetical next glyphs in every cell.
 * Wrapping is used only if this bounded placement has no solution.
 */
export function placeAkiAnnotations(units: KanbunLayoutUnit[], options: LayoutOptions, glyphs: Map<KanbunUnit, Partial<Record<Lane, AnnotationGlyph[]>>>, diagnostics: Diagnostic[]): void {
  const size = options.kanjiFontSize, gap = size * options.annotationGap, tolerance = size * options.collisionTolerance;
  const byColumn = new Map<number, KanbunLayoutUnit[]>();
  for (const unit of units) { const column = byColumn.get(unit.column) ?? []; column.push(unit); byColumn.set(unit.column, column); }
  for (const column of byColumn.values()) for (const kind of ['reading', 'reread'] as const) {
    const makeRuns = (): Run[] => column.flatMap((unit, index) => {
      const parts = unit.parts.filter(p => p.kind === kind && !p.nextHeadAligned); if (!parts.length) return [];
      const bounds = union(parts.map(p => p.rect));
      const previous = column[index - 1], next = column[index + 1];
      const lower = previous ? Math.max(...previous.parts.filter(p => p.kind === 'base').map(p => p.rect.i + p.rect.inlineSize)) : Math.min(bounds.i, -size);
      const end = next ? Math.min(...next.parts.filter(p => p.kind === 'base').map(p => p.rect.i)) : Math.max(options.columnHeight, bounds.i + bounds.inlineSize);
      return [{ unit, parts, preferred: bounds.i, length: bounds.inlineSize, lower, upper: end - bounds.inlineSize }];
    });
    let runs = makeRuns(); let positions = positionAnnotationRuns(runs, gap);
    if (!positions) positions = positionAnnotationRuns(runs, -tolerance);
    if (!positions && kind === 'reading' && options.shiftOverflowOkurigana) {
      // First try the complete furigana/okurigana flow. Only an actual failed
      // bounded placement can enter this finite fallback pass.
      let shortage = deficit(runs, gap);
      for (const run of runs) {
        const unitIndex = column.indexOf(run.unit), next = column[unitIndex + 1];
        const sending = run.parts.filter(p => p.annotationKind === 'okurigana');
        if (!next || !sending.length || !run.parts.some(p => p.annotationKind === 'furigana')) continue;
        for (const part of sending) part.nextHeadAligned = true;
        const candidate = makeRuns(), remaining = deficit(candidate, gap);
        for (const part of sending) part.nextHeadAligned = undefined;
        if (remaining >= shortage - .05) continue;
        const nextHead = Math.min(...next.parts.filter(p => p.kind === 'base').map(p => p.rect.i));
        shiftOverflowOkurigana(run.unit.parts, nextHead, size * .125);
        runs = makeRuns(); shortage = remaining;
        positions = positionAnnotationRuns(runs, gap) ?? positionAnnotationRuns(runs, -tolerance);
        if (positions) break;
      }
    }
    if (!positions && options.akiAnnotationOverflow === 'wrap') {
      // A single, finite fallback pass. Unrelated paragraphs/columns are untouched.
      for (const run of runs) {
        const base = union(run.unit.parts.filter(p => p.kind === 'base').map(p => p.rect));
        const before = Math.max(0, size * (options.baseSpacing - options.annotationGap) / 2);
        const end = base.inlineSize + size * options.baseSpacing - before - gap;
        const lane = union(run.parts.map(p => p.rect));
        const preferred = Math.max(-before, lane.i - base.i);
        const shifted = Math.max(-before, Math.min(preferred, end - lane.inlineSize));
        if (lane.inlineSize <= end + before + .05) {
          for (const part of run.parts) part.rect.i += base.i + shifted - lane.i;
          continue;
        }
        const hasShiftedOkuri = run.unit.parts.some(p => p.nextHeadAligned);
        const measuredGlyphs = (glyphs.get(run.unit.node)?.[kind] ?? []).filter(g => !hasShiftedOkuri || g.annotationKind !== 'okurigana');
        const start = Math.max(-before, Math.min(preferred, Math.max(0, end - (measuredGlyphs[0]?.measurement.inlineSize ?? 0))));
        const wrapped = wrapAkiAnnotation(measuredGlyphs, start, end, kind === 'reading' ? 'right' : 'left', base.blockSize, size * .125);
        const index = run.unit.parts.indexOf(run.parts[0]!);
        run.unit.parts.splice(index, run.parts.length, ...wrapped.glyphs.map(g => ({ kind, annotationKind: g.annotationKind, text: g.text, style: g.style, textBox: g.measurement.textBox, annotationLine: g.line, rect: { ...g.rect, i: g.rect.i + base.i }, physical: { x: 0, y: 0, width: 0, height: 0 } })));
        if (wrapped.overflow) diagnostics.push({ code: 'ANNOTATION_OVERFLOW', severity: 'error', message: '当前标注空间连一个原字号字素也无法容纳；已完整保留内容。', sourceRange: { ...run.unit.node.sourceRange } });
      }
      runs = makeRuns(); positions = positionAnnotationRuns(runs, gap) ?? positionAnnotationRuns(runs, -tolerance);
    }
    if (positions) {
      runs.forEach((run, index) => { const shift = positions![index]! - run.preferred; for (const part of run.parts) part.rect.i += shift; });
    } else if (runs.length) {
      diagnostics.push({ code: 'FIXED_SPACING_CONFLICT', severity: 'error', message: '固定字距、主字位置不变时，当前注音策略无法满足相邻标注的空间约束；已保留原文和字号。', sourceRange: { start: runs[0]!.unit.node.sourceRange.start, end: runs.at(-1)!.unit.node.sourceRange.end } });
    }
  }
}

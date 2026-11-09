import type { KanbunLayoutUnit, LayoutPart } from './engine.js';
import type { LayoutOptions } from './options.js';
import type { Diagnostic, KanbunUnit } from '../parser/ast.js';
import { union } from './geometry.js';
import { hasForbiddenOverlap } from './collision.js';
import { wrapAkiAnnotation, type AnnotationGlyph } from './aki-annotations.js';

/** Resolve optional outer sending tracks against the neighbouring reread lane.
 * All candidates are finite, measured, and checked against the whole page.
 * No main glyph or column origin is ever moved here.
 */
export function avoidIntercolumnAnnotations(units: KanbunLayoutUnit[], options: LayoutOptions, glyphs: Map<KanbunUnit, Partial<Record<'reading' | 'reread', AnnotationGlyph[]>>>, diagnostics: Diagnostic[]): void {
  const tolerance = options.kanjiFontSize * options.collisionTolerance;
  const items = () => units.flatMap((owner, unit) => owner.parts.map(part => ({ part, owner, unit, kind: part.kind, rect: part.rect })));
  const clear = (parts: LayoutPart[]) => {
    const all = items(), selected = new Set(parts);
    return all.filter(a => selected.has(a.part)).every(a => all.every(b => a.part === b.part || !hasForbiddenOverlap(a,b,tolerance)));
  };
  for (const sendingOwner of units) {
    const sending = sendingOwner.parts.filter(p => p.nextHeadAligned);
    if (!sending.length) continue;
    const neighbours = units.filter(u => u.column === sendingOwner.column - 1 && u.parts.some(p => p.kind === 'reread'));
    for (const rereadOwner of neighbours) {
      const reread = rereadOwner.parts.filter(p => p.kind === 'reread');
      if (!sending.some(a => reread.some(b => hasForbiddenOverlap({rect:a.rect,unit:0,kind:a.kind},{rect:b.rect,unit:1,kind:b.kind},tolerance)))) continue;
      const original = reread.map(p => ({ ...p.rect }));
      const bounds = union(reread.map(p => p.rect));
      const column = units.filter(u => u.column === rereadOwner.column && u.parts.some(p => p.kind === 'base'));
      const index = column.indexOf(rereadOwner), previous = column[index-1], next = column[index+1];
      const lower = previous ? Math.max(...previous.parts.filter(p => p.kind === 'base').map(p => p.rect.i+p.rect.inlineSize)) : Math.min(bounds.i,-options.kanjiFontSize);
      const upper = (next ? Math.min(...next.parts.filter(p => p.kind === 'base').map(p => p.rect.i)) : Math.max(options.columnHeight,bounds.i+bounds.inlineSize))-bounds.inlineSize;
      const candidates = [0,lower-bounds.i,upper-bounds.i];
      for (const obstacle of items().filter(a => !reread.includes(a.part))) for (const part of reread) {
        candidates.push(obstacle.rect.i-part.rect.i-part.rect.inlineSize+tolerance,obstacle.rect.i+obstacle.rect.inlineSize-part.rect.i-tolerance);
      }
      let resolved = false;
      for (const shift of [...new Set(candidates)].sort((a,b) => Math.abs(a)-Math.abs(b))) {
        if (bounds.i+shift < lower-.05 || bounds.i+shift > upper+.05) continue;
        reread.forEach((p,i) => { p.rect.i=original[i]!.i+shift; });
        if (clear(reread)) { resolved=true; break; }
      }
      if (resolved) continue;
      reread.forEach((p,i) => { Object.assign(p.rect,original[i]); });
      // Pack both tracks against opposite edges of the existing column band.
      const ordinary = (u: KanbunLayoutUnit) => u.parts.filter(p => p.kind !== 'reread' && !p.nextHeadAligned && !p.outsideMainTrack);
      const right = units.filter(u => u.column === rereadOwner.column).flatMap(ordinary);
      const left = units.filter(u => u.column === sendingOwner.column).flatMap(ordinary);
      const start = Math.max(...right.map(p => p.rect.b+p.rect.blockSize)), end = Math.min(...left.map(p => p.rect.b));
      const sendingBounds=union(sending.map(p=>p.rect)), savedSending=sending.map(p=>({...p.rect}));
      const rereadShift=start-bounds.b, sendingShift=end-sendingBounds.blockSize-sendingBounds.b;
      for (const p of reread) p.rect.b+=rereadShift;
      for (const p of sending) p.rect.b+=sendingShift;
      if (clear([...reread,...sending])) continue;
      reread.forEach((p,i)=>Object.assign(p.rect,original[i]));
      sending.forEach((p,i)=>Object.assign(p.rect,savedSending[i]));
      // Cancel this optional shift; fit measured glyphs on the original side.
      const reading = sendingOwner.parts.filter(p=>p.kind==='reading');
      const base=union(sendingOwner.parts.filter(p=>p.kind==='base').map(p=>p.rect));
      const following=units.slice(units.indexOf(sendingOwner)+1).find(u=>u.column===sendingOwner.column && u.parts.some(p=>p.kind==='base'));
      const head=following ? Math.min(...following.parts.filter(p=>p.kind==='base').map(p=>p.rect.i)) : options.columnHeight;
      const wrapped=wrapAkiAnnotation(glyphs.get(sendingOwner.node)?.reading ?? [],0,head-base.i,'right',base.blockSize,options.kanjiFontSize*.125);
      const replacements: LayoutPart[]=wrapped.glyphs.map(g=>({kind:'reading',annotationKind:g.annotationKind,text:g.text,style:g.style,textBox:g.measurement.textBox,annotationLine:g.line,rect:{...g.rect,i:g.rect.i+base.i,b:g.rect.b+base.b},physical:{x:0,y:0,width:0,height:0}}));
      if (replacements.length) {
        const at=sendingOwner.parts.indexOf(reading[0]!);
        sendingOwner.parts=sendingOwner.parts.filter(p=>!reading.includes(p));
        sendingOwner.parts.splice(at,0,...replacements);
      } else for (const p of sending) p.nextHeadAligned=undefined;
      if (wrapped.overflow || !clear(replacements)) diagnostics.push({code:'INTERCOLUMN_CONFLICT',severity:'error',message:'相邻列标注无法在现有空间内避让；已取消送假名右移，保留原文和字号。',sourceRange:{...sendingOwner.node.sourceRange}});
      break;
    }
  }
}

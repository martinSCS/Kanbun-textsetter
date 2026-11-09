import type { KanbunLayoutUnit } from './engine.js';
import { permitsParentOverlap } from './collision.js';
import { intersects, union } from './geometry.js';
/** At fixed main spacing, full-size overlapping marks may be taller than the
 * gap. Use the existing left inter-column space rather than shrinking the
 * marks or moving main characters. Ordinary single marks keep their anchors. */
export function placeCompoundMarks(units: KanbunLayoutUnit[], trackGap: number): void {
  const columns = new Map<number, KanbunLayoutUnit[]>();
  for (const unit of units) { const column = columns.get(unit.column) ?? []; column.push(unit); columns.set(unit.column, column); }
  for (const column of columns.values()) {
    const parts = column.flatMap(u => u.parts);
    const bases = column.flatMap(unit => unit.parts.filter(p => p.kind === 'base').map((part, baseIndex) => ({ unit, part, baseIndex })));
    const edge = Math.max(...parts.filter(p => !p.nextHeadAligned).map(p => p.rect.b + p.rect.blockSize));
    for (const unit of column) for (const id of new Set(unit.parts.flatMap(p => p.compoundGroup === undefined ? [] : [p.compoundGroup]))) {
      const marks = unit.parts.filter(p => p.kind === 'kaeriten' && p.compoundGroup === id);
      if (!marks.some(mark => bases.some(base => intersects(mark.rect, base.part.rect) && !(base.unit === unit && permitsParentOverlap(mark, { rect: base.part.rect, baseIndex: base.baseIndex }))))) continue;
      const bounds = union(marks.map(p => p.rect));
      for (const mark of marks) { mark.rect.b += edge + trackGap - bounds.b; mark.outsideMainTrack = true; }
    }
  }
}

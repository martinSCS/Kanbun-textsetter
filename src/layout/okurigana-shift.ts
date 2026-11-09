import type { LayoutPart, KanbunLayoutUnit } from './engine.js';
import { union } from './geometry.js';
/** Move only normal okurigana to the next right-hand track. The provisional
 * inline end is replaced by the actual following base head after placement. */
export function shiftOverflowOkurigana(parts: LayoutPart[], nextHead: number, trackGap: number): boolean {
  const ruby = parts.filter(p => p.annotationKind === 'furigana');
  const okuri = parts.filter(p => p.annotationKind === 'okurigana');
  if (!ruby.length || !okuri.length) return false;
  const reading = union(ruby.map(p => p.rect)), sending = union(okuri.map(p => p.rect));
  const deltaI = nextHead - sending.i - sending.inlineSize;
  const deltaB = reading.b - trackGap - sending.blockSize - sending.b;
  for (const part of okuri) { part.rect.i += deltaI; part.rect.b += deltaB; part.nextHeadAligned = true; }
  return true;
}
export function alignShiftedOkurigana(units: KanbunLayoutUnit[], trackGap: number): void {
  for (let index = 0; index < units.length; index++) {
    const unit = units[index]!, parts = unit.parts.filter(p => p.nextHeadAligned);
    if (!parts.length) continue;
    const next = units.slice(index + 1).find(u => u.column === unit.column && u.parts.some(p => p.kind === 'base'));
    if (!next) continue; // Beta attaches pairs; aki opts in only with a following base in this column.
    const nextHead = Math.min(...next.parts.filter(p => p.kind === 'base').map(p => p.rect.i));
    const end = Math.max(...parts.map(p => p.rect.i + p.rect.inlineSize));
    for (const part of parts) part.rect.i += nextHead - end;
    // Aki may have moved the ruby while avoiding adjacent readings. Keep the
    // new track directly to the right of that ruby's final block position.
    const ruby = unit.parts.filter(p => p.annotationKind === 'furigana');
    if (ruby.length) {
      const target = Math.min(...ruby.map(p => p.rect.b));
      const oldRight = Math.max(...parts.map(p => p.rect.b + p.rect.blockSize));
      const gap = trackGap;
      for (const part of parts) part.rect.b += target - gap - oldRight;
    }
  }
}

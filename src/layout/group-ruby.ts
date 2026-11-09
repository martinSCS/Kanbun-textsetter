import type { AnnotationGlyph, PositionedAnnotationGlyph } from './aki-annotations.js';
export type GroupRubyAlign = 'space-around' | 'space-between' | 'start' | 'center' | 'end';
/** JLREQ 3.3.6: shorter group ruby is balanced across the complete parent run.
 * space-around gives edge : internal gap : edge = 1 : 2 : 1.
 * Only ruby spacing changes; parent character positions are never changed here.
 */
export function positionGroupRuby(glyphs: AnnotationGlyph[], parentLength: number, furiganaCount: number, align: GroupRubyAlign, block: number): PositionedAnnotationGlyph[] {
  const furigana = glyphs.slice(0, furiganaCount);
  const length = furigana.reduce((sum, g) => sum + g.measurement.inlineSize, 0);
  const free = parentLength - length;
  let cursor = align === 'start' ? 0 : align === 'end' ? free : free / 2, gap = 0;
  if (free >= 0 && furiganaCount > 1) {
    if (align === 'space-around') { cursor = free / (2 * furiganaCount); gap = free / furiganaCount; }
    if (align === 'space-between') { cursor = 0; gap = free / (furiganaCount - 1); }
  }
  return glyphs.map((g, index) => {
    const result = { ...g, line: 0, rect: { i: cursor, b: block, inlineSize: g.measurement.inlineSize, blockSize: g.measurement.blockSize } };
    cursor += g.measurement.inlineSize;
    // Okurigana immediately follows the final furigana; it is not used to align it.
    if (index < furiganaCount - 1) cursor += gap;
    return result;
  });
}

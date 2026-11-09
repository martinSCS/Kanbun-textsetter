import type { TextMeasurement, TextStyle } from './measurement.js';
import type { LogicalRect } from './geometry.js';
export type ReadingAnnotationKind = 'furigana' | 'okurigana' | 'rereadFurigana' | 'rereadOkurigana';
export interface AnnotationGlyph { annotationKind?: ReadingAnnotationKind; text: string; style: TextStyle; measurement: TextMeasurement }
export interface PositionedAnnotationGlyph extends AnnotationGlyph { rect: LogicalRect; line: number }
/** A fixed-main-grid policy: fit measured glyphs into the unit's annotation slot.
 * A subcolumn is part of the same annotation/unit, never a new main-text column.
 * JAGAT 56 explicitly leaves room for differing aki practices.
 * This optional policy is not a rule prescribed by JAGAT's beta examples.
 */
export function wrapAkiAnnotation(glyphs: AnnotationGlyph[], start: number, end: number, side: 'right' | 'left', baseBlock: number, lineGap: number): { glyphs: PositionedAnnotationGlyph[]; lines: number; overflow: boolean } {
  if (!glyphs.length) return { glyphs: [], lines: 0, overflow: false };
  const lines: { glyphs: PositionedAnnotationGlyph[]; width: number }[] = [{ glyphs: [], width: 0 }];
  let cursor = start, overflow = false;
  for (const glyph of glyphs) {
    let line = lines.at(-1)!;
    if (cursor + glyph.measurement.inlineSize > end + .05 && line.glyphs.length) {
      line = { glyphs: [], width: 0 }; lines.push(line); cursor = 0;
    }
    // No character may be clipped or scaled just to fit a slot.
    if (cursor + glyph.measurement.inlineSize > end + .05) overflow = true;
    line.glyphs.push({ ...glyph, line: lines.length - 1, rect: { i: cursor, b: 0, inlineSize: glyph.measurement.inlineSize, blockSize: glyph.measurement.blockSize } });
    line.width = Math.max(line.width, glyph.measurement.blockSize); cursor += glyph.measurement.inlineSize;
  }
  const width = lines.reduce((sum, line) => sum + line.width, 0) + (lines.length - 1) * lineGap;
  let block = side === 'right' ? -width : baseBlock;
  for (const line of lines) {
    for (const glyph of line.glyphs) glyph.rect.b = block;
    block += line.width + lineGap;
  }
  return { glyphs: lines.flatMap(line => line.glyphs), lines: lines.length, overflow };
}

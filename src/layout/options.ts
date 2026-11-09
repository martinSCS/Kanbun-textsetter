import type { GroupRubyAlign } from './group-ruby.js';
import type { WritingMode } from './geometry.js';
export interface LayoutOptions {
  writingMode: WritingMode;
  /** beta: compact with local collision avoidance; aki: fixed baseSpacing, adjust annotations without moving main glyphs. */
  spacingMode: 'beta' | 'aki';
  /** Fixed gap between main-character layout boxes, in main font em; used only in aki. */
  baseSpacing: number;
  /** Long aki annotations: measured subcolumn wrapping, or diagnostic only. Main gap never changes. */
  akiAnnotationOverflow: 'wrap' | 'report';
  /** Aki: anchor readings according to okurigana presence, or use explicit mono-ruby alignment. */
  akiReadingAlign: 'contextual' | 'configured';
  kanjiFontFamily: string; annotationFontFamily: string; kanjiFontSize: number; annotationScale: number; kaeritenScale: number;
  columnHeight: number; columnGap: number; annotationGap: number;
  /** Allowed shallow annotation-frame intersection depth, in main-font em. Zero is strict. */
  collisionTolerance: number; letterSpacing: number;
  groupRubyAlign: GroupRubyAlign;
  /** Overflowing combined readings: put okurigana on the next right track, bottom at the following base head. */
  shiftOverflowOkurigana: boolean;
  /** Placement of opening brackets at a column head; full uses a complete main-text slot. */
  lineStartBracket: 'hang' | 'half' | 'full';
  /** Select hang/half when lineStartBracket is omitted. Hang leading opening brackets before the main-text origin at each column head. */
  hangOpeningBrackets: boolean;
  furiganaAlign: 'shoulder' | 'center'; okuriganaOffset: .5 | .75;
  collisionPolicy: 'strict' | 'traditional'; traditionalOverhang: number;
  kaeritenGlyphs: 'unicode' | 'source'; overflowPolicy: 'expand' | 'report';
}
export const defaultOptions: LayoutOptions = {
  writingMode: 'vertical-rl', spacingMode: 'aki', baseSpacing: 1, akiAnnotationOverflow: 'wrap', akiReadingAlign: 'contextual',
  kanjiFontFamily: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", serif',
  annotationFontFamily: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", serif',
  kanjiFontSize: 32, annotationScale: .5, kaeritenScale: .5,
  columnHeight: 560, columnGap: 24, annotationGap: .25, collisionTolerance: .05, letterSpacing: 0,
  lineStartBracket: 'hang', hangOpeningBrackets: true, shiftOverflowOkurigana: true, groupRubyAlign: 'space-between', furiganaAlign: 'shoulder', okuriganaOffset: .5, collisionPolicy: 'strict', traditionalOverhang: .25,
  kaeritenGlyphs: 'source', overflowPolicy: 'expand',
};
export function resolveOptions(input: Partial<LayoutOptions>): LayoutOptions {
  const o = { ...defaultOptions, ...input };
  for (const key of ['kanjiFontSize', 'annotationScale', 'kaeritenScale', 'columnHeight'] as const) if (!Number.isFinite(o[key]) || o[key] <= 0) throw new RangeError(`${key} 必须为正数`);
  for (const key of ['baseSpacing', 'columnGap', 'annotationGap', 'collisionTolerance', 'letterSpacing', 'traditionalOverhang'] as const) if (!Number.isFinite(o[key]) || o[key] < 0) throw new RangeError(`${key} 不得为负数`);
  if (!['vertical-rl', 'horizontal-tb'].includes(o.writingMode)) throw new RangeError('不支持的书写方向');
  if (!['wrap', 'report'].includes(o.akiAnnotationOverflow)) throw new RangeError('不支持的疏排注音溢出策略');
  if (!['space-around', 'space-between', 'start', 'center', 'end'].includes(o.groupRubyAlign)) throw new RangeError('不支持的整体注音对齐策略');
  if (!['contextual', 'configured'].includes(o.akiReadingAlign)) throw new RangeError('不支持的疏排读音定位策略');
  if (!['hang', 'half', 'full'].includes(o.lineStartBracket)) throw new RangeError('不支持的行首开括号方式');
  if (typeof o.hangOpeningBrackets !== 'boolean') throw new TypeError('行首正文齐头开关必须为布尔值');
  if (typeof o.shiftOverflowOkurigana !== 'boolean') throw new TypeError('送假名右移开关必须为布尔值');
  if (input.lineStartBracket === undefined) o.lineStartBracket = o.hangOpeningBrackets ? 'hang' : 'half';
  o.hangOpeningBrackets = o.lineStartBracket === 'hang';
  return o;
}

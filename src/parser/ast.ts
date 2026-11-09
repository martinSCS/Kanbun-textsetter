export interface SourceRange { start: number; end: number }
export interface Diagnostic { code: string; message: string; severity: 'error' | 'warning'; sourceRange: SourceRange }
export type AnnotationKind = 'furigana' | 'okurigana' | 'rereadFurigana' | 'rereadOkurigana' | 'kaeriten' | 'link';
export interface Annotation { kind: AnnotationKind; text: string; sourceRange: SourceRange; raw: string }
export interface KanbunUnit {
  type: 'kanji' | 'group' | 'punctuation' | 'symbol' | 'whitespace' | 'unknown';
  text: string; children?: KanbunUnit[]; annotations: Annotation[]; sourceRange: SourceRange; raw: string;
}
export interface Paragraph { type: 'paragraph'; children: KanbunUnit[]; sourceRange: SourceRange; separator: string }
export interface KanbunDocument { type: 'document'; source: string; children: Paragraph[]; diagnostics: Diagnostic[] }
export const graphemes = (text: string): string[] => Array.from(new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(text), s => s.segment);

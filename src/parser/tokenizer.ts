import type { AnnotationKind, SourceRange } from './ast.js';
export const delimiters: Record<string, { close: string; kind: AnnotationKind | 'group' }> = {
  '(': { close: ')', kind: 'furigana' }, '{': { close: '}', kind: 'okurigana' },
  '<': { close: '>', kind: 'rereadFurigana' }, '|': { close: '|', kind: 'rereadOkurigana' },
  '[': { close: ']', kind: 'kaeriten' }, '`': { close: '`', kind: 'group' },
};
export interface Token { type: 'text' | 'annotation' | 'group' | 'newline' | 'invalid'; text: string; raw: string; kind?: AnnotationKind; sourceRange: SourceRange; error?: string }
/** UTF-16 offsets match textarea selections; iterate grapheme clusters, never split IVS. */
export function tokenize(source: string): Token[] {
  const segments = Array.from(new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(source));
  const tokens: Token[] = [];
  for (let n = 0; n < segments.length; n++) {
    const seg = segments[n]!; const start = seg.index; const char = seg.segment;
    if (/^[\r\n]+$/.test(char)) { tokens.push({ type: 'newline', text: char, raw: char, sourceRange: { start, end: start + char.length } }); continue; }
    const delimiter = delimiters[char];
    if (delimiter) {
      let end = n + 1;
      while (end < segments.length && segments[end]!.segment !== delimiter.close && !/[\r\n]/.test(segments[end]!.segment)) end++;
      const closed = segments[end]?.segment === delimiter.close;
      const finish = closed ? segments[end]!.index + delimiter.close.length : (segments[end]?.index ?? source.length);
      const raw = source.slice(start, finish);
      const text = source.slice(start + char.length, closed ? finish - delimiter.close.length : finish);
      const nested = Object.keys(delimiters).some(d => text.includes(d) && !(delimiter.kind === 'group' && d === '['));
      tokens.push({ type: !closed || nested ? 'invalid' : delimiter.kind === 'group' ? 'group' : 'annotation', kind: delimiter.kind === 'group' ? undefined : delimiter.kind, text, raw, sourceRange: { start, end: finish }, error: !closed ? `缺少闭合标记 ${delimiter.close}` : nested ? '不支持嵌套标记；原文已保留' : undefined });
      n = closed ? end : end - 1;
    } else {
      const legacy = /[‹›«»‘’]/.test(char);
      const invalid = legacy || /[)\]}>]/.test(char);
      tokens.push({ type: invalid ? 'invalid' : 'text', text: char, raw: char, sourceRange: { start, end: start + char.length }, error: legacy ? '旧记法不再支持，请使用 <…>、|…| 或反引号分组' : invalid ? `没有对应起始标记的 ${char}` : undefined });
    }
  }
  return tokens;
}

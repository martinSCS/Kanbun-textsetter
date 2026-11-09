import type { KanbunDocument, KanbunUnit, Paragraph } from './ast.js';
import { tokenize } from './tokenizer.js';
const linkMarks = new Set(['―', '-', '‐', '㆐']);
const isHan = (s: string) => /^\p{Script=Han}/u.test(s);
const isKana = (s: string) => /^[\p{Script=Katakana}ー゙゚]+$/u.test(s);
export interface ParseOptions {
  /** Default: a reading applies to the contiguous, unannotated Han run before it.
   * Explicit `…` always sets the scope; false attaches a bare reading only to the preceding character. */
  implicitRubyGroups?: boolean;
}
export function parseKanbun(source: string, options: ParseOptions = {}): KanbunDocument {
  const doc: KanbunDocument = { type: 'document', source, children: [], diagnostics: [] };
  let paragraph: Paragraph = { type: 'paragraph', children: [], separator: '', sourceRange: { start: 0, end: 0 } };
  let current: KanbunUnit | undefined;
  for (const token of tokenize(source)) {
    if (token.type === 'newline') {
      paragraph.separator = token.raw; paragraph.sourceRange.end = token.sourceRange.end; doc.children.push(paragraph);
      paragraph = { type: 'paragraph', children: [], separator: '', sourceRange: { start: token.sourceRange.end, end: token.sourceRange.end } }; current = undefined; continue;
    }
    const unicodeMark = token.type === 'text' && /^[㆐-㆟]$/u.test(token.text);
    const link = token.type === 'text' && linkMarks.has(token.text);
    const shorthand = token.type === 'text' && isKana(token.text);
    if ((token.type === 'annotation' || unicodeMark || link || shorthand) && current) {
      if (options.implicitRubyGroups !== false && token.kind === 'furigana' && current.type === 'kanji' && !current.annotations.some(a => a.kind === 'furigana')) {
        let start = paragraph.children.length - 1;
        while (start > 0) {
          const preceding = paragraph.children[start - 1]!;
          if (preceding.type !== 'kanji' || preceding.annotations.length) break;
          start--;
        }
        if (start < paragraph.children.length - 1) {
          const run = paragraph.children.slice(start);
          current = { type: 'group', text: run.map(u => u.text).join(''), raw: run.map(u => u.raw).join(''), annotations: [...current.annotations], sourceRange: { start: run[0]!.sourceRange.start, end: current.sourceRange.end } };
          paragraph.children.splice(start, run.length, current);
        }
      }
      current.annotations.push({ kind: link ? 'link' : unicodeMark ? 'kaeriten' : shorthand ? 'okurigana' : token.kind!, text: token.text, raw: token.raw, sourceRange: token.sourceRange });
      current.raw += token.raw; current.sourceRange.end = token.sourceRange.end;
      continue;
    }
    let type: KanbunUnit['type'] = token.type === 'group' ? 'group' : isHan(token.text) ? 'kanji' : /^\s+$/u.test(token.text) ? 'whitespace' : /^\p{P}/u.test(token.text) && !link ? 'punctuation' : 'symbol';
    if (token.type === 'invalid' || token.type === 'annotation' || (token.type === 'group' && !token.text)) {
      type = 'unknown'; doc.diagnostics.push({ code: token.type === 'invalid' ? 'INVALID_MARKUP' : token.type === 'group' ? 'EMPTY_GROUP' : 'ORPHAN_ANNOTATION', message: token.error ?? (token.type === 'group' ? '整体注音组内没有文字' : '注释前没有可附着的汉字'), severity: 'error', sourceRange: token.sourceRange });
    }
    const unit: KanbunUnit = { type, text: type === 'unknown' ? token.raw : type === 'whitespace' ? '\u3000' : token.text, annotations: [], raw: token.raw, sourceRange: { ...token.sourceRange } };
    if (type === 'group' && (token.text.includes('[') || Array.from(token.text).some(char => linkMarks.has(char)))) {
      // A grouped ruby base may carry a return mark on an individual parent.
      const inner = parseKanbun(token.text, { implicitRubyGroups: false });
      const offset = token.sourceRange.start + 1;
      unit.children = inner.children[0]!.children;
      unit.text = unit.children.map(child => child.text).join('');
      for (const child of unit.children) {
        child.sourceRange = { start: child.sourceRange.start + offset, end: child.sourceRange.end + offset };
        for (const annotation of child.annotations) annotation.sourceRange = { start: annotation.sourceRange.start + offset, end: annotation.sourceRange.end + offset };
      }
      for (const diagnostic of inner.diagnostics) doc.diagnostics.push({ ...diagnostic, sourceRange: { start: diagnostic.sourceRange.start + offset, end: diagnostic.sourceRange.end + offset } });
    }
    paragraph.children.push(unit); current = type === 'kanji' || type === 'group' || token.text === '〻' ? unit : undefined;
  }
  paragraph.sourceRange.end = source.length; doc.children.push(paragraph);
  return doc;
}

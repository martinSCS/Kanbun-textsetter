import type { KanbunDocument, KanbunUnit } from './ast.js';
const brackets = { furigana: ['(', ')'], okurigana: ['{', '}'], rereadFurigana: ['<', '>'], rereadOkurigana: ['|', '|'], kaeriten: ['[', ']'], link: ['', ''] } as const;
/** Lossless mode reflects AST raw nodes, not an unrelated copy of document.source. */
export function serializeKanbun(doc: KanbunDocument, mode: 'lossless' | 'canonical' = 'lossless'): string {
  const serializeUnit = (u: KanbunUnit): string => {
    if (mode === 'lossless') return u.raw;
    const base = u.type === 'group' ? '`' + (u.children ? u.children.map(serializeUnit).join('') : u.text) + '`' : u.text;
    return base + u.annotations.map(a => { const [open, close] = brackets[a.kind]; return `${open}${a.text}${close}`; }).join('');
  };
  return doc.children.map(p => p.children.map(serializeUnit).join('') + p.separator).join('');
}

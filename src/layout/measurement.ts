import { punctuationClass } from './punctuation.js';
import type { LayoutRect, WritingMode } from './geometry.js';
export interface TextStyle { fontFamily: string; fontSize: number; writingMode: WritingMode; letterSpacing: number; compound?: boolean; halfWidth?: boolean }
export interface MeasurementRequest { text: string; style: TextStyle }
export interface TextMeasurement { inlineSize: number; blockSize: number; textBox?: LayoutRect }
export interface TextMeasurer { measureBatch(requests: MeasurementRequest[]): Promise<TextMeasurement[]> }
export function applyTextStyle(el: HTMLElement, style: TextStyle): void {
  Object.assign(el.style, { fontFamily: style.fontFamily, fontSize: `${style.fontSize}px`, writingMode: style.compound ? 'horizontal-tb' : style.writingMode, textOrientation: 'upright', lineHeight: '1', letterSpacing: `${style.letterSpacing}px`, whiteSpace: 'pre', fontKerning: 'none', fontWeight: '400', fontFeatureSettings: style.halfWidth ? (style.writingMode === 'vertical-rl' ? '"vhal" 1' : '"halt" 1') : 'normal' });
}
const keyOf = (r: MeasurementRequest) => JSON.stringify(r);
/** DOM line boxes + text Range bounds, measured with final renderer styles.
 * Font resolution, vertical substitutions and fallback are delegated to the same browser.
 * These are conservative typographic bounds, not outline-exact ink bounds. */
export class DOMTextMeasurer implements TextMeasurer {
  private cache = new Map<string, TextMeasurement>();
  clear(): void { this.cache.clear(); }
  async measureBatch(requests: MeasurementRequest[]): Promise<TextMeasurement[]> {
    const missing = new Map<string, MeasurementRequest>();
    requests.forEach(r => { if (!this.cache.has(keyOf(r))) missing.set(keyOf(r), r); });
    if (missing.size) {
      await Promise.all([...missing.values()].map(r => document.fonts.load(`${r.style.fontSize}px ${r.style.fontFamily}`, r.text)));
      await document.fonts.ready;
      const host = document.createElement('div');
      Object.assign(host.style, { position: 'fixed', left: '-100000px', top: '0', visibility: 'hidden', contain: 'layout style', pointerEvents: 'none' });
      const entries = [...missing].map(([key, request]) => {
        const el = document.createElement('span'); applyTextStyle(el, request.style); el.style.display = 'inline-block'; el.textContent = request.text || '\u200b'; host.append(el); return { key, request, el };
      });
      document.body.append(host); // All writes precede all geometry reads.
      try {
        for (const { key, request, el } of entries) {
          const rect = el.getBoundingClientRect();
          const range = document.createRange(); range.selectNodeContents(el);
          const glyph = range.getBoundingClientRect();
          const left = Math.min(0, glyph.left - rect.left), top = Math.min(0, glyph.top - rect.top);
          const width = Math.max(rect.width, glyph.right - rect.left) - left;
          const height = Math.max(rect.height, glyph.bottom - rect.top) - top;
          const textBox = { x: -left, y: -top, width: rect.width, height: rect.height };
          const vertical = request.style.writingMode === 'vertical-rl';
          const measurement: TextMeasurement = vertical ? { inlineSize: height, blockSize: width, textBox } : { inlineSize: width, blockSize: height, textBox };
          // WebKit currently ignores vhal in vertical shaping. A Japanese full
          // punctuation glyph has a half-em spacing side: before an opening
          // bracket, after a stop/closing bracket. Remove that spacing from the
          // advance, preserving the full glyph frame (no clipping or scaling).
          if (request.style.halfWidth && punctuationClass(request.text) && measurement.inlineSize > request.style.fontSize * .75 + request.style.letterSpacing) {
            const spacing = request.style.fontSize / 2;
            measurement.inlineSize -= spacing;
            if (punctuationClass(request.text) === 'open') {
              if (vertical) textBox.y -= spacing; else textBox.x -= spacing;
            }
          }
          this.cache.set(key, measurement);
        }
      } finally { host.remove(); }
    }
    return requests.map(r => ({ ...this.cache.get(keyOf(r))! }));
  }
}

import { parseKanbun } from '../parser/parser.js';
import { layoutKanbun, type KanbunLayout } from '../layout/engine.js';
import { DOMTextMeasurer } from '../layout/measurement.js';
import type { LayoutOptions } from '../layout/options.js';
import { renderKanbun, type RenderOptions } from './renderer.js';
export interface ViewerOptions {
  source: string; layout?: Partial<LayoutOptions>; debug?: RenderOptions;
  /** Fit the inline extent to the host height (vertical) or width (horizontal). */
  autoColumnHeight?: boolean;
  onLayout?: (layout: KanbunLayout) => void; onError?: (error: unknown) => void;
}
/** Optional framework-free controller; disconnect when the host is unmounted. */
export class KanbunViewer {
  private measurer = new DOMTextMeasurer();
  private observer: ResizeObserver; private run = 0; private disposed = false;
  private frame = 0; private sizeKey = '';
  private fontChanged = () => { this.measurer.clear(); this.schedule(); };
  constructor(private host: HTMLElement, private config: ViewerOptions) {
    this.observer = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect; if (!r) return;
      const key = `${r.width}/${r.height}`;
      if (key !== this.sizeKey) { this.sizeKey = key; if (this.config.autoColumnHeight) this.schedule(); }
    });
    this.observer.observe(host); document.fonts.addEventListener('loadingdone', this.fontChanged); this.schedule();
  }
  /** Replace configuration so omitted options return to their defaults. */
  setConfig(config: ViewerOptions): void { this.config = { ...config }; this.schedule(); }
  setSource(source: string): void { this.config = { ...this.config, source }; this.schedule(); }
  setOptions(options: Partial<LayoutOptions>): void { this.config = { ...this.config, layout: { ...this.config.layout, ...options } }; this.schedule(); }
  private schedule(): void {
    this.run++; cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => { void this.update().catch(error => { this.config.onError?.(error); }); });
  }
  async update(): Promise<KanbunLayout | undefined> {
    cancelAnimationFrame(this.frame);
    const generation = ++this.run; if (this.disposed) return;
    const options = { ...this.config.layout };
    if (this.config.autoColumnHeight) {
      const size = options.kanjiFontSize ?? 32;
      options.columnHeight = Math.max(size, (options.writingMode === 'horizontal-tb' ? this.host.clientWidth : this.host.clientHeight) - size * 2);
    }
    const layout = await layoutKanbun(parseKanbun(this.config.source), options, this.measurer);
    if (generation !== this.run || this.disposed) return;
    renderKanbun(layout, this.host, this.config.debug); this.config.onLayout?.(layout); return layout;
  }
  destroy(): void { this.disposed = true; this.run++; cancelAnimationFrame(this.frame); this.observer.disconnect(); document.fonts.removeEventListener('loadingdone', this.fontChanged); }
}

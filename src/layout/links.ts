import type { KanbunLayoutUnit } from './engine.js';
import type { LayoutOptions } from './options.js';
/** Link strokes use main glyph frames as their anchors, never font dash metrics. */
export function positionLinks(units: KanbunLayoutUnit[], options: LayoutOptions): void {
  for (let index = 0; index < units.length; index++) {
    const unit = units[index]!, bases = unit.parts.filter(p => p.kind === 'base');
    for (const link of unit.parts.filter(p => p.kind === 'link')) {
      const anchor = link.anchorIndex ?? bases.length - 1, parent = bases[anchor];
      if (!parent) continue;
      const following = bases[anchor + 1] ?? units.slice(index + 1).find(u => u.column === unit.column && u.parts.some(p => p.kind === 'base'))?.parts.find(p => p.kind === 'base');
      if (!following) continue;
      const start = parent.rect.i + parent.rect.inlineSize, gap = Math.max(0, following.rect.i - start);
      const length = options.spacingMode === 'aki' ? gap : Math.min(options.kanjiFontSize / 2, gap);
      link.rect.inlineSize = length;
      link.rect.i = start + (gap - length) / 2;
      link.rect.b = parent.rect.b + (parent.rect.blockSize - link.rect.blockSize) / 2;
    }
  }
}

import { serializeKanbun } from '../parser/serializer.js';
import { physicalRect, type LayoutRect } from '../layout/geometry.js';
import type { KanbunLayout } from '../layout/engine.js';
import { punctuationClass } from '../layout/punctuation.js';
import { applyTextStyle } from '../layout/measurement.js';
export interface RenderOptions { showBoxes?: boolean; showUnits?: boolean; showCollisions?: boolean }
function position(el: HTMLElement, r: LayoutRect): void {
  Object.assign(el.style, { position: 'absolute', left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` });
}
/** Semantic DOM order follows AST order even when columns progress to the left. */
export function renderKanbun(layout: KanbunLayout, container: HTMLElement, options: RenderOptions = {}): HTMLElement {
  const root = document.createElement('div'); root.className = 'kanbun-page'; root.lang = 'ja'; root.setAttribute('aria-label', '漢文訓読');
  root.style.width = `${layout.width}px`; root.style.height = `${layout.height}px`;
  root.dataset.boxes = String(!!options.showBoxes); root.dataset.units = String(!!options.showUnits);
  let parent: typeof layout.units[number] | undefined;
  for (const unit of layout.units) {
    if (!punctuationClass(unit.node.text)) parent = unit;
    const wrapper = document.createElement('div'); wrapper.className = 'kanbun-unit'; wrapper.dataset.unitType = unit.node.type; wrapper.dataset.sourceIndex = String(unit.sourceIndex); wrapper.dataset.column = String(unit.column); wrapper.dataset.extraSpacing = String(unit.extraSpacing);
    wrapper.title = `${unit.node.raw} · 字间扩张 ${unit.extraSpacing.toFixed(2)}px`;
    position(wrapper, unit.bounds);
    const annotationGroups = new Map<string, { el: HTMLDivElement; bounds: LayoutRect }>();
    for (const part of unit.parts) {
      if (!part.annotationKind || annotationGroups.has(part.annotationKind)) continue;
      const members = unit.parts.filter(p => p.annotationKind === part.annotationKind);
      const x = Math.min(...members.map(p => p.physical.x)), y = Math.min(...members.map(p => p.physical.y));
      const bounds = { x, y, width: Math.max(...members.map(p => p.physical.x + p.physical.width)) - x, height: Math.max(...members.map(p => p.physical.y + p.physical.height)) - y };
      const el = document.createElement('div');
      el.className = `kanbun-annotation-group kanbun-${part.annotationKind.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`;
      el.dataset.annotationKind = part.annotationKind;
      if (members.some(p => p.nextHeadAligned)) el.dataset.nextHeadAligned = 'true';
      position(el, { ...bounds, x: x - unit.bounds.x, y: y - unit.bounds.y });
      annotationGroups.set(part.annotationKind, { el, bounds });
    }
    let baseIndex = 0;
    for (const part of unit.parts) {
      const el = document.createElement(part.kind === 'kaeriten' ? 'div' : 'span'); el.className = `kanbun-part kanbun-${part.kind}`; el.dataset.kind = part.kind; if (part.annotationLine !== undefined) el.dataset.annotationLine = String(part.annotationLine);
      if (part.annotationKind) el.dataset.annotationKind = part.annotationKind;
      if (part.kind === 'base') el.dataset.baseIndex = String(baseIndex++);
      if (part.parentOverlap !== undefined) { el.dataset.parentOverlap = String(part.parentOverlap); el.dataset.overlapParentIndex = String(part.overlapParentIndex); }
      if (part.compoundGroup !== undefined) el.dataset.compoundGroup = `${unit.sourceIndex}:${part.compoundGroup}`;
      if (part.kind === 'kaeriten') el.dataset.returnCell = String(unit.sourceIndex);
      if (part.kind === 'punctuation' && punctuationClass(unit.node.text) === 'stop' && parent?.column === unit.column && parent.parts.some(p => p.kind === 'kaeriten')) el.dataset.sharesReturnCell = String(parent.sourceIndex);
      const text = document.createElement('span'); text.className = 'kanbun-text';
      applyTextStyle(text, part.style); text.textContent = part.text;
      if (part.textBox) position(text, part.textBox);
      el.append(text);
      const group = part.annotationKind ? annotationGroups.get(part.annotationKind) : undefined;
      const origin = group?.bounds ?? unit.bounds;
      position(el, { ...part.physical, x: part.physical.x - origin.x, y: part.physical.y - origin.y });
      if (group) {
        if (!group.el.parentElement) wrapper.append(group.el);
        group.el.append(el);
      } else wrapper.append(el);
    }
    if (options.showUnits && unit.extraSpacing > .05) {
      const label = document.createElement('span'); label.className = 'kanbun-spacing-label'; label.textContent = `+${unit.extraSpacing.toFixed(1)}`; label.setAttribute('aria-hidden', 'true'); wrapper.append(label);
    }
    root.append(wrapper);
  }
  if (options.showCollisions) for (const collision of layout.collisions) {
    const el = document.createElement('span'); el.className = 'kanbun-collision'; el.setAttribute('aria-hidden', 'true'); position(el, physicalRect(collision.rect, layout.width, layout.padding, layout.options.writingMode)); root.append(el);
  }
  // Normal selection remains native. This separate command returns the exact markup.
  root.addEventListener('copy', e => {
    e.clipboardData?.setData('application/x-kanbun', serializeKanbun(layout.document));
  });
  container.replaceChildren(root);
  return root;
}
export function copyKanbunSource(layout: KanbunLayout): Promise<void> { return navigator.clipboard.writeText(serializeKanbun(layout.document)); }
/** Post-render calibration check: final DOM geometry must match the solved boxes. */
export function verifyRenderedGeometry(layout: KanbunLayout, root: HTMLElement, tolerance = .75): string[] {
  const errors: string[] = [], origin = root.getBoundingClientRect();
  const elements = [...root.querySelectorAll<HTMLElement>('.kanbun-part')];
  layout.units.flatMap(u => u.parts).forEach((part, index) => {
    const el = elements[index]; if (!el) { errors.push(`缺失元素 ${index}`); return; }
    const r = el.getBoundingClientRect(), target = part.physical;
    if (Math.abs(r.x - origin.x - target.x) > tolerance || Math.abs(r.y - origin.y - target.y) > tolerance || Math.abs(r.width - target.width) > tolerance || Math.abs(r.height - target.height) > tolerance) errors.push(`元素 ${index} 的 DOM 框与布局不一致`);
    if (part.kind === 'link') return; // CSS stroke geometry was checked above; text is retained only for copying.
    const range = document.createRange(); range.selectNodeContents(el); const glyph = range.getBoundingClientRect();
    // Half-width punctuation can retain a full font frame with an empty spacing
    // half. Check its measured text frame; the outer box is its occupied cell.
    const frame = part.kind === 'punctuation' ? el.querySelector('.kanbun-text')!.getBoundingClientRect() : r;
    if (glyph.left < frame.left - tolerance || glyph.top < frame.top - tolerance || glyph.right > frame.right + tolerance || glyph.bottom > frame.bottom + tolerance) errors.push(`元素 ${index} 的文本越出测量框`);
  });
  return errors;
}

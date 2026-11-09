/** i: inline progression; b: block progression (leftward in vertical-rl). */
export interface LogicalRect { i: number; b: number; inlineSize: number; blockSize: number }
export interface LayoutRect { x: number; y: number; width: number; height: number }
export type WritingMode = 'vertical-rl' | 'horizontal-tb';
export function physicalRect(r: LogicalRect, width: number, pad: number, mode: WritingMode): LayoutRect {
  return mode === 'vertical-rl' ? { x: width - pad - r.b - r.blockSize, y: pad + r.i, width: r.blockSize, height: r.inlineSize } : { x: pad + r.i, y: pad + r.b, width: r.inlineSize, height: r.blockSize };
}
export function intersects(a: LogicalRect, b: LogicalRect, epsilon = .05): boolean {
  return a.i < b.i + b.inlineSize - epsilon && b.i < a.i + a.inlineSize - epsilon && a.b < b.b + b.blockSize - epsilon && b.b < a.b + a.blockSize - epsilon;
}
export function union(rects: LogicalRect[]): LogicalRect {
  const i = Math.min(...rects.map(r => r.i)), b = Math.min(...rects.map(r => r.b));
  return { i, b, inlineSize: Math.max(...rects.map(r => r.i + r.inlineSize)) - i, blockSize: Math.max(...rects.map(r => r.b + r.blockSize)) - b };
}

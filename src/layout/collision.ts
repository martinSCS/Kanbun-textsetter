import { intersects, type LogicalRect } from './geometry.js';
export interface Collision { first: number; second: number; rect: LogicalRect }
export interface CollisionItem { rect: LogicalRect; unit: number; kind?: string; compoundGroup?: number; parentOverlap?: number; overlapParentIndex?: number; baseIndex?: number; sharedStopOwner?: number }
export function tolerantPair(a?: string, b?: string): boolean {
  return a !== 'link' && b !== 'link' && (a === 'reading' || a === 'reread' || b === 'reading' || b === 'reread');
}
export function hasForbiddenOverlap(a: CollisionItem, b: CollisionItem, tolerance = 0): boolean {
  if (!intersects(a.rect, b.rect)) return false;
  if (a.unit === b.unit && ((a.kind === 'kaeriten' && b.kind === 'base' && permitsParentOverlap(a,b)) || (b.kind === 'kaeriten' && a.kind === 'base' && permitsParentOverlap(b,a)))) return false;
  if (a.kind === 'kaeriten' && b.kind === 'kaeriten' && a.unit === b.unit && a.compoundGroup !== undefined && a.compoundGroup === b.compoundGroup) return false;
  if ((a.kind === 'punctuation' && b.kind === 'kaeriten' && a.sharedStopOwner === b.unit) || (b.kind === 'punctuation' && a.kind === 'kaeriten' && b.sharedStopOwner === a.unit)) return false;
  const inline = Math.min(a.rect.i+a.rect.inlineSize,b.rect.i+b.rect.inlineSize)-Math.max(a.rect.i,b.rect.i);
  const block = Math.min(a.rect.b+a.rect.blockSize,b.rect.b+b.rect.blockSize)-Math.max(a.rect.b,b.rect.b);
  return !tolerantPair(a.kind,b.kind) || Math.min(inline,block) > tolerance + .05;
}
export function findCollisions(parts: CollisionItem[], tolerance = 0): Collision[] {
  const collisions: Collision[] = [];
  const sorted = [...parts].sort((a,b) => a.rect.b-b.rect.b);
  let active: CollisionItem[] = [];
  for (const part of sorted) {
    active = active.filter(p => p.rect.b+p.rect.blockSize > part.rect.b+.05);
    for (const other of active) if (hasForbiddenOverlap(part,other,tolerance)) {
      const i = Math.max(part.rect.i,other.rect.i), b = Math.max(part.rect.b,other.rect.b);
      collisions.push({ first: other.unit, second: part.unit, rect: { i,b,inlineSize: Math.min(part.rect.i+part.rect.inlineSize,other.rect.i+other.rect.inlineSize)-i,blockSize: Math.min(part.rect.b+part.rect.blockSize,other.rect.b+other.rect.blockSize)-b } });
    }
    active.push(part);
  }
  return collisions;
}
/** Solve all forbidden pairs at once. Moving only forward makes a single max exact. */
export function requiredOrigin(current: (LogicalRect & { kind?: string })[], preceding: (LogicalRect & { kind?: string })[], minimum: number, gap: number, tolerance = 0): number {
  let origin = minimum;
  for (const a of preceding) for (const b of current) {
    const allowance = tolerantPair(a.kind,b.kind) ? tolerance : 0;
    const overlap = Math.min(a.b+a.blockSize,b.b+b.blockSize)-Math.max(a.b,b.b);
    if (overlap > allowance+.05) origin = Math.max(origin, a.i+a.inlineSize+gap-b.i-allowance);
  }
  return origin;
}

/** Only the explicitly identified parent can share the small 一レ overhang. */
export function permitsParentOverlap(mark: { rect: LogicalRect; parentOverlap?: number; overlapParentIndex?: number }, base: { rect: LogicalRect; baseIndex?: number }): boolean {
  if (mark.parentOverlap === undefined || mark.overlapParentIndex !== base.baseIndex) return false;
  const depth = Math.min(mark.rect.i + mark.rect.inlineSize, base.rect.i + base.rect.inlineSize) - Math.max(mark.rect.i, base.rect.i);
  return mark.rect.i >= base.rect.i + base.rect.inlineSize - mark.parentOverlap - .05 && depth <= mark.parentOverlap + .05;
}

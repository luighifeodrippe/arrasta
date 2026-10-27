export interface Point { x: number; y: number }
export interface Rect extends Point { width: number; height: number }
export interface SnapTargets { x: number[]; y: number[] }

/** Coordenadas em pixels do slide, independentes do zoom. */
export function snapTargets(height: number, others: Rect[]): SnapTargets {
  return {
    x: [64, 540, 1016, ...others.flatMap((r) => [r.x, r.x + r.width / 2, r.x + r.width])],
    y: [height / 2, (height - 1080) / 2, (height + 1080) / 2, ...others.flatMap((r) => [r.y, r.y + r.height / 2, r.y + r.height])],
  };
}

/** Menor correção entre todas as bordas/centros e todos os alvos. Empates são estáveis. */
export function nearestSnap(edges: number[], targets: number[], threshold: number): { delta: number; line: number } | null {
  let best: { delta: number; line: number } | null = null;
  for (const edge of edges) for (const line of targets) {
    const delta = line - edge;
    if (Math.abs(delta) < threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, line };
  }
  return best;
}

/** Conserva até 40 px de cada eixo dentro do card, inclusive para peças pequenas. */
export function clampOffset(base: Rect, offset: Point, width: number, height: number): Point {
  const visibleX = Math.min(40, base.width);
  const visibleY = Math.min(40, base.height);
  return {
    x: Math.min(width - visibleX - base.x, Math.max(visibleX - base.width - base.x, offset.x)),
    y: Math.min(height - visibleY - base.y, Math.max(visibleY - base.height - base.y, offset.y)),
  };
}

export function snapOffset(base: Rect, desired: Point, targets: SnapTargets, scale: number, width: number, height: number, bypass = false) {
  const bounded = clampOffset(base, desired, width, height);
  const threshold = 6 / Math.max(scale, 0.001);
  const x = bypass ? null : nearestSnap([base.x + bounded.x, base.x + bounded.x + base.width / 2, base.x + bounded.x + base.width], targets.x, threshold);
  const y = bypass ? null : nearestSnap([base.y + bounded.y, base.y + bounded.y + base.height / 2, base.y + bounded.y + base.height], targets.y, threshold);
  const offset = clampOffset(base, { x: bounded.x + (x?.delta ?? 0), y: bounded.y + (y?.delta ?? 0) }, width, height);
  return {
    offset,
    x: x && Math.abs(offset.x - bounded.x - x.delta) < 0.001 ? x.line : null,
    y: y && Math.abs(offset.y - bounded.y - y.delta) < 0.001 ? y.line : null,
  };
}

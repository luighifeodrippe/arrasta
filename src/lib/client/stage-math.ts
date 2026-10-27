/** Matemática do palco em pixels de tela, sem transformar os ancestrais dos cards. */
export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 2.5;
export const DEFAULT_ZOOM = 0.72;
export const clampZoom = (zoom: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
export const stepZoom = (zoom: number, direction: 1 | -1) => clampZoom(zoom * 1.25 ** direction);

export function cardWidth(height: number, zoom: number, ratio: number, layout: "row" | "column", boxWidth: number) {
  return layout === "column"
    ? Math.max(0, Math.min(Math.max(440 * zoom / DEFAULT_ZOOM, 160), boxWidth - 48))
    : Math.max(0, height * zoom / ratio);
}

export interface Point { x: number; y: number }
export interface Rect { left: number; top: number; width: number; height: number }
export function selectionRect(a: Point, b: Point): Rect {
  return { left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}
export function intersects(a: Rect, b: Rect) {
  return a.left <= b.left + b.width && a.left + a.width >= b.left && a.top <= b.top + b.height && a.top + a.height >= b.top;
}
/** Fração do card sob o ponteiro; pode extrapolar o card quando o cursor está no vazio. */
export function zoomAnchor(pointer: Point, before: Rect): Point {
  return { x: (pointer.x - before.left) / before.width, y: (pointer.y - before.top) / before.height };
}
export function anchoredScroll(scroll: Point, pointer: Point, anchor: Point, after: Rect): Point {
  return { x: scroll.x + after.left + anchor.x * after.width - pointer.x, y: scroll.y + after.top + anchor.y * after.height - pointer.y };
}

/** Espaço extra para a âncora; content é a extensão natural, antes do mínimo do scrollport. */
export function anchorRoom(scroll: Point, content: Point, viewport: Point) {
  return {
    left: Math.max(0, -scroll.x),
    top: Math.max(0, -scroll.y),
    right: scroll.x > 0 ? Math.max(0, scroll.x - (content.x - viewport.x)) : 0,
    bottom: scroll.y > 0 ? Math.max(0, scroll.y - (content.y - viewport.y)) : 0,
  };
}

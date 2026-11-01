import type { Element, ElementType, Vec2 } from "./model";

export const DRAW_TYPES = new Set<ElementType>(["path", "ellipse", "line"]);

export function strokeOf(el: Pick<Element, "stroke">) {
  return el.stroke && el.stroke !== "transparent" ? el.stroke : "";
}

export function strokeWidthOf(el: Pick<Element, "strokeWidth">) {
  return el.strokeWidth ?? 0;
}

export function fillOf(el: Pick<Element, "fill">) {
  return !el.fill || el.fill === "transparent" ? "none" : el.fill;
}

export function boxFromDrag(x1: number, y1: number, x2: number, y2: number, min = 4) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(min, Math.round(Math.abs(x2 - x1))),
    height: Math.max(min, Math.round(Math.abs(y2 - y1))),
  };
}

export function boundsOf(points: Vec2[]) {
  if (!points.length) return { x: 0, y: 0, width: 1, height: 1 };
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = minX;
  let maxY = minY;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

export function normalizeToBox(points: Vec2[], box: { x: number; y: number; width: number; height: number }): Vec2[] {
  const w = box.width || 1;
  const h = box.height || 1;
  return points.map((p) => ({ x: (p.x - box.x) / w, y: (p.y - box.y) / h }));
}

export function denormalize(points: Vec2[], width: number, height: number): Vec2[] {
  return points.map((p) => ({ x: p.x * width, y: p.y * height }));
}

/** Drop vertices closer than `minDist` so freehand paths stay compact. */
export function thinPoints(points: Vec2[], minDist = 2): Vec2[] {
  if (points.length < 3) return points;
  const out: Vec2[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1];
    const p = points[i];
    if (Math.hypot(p.x - prev.x, p.y - prev.y) >= minDist) out.push(p);
  }
  out.push(points[points.length - 1]);
  return out;
}

export function pathFromFreehand(points: Vec2[], min = 8) {
  const thinned = thinPoints(points);
  const raw = boundsOf(thinned);
  const box = {
    x: Math.round(raw.x),
    y: Math.round(raw.y),
    width: Math.max(min, Math.round(raw.width)),
    height: Math.max(min, Math.round(raw.height)),
  };
  return { ...box, points: normalizeToBox(thinned, box) };
}

export function lineFromDrag(x1: number, y1: number, x2: number, y2: number, min = 8) {
  const box = boxFromDrag(x1, y1, x2, y2, min);
  return {
    ...box,
    points: normalizeToBox(
      [
        { x: x1, y: y1 },
        { x: x2, y: y2 },
      ],
      box,
    ),
  };
}

export function polylineD(points: Vec2[] | undefined, width: number, height: number) {
  if (!points?.length) return "";
  const first = points[0];
  let d = `M ${first.x * width} ${first.y * height}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x * width} ${points[i].y * height}`;
  }
  return d;
}

/** Quadratic mid-point smoothing so freehand reads as a stroke, not a polyline. */
export function smoothPathD(points: Vec2[] | undefined, width: number, height: number) {
  if (!points?.length) return "";
  if (points.length < 3) return polylineD(points, width, height);
  const px = (p: Vec2) => p.x * width;
  const py = (p: Vec2) => p.y * height;
  let d = `M ${px(points[0])} ${py(points[0])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const cx = px(points[i]);
    const cy = py(points[i]);
    const mx = (cx + px(points[i + 1])) / 2;
    const my = (cy + py(points[i + 1])) / 2;
    d += ` Q ${cx} ${cy} ${mx} ${my}`;
  }
  const last = points[points.length - 1];
  d += ` L ${px(last)} ${py(last)}`;
  return d;
}

import { cloneElement, type Element } from "./model";

export type Box = { x: number; y: number; width: number; height: number };
export type AlignEdge = "left" | "center" | "right" | "top" | "middle" | "bottom";

export function boxOf(el: Pick<Element, "x" | "y" | "width" | "height">): Box {
  return { x: el.x, y: el.y, width: el.width, height: el.height };
}

export function unionBox(els: Pick<Element, "x" | "y" | "width" | "height">[]): Box | null {
  if (!els.length) return null;
  let x1 = els[0].x;
  let y1 = els[0].y;
  let x2 = els[0].x + els[0].width;
  let y2 = els[0].y + els[0].height;
  for (let i = 1; i < els.length; i++) {
    const e = els[i];
    x1 = Math.min(x1, e.x);
    y1 = Math.min(y1, e.y);
    x2 = Math.max(x2, e.x + e.width);
    y2 = Math.max(y2, e.y + e.height);
  }
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

export function intersects(a: Box, b: Box) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function marqueeHits(els: Element[], rect: Box) {
  const box = {
    x: Math.min(rect.x, rect.x + rect.width),
    y: Math.min(rect.y, rect.y + rect.height),
    width: Math.abs(rect.width),
    height: Math.abs(rect.height),
  };
  return els.filter((el) => !el.hidden && intersects(boxOf(el), box));
}

export function toggleId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

export function moveBy(el: Element, dx: number, dy: number) {
  el.x = Math.round(el.x + dx);
  el.y = Math.round(el.y + dy);
}

export function scaleInGroup(el: Element, from: Box, to: Box) {
  const sx = (to.width || 1) / (from.width || 1);
  const sy = (to.height || 1) / (from.height || 1);
  el.x = Math.round(to.x + (el.x - from.x) * sx);
  el.y = Math.round(to.y + (el.y - from.y) * sy);
  el.width = Math.max(4, Math.round(el.width * sx));
  el.height = Math.max(4, Math.round(el.height * sy));
}

export function alignElements(els: Element[], edge: AlignEdge) {
  if (els.length < 2) return;
  const box = unionBox(els);
  if (!box) return;
  for (const el of els) {
    if (edge === "left") el.x = box.x;
    else if (edge === "right") el.x = box.x + box.width - el.width;
    else if (edge === "center") el.x = Math.round(box.x + (box.width - el.width) / 2);
    else if (edge === "top") el.y = box.y;
    else if (edge === "bottom") el.y = box.y + box.height - el.height;
    else el.y = Math.round(box.y + (box.height - el.height) / 2);
  }
}

export function distributeElements(els: Element[], axis: "x" | "y") {
  if (els.length < 3) return;
  const sorted = [...els].sort((a, b) => (axis === "x" ? a.x - b.x : a.y - b.y));
  if (axis === "x") {
    const start = sorted[0].x;
    const end = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width;
    const total = sorted.reduce((s, e) => s + e.width, 0);
    const gap = (end - start - total) / (sorted.length - 1);
    let x = start;
    for (const el of sorted) {
      el.x = Math.round(x);
      x += el.width + gap;
    }
  } else {
    const start = sorted[0].y;
    const end = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height;
    const total = sorted.reduce((s, e) => s + e.height, 0);
    const gap = (end - start - total) / (sorted.length - 1);
    let y = start;
    for (const el of sorted) {
      el.y = Math.round(y);
      y += el.height + gap;
    }
  }
}

export function copiesOffset(els: Element[], offset: number) {
  return els.map((el) => {
    const copy = cloneElement(el);
    copy.x += offset;
    copy.y += offset;
    if (!copy.name.endsWith(" copy")) copy.name = `${el.name} copy`;
    return copy;
  });
}

export function sharedValue<T>(values: T[]): T | undefined {
  if (!values.length) return undefined;
  return values.every((v) => Object.is(v, values[0])) ? values[0] : undefined;
}

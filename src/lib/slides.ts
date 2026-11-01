import type { Screen } from "./model";

export type SlideNav = "next" | "prev" | "first" | "last";

/** Arrow keys, space, page keys, and home/end — same as a typical slideshow. */
export function slideNavFromKey(key: string): SlideNav | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
    case "PageDown":
    case " ":
      return "next";
    case "ArrowLeft":
    case "ArrowUp":
    case "PageUp":
    case "Backspace":
      return "prev";
    case "Home":
      return "first";
    case "End":
      return "last";
    default:
      return null;
  }
}

/** Left third goes back; the rest of the slide advances (click-to-advance). */
export function slideNavFromClick(clientX: number, width: number): SlideNav {
  return width > 0 && clientX < width * 0.25 ? "prev" : "next";
}

export function applySlideNav(index: number, count: number, nav: SlideNav): number {
  if (count <= 0) return 0;
  switch (nav) {
    case "next":
      return Math.min(count - 1, index + 1);
    case "prev":
      return Math.max(0, index - 1);
    case "first":
      return 0;
    case "last":
      return count - 1;
  }
}

export function slideIndex(screens: Pick<Screen, "id">[], id: string | null | undefined): number {
  const i = id ? screens.findIndex((s) => s.id === id) : -1;
  return i >= 0 ? i : 0;
}

export function reorderList<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

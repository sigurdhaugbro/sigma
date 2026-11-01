"use client";

import { produce } from "immer";
import { create } from "zustand";
import { DEFAULT_GRID, clampGridSize, type GridSettings } from "./grid";
import {
  alignElements,
  copiesOffset,
  distributeElements,
  toggleId,
  type AlignEdge,
} from "./selection";
import {
  cloneElement,
  createElement,
  createScreen,
  DEVICES,
  type DeviceKind,
  type Element,
  type ElementType,
  type Project,
  type Screen,
} from "./model";

const HISTORY_LIMIT = 100;
const PASTE_OFFSET = 16;

export interface View {
  x: number;
  y: number;
  zoom: number;
}

export type EditorTool = "select" | "pen" | "rect" | "ellipse" | "line" | "text";

export interface DrawStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
}

interface EditorState {
  project: Project | null;
  screenId: string | null;
  elementId: string | null;
  elementIds: string[];
  past: Project[];
  future: Project[];
  txSnapshot: Project | null;
  view: View;
  clipboard: Element[];
  pasteCount: number;

  load: (p: Project) => void;
  mutate: (fn: (draft: Project) => void) => void;
  /** Replaces the project as a single undo step. */
  commit: (next: Project) => void;
  beginTx: () => void;
  endTx: () => void;
  undo: () => void;
  redo: () => void;
  select: (screenId: string | null, elementId?: string | null) => void;
  toggleSelect: (screenId: string, elementId: string) => void;
  setSelection: (screenId: string | null, elementIds: string[]) => void;
  setView: (v: Partial<View>) => void;

  updateElement: (id: string, fn: (el: Element) => void) => void;
  updateSelected: (fn: (el: Element) => void) => void;
  updateScreen: (id: string, fn: (s: Screen) => void) => void;
  addElement: (type: ElementType) => void;
  addScreen: (device: DeviceKind) => void;
  placeElement: (screenId: string, el: Element) => void;
  deleteSelection: () => void;
  duplicateSelection: () => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteSelection: () => void;
  nudgeSelection: (dx: number, dy: number) => void;
  alignSelection: (edge: AlignEdge) => void;
  distributeSelection: (axis: "x" | "y") => void;
  moveLayer: (dir: "up" | "down" | "top" | "bottom") => void;

  tool: EditorTool;
  drawStyle: DrawStyle;
  setTool: (tool: EditorTool) => void;
  setDrawStyle: (style: Partial<DrawStyle>) => void;
  grid: GridSettings;
  setGrid: (grid: Partial<GridSettings>) => void;
}

export function findElement(project: Project, id: string): { screen: Screen; el: Element } | null {
  for (const screen of project.screens) {
    const el = screen.elements.find((e) => e.id === id);
    if (el) return { screen, el };
  }
  return null;
}

function selectedOn(project: Project, ids: string[]) {
  const out: Element[] = [];
  for (const id of ids) {
    const found = findElement(project, id);
    if (found) out.push(found.el);
  }
  return out;
}

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
  screenId: null,
  elementId: null,
  elementIds: [],
  past: [],
  future: [],
  txSnapshot: null,
  view: { x: 80, y: 80, zoom: 0.6 },
  clipboard: [],
  pasteCount: 0,
  tool: "select",
  drawStyle: { fill: "#E5E5EA", stroke: "#111111", strokeWidth: 2 },
  grid: { ...DEFAULT_GRID },
  setTool: (tool) => set({ tool }),
  setDrawStyle: (style) => set({ drawStyle: { ...get().drawStyle, ...style } }),
  setGrid: (grid) =>
    set({
      grid: {
        ...get().grid,
        ...grid,
        size: grid.size !== undefined ? clampGridSize(grid.size) : get().grid.size,
      },
    }),

  load: (p) => set({ project: p, past: [], future: [], screenId: p.startScreenId, elementId: null, elementIds: [], pasteCount: 0 }),

  mutate: (fn) => {
    const { project, txSnapshot, past } = get();
    if (!project) return;
    const next = produce(project, (d) => {
      fn(d);
      d.updatedAt = Date.now();
    });
    if (next === project) return;
    if (txSnapshot) set({ project: next });
    else set({ project: next, past: [...past, project].slice(-HISTORY_LIMIT), future: [] });
  },

  commit: (next) => {
    const { project, past } = get();
    if (!project) return;
    set({ project: { ...next, updatedAt: Date.now() }, past: [...past, project].slice(-HISTORY_LIMIT), future: [], ...validSelection(next, get()) });
  },

  beginTx: () => set({ txSnapshot: get().project }),
  endTx: () => {
    const { txSnapshot, project, past } = get();
    if (txSnapshot && project && txSnapshot !== project) {
      set({ past: [...past, txSnapshot].slice(-HISTORY_LIMIT), future: [], txSnapshot: null });
    } else set({ txSnapshot: null });
  },

  undo: () => {
    const { past, project, future } = get();
    if (!past.length || !project) return;
    const prev = past[past.length - 1];
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future], ...validSelection(prev, get()) });
  },
  redo: () => {
    const { past, project, future } = get();
    if (!future.length || !project) return;
    const next = future[0];
    set({ project: next, past: [...past, project], future: future.slice(1), ...validSelection(next, get()) });
  },

  select: (screenId, elementId = null) => set({ screenId, elementId, elementIds: elementId ? [elementId] : [] }),
  toggleSelect: (screenId, elementId) => {
    const next = toggleId(get().screenId === screenId ? get().elementIds : [], elementId);
    set({ screenId, elementIds: next, elementId: next.at(-1) ?? null });
  },
  setSelection: (screenId, elementIds) => set({ screenId, elementIds, elementId: elementIds.at(-1) ?? null }),
  setView: (v) => set({ view: { ...get().view, ...v } }),

  updateElement: (id, fn) =>
    get().mutate((d) => {
      const found = findElement(d, id);
      if (found) fn(found.el);
    }),
  updateSelected: (fn) => {
    const ids = get().elementIds;
    if (!ids.length) return;
    get().mutate((d) => {
      for (const id of ids) {
        const found = findElement(d, id);
        if (found) fn(found.el);
      }
    });
  },
  updateScreen: (id, fn) =>
    get().mutate((d) => {
      const s = d.screens.find((x) => x.id === id);
      if (s) fn(s);
    }),

  addElement: (type) => {
    const { project, screenId } = get();
    if (!project) return;
    const screen = project.screens.find((s) => s.id === screenId) ?? project.screens[0];
    if (!screen) return;
    const el = createElement(type);
    const fullWidth = ["navbar", "tabbar", "statusbar", "listrow", "messagelist", "mactitlebar"].includes(type);
    if (fullWidth) el.width = screen.width;
    if (type === "statusbar" || type === "mactitlebar") el.y = 0;
    else if (type === "navbar") el.y = screen.device === "mac" ? 0 : 54;
    else if (type === "tabbar") el.y = screen.height - el.height;
    else {
      el.x = fullWidth ? 0 : Math.round((screen.width - el.width) / 2);
      el.y = Math.round((screen.height - el.height) / 2);
    }
    if (screen.device === "mac" && type === "text") el.fontSize = 13;
    get().mutate((d) => {
      d.screens.find((s) => s.id === screen.id)!.elements.push(el);
    });
    set({ screenId: screen.id, elementId: el.id, elementIds: [el.id], tool: "select" });
  },

  placeElement: (screenId, el) => {
    const { project } = get();
    if (!project?.screens.some((s) => s.id === screenId)) return;
    get().mutate((d) => {
      d.screens.find((s) => s.id === screenId)!.elements.push(el);
    });
    set({ screenId, elementId: el.id, elementIds: [el.id] });
  },

  addScreen: (device) => {
    const { project } = get();
    if (!project) return;
    const maxX = Math.max(0, ...project.screens.map((s) => s.x + s.width));
    const screen = createScreen(device, { x: project.screens.length ? maxX + 100 : 0, y: 0, name: `${DEVICES[device].label} ${project.screens.length + 1}` });
    if (device === "iphone" || device === "ipad") screen.elements.push(createElement("statusbar", { width: screen.width }));
    else if (device === "mac") screen.elements.push(createElement("mactitlebar", { width: screen.width, props: { title: screen.name } }));
    get().mutate((d) => {
      d.screens.push(screen);
    });
    set({ screenId: screen.id, elementId: null, elementIds: [] });
  },

  deleteSelection: () => {
    const { elementIds, screenId, project } = get();
    if (!project) return;
    if (elementIds.length) {
      const drop = new Set(elementIds);
      get().mutate((d) => {
        for (const s of d.screens) s.elements = s.elements.filter((e) => !drop.has(e.id));
      });
      set({ elementId: null, elementIds: [] });
    } else if (screenId && project.screens.length > 1) {
      get().mutate((d) => {
        d.screens = d.screens.filter((s) => s.id !== screenId);
        if (d.startScreenId === screenId) d.startScreenId = d.screens[0].id;
      });
      set({ screenId: null, elementId: null, elementIds: [] });
    }
  },

  duplicateSelection: () => {
    const { elementIds, screenId, project } = get();
    if (!project) return;
    if (elementIds.length) {
      const originals = selectedOn(project, elementIds);
      if (!originals.length) return;
      const copies = copiesOffset(originals, PASTE_OFFSET);
      const screen = findElement(project, originals[0].id)!.screen;
      get().mutate((d) => {
        const s = d.screens.find((x) => x.id === screen.id)!;
        s.elements.push(...copies);
      });
      set({ screenId: screen.id, elementIds: copies.map((e) => e.id), elementId: copies.at(-1)!.id });
    } else if (screenId) {
      const s = project.screens.find((x) => x.id === screenId);
      if (!s) return;
      const copy: Screen = {
        ...structuredClone(s),
        id: createScreen(s.device).id,
        name: `${s.name} copy`,
        y: s.y + s.height + 120,
      };
      copy.elements = copy.elements.map(cloneElement);
      get().mutate((d) => {
        d.screens.push(copy);
      });
      set({ screenId: copy.id, elementId: null, elementIds: [] });
    }
  },

  copySelection: () => {
    const { project, elementIds } = get();
    if (!project || !elementIds.length) return;
    set({ clipboard: selectedOn(project, elementIds).map((el) => structuredClone(el)), pasteCount: 0 });
  },
  cutSelection: () => {
    get().copySelection();
    if (get().clipboard.length) get().deleteSelection();
  },
  pasteSelection: () => {
    const { project, clipboard, screenId, pasteCount } = get();
    if (!project || !clipboard.length) return;
    const screen = project.screens.find((s) => s.id === screenId) ?? project.screens[0];
    if (!screen) return;
    const copies = copiesOffset(clipboard, PASTE_OFFSET * (pasteCount + 1));
    get().mutate((d) => {
      d.screens.find((s) => s.id === screen.id)!.elements.push(...copies);
    });
    set({
      screenId: screen.id,
      elementIds: copies.map((e) => e.id),
      elementId: copies.at(-1)!.id,
      pasteCount: pasteCount + 1,
    });
  },

  nudgeSelection: (dx, dy) =>
    get().updateSelected((el) => {
      el.x += dx;
      el.y += dy;
    }),
  alignSelection: (edge) => {
    const { project, elementIds } = get();
    if (!project || elementIds.length < 2) return;
    get().mutate((d) => alignElements(selectedOn(d, elementIds), edge));
  },
  distributeSelection: (axis) => {
    const { project, elementIds } = get();
    if (!project || elementIds.length < 3) return;
    get().mutate((d) => distributeElements(selectedOn(d, elementIds), axis));
  },

  moveLayer: (dir) => {
    const { elementIds } = get();
    if (!elementIds.length) return;
    const idSet = new Set(elementIds);
    get().mutate((d) => {
      const found = findElement(d, elementIds[0]);
      if (!found) return;
      const list = found.screen.elements;
      const selected = list.filter((e) => idSet.has(e.id));
      const rest = list.filter((e) => !idSet.has(e.id));
      if (dir === "top") found.screen.elements = [...rest, ...selected];
      else if (dir === "bottom") found.screen.elements = [...selected, ...rest];
      else if (dir === "up") {
        const last = list.findLastIndex((e) => idSet.has(e.id));
        if (last >= list.length - 1) return;
        const after = list[last + 1];
        const idx = rest.indexOf(after);
        rest.splice(idx + 1, 0, ...selected);
        found.screen.elements = rest;
      } else {
        const first = list.findIndex((e) => idSet.has(e.id));
        if (first <= 0) return;
        const before = list[first - 1];
        const idx = rest.indexOf(before);
        rest.splice(idx, 0, ...selected);
        found.screen.elements = rest;
      }
    });
  },
}));

function validSelection(p: Project, s: EditorState) {
  const screenOk = p.screens.some((x) => x.id === s.screenId);
  const ids = s.elementIds.filter((id) => !!findElement(p, id));
  return {
    screenId: screenOk ? s.screenId : null,
    elementId: ids.includes(s.elementId ?? "") ? s.elementId : (ids.at(-1) ?? null),
    elementIds: ids,
  };
}

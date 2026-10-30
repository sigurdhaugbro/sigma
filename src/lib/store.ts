"use client";

import { produce } from "immer";
import { create } from "zustand";
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

export interface View {
  x: number;
  y: number;
  zoom: number;
}

interface EditorState {
  project: Project | null;
  screenId: string | null;
  elementId: string | null;
  past: Project[];
  future: Project[];
  txSnapshot: Project | null;
  view: View;

  load: (p: Project) => void;
  mutate: (fn: (draft: Project) => void) => void;
  beginTx: () => void;
  endTx: () => void;
  undo: () => void;
  redo: () => void;
  select: (screenId: string | null, elementId?: string | null) => void;
  setView: (v: Partial<View>) => void;

  updateElement: (id: string, fn: (el: Element) => void) => void;
  updateScreen: (id: string, fn: (s: Screen) => void) => void;
  addElement: (type: ElementType) => void;
  addScreen: (device: DeviceKind) => void;
  deleteSelection: () => void;
  duplicateSelection: () => void;
  moveLayer: (dir: "up" | "down" | "top" | "bottom") => void;
}

export function findElement(project: Project, id: string): { screen: Screen; el: Element } | null {
  for (const screen of project.screens) {
    const el = screen.elements.find((e) => e.id === id);
    if (el) return { screen, el };
  }
  return null;
}

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
  screenId: null,
  elementId: null,
  past: [],
  future: [],
  txSnapshot: null,
  view: { x: 80, y: 80, zoom: 0.6 },

  load: (p) => set({ project: p, past: [], future: [], screenId: p.startScreenId, elementId: null }),

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

  select: (screenId, elementId = null) => set({ screenId, elementId }),
  setView: (v) => set({ view: { ...get().view, ...v } }),

  updateElement: (id, fn) =>
    get().mutate((d) => {
      const found = findElement(d, id);
      if (found) fn(found.el);
    }),
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
    set({ screenId: screen.id, elementId: el.id });
  },

  addScreen: (device) => {
    const { project } = get();
    if (!project) return;
    const maxX = Math.max(0, ...project.screens.map((s) => s.x + s.width));
    const screen = createScreen(device, { x: project.screens.length ? maxX + 100 : 0, y: 0, name: `${DEVICES[device].label} ${project.screens.length + 1}` });
    if (device !== "mac") screen.elements.push(createElement("statusbar", { width: screen.width }));
    else screen.elements.push(createElement("mactitlebar", { width: screen.width, props: { title: screen.name } }));
    get().mutate((d) => {
      d.screens.push(screen);
    });
    set({ screenId: screen.id, elementId: null });
  },

  deleteSelection: () => {
    const { elementId, screenId, project } = get();
    if (!project) return;
    if (elementId) {
      get().mutate((d) => {
        for (const s of d.screens) s.elements = s.elements.filter((e) => e.id !== elementId);
      });
      set({ elementId: null });
    } else if (screenId && project.screens.length > 1) {
      get().mutate((d) => {
        d.screens = d.screens.filter((s) => s.id !== screenId);
        if (d.startScreenId === screenId) d.startScreenId = d.screens[0].id;
      });
      set({ screenId: null });
    }
  },

  duplicateSelection: () => {
    const { elementId, screenId, project } = get();
    if (!project) return;
    if (elementId) {
      const found = findElement(project, elementId);
      if (!found) return;
      const copy = cloneElement(found.el);
      copy.x += 16;
      copy.y += 16;
      copy.name = `${found.el.name} copy`;
      get().mutate((d) => {
        const s = d.screens.find((x) => x.id === found.screen.id)!;
        const idx = s.elements.findIndex((e) => e.id === elementId);
        s.elements.splice(idx + 1, 0, copy);
      });
      set({ elementId: copy.id });
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
      set({ screenId: copy.id });
    }
  },

  moveLayer: (dir) => {
    const { elementId } = get();
    if (!elementId) return;
    get().mutate((d) => {
      const found = findElement(d, elementId);
      if (!found) return;
      const list = found.screen.elements;
      const i = list.findIndex((e) => e.id === elementId);
      const [el] = list.splice(i, 1);
      const to = dir === "up" ? Math.min(list.length, i + 1) : dir === "down" ? Math.max(0, i - 1) : dir === "top" ? list.length : 0;
      list.splice(to, 0, el);
    });
  },
}));

function validSelection(p: Project, s: EditorState) {
  const screenOk = p.screens.some((x) => x.id === s.screenId);
  const elOk = s.elementId ? !!findElement(p, s.elementId) : false;
  return { screenId: screenOk ? s.screenId : null, elementId: elOk ? s.elementId : null };
}

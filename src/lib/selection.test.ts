import { describe, expect, it } from "vitest";
import { createElement, createProject } from "./model";
import {
  alignElements,
  copiesOffset,
  distributeElements,
  marqueeHits,
  scaleInGroup,
  toggleId,
  unionBox,
} from "./selection";
import { useEditor } from "./store";

function reset(project = createProject()) {
  useEditor.setState({
    project,
    screenId: project.screens[0].id,
    elementId: null,
    elementIds: [],
    past: [],
    future: [],
    txSnapshot: null,
    clipboard: [],
    pasteCount: 0,
    tool: "select",
    drawStyle: { fill: "#E5E5EA", stroke: "#111111", strokeWidth: 2 },
    grid: { visible: false, snap: false, size: 8 },
    view: { x: 0, y: 0, zoom: 1 },
  });
  return project;
}

describe("selection geometry", () => {
  it("unions boxes and hits a marquee", () => {
    const a = createElement("rect", { x: 0, y: 0, width: 40, height: 40 });
    const b = createElement("ellipse", { x: 80, y: 10, width: 20, height: 20 });
    const c = createElement("text", { x: 200, y: 200, width: 40, height: 20 });
    expect(unionBox([a, b])).toEqual({ x: 0, y: 0, width: 100, height: 40 });
    expect(marqueeHits([a, b, c], { x: 30, y: -5, width: 60, height: 30 }).map((e) => e.id)).toEqual([a.id, b.id]);
  });

  it("toggles ids, offsets copies, and scales a group", () => {
    expect(toggleId(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleId(["a", "b"], "a")).toEqual(["b"]);
    const src = createElement("rect", { name: "Card", x: 10, y: 20, width: 30, height: 40 });
    const [copy] = copiesOffset([src], 16);
    expect(copy.id).not.toBe(src.id);
    expect(copy.x).toBe(26);
    expect(copy.y).toBe(36);
    expect(copy.name).toBe("Card copy");
    const el = createElement("rect", { x: 20, y: 20, width: 20, height: 20 });
    scaleInGroup(el, { x: 0, y: 0, width: 40, height: 40 }, { x: 0, y: 0, width: 80, height: 80 });
    expect(el).toMatchObject({ x: 40, y: 40, width: 40, height: 40 });
  });

  it("aligns and distributes a group", () => {
    const a = createElement("rect", { x: 0, y: 10, width: 10, height: 10 });
    const b = createElement("rect", { x: 30, y: 40, width: 10, height: 10 });
    const c = createElement("rect", { x: 80, y: 0, width: 20, height: 10 });
    alignElements([a, b, c], "left");
    expect([a.x, b.x, c.x]).toEqual([0, 0, 0]);
    alignElements([a, b, c], "top");
    expect([a.y, b.y, c.y]).toEqual([0, 0, 0]);
    a.x = 0;
    b.x = 20;
    c.x = 80;
    a.width = 10;
    b.width = 10;
    c.width = 10;
    distributeElements([a, b, c], "x");
    expect(a.x).toBe(0);
    expect(c.x).toBe(80);
    expect(b.x).toBe(40);
  });
});

describe("editor clipboard and multi-select", () => {
  it("shift-toggles, copies, pastes with a stacking offset, and cuts", () => {
    const project = reset();
    const screen = project.screens[0];
    const startCount = screen.elements.length;
    const one = createElement("rect", { name: "One", x: 8, y: 8, width: 40, height: 20 });
    const two = createElement("ellipse", { name: "Two", x: 60, y: 16, width: 24, height: 24 });
    screen.elements.push(one, two);
    useEditor.setState({ project, screenId: screen.id });

    useEditor.getState().select(screen.id, one.id);
    useEditor.getState().toggleSelect(screen.id, two.id);
    expect(useEditor.getState().elementIds).toEqual([one.id, two.id]);

    useEditor.getState().copySelection();
    useEditor.getState().pasteSelection();
    const afterPaste = useEditor.getState().project!.screens[0].elements;
    expect(afterPaste).toHaveLength(startCount + 4);
    const pasted = afterPaste.filter((e) => e.id !== one.id && e.id !== two.id && e.name.endsWith(" copy"));
    expect(pasted.map((e) => e.x).sort((a, b) => a - b)).toEqual([24, 76]);
    expect(useEditor.getState().elementIds).toEqual(pasted.map((e) => e.id));

    useEditor.getState().pasteSelection();
    const afterSecond = useEditor.getState().project!.screens[0].elements;
    expect(afterSecond).toHaveLength(startCount + 6);
    const second = afterSecond.filter((e) => e.name.endsWith(" copy") && e.x === one.x + 32);
    expect(second).toHaveLength(1);

    useEditor.getState().select(screen.id, one.id);
    useEditor.getState().toggleSelect(screen.id, two.id);
    useEditor.getState().cutSelection();
    expect(useEditor.getState().project!.screens[0].elements.some((e) => e.id === one.id)).toBe(false);
    expect(useEditor.getState().clipboard).toHaveLength(2);
  });

  it("duplicates, deletes, nudges, aligns, and styles the whole selection", () => {
    const project = reset();
    const screen = project.screens[0];
    const startCount = screen.elements.length;
    const a = createElement("rect", { name: "A", x: 0, y: 0, width: 20, height: 20, fill: "#111111" });
    const b = createElement("rect", { name: "B", x: 40, y: 10, width: 20, height: 20, fill: "#111111" });
    screen.elements.push(a, b);
    useEditor.setState({ project, screenId: screen.id, elementIds: [a.id, b.id], elementId: b.id });

    useEditor.getState().duplicateSelection();
    expect(useEditor.getState().project!.screens[0].elements).toHaveLength(startCount + 4);
    expect(useEditor.getState().elementIds).toHaveLength(2);

    useEditor.getState().nudgeSelection(5, -2);
    const ids = useEditor.getState().elementIds;
    const moved = useEditor.getState().project!.screens[0].elements.filter((e) => ids.includes(e.id));
    expect(moved.map((e) => e.x)).toEqual([21, 61]);

    useEditor.getState().setSelection(screen.id, [a.id, b.id]);
    useEditor.getState().alignSelection("top");
    const aligned = useEditor.getState().project!.screens[0].elements.filter((e) => [a.id, b.id].includes(e.id));
    expect(aligned.every((e) => e.y === 0)).toBe(true);

    useEditor.getState().updateSelected((el) => {
      el.fill = "#FF3B30";
    });
    const painted = useEditor.getState().project!.screens[0].elements.filter((e) => [a.id, b.id].includes(e.id));
    expect(painted.every((e) => e.fill === "#FF3B30")).toBe(true);

    useEditor.getState().deleteSelection();
    expect(useEditor.getState().project!.screens[0].elements.some((e) => e.id === a.id || e.id === b.id)).toBe(false);
    expect(useEditor.getState().elementIds).toEqual([]);
  });
});

describe("canvas screens", () => {
  it("adds a chrome-less canvas and places a vector path on it", () => {
    reset();
    useEditor.getState().addScreen("canvas");
    const canvas = useEditor.getState().project!.screens.at(-1)!;
    expect(canvas.device).toBe("canvas");
    expect(canvas.elements).toEqual([]);
    const path = createElement("path", {
      x: 10,
      y: 10,
      width: 80,
      height: 40,
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    });
    useEditor.getState().placeElement(canvas.id, path);
    expect(useEditor.getState().elementIds).toEqual([path.id]);
    expect(useEditor.getState().project!.screens.at(-1)!.elements[0].type).toBe("path");
  });
});

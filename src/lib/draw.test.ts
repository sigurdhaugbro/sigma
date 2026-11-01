import { describe, expect, it } from "vitest";
import { applyOperations } from "./ai/ops";
import {
  boundsOf,
  boxFromDrag,
  lineFromDrag,
  normalizeToBox,
  pathFromFreehand,
  polylineD,
  smoothPathD,
  thinPoints,
} from "./draw";
import { createElement, createProject, createScreen, DEVICES, hasDeviceChrome } from "./model";

describe("canvas device", () => {
  it("is a bezel-less artboard with an arbitrary default size", () => {
    expect(DEVICES.canvas).toMatchObject({ label: "Canvas", width: 1200, height: 800, radius: 0, bezel: 0 });
    expect(hasDeviceChrome("canvas")).toBe(false);
    expect(hasDeviceChrome("iphone")).toBe(true);
    expect(hasDeviceChrome("mac")).toBe(false);
    const screen = createScreen("canvas", { name: "Board" });
    expect(screen.device).toBe("canvas");
    expect(screen.name).toBe("Board");
    expect(screen.width).toBe(1200);
    expect(screen.height).toBe(800);
    expect(screen.elements).toEqual([]);
  });
});

describe("drawing geometry", () => {
  it("normalizes freehand points into the element's box", () => {
    const drawn = pathFromFreehand([
      { x: 10, y: 20 },
      { x: 10, y: 20 },
      { x: 12, y: 21 },
      { x: 40, y: 80 },
    ]);
    expect(drawn.x).toBe(10);
    expect(drawn.y).toBe(20);
    expect(drawn.width).toBeGreaterThanOrEqual(8);
    expect(drawn.height).toBeGreaterThanOrEqual(8);
    expect(drawn.points[0]).toEqual({ x: 0, y: 0 });
    expect(drawn.points.at(-1)?.x).toBeCloseTo((40 - 10) / drawn.width);
  });

  it("builds a line that keeps both endpoints after resize-style normalization", () => {
    const line = lineFromDrag(100, 50, 20, 90);
    expect(line.x).toBe(20);
    expect(line.y).toBe(50);
    expect(line.points).toHaveLength(2);
    const d = polylineD(line.points, line.width, line.height);
    expect(d.startsWith("M ")).toBe(true);
    expect(d).toContain(" L ");
  });

  it("emits an SVG path for stored vector points", () => {
    const d = smoothPathD(
      [
        { x: 0, y: 0 },
        { x: 0.5, y: 1 },
        { x: 1, y: 0 },
      ],
      100,
      50,
    );
    expect(d).toMatch(/^M 0 0 Q /);
    expect(polylineD([{ x: 0, y: 0 }], 10, 10)).toBe("M 0 0");
    expect(polylineD(undefined, 10, 10)).toBe("");
  });

  it("thins clustered vertices and expands a tiny drag to a minimum box", () => {
    expect(thinPoints([{ x: 0, y: 0 }, { x: 0.4, y: 0 }, { x: 10, y: 0 }])).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    expect(boxFromDrag(5, 5, 6, 6, 4)).toMatchObject({ x: 5, y: 5, width: 4, height: 4 });
    expect(boundsOf([]).width).toBe(1);
    expect(normalizeToBox([{ x: 10, y: 20 }], { x: 10, y: 20, width: 40, height: 20 })).toEqual([{ x: 0, y: 0 }]);
  });
});

describe("drawing elements in project JSON", () => {
  it("stores path / ellipse / line as ordinary elements", () => {
    const path = createElement("path", {
      x: 20,
      y: 30,
      width: 80,
      height: 40,
      stroke: "#FF3B30",
      strokeWidth: 3,
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    });
    expect(path.type).toBe("path");
    expect(path.points).toHaveLength(2);
    expect(path.stroke).toBe("#FF3B30");
    expect(createElement("ellipse").type).toBe("ellipse");
    expect(createElement("line").points).toHaveLength(2);
  });

  it("applies AI ops that add a canvas and a vector path", () => {
    const project = createProject();
    const result = applyOperations(project, [
      { op: "addScreen", id: "board", device: "canvas", name: "Storyboard" },
      {
        op: "addElement",
        id: "scribble",
        screenId: "board",
        type: "path",
        x: 40,
        y: 40,
        width: 200,
        height: 80,
        stroke: "#111111",
        strokeWidth: 3,
        points: [
          { x: 0, y: 0.2 },
          { x: 1, y: 0.8 },
        ],
      },
      { op: "addElement", screenId: "board", type: "ellipse", x: 80, y: 140, width: 60, height: 60, fill: "#FFCC00" },
    ]);
    expect(result.errors).toEqual([]);
    const board = project.screens.find((s) => s.id === "board")!;
    expect(board.device).toBe("canvas");
    expect(board.elements.map((e) => e.type)).toEqual(["path", "ellipse"]);
    expect(board.elements[0].points?.[1]).toEqual({ x: 1, y: 0.8 });
    expect(board.elements[0].strokeWidth).toBe(3);
  });
});

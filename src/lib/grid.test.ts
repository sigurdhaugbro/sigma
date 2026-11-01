import { describe, expect, it } from "vitest";
import { clampGridSize, DEFAULT_GRID, snapMaybe, snapValue } from "./grid";

describe("grid", () => {
  it("snaps to the nearest cell and can be toggled off", () => {
    expect(snapValue(13, 8)).toBe(16);
    expect(snapValue(10, 8)).toBe(8);
    expect(snapMaybe(13, { snap: true, size: 8 })).toBe(16);
    expect(snapMaybe(13.4, { snap: false, size: 8 })).toBe(13);
    expect(clampGridSize(2)).toBe(4);
    expect(clampGridSize(99)).toBe(64);
    expect(DEFAULT_GRID).toEqual({ visible: false, snap: false, size: 8 });
  });
});

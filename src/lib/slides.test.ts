import { describe, expect, it } from "vitest";
import { createDeck, createProject, DEVICES, isDeck, isProject } from "./model";
import { createSampleDeck, createSampleProject } from "./sample";
import { applySlideNav, reorderList, slideIndex, slideNavFromClick, slideNavFromKey } from "./slides";

describe("deck model", () => {
  it("creates a 16:9 deck distinct from prototypes", () => {
    const deck = createDeck("Pitch");
    expect(isDeck(deck)).toBe(true);
    expect(isProject(deck)).toBe(true);
    expect(deck.kind).toBe("deck");
    expect(deck.screens).toHaveLength(1);
    const slide = deck.screens[0];
    expect(slide.device).toBe("slide");
    expect(slide.width / slide.height).toBeCloseTo(16 / 9);
    expect(slide.width).toBe(DEVICES.slide.width);
    expect(slide.height).toBe(DEVICES.slide.height);
    expect(isDeck(createProject())).toBe(false);
    expect(isDeck(createSampleProject())).toBe(false);
  });

  it("accepts sample decks as projects", () => {
    const deck = createSampleDeck();
    expect(isProject(deck)).toBe(true);
    expect(isDeck(deck)).toBe(true);
    expect(deck.screens.length).toBeGreaterThanOrEqual(3);
    expect(deck.screens.every((s) => s.device === "slide")).toBe(true);
    expect(deck.screens.every((s) => s.width === 1920 && s.height === 1080)).toBe(true);
  });

  it("treats missing kind as a prototype", () => {
    const p = createSampleProject();
    delete p.kind;
    expect(isDeck(p)).toBe(false);
    expect(isProject(p)).toBe(true);
  });
});

describe("slide navigation", () => {
  it("maps keys", () => {
    expect(slideNavFromKey("ArrowRight")).toBe("next");
    expect(slideNavFromKey(" ")).toBe("next");
    expect(slideNavFromKey("ArrowLeft")).toBe("prev");
    expect(slideNavFromKey("Home")).toBe("first");
    expect(slideNavFromKey("End")).toBe("last");
    expect(slideNavFromKey("Escape")).toBeNull();
  });

  it("maps click: left quarter previous, otherwise next", () => {
    expect(slideNavFromClick(10, 1000)).toBe("prev");
    expect(slideNavFromClick(400, 1000)).toBe("next");
  });

  it("clamps at the ends", () => {
    expect(applySlideNav(0, 4, "prev")).toBe(0);
    expect(applySlideNav(3, 4, "next")).toBe(3);
    expect(applySlideNav(1, 4, "next")).toBe(2);
    expect(applySlideNav(2, 4, "first")).toBe(0);
    expect(applySlideNav(1, 4, "last")).toBe(3);
    expect(applySlideNav(0, 0, "next")).toBe(0);
  });

  it("finds the current slide index", () => {
    const deck = createSampleDeck();
    expect(slideIndex(deck.screens, deck.screens[2].id)).toBe(2);
    expect(slideIndex(deck.screens, "missing")).toBe(0);
  });
});

describe("reorderList", () => {
  it("moves an item and no-ops out of range", () => {
    expect(reorderList(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(reorderList(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(reorderList(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
});

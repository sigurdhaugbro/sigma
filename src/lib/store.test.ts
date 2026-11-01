import { beforeEach, describe, expect, it } from "vitest";
import { createDeck } from "./model";
import { createSampleDeck } from "./sample";
import { useEditor } from "./store";

describe("deck editor store", () => {
  beforeEach(() => {
    useEditor.getState().load(createSampleDeck());
  });

  it("adds a slide after the current one, without device chrome", () => {
    const first = useEditor.getState().project!.screens[0];
    useEditor.getState().select(first.id, null);
    useEditor.getState().addScreen("slide");
    const screens = useEditor.getState().project!.screens;
    expect(screens[1].device).toBe("slide");
    expect(screens[1].width).toBe(1920);
    expect(screens[1].height).toBe(1080);
    expect(screens[1].elements.some((e) => e.type === "statusbar" || e.type === "mactitlebar")).toBe(false);
    expect(useEditor.getState().screenId).toBe(screens[1].id);
  });

  it("duplicates a slide in place and deletes it", () => {
    const before = useEditor.getState().project!.screens.length;
    const id = useEditor.getState().project!.screens[1].id;
    useEditor.getState().select(id, null);
    useEditor.getState().duplicateSelection();
    const afterDup = useEditor.getState().project!.screens;
    expect(afterDup.length).toBe(before + 1);
    expect(afterDup[2].name).toMatch(/copy$/);
    expect(afterDup[2].id).not.toBe(id);
    useEditor.getState().select(afterDup[2].id, null);
    useEditor.getState().deleteSelection();
    expect(useEditor.getState().project!.screens.length).toBe(before);
  });

  it("reorders slides", () => {
    const ids = useEditor.getState().project!.screens.map((s) => s.id);
    useEditor.getState().moveSlide(ids[0], "down");
    expect(useEditor.getState().project!.screens.map((s) => s.id)).toEqual([ids[1], ids[0], ...ids.slice(2)]);
    useEditor.getState().reorderSlides(0, 2);
    const moved = useEditor.getState().project!.screens.map((s) => s.id);
    expect(moved[2]).toBe(ids[1]);
  });

  it("refuses to delete the last slide", () => {
    useEditor.getState().load(createDeck());
    const only = useEditor.getState().project!.screens[0].id;
    useEditor.getState().select(only, null);
    useEditor.getState().deleteSelection();
    expect(useEditor.getState().project!.screens).toHaveLength(1);
  });

  it("adds text, a shape, and an image to the current slide", () => {
    const slideId = useEditor.getState().project!.screens[0].id;
    useEditor.getState().select(slideId, null);
    useEditor.getState().addElement("text");
    useEditor.getState().addElement("rect");
    useEditor.getState().addElement("image");
    const types = useEditor.getState().project!.screens[0].elements.map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["text", "rect", "image"]));
  });
});

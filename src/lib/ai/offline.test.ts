import { describe, expect, it } from "vitest";
import { createSampleDeck, createSampleProject } from "@/lib/sample";
import { offlinePlan } from "./offline";
import { applyOperations } from "./ops";

function setup() {
  const project = createSampleProject();
  const [list, chat, details] = project.screens;
  const byName = (name: string) => project.screens.flatMap((s) => s.elements).find((e) => e.name === name)!;
  return { project, list, chat, details, byName };
}

function run(instruction: string, sel: { screenId: string | null; elementId: string | null }, project = setup().project) {
  const plan = offlinePlan(project, sel, instruction);
  if (!plan) return null;
  const draft = structuredClone(project);
  return { plan, draft, result: applyOperations(draft, plan.operations) };
}

describe("offline fallback", () => {
  it("recolors a named element", () => {
    const { project, chat, byName } = setup();
    const out = run("make the send button green", { screenId: chat.id, elementId: null }, project)!;
    const send = out.draft.screens[1].elements.find((e) => e.id === byName("Send").id)!;
    expect(send.fill).toBe("#34C759");
  });

  it("recolors the selection's text", () => {
    const { project, list, byName } = setup();
    const title = byName("Large Title");
    const out = run("make the text red", { screenId: list.id, elementId: title.id }, project)!;
    expect(out.draft.screens[0].elements.find((e) => e.id === title.id)!.textColor).toBe("#FF3B30");
  });

  it("changes text", () => {
    const { project, list, byName } = setup();
    const title = byName("Large Title");
    const out = run('set the title to "Inbox"', { screenId: list.id, elementId: title.id }, project)!;
    expect(out.draft.screens[0].elements.find((e) => e.id === title.id)!.text).toBe("Inbox");
  });

  it("adds a screen with status and nav bars", () => {
    const { project } = setup();
    const out = run("add a settings screen", { screenId: null, elementId: null }, project)!;
    const added = out.draft.screens.at(-1)!;
    expect(added.name).toBe("Settings");
    expect(added.elements.map((e) => e.type)).toEqual(["statusbar", "navbar"]);
  });

  it("adds a chrome-less canvas", () => {
    const { project } = setup();
    const out = run("add a canvas", { screenId: null, elementId: null }, project)!;
    const added = out.draft.screens.at(-1)!;
    expect(added.device).toBe("canvas");
    expect(added.elements).toEqual([]);
  });

  it("adds a screen linked from an existing button", () => {
    const { project, byName } = setup();
    const out = run("add a settings screen linked from the compose icon", { screenId: null, elementId: null }, project)!;
    const added = out.draft.screens.at(-1)!;
    const compose = out.draft.screens[0].elements.find((e) => e.id === byName("Compose").id)!;
    expect(compose.interactions[0].action).toMatchObject({ type: "navigate", screenId: added.id });
  });

  it("adds an element to the current screen", () => {
    const { project, details } = setup();
    const out = run('add a button saying "Call"', { screenId: details.id, elementId: null }, project)!;
    const btn = out.draft.screens[2].elements.at(-1)!;
    expect(btn.type).toBe("button");
    expect(btn.text).toBe("Call");
  });

  it("links an element to a screen", () => {
    const { project, list, byName } = setup();
    const out = run("link Edit to Contact Details", { screenId: list.id, elementId: null }, project)!;
    const edit = out.draft.screens[0].elements.find((e) => e.id === byName("Edit").id)!;
    expect(edit.interactions[0].action).toMatchObject({ type: "navigate", screenId: project.screens[2].id });
  });

  it("adds a 16:9 slide without device chrome", () => {
    const project = createSampleDeck();
    const out = run("add a slide", { screenId: project.screens[0].id, elementId: null }, project)!;
    const added = out.draft.screens.at(-1)!;
    expect(added.device).toBe("slide");
    expect(added.width).toBe(1920);
    expect(added.height).toBe(1080);
    expect(added.elements).toEqual([]);
  });

  it("returns null for things it can't understand", () => {
    const { project } = setup();
    expect(offlinePlan(project, { screenId: null, elementId: null }, "make a WhatsApp-style chat screen with contact Anna")).toBeNull();
  });
});

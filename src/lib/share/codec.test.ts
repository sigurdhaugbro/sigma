import { describe, expect, it } from "vitest";
import { createSampleProject } from "@/lib/sample";
import { decodeProject, encodeProject, MAX_HASH_URL_LENGTH, phonePath } from "./codec";

describe("share codec", () => {
  it("round-trips a sample project", () => {
    const project = createSampleProject();
    const again = decodeProject(encodeProject(project));
    expect(again.name).toBe(project.name);
    expect(again.screens).toHaveLength(project.screens.length);
    expect(again.variables.map((v) => v.name)).toEqual(project.variables.map((v) => v.name));
  });

  it("keeps tiny projects in the hash and sends the sample (too dense for a QR) to the store", () => {
    const tiny = createSampleProject();
    tiny.screens = [tiny.screens[0]];
    tiny.screens[0].elements = tiny.screens[0].elements.slice(0, 3);
    tiny.variables = [];
    const tinyUrl = `https://example.netlify.app${phonePath()}#p=${encodeProject(tiny)}`;
    expect(tinyUrl.length).toBeLessThanOrEqual(MAX_HASH_URL_LENGTH);
    const sampleUrl = `https://example.netlify.app${phonePath()}#p=${encodeProject(createSampleProject())}`;
    expect(sampleUrl.length).toBeGreaterThan(MAX_HASH_URL_LENGTH);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { getShare, putShare } from "./store";
import { decodeProject, encodeProject } from "./codec";
import { createSampleProject } from "@/lib/sample";

describe("share store (disk fallback)", () => {
  const ids: string[] = [];
  afterEach(async () => {
    const { rm } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    await Promise.all(ids.splice(0).map((id) => rm(join(tmpdir(), "sigma-shares", `${id}.json`), { force: true })));
  });

  it("stores and returns encoded project JSON", async () => {
    const project = createSampleProject();
    const data = encodeProject(project);
    const { id, expiresAt } = await putShare(data);
    ids.push(id);
    expect(id).toMatch(/^[a-z0-9]{10}$/);
    expect(expiresAt).toBeGreaterThan(Date.now());
    const rec = await getShare(id);
    expect(rec?.data).toBe(data);
    expect(decodeProject(rec!.data).name).toBe(project.name);
  });

  it("rejects unknown ids", async () => {
    expect(await getShare("nope")).toBeNull();
    expect(await getShare("../etc")).toBeNull();
  });
});

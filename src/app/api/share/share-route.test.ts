import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";
import { GET } from "./[id]/route";
import { encodeProject } from "@/lib/share/codec";
import { createSampleProject } from "@/lib/sample";

describe("/api/share", () => {
  const ids: string[] = [];
  afterEach(async () => {
    const { rm } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    await Promise.all(ids.splice(0).map((id) => rm(join(tmpdir(), "sigma-shares", `${id}.json`), { force: true })));
  });

  it("creates a token and serves it back", async () => {
    const data = encodeProject(createSampleProject());
    const res = await POST(new Request("http://localhost/api/share", { method: "POST", body: JSON.stringify({ data }) }));
    expect(res.status).toBe(200);
    const created = await res.json();
    ids.push(created.id);
    const got = await GET(new Request(`http://localhost/api/share/${created.id}`), { params: Promise.resolve({ id: created.id }) });
    expect(got.status).toBe(200);
    expect((await got.json()).data).toBe(data);
  });

  it("rejects junk bodies", async () => {
    const res = await POST(new Request("http://localhost/api/share", { method: "POST", body: JSON.stringify({ data: "!!!" }) }));
    expect(res.status).toBe(400);
  });
});

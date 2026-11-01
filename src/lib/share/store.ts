import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { getStore } from "@netlify/blobs";

export const SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface Record {
  data: string;
  expiresAt: number;
}

interface Backend {
  put(id: string, rec: Record): Promise<void>;
  get(id: string): Promise<Record | null>;
  remove(id: string): Promise<void>;
}

/** Netlify Blobs when deployed on Netlify (serverless, shared across function instances). */
function netlifyBackend(): Backend | null {
  try {
    const store = getStore({ name: "sigma-shares", consistency: "strong" });
    return {
      put: async (id, rec) => void (await store.setJSON(id, rec)),
      get: async (id) => (await store.get(id, { type: "json" })) as Record | null,
      remove: (id) => store.delete(id),
    };
  } catch {
    return null;
  }
}

/** Local dev / self-hosting: files in the OS temp dir, which survive dev-server restarts. */
function diskBackend(): Backend {
  const dir = join(tmpdir(), "sigma-shares");
  const file = (id: string) => join(dir, `${id}.json`);
  return {
    put: async (id, rec) => {
      await mkdir(dir, { recursive: true });
      await writeFile(file(id), JSON.stringify(rec));
    },
    get: async (id) => {
      try {
        return JSON.parse(await readFile(file(id), "utf8"));
      } catch {
        return null;
      }
    },
    remove: (id) => rm(file(id), { force: true }),
  };
}

const backend = (): Backend => netlifyBackend() ?? diskBackend();

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export async function putShare(data: string) {
  const bytes = randomBytes(10);
  const id = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  const expiresAt = Date.now() + SHARE_TTL_MS;
  await backend().put(id, { data, expiresAt });
  return { id, expiresAt };
}

export async function getShare(id: string) {
  if (!/^[a-z0-9]{6,20}$/.test(id)) return null;
  const b = backend();
  const rec = await b.get(id);
  if (!rec) return null;
  if (rec.expiresAt < Date.now()) {
    await b.remove(id);
    return null;
  }
  return rec;
}

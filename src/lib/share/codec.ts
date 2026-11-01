import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate";
import { isProject, type Project } from "@/lib/model";

export type { Project };

/**
 * Links that embed the whole project in the URL hash are self-contained: nothing is stored on a
 * server and the hash never reaches it. QR codes stay reliably scannable up to roughly this length,
 * so bigger projects (usually ones with photos) go through the short-link store instead.
 */
export const MAX_HASH_URL_LENGTH = 2200;

function toBase64Url(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeProject(project: Project): string {
  return toBase64Url(deflateSync(strToU8(JSON.stringify(project)), { level: 9 }));
}

export function decodeProject(encoded: string): Project {
  const parsed = JSON.parse(strFromU8(inflateSync(fromBase64Url(encoded))));
  if (!isProject(parsed)) throw new Error("Not a Sigma project");
  return parsed;
}

export function phonePath() {
  return "/m";
}

import type { Project } from "@/lib/model";
import { encodeProject, MAX_HASH_URL_LENGTH, phonePath } from "./codec";

export type ShareLink = { url: string; via: "hash" | "store"; expiresAt?: number };

/** Builds a phone-player URL. Hash links are self-contained; oversized projects use the short-link store. */
export async function createShareLink(
  origin: string,
  project: Project,
  screenId?: string,
): Promise<ShareLink> {
  const encoded = encodeProject(project);
  const screen = screenId && screenId !== project.startScreenId ? `&s=${encodeURIComponent(screenId)}` : "";
  const hashUrl = `${origin}${phonePath()}#p=${encoded}${screen}`;
  if (hashUrl.length <= MAX_HASH_URL_LENGTH) return { url: hashUrl, via: "hash" };

  const res = await fetch("/api/share", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: encoded }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Couldn't create a share link.");
  const queryUrl = `${origin}${phonePath()}?t=${encodeURIComponent(body.id)}${screenId && screenId !== project.startScreenId ? `&s=${encodeURIComponent(screenId)}` : ""}`;
  return { url: queryUrl, via: "store", expiresAt: body.expiresAt };
}

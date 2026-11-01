import { putShare } from "@/lib/share/store";

const MAX_BYTES = 4_000_000;

/** Short-link fallback for projects too large for a URL-hash link (typically ones with photos). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const data = body?.data;
  if (typeof data !== "string" || !/^[\w-]+$/.test(data)) return Response.json({ error: "Invalid project data." }, { status: 400 });
  if (data.length > MAX_BYTES) return Response.json({ error: "Project is too large to share (over 4 MB). Try smaller images." }, { status: 413 });
  try {
    return Response.json(await putShare(data));
  } catch (e) {
    return Response.json({ error: `Couldn't store the project: ${(e as Error).message}` }, { status: 500 });
  }
}

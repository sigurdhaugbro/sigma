import { getShare } from "@/lib/share/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/share/[id]">) {
  const { id } = await ctx.params;
  const rec = await getShare(id);
  if (!rec) return Response.json({ error: "This link has expired or doesn't exist." }, { status: 404 });
  return Response.json(rec, { headers: { "cache-control": "private, max-age=60" } });
}

import { z } from "zod";

const BodySchema = z.object({ provider: z.enum(["openai", "anthropic"]), apiKey: z.string().min(1) });

/** Lists models the key can use, so the settings dialog never relies on a guessed model id. */
export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { provider, apiKey } = parsed.data;

  const res =
    provider === "anthropic"
      ? await fetch("https://api.anthropic.com/v1/models?limit=100", {
          headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        })
      : await fetch("https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${apiKey}` } });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = body?.error?.message ?? res.statusText;
    return Response.json({ error: res.status === 401 ? "That API key was rejected." : `Couldn't list models: ${msg}` }, { status: res.status === 401 ? 401 : 502 });
  }
  const data = await res.json();
  const ids: string[] = (data?.data ?? []).map((m: { id: string }) => m.id);
  const models = provider === "anthropic" ? ids.filter((id) => id.startsWith("claude")) : ids.filter((id) => /^(gpt|o\d)/.test(id)).sort().reverse();
  return Response.json({ models });
}

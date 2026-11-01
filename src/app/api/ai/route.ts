import { z } from "zod";
import { parsePlan } from "@/lib/ai/ops";
import { SYSTEM_PROMPT } from "@/lib/ai/prompt";

const BodySchema = z.object({
  provider: z.enum(["openai", "anthropic"]),
  model: z.string().min(1),
  apiKey: z.string().min(1),
  instruction: z.string().min(1).max(4000),
  project: z.unknown(),
  selection: z.unknown(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(20).default([]),
});

type Turn = { role: "user" | "assistant"; content: string };

/** Keys arrive per request and are only forwarded to the provider; nothing is stored. */
export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { provider, model, apiKey, instruction, project, selection, history } = parsed.data;

  const context = `Current project:\n${JSON.stringify(project)}\n\nSelection:\n${JSON.stringify(selection)}\n\nInstruction:\n${instruction}`;
  const messages: Turn[] = [...history, { role: "user", content: context }];

  try {
    const text = provider === "openai" ? await callOpenAI(apiKey, model, messages) : await callAnthropic(apiKey, model, messages);
    const json = extractJson(text);
    if (!json) return Response.json({ error: "The model didn't return valid JSON. Try rephrasing.", raw: text.slice(0, 500) }, { status: 502 });
    const { plan, rejected } = parsePlan(json);
    return Response.json({ ...plan, rejected });
  } catch (e) {
    const err = e as ProviderError;
    return Response.json({ error: err.message }, { status: err.status ?? 502 });
  }
}

class ProviderError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

async function providerError(res: Response, name: string) {
  let detail = "";
  try {
    const body = await res.json();
    detail = body?.error?.message ?? JSON.stringify(body).slice(0, 300);
  } catch {
    detail = res.statusText;
  }
  const hint = res.status === 401 ? " Check the API key in AI settings." : res.status === 404 ? " Check the model name in AI settings." : "";
  return new ProviderError(`${name} error ${res.status}: ${detail}${hint}`, res.status === 401 ? 401 : 502);
}

async function callOpenAI(apiKey: string, model: string, messages: Turn[]) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
  });
  if (!res.ok) throw await providerError(res, "OpenAI");
  const data = await res.json();
  return String(data?.choices?.[0]?.message?.content ?? "");
}

async function callAnthropic(apiKey: string, model: string, messages: Turn[]) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: 16000, system: SYSTEM_PROMPT, messages }),
  });
  if (!res.ok) throw await providerError(res, "Anthropic");
  const data = await res.json();
  return (data?.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

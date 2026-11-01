import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as aiRoute } from "@/app/api/ai/route";
import { POST as modelsRoute } from "@/app/api/ai/models/route";
import { createSampleProject } from "@/lib/sample";
import { DEFAULT_AI_SETTINGS } from "./settings";
import { applyOperations, parsePlan, projectForPrompt } from "./ops";
import { SYSTEM_PROMPT } from "./prompt";

const KEY = "sk-ant-test-key";

/** What Claude would plausibly answer to "make a WhatsApp-style chat screen with contact Anna". */
function whatsappPlan(composeId: string) {
  const send = { type: "sendMessage", from: "annaDraft", to: "annaMessages", replies: ["Ok, ordering you a flat white"] };
  return {
    summary: "Added a WhatsApp-style chat with Anna, opened from the compose button.",
    operations: [
      { op: "setVariable", name: "annaMessages", type: "messages", initial: [{ from: "them", text: "Are you at the café yet?" }, { from: "me", text: "5 min away" }] },
      { op: "setVariable", name: "annaDraft", type: "text", initial: "" },
      { op: "addScreen", id: "anna-chat", device: "iphone", name: "WhatsApp — Anna", background: "#EFE7DE" },
      { op: "addElement", screenId: "anna-chat", type: "statusbar" },
      { op: "addElement", id: "anna-header", screenId: "anna-chat", type: "navbar", fill: "#F6F6F6", props: { title: "Anna", backLabel: "", rightIcon: "video" } },
      { op: "addElement", screenId: "anna-chat", type: "messagelist", y: 98, height: 650, props: { variable: "annaMessages", keyboardAware: true } },
      {
        op: "addElement",
        id: "anna-field",
        screenId: "anna-chat",
        type: "textfield",
        x: 16,
        y: 758,
        width: 316,
        height: 36,
        props: { variable: "annaDraft", fieldStyle: "pill", placeholder: "Message", keyboardAware: true },
        interactions: [{ trigger: "submit", action: send }],
      },
      {
        op: "addElement",
        id: "anna-send",
        screenId: "anna-chat",
        type: "button",
        x: 341,
        y: 758,
        width: 36,
        height: 36,
        fill: "#25D366",
        radius: 18,
        text: "",
        showIf: "annaDraft",
        props: { icon: "arrow-up", keyboardAware: true },
        interactions: [{ trigger: "tap", action: send }],
      },
      { op: "addInteraction", elementId: composeId, trigger: "tap", action: { type: "navigate", screenId: "anna-chat", transition: "push" } },
      { op: "updateElement", elementId: "does-not-exist", set: { fill: "#000000" } },
      { op: "addElement", screenId: "anna-chat", type: "sparkle" },
    ],
  };
}

function anthropicReply(text: string, status = 200) {
  const body = status === 200 ? { content: [{ type: "text", text }] } : { error: { message: text } };
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function request(body: unknown) {
  return new Request("http://localhost/api/ai", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

afterEach(() => vi.unstubAllGlobals());

describe("defaults", () => {
  it("uses Claude with a Sonnet model and no key", () => {
    expect(DEFAULT_AI_SETTINGS.provider).toBe("anthropic");
    expect(DEFAULT_AI_SETTINGS.models.anthropic).toMatch(/^claude-sonnet/);
    expect(DEFAULT_AI_SETTINGS.keys).toEqual({});
  });
});

describe("/api/ai with a mocked Claude", () => {
  const project = createSampleProject();
  const compose = project.screens[0].elements.find((e) => e.name === "Compose")!;

  it("sends a well-formed Anthropic request and returns validated operations", async () => {
    const fetchMock = vi.fn(async () => anthropicReply("```json\n" + JSON.stringify(whatsappPlan(compose.id)) + "\n```"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await aiRoute(
      request({
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        apiKey: KEY,
        instruction: "make a WhatsApp-style chat screen with contact Anna",
        project: projectForPrompt(project),
        selection: { screenId: project.screens[0].id, elementId: null },
        history: [{ role: "user", content: "hi" }, { role: "assistant", content: "Hello" }],
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe(KEY);
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    const sent = JSON.parse(String(init.body));
    expect(sent.model).toBe("claude-sonnet-4-5");
    expect(sent.system).toBe(SYSTEM_PROMPT);
    expect(sent.max_tokens).toBeGreaterThan(1000);
    expect(sent.messages).toHaveLength(3);
    expect(sent.messages.at(-1).content).toContain("WhatsApp-style chat screen with contact Anna");
    expect(sent.messages.at(-1).content).toContain(compose.id);

    expect(res.status).toBe(200);
    const raw = await res.text();
    expect(raw).not.toContain(KEY);
    const data = JSON.parse(raw);
    expect(data.summary).toMatch(/Anna/);
    expect(data.operations).toHaveLength(10);
    expect(data.rejected).toHaveLength(1);
    expect(data.rejected[0]).toMatch(/addElement/);
  });

  it("applies the plan into a working chat screen", () => {
    const draft = structuredClone(project);
    const { plan } = parsePlan(whatsappPlan(compose.id));
    const result = applyOperations(draft, plan.operations);

    const anna = draft.screens.find((s) => s.name === "WhatsApp — Anna")!;
    expect(anna).toBeTruthy();
    expect(anna.elements.map((e) => e.type)).toEqual(["statusbar", "navbar", "messagelist", "textfield", "button"]);
    expect(anna.elements[0].width).toBe(393);
    expect(anna.elements[1].y).toBe(54);

    const field = anna.elements.find((e) => e.type === "textfield")!;
    expect(field.props.variable).toBe("annaDraft");
    expect(field.interactions[0]).toMatchObject({ trigger: "submit", action: { type: "sendMessage", to: "annaMessages" } });
    expect(anna.elements.find((e) => e.type === "button")!.showIf).toBe("annaDraft");

    const composeAfter = draft.screens[0].elements.find((e) => e.id === compose.id)!;
    expect(composeAfter.interactions[0].action).toEqual({ type: "navigate", screenId: anna.id, transition: "push" });

    const messages = draft.variables.find((v) => v.name === "annaMessages")!;
    expect(Array.isArray(messages.initial) && messages.initial).toHaveLength(2);

    expect(result.errors).toEqual(["updateElement: element does-not-exist not found"]);
    expect(result.addedScreens).toBe(1);
    expect(result.focus?.screenId).toBe(anna.id);
    expect(project.screens).toHaveLength(4);
  });

  it("explains a rejected key", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => anthropicReply("invalid x-api-key", 401)));
    const res = await aiRoute(request({ provider: "anthropic", model: "claude-sonnet-4-5", apiKey: "bad", instruction: "x", project: {}, selection: {} }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/Check the API key/);
  });

  it("explains an unknown model", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => anthropicReply("model: claude-nope", 404)));
    const res = await aiRoute(request({ provider: "anthropic", model: "claude-nope", apiKey: KEY, instruction: "x", project: {}, selection: {} }));
    expect((await res.json()).error).toMatch(/Check the model name/);
  });

  it("handles a reply that isn't JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => anthropicReply("Sure! I'd love to help with that.")));
    const res = await aiRoute(request({ provider: "anthropic", model: "claude-sonnet-4-5", apiKey: KEY, instruction: "x", project: {}, selection: {} }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/valid JSON/);
  });

  it("refuses requests without a key and never calls out", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await aiRoute(request({ provider: "anthropic", model: "claude-sonnet-4-5", apiKey: "", instruction: "x", project: {}, selection: {} }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("/api/ai/models with a mocked Claude", () => {
  it("lists Claude models for the key", async () => {
    const fetchMock = vi.fn(async () => Response.json({ data: [{ id: "claude-sonnet-4-5" }, { id: "claude-haiku-4-5" }, { id: "other" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await modelsRoute(new Request("http://localhost/api/ai/models", { method: "POST", body: JSON.stringify({ provider: "anthropic", apiKey: KEY }) }));
    expect(await res.json()).toEqual({ models: ["claude-sonnet-4-5", "claude-haiku-4-5"] });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("api.anthropic.com/v1/models");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe(KEY);
  });
});

"use client";

import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { AlertTriangle, ArrowUp, Check, Loader2, PlugZap, Settings2, Sparkles, Undo2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyOperations, projectForPrompt, type AiPlan } from "@/lib/ai/ops";
import { offlinePlan } from "@/lib/ai/offline";
import { DEFAULT_AI_SETTINGS, loadAiSettings, PROVIDER_LABELS, saveAiSettings, type AiSettings } from "@/lib/ai/settings";
import type { Project } from "@/lib/model";
import { findElement, useEditor } from "@/lib/store";
import { cn } from "@/lib/utils";
import { AiSettingsDialog } from "./ai-settings-dialog";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  text: string;
  changes?: string[];
  problems?: string[];
  tone?: "error" | "info";
  offline?: boolean;
  /** The project right after this change, so Undo only applies if nothing changed since. */
  after?: Project;
}

const useChat = create<{ messages: ChatMsg[]; pending: boolean; push: (m: ChatMsg) => void; setPending: (p: boolean) => void }>((set) => ({
  messages: [],
  pending: false,
  push: (m) => set((s) => ({ messages: [...s.messages, m] })),
  setPending: (pending) => set({ pending }),
}));

const SUGGESTIONS = [
  "Make a WhatsApp-style chat screen with contact Anna",
  "Make the send button green",
  "Add a settings screen linked from the compose icon",
  "Add a dark mode toggle that hides the search field when on",
];

const OFFLINE_HELP =
  "Offline I can handle simple commands: “make the send button blue”, “set the title to “Inbox””, “add a settings screen”, “add a button saying “Call””, “link Edit to Contact Details”, “delete this”. Add a Claude (Anthropic) API key in AI settings for everything else.";

let seq = 0;
const nextId = () => `msg_${Date.now()}_${seq++}`;

function selectionInfo() {
  const { project, screenId, elementId } = useEditor.getState();
  if (!project) return null;
  const screen = project.screens.find((s) => s.id === screenId);
  const found = elementId ? findElement(project, elementId) : null;
  return {
    screenId: found?.screen.id ?? screen?.id ?? null,
    screenName: found?.screen.name ?? screen?.name ?? null,
    elementId: found?.el.id ?? null,
    elementName: found?.el.name ?? null,
    elementType: found?.el.type ?? null,
  };
}

export function AiPanel({ onFit, focusSignal }: { onFit: () => void; focusSignal: number }) {
  const { messages, pending } = useChat();
  const [input, setInput] = useState("");
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const project = useEditor((s) => s.project);
  useEditor((s) => s.screenId);
  useEditor((s) => s.elementId);
  const info = selectionInfo();

  useEffect(() => {
    const id = window.setTimeout(() => setSettings(loadAiSettings()), 0);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, pending]);
  useEffect(() => {
    if (focusSignal) inputRef.current?.focus();
  }, [focusSignal]);

  const key = settings.keys[settings.provider];
  const model = settings.models[settings.provider];

  const saveSettings = (next: AiSettings) => {
    saveAiSettings(next);
    setSettings(next);
  };

  /** Saving is the only thing connecting does; the key is first used on the next request. */
  const connect = (anthropicKey: string) => {
    const next: AiSettings = { ...settings, provider: "anthropic", keys: { ...settings.keys, anthropic: anthropicKey } };
    saveSettings(next);
    useChat.getState().push({
      id: nextId(),
      role: "assistant",
      tone: "info",
      text: `Claude connected (${next.models.anthropic}). Describe a screen or a change and I'll build it.`,
    });
    inputRef.current?.focus();
  };

  const apply = (plan: AiPlan, extraProblems: string[], offline: boolean) => {
    const { project, commit, select } = useEditor.getState();
    if (!project) return;
    const draft = structuredClone(project);
    const result = applyOperations(draft, plan.operations);
    const problems = [...extraProblems, ...result.errors];
    let after: Project | undefined;
    if (result.changes.length) {
      commit(draft);
      after = useEditor.getState().project ?? undefined;
      if (result.focus) select(result.focus.screenId, result.focus.elementId);
      if (result.addedScreens) window.setTimeout(onFit, 50);
    }
    useChat.getState().push({
      id: nextId(),
      role: "assistant",
      text: plan.summary || (result.changes.length ? "Done." : "I didn't change anything."),
      changes: result.changes,
      problems,
      offline,
      after,
    });
  };

  const send = async (raw: string) => {
    const instruction = raw.trim();
    const chat = useChat.getState();
    if (!instruction || chat.pending || !project) return;
    setInput("");
    const history = chat.messages
      .filter((m) => !m.tone)
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.role === "assistant" ? [m.text, ...(m.changes ?? [])].join("\n") : m.text }));
    chat.push({ id: nextId(), role: "user", text: instruction });
    const sel = selectionInfo() ?? { screenId: null, elementId: null };

    if (!key) {
      const plan = offlinePlan(project, sel, instruction);
      if (plan) apply(plan, [], true);
      else chat.push({ id: nextId(), role: "assistant", tone: "info", offline: true, text: `I couldn't do that without an AI model. ${OFFLINE_HELP}` });
      return;
    }

    chat.setPending(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: settings.provider,
          model,
          apiKey: key,
          instruction,
          project: projectForPrompt(useEditor.getState().project!),
          selection: sel,
          history,
        }),
      });
      const data = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
      if (!res.ok || data.error) throw new Error(data.error ?? `Request failed (${res.status})`);
      apply({ summary: data.summary, operations: data.operations }, (data.rejected ?? []).map((r: string) => `Skipped invalid operation ${r}`), false);
    } catch (e) {
      useChat.getState().push({ id: nextId(), role: "assistant", tone: "error", text: (e as Error).message || "Something went wrong." });
    } finally {
      useChat.getState().setPending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2 text-xs">
        {key ? (
          <span className="truncate text-muted-foreground">
            {PROVIDER_LABELS[settings.provider]} · <span className="text-foreground">{model}</span>
          </span>
        ) : (
          <button type="button" onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 text-amber-300 hover:text-amber-200">
            <WifiOff className="size-3.5" /> Claude not connected · offline commands only
          </button>
        )}
        <Button size="icon-xs" variant="ghost" className="ml-auto" title="AI settings" onClick={() => setSettingsOpen(true)}>
          <Settings2 />
        </Button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3 pt-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-violet-400" /> Describe what to build or change
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              The assistant edits screens, elements, variables and interactions. Each request is one undo step.
            </p>
            {!key && <ConnectCard settings={settings} onConnect={connect} />}
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-md border border-border px-2.5 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-violet-500/50 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <Message key={m.id} m={m} />
            ))}
            {!key && <ConnectCard settings={settings} onConnect={connect} />}
            {pending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Designing with {model}…
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border/60 p-2">
        {info?.screenName && (
          <div className="mb-1.5 truncate px-1 text-[11px] text-muted-foreground">
            Context: <span className="text-foreground">{info.elementName ? `${info.elementName} · ` : ""}{info.screenName}</span>
          </div>
        )}
        <div className="flex items-end gap-1.5 rounded-lg border border-input bg-input/30 p-1.5 focus-within:border-ring">
          <textarea
            ref={inputRef}
            rows={2}
            aria-label="Message the AI assistant"
            value={input}
            disabled={pending}
            placeholder={key ? "e.g. add a settings screen linked from the gear icon" : "e.g. make the send button blue"}
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <Button size="icon-sm" disabled={!input.trim() || pending} onClick={() => send(input)} className="bg-violet-500 text-white hover:bg-violet-400" title="Send (Enter)">
            {pending ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          </Button>
        </div>
      </div>

      <AiSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSave={saveSettings}
      />
    </div>
  );
}

function ConnectCard({ settings, onConnect }: { settings: AiSettings; onConnect: (key: string) => void }) {
  const [value, setValue] = useState("");
  const trimmed = value.trim();
  const looksWrong = trimmed.length > 0 && !trimmed.startsWith("sk-ant-");
  return (
    <form
      className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed) onConnect(trimmed);
      }}
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-200">
        <PlugZap className="size-3.5" /> Claude not connected — add your API key in settings
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Paste an Anthropic API key to connect. Until then, simple commands like “make the send button blue” run offline, and nothing is sent anywhere.
      </p>
      <div className="flex gap-1.5">
        <Input
          type="password"
          autoComplete="off"
          placeholder="sk-ant-…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text").trim();
            if (pasted.startsWith("sk-ant-")) {
              e.preventDefault();
              onConnect(pasted);
            }
          }}
          className="h-8 text-xs"
          aria-label="Anthropic API key"
        />
        <Button type="submit" size="sm" disabled={!trimmed}>
          Connect
        </Button>
      </div>
      {looksWrong && <p className="text-[11px] text-amber-300">Anthropic keys usually start with sk-ant-.</p>}
      <p className="text-[11px] text-muted-foreground">
        Get one at{" "}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
          console.anthropic.com
        </a>
        . A Claude.ai subscription doesn&apos;t include API access. Model: {settings.models.anthropic}.
      </p>
    </form>
  );
}

function Message({ m }: { m: ChatMsg }) {
  const current = useEditor((s) => s.project);
  if (m.role === "user")
    return <div className="ml-6 self-end rounded-xl rounded-br-sm bg-violet-500/20 px-3 py-2 text-sm whitespace-pre-wrap text-violet-50">{m.text}</div>;

  const canUndo = !!m.after && current === m.after;
  return (
    <div
      className={cn(
        "mr-2 flex flex-col gap-1.5 rounded-xl rounded-bl-sm border px-3 py-2 text-sm",
        m.tone === "error" ? "border-destructive/40 bg-destructive/10" : m.tone === "info" ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-muted/40",
      )}
    >
      <div className="flex gap-2">
        {m.tone === "error" && <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />}
        <p className="leading-snug whitespace-pre-wrap">{m.text}</p>
      </div>
      {!!m.changes?.length && (
        <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {m.changes.map((c, i) => (
            <li key={i} className="flex gap-1.5">
              <Check className="mt-0.5 size-3 shrink-0 text-emerald-400" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      )}
      {!!m.problems?.length && (
        <ul className="flex flex-col gap-0.5 text-xs text-amber-300/90">
          {m.problems.map((c, i) => (
            <li key={i} className="flex gap-1.5">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      )}
      {(m.after || m.offline) && (
        <div className="flex items-center gap-2 pt-0.5 text-[11px] text-muted-foreground">
          {m.offline && <span className="text-amber-300/80">Offline rules</span>}
          {m.after && (
            <Button size="xs" variant="ghost" className="ml-auto h-6" disabled={!canUndo} onClick={() => useEditor.getState().undo()} title={canUndo ? "Undo this change" : "The project changed since"}>
              <Undo2 /> Undo
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

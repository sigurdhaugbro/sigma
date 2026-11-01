"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MODEL_SUGGESTIONS, PROVIDER_LABELS, PROVIDERS, type AiSettings, type Provider } from "@/lib/ai/settings";
import { cn } from "@/lib/utils";

export function AiSettingsDialog({
  open,
  onOpenChange,
  settings,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AiSettings;
  onSave: (s: AiSettings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [reveal, setReveal] = useState(false);
  const [available, setAvailable] = useState<Partial<Record<Provider, string[]>>>({});
  const [loading, setLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(settings);
  }
  const p = draft.provider;
  const suggestions = available[p]?.length ? available[p]! : MODEL_SUGGESTIONS[p];

  const loadModels = async () => {
    // Only a key that has been saved may reach the network.
    const key = settings.keys[p];
    if (!key) return;
    setLoading(true);
    setModelError(null);
    try {
      const res = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: p, apiKey: key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't load models.");
      const models: string[] = data.models ?? [];
      setAvailable((a) => ({ ...a, [p]: models }));
      if (models.length && !models.includes(draft.models[p])) {
        const preferred = p === "anthropic" ? models.find((m) => m.includes("sonnet")) : models.find((m) => m.startsWith("gpt-5"));
        setDraft((d) => ({ ...d, models: { ...d.models, [p]: preferred ?? models[0] } }));
      }
    } catch (e) {
      setModelError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>AI assistant settings</DialogTitle>
          <DialogDescription>
            Keys are stored only in this browser. Each request passes the key through this app&apos;s server to the provider; the server never saves it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Provider</Label>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {PROVIDERS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDraft({ ...draft, provider: id })}
                  className={cn("rounded-md py-1.5 text-sm transition-colors", p === id ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {PROVIDER_LABELS[id]}
                  {draft.keys[id] ? <span className="ml-1.5 inline-block size-1.5 rounded-full bg-emerald-400 align-middle" /> : null}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-key">{PROVIDER_LABELS[p]} API key</Label>
            <div className="flex gap-1.5">
              <Input
                id="ai-key"
                type={reveal ? "text" : "password"}
                autoComplete="off"
                placeholder={p === "anthropic" ? "sk-ant-…" : "sk-…"}
                value={draft.keys[p] ?? ""}
                onChange={(e) => setDraft({ ...draft, keys: { ...draft.keys, [p]: e.target.value.trim() } })}
              />
              <Button variant="outline" size="icon" onClick={() => setReveal((r) => !r)} title={reveal ? "Hide key" : "Show key"}>
                {reveal ? <EyeOff /> : <Eye />}
              </Button>
            </div>
            {p === "anthropic" ? (
              <p className="text-xs text-muted-foreground">
                Needs an API key from{" "}
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
                  console.anthropic.com
                </a>
                . A Claude.ai subscription doesn&apos;t include API access.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Optional alternative. Needs an API key from platform.openai.com.</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="ai-model">Model</Label>
              <Button size="xs" variant="ghost" disabled={!settings.keys[p] || settings.keys[p] !== draft.keys[p] || loading}
                onClick={loadModels}
                title={settings.keys[p] && settings.keys[p] === draft.keys[p] ? "List the models this key can use" : "Save the key first"}>
                {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Load from key
              </Button>
            </div>
            <Input
              id="ai-model"
              list={`models-${p}`}
              value={draft.models[p]}
              onChange={(e) => setDraft({ ...draft, models: { ...draft.models, [p]: e.target.value } })}
            />
            <datalist id={`models-${p}`}>
              {suggestions.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            {modelError && <p className="text-xs text-destructive">{modelError}</p>}
            <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
              {suggestions.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDraft({ ...draft, models: { ...draft.models, [p]: m } })}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px]",
                    draft.models[p] === m ? "border-sky-500 text-sky-300" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          {draft.keys[p] && (
            <Button variant="ghost" className="mr-auto text-destructive" onClick={() => setDraft({ ...draft, keys: { ...draft.keys, [p]: undefined } })}>
              Remove key
            </Button>
          )}
          <Button
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

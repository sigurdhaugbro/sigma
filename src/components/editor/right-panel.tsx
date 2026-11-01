"use client";

import { SlidersHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { AiPanel } from "./ai-panel";
import { PropertiesPanel } from "./properties-panel";

export type RightTab = "design" | "ai";

export function RightPanel({
  tab,
  onTab,
  onPlay,
  onFit,
  aiFocusSignal,
}: {
  tab: RightTab;
  onTab: (t: RightTab) => void;
  onPlay: (screenId?: string) => void;
  onFit: () => void;
  aiFocusSignal: number;
}) {
  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex gap-1 border-b border-border p-1.5">
        {(
          [
            ["design", "Design", SlidersHorizontal],
            ["ai", "AI", Sparkles],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => onTab(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors",
              tab === id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            title={id === "ai" ? "AI assistant (⌘K)" : "Design properties"}
          >
            <Icon className={cn("size-3.5", id === "ai" && tab === id && "text-violet-400")} /> {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {/* Both stay mounted so the chat keeps its draft and scroll position. */}
        <div className={cn("h-full", tab !== "design" && "hidden")}>
          <PropertiesPanel onPlay={onPlay} />
        </div>
        <div className={cn("h-full", tab !== "ai" && "hidden")}>
          <AiPanel onFit={onFit} focusSignal={aiFocusSignal} />
        </div>
      </div>
    </aside>
  );
}

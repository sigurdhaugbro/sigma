"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Circle, Clapperboard, Download, FilePlus2, Frame, Grid3x3, Magnet, Maximize2, Minus, Monitor, MousePointer2, Pencil, Play, Plus, Redo2, Smartphone, Sparkles, Square, Tablet, Trash2, Type, Undo2, Upload } from "lucide-react";
import { PlayOnIPhoneDialog } from "./play-on-iphone";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createProject, type Project } from "@/lib/model";
import { createSampleProject } from "@/lib/sample";
import { deleteProject, downloadProject, listProjects, loadProject, readProjectFile, type ProjectSummary } from "@/lib/storage";
import { useEditor, type EditorTool } from "@/lib/store";
import { cn } from "@/lib/utils";

const TOOLS: { id: EditorTool; label: string; icon: typeof MousePointer2; key: string }[] = [
  { id: "select", label: "Select", icon: MousePointer2, key: "V" },
  { id: "pen", label: "Pencil", icon: Pencil, key: "P" },
  { id: "rect", label: "Rectangle", icon: Square, key: "R" },
  { id: "ellipse", label: "Ellipse", icon: Circle, key: "O" },
  { id: "line", label: "Line", icon: Minus, key: "L" },
  { id: "text", label: "Text", icon: Type, key: "T" },
];

export function Toolbar({ onPlay, onOpenProject, onFit }: { onPlay: () => void; onOpenProject: (p: Project) => void; onFit: () => void }) {
  const project = useEditor((s) => s.project)!;
  const zoom = useEditor((s) => s.view.zoom);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const screenId = useEditor((s) => s.screenId);
  const tool = useEditor((s) => s.tool);
  const grid = useEditor((s) => s.grid);
  const { undo, redo, addScreen, mutate, setTool, setGrid } = useEditor.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [recent, setRecent] = useState<ProjectSummary[]>([]);
  const [iphoneOpen, setIphoneOpen] = useState(false);

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border bg-card px-2">
      <DropdownMenu onOpenChange={(open) => open && setRecent(listProjects())}>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="gap-1.5 font-semibold" />}>
          <Clapperboard className="text-amber-400" />
          <span className="hidden sm:inline">Sigma</span>
          <ChevronDown className="opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => onOpenProject(createProject())}>
              <FilePlus2 /> New blank project
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenProject(createSampleProject())}>
              <Sparkles /> New from Messages sample
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => fileRef.current?.click()}>
              <Upload /> Import JSON…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadProject(project)}>
              <Download /> Export JSON
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {recent.length > 1 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Saved in this browser</DropdownMenuLabel>
                {recent.map((r) => (
                  <DropdownMenuItem
                    key={r.id}
                    disabled={r.id === project.id}
                    onClick={() => {
                      const p = loadProject(r.id);
                      if (p) onOpenProject(p);
                    }}
                  >
                    <span className="truncate">{r.name}</span>
                    {r.id !== project.id && (
                      <span
                        role="button"
                        className="ml-auto rounded p-0.5 opacity-50 hover:bg-destructive/20 hover:opacity-100"
                        title="Delete project"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${r.name}"? This can't be undone.`)) {
                            deleteProject(r.id);
                            setRecent(listProjects());
                          }
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            const p = await readProjectFile(file);
            onOpenProject(p);
            toast.success(`Imported “${p.name}”`);
          } catch {
            toast.error("That file isn't a Sigma project.");
          }
        }}
      />

      <input
        className="mx-1 h-7 w-44 min-w-0 rounded-md bg-transparent px-2 text-sm text-muted-foreground outline-none hover:bg-muted focus:bg-muted focus:text-foreground"
        value={project.name}
        onFocus={() => useEditor.getState().beginTx()}
        onBlur={() => useEditor.getState().endTx()}
        onChange={(e) => mutate((d) => void (d.name = e.target.value))}
        aria-label="Project name"
      />

      <div className="mx-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <Plus /> <span className="hidden sm:inline">Screen</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => addScreen("iphone")}>
              <Smartphone /> iPhone screen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addScreen("ipad")}>
              <Tablet /> iPad screen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addScreen("mac")}>
              <Monitor /> Mac window
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addScreen("canvas")}>
              <Frame /> Canvas
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="mx-1 flex items-center rounded-md border border-border/70 p-0.5">
          {TOOLS.map(({ id, label, icon: Icon, key }) => (
            <Button
              key={id}
              variant="ghost"
              size="icon-sm"
              title={`${label} (${key})`}
              onClick={() => setTool(id)}
              className={cn(tool === id && "bg-sky-500/20 text-sky-200")}
            >
              <Icon />
            </Button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          title={grid.visible ? "Hide grid" : "Show grid"}
          onClick={() => setGrid({ visible: !grid.visible })}
          className={cn(grid.visible && "bg-sky-500/20 text-sky-200")}
        >
          <Grid3x3 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title={grid.snap ? "Snap off" : "Snap to grid"}
          onClick={() => setGrid({ snap: !grid.snap })}
          className={cn(grid.snap && "bg-sky-500/20 text-sky-200")}
        >
          <Magnet />
        </Button>
        <Button variant="ghost" size="icon-sm" disabled={!canUndo} onClick={undo} title="Undo (⌘Z)">
          <Undo2 />
        </Button>
        <Button variant="ghost" size="icon-sm" disabled={!canRedo} onClick={redo} title="Redo (⇧⌘Z)">
          <Redo2 />
        </Button>
        <Button variant="ghost" size="sm" onClick={onFit} title="Zoom to fit (Shift+1)" className="tabular-nums">
          <Maximize2 /> {Math.round(zoom * 100)}%
        </Button>
      </div>

      <Button size="sm" variant="outline" onClick={() => setIphoneOpen(true)} title="Play on iPhone">
        <Smartphone /> <span className="hidden xl:inline">iPhone</span>
      </Button>
      <Button size="sm" onClick={onPlay} className="bg-sky-500 text-white hover:bg-sky-400" title="Play prototype (⌘Enter)">
        <Play className="fill-current" /> Present
      </Button>
      <PlayOnIPhoneDialog open={iphoneOpen} onOpenChange={setIphoneOpen} project={project} screenId={screenId ?? undefined} />
    </header>
  );
}

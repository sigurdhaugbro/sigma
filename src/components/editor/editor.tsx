"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createProject } from "@/lib/model";
import { createSampleProject } from "@/lib/sample";
import { currentProjectId, listProjects, loadProject, saveProject } from "@/lib/storage";
import { useEditor } from "@/lib/store";
import { Canvas, fitView } from "./canvas";
import { LeftPanel } from "./left-panel";
import { RightPanel, type RightTab } from "./right-panel";
import { Toolbar } from "./toolbar";

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

export function Editor() {
  const router = useRouter();
  const project = useEditor((s) => s.project);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [needsFit, setNeedsFit] = useState(true);
  const [rightTab, setRightTab] = useState<RightTab>("design");
  const [aiFocus, setAiFocus] = useState(0);

  useEffect(() => {
    const id = currentProjectId();
    let p = id ? loadProject(id) : null;
    if (!p && !listProjects().length) {
      p = createSampleProject();
      saveProject(p);
    }
    if (!p) {
      const first = listProjects()[0];
      p = first ? loadProject(first.id) : null;
    }
    useEditor.getState().load(p ?? createProject());
  }, []);

  useEffect(() => {
    if (project && needsFit && canvasRef.current) {
      fitView(project, canvasRef.current);
      setNeedsFit(false);
    }
  }, [project, needsFit]);

  useEffect(() => {
    if (!project) return;
    const t = window.setTimeout(() => {
      if (!saveProject(project)) toast.error("Couldn't save — browser storage is full. Remove large images or export the project.");
    }, 300);
    return () => window.clearTimeout(t);
  }, [project]);

  const openProject = useCallback((p: ReturnType<typeof createProject>) => {
    saveProject(p);
    useEditor.getState().load(p);
    setNeedsFit(true);
  }, []);

  const play = useCallback(
    (screenId?: string) => {
      const p = useEditor.getState().project;
      if (!p) return;
      saveProject(p);
      const s = screenId ?? p.startScreenId;
      router.push(`/play?id=${p.id}&screen=${s}`);
    },
    [router],
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setRightTab("ai");
        setAiFocus((n) => n + 1);
        return;
      }
      if (isTyping(e.target)) return;
      const s = useEditor.getState();
      if (e.code === "Space") {
        e.preventDefault();
        setSpaceDown(true);
        return;
      }
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        s.duplicateSelection();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        s.deleteSelection();
      } else if (e.key === "Escape") {
        if (s.elementId) s.select(s.screenId, null);
        else s.select(null, null);
      } else if (e.shiftKey && (e.key === "!" || e.code === "Digit1")) {
        if (s.project) fitView(s.project, canvasRef.current);
      } else if (mod && e.key === "Enter") {
        e.preventDefault();
        play(s.screenId ?? undefined);
      } else if (e.key.startsWith("Arrow") && s.elementId) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        s.updateElement(s.elementId, (el) => {
          if (e.key === "ArrowLeft") el.x -= step;
          if (e.key === "ArrowRight") el.x += step;
          if (e.key === "ArrowUp") el.y -= step;
          if (e.key === "ArrowDown") el.y += step;
        });
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [play]);

  if (!project) {
    return <div className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground">Loading your projects…</div>;
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <Toolbar onPlay={() => play()} onOpenProject={openProject} onFit={() => fitView(project, canvasRef.current)} />
      <div className="flex min-h-0 flex-1">
        <div className="hidden md:flex">
          <LeftPanel />
        </div>
        <main className="relative min-w-0 flex-1">
          <Canvas containerRef={canvasRef} spaceDown={spaceDown} />
        </main>
        <div className="hidden lg:flex">
          <RightPanel
            tab={rightTab}
            onTab={setRightTab}
            onPlay={play}
            onFit={() => fitView(useEditor.getState().project!, canvasRef.current)}
            aiFocusSignal={aiFocus}
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createProject, isDeck } from "@/lib/model";
import { applySlideNav, slideIndex } from "@/lib/slides";
import { createSampleProject } from "@/lib/sample";
import { currentProjectId, listProjects, loadProject, saveProject } from "@/lib/storage";
import { useEditor } from "@/lib/store";
import { DeckStage, fitSlide } from "@/components/slides/deck-stage";
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
      if (isDeck(project)) {
        const slide = project.screens.find((s) => s.id === useEditor.getState().screenId) ?? project.screens[0];
        if (slide) fitSlide(slide, canvasRef.current);
      } else {
        fitView(project, canvasRef.current);
      }
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
      const selected = useEditor.getState().screenId;
      const s = screenId ?? (isDeck(p) ? (selected ?? p.startScreenId) : p.startScreenId);
      router.push(isDeck(p) ? `/present?id=${p.id}&slide=${s}` : `/play?id=${p.id}&screen=${s}`);
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
      } else if (mod && e.key.toLowerCase() === "c") {
        e.preventDefault();
        s.copySelection();
      } else if (mod && e.key.toLowerCase() === "x") {
        e.preventDefault();
        s.cutSelection();
      } else if (mod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        s.pasteSelection();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        s.deleteSelection();
      } else if (e.key === "Escape") {
        if (s.tool !== "select") s.setTool("select");
        else if (s.elementIds.length) s.select(s.screenId, null);
        else s.select(null, null);
      } else if (e.shiftKey && (e.key === "!" || e.code === "Digit1")) {
        if (s.project) {
          if (isDeck(s.project)) {
            const slide = s.project.screens.find((x) => x.id === s.screenId) ?? s.project.screens[0];
            if (slide) fitSlide(slide, canvasRef.current);
          } else fitView(s.project, canvasRef.current);
        }
      } else if (mod && e.key === "Enter") {
        e.preventDefault();
        play(s.screenId ?? undefined);
      } else if (e.key.startsWith("Arrow") && s.elementIds.length) {
        e.preventDefault();
        const step = e.shiftKey ? (s.grid.snap ? s.grid.size : 10) : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        s.nudgeSelection(dx, dy);
      } else if (e.key.startsWith("Arrow") && s.project && isDeck(s.project) && !s.elementIds.length) {
        e.preventDefault();
        const nav = e.key === "ArrowRight" || e.key === "ArrowDown" ? "next" : e.key === "ArrowLeft" || e.key === "ArrowUp" ? "prev" : null;
        if (!nav) return;
        const i = applySlideNav(slideIndex(s.project.screens, s.screenId), s.project.screens.length, nav);
        const next = s.project.screens[i];
        if (next) s.select(next.id, null);
      } else if (!mod && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === "v") s.setTool("select");
        else if (k === "p") s.setTool("pen");
        else if (k === "r") s.setTool("rect");
        else if (k === "o") s.setTool("ellipse");
        else if (k === "l") s.setTool("line");
        else if (k === "t") s.setTool("text");
        else if (k === "g") s.setGrid({ visible: !s.grid.visible });
        else if (k === ";") s.setGrid({ snap: !s.grid.snap });
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
      <Toolbar
        onPlay={() => play()}
        onOpenProject={openProject}
        onFit={() => {
          if (isDeck(project)) {
            const slide = project.screens.find((s) => s.id === useEditor.getState().screenId) ?? project.screens[0];
            if (slide) fitSlide(slide, canvasRef.current);
          } else fitView(project, canvasRef.current);
        }}
      />
      <div className="flex min-h-0 flex-1">
        <div className="hidden md:flex">
          <LeftPanel />
        </div>
        <main className="relative min-w-0 flex-1">
          {isDeck(project) ? <DeckStage containerRef={canvasRef} spaceDown={spaceDown} /> : <Canvas containerRef={canvasRef} spaceDown={spaceDown} />}
        </main>
        <div className="hidden lg:flex">
          <RightPanel
            tab={rightTab}
            onTab={setRightTab}
            onPlay={play}
            onFit={() => {
              const p = useEditor.getState().project!;
              if (isDeck(p)) {
                const slide = p.screens.find((s) => s.id === useEditor.getState().screenId) ?? p.screens[0];
                if (slide) fitSlide(slide, canvasRef.current);
              } else fitView(p, canvasRef.current);
            }}
            aiFocusSignal={aiFocus}
          />
        </div>
      </div>
    </div>
  );
}

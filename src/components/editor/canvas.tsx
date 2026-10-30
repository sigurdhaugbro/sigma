"use client";

import { useEffect, useMemo, useState, type PointerEvent as RPointerEvent } from "react";
import { Play } from "lucide-react";
import { DEVICES, type Element, type Project, type Screen } from "@/lib/model";
import { useEditor } from "@/lib/store";
import { RuntimeContext, staticRuntime } from "@/components/device/runtime-context";
import { ScreenView } from "@/components/device/screen-view";
import { cn } from "@/lib/utils";

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/** Tracks pointer movement in world units (screen pixels divided by zoom) until release. */
function drag(e: RPointerEvent, onMove: (dx: number, dy: number, ev: PointerEvent) => void, onEnd?: (moved: boolean) => void) {
  const zoom = useEditor.getState().view.zoom;
  const sx = e.clientX;
  const sy = e.clientY;
  let moved = false;
  const move = (ev: PointerEvent) => {
    const dx = (ev.clientX - sx) / zoom;
    const dy = (ev.clientY - sy) / zoom;
    if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 3) return;
    moved = true;
    onMove(dx, dy, ev);
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    onEnd?.(moved);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

export function fitView(project: Project, el: HTMLElement | null) {
  if (!el || !project.screens.length) return;
  const minX = Math.min(...project.screens.map((s) => s.x));
  const minY = Math.min(...project.screens.map((s) => s.y)) - 40;
  const maxX = Math.max(...project.screens.map((s) => s.x + s.width));
  const maxY = Math.max(...project.screens.map((s) => s.y + s.height));
  const pad = 60;
  const zoom = Math.min(2, (el.clientWidth - pad * 2) / (maxX - minX), (el.clientHeight - pad * 2) / (maxY - minY));
  useEditor.getState().setView({
    zoom,
    x: (el.clientWidth - (maxX - minX) * zoom) / 2 - minX * zoom,
    y: (el.clientHeight - (maxY - minY) * zoom) / 2 - minY * zoom,
  });
}

export function Canvas({ containerRef, spaceDown }: { containerRef: React.RefObject<HTMLDivElement | null>; spaceDown: boolean }) {
  const project = useEditor((s) => s.project)!;
  const view = useEditor((s) => s.view);
  const [panning, setPanning] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { view, setView } = useEditor.getState();
      if (e.ctrlKey || e.metaKey) {
        const rect = node.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const zoom = Math.min(8, Math.max(0.05, view.zoom * Math.exp(-e.deltaY * 0.01)));
        setView({ zoom, x: cx - ((cx - view.x) * zoom) / view.zoom, y: cy - ((cy - view.y) * zoom) / view.zoom });
      } else {
        setView({ x: view.x - e.deltaX, y: view.y - e.deltaY });
      }
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [containerRef]);

  const startPan = (e: RPointerEvent) => {
    const start = useEditor.getState().view;
    const zoom = start.zoom;
    setPanning(true);
    drag(
      e,
      (dx, dy) => useEditor.getState().setView({ x: start.x + dx * zoom, y: start.y + dy * zoom }),
      () => setPanning(false),
    );
  };

  const onBackgroundDown = (e: RPointerEvent) => {
    if (e.button === 1 || spaceDown || e.target === e.currentTarget) {
      if (e.target === e.currentTarget && !spaceDown && e.button === 0) useEditor.getState().select(null, null);
      startPan(e);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("canvas-bg relative h-full w-full overflow-hidden", spaceDown && "cursor-grab", panning && "cursor-grabbing")}
      onPointerDown={onBackgroundDown}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, pointerEvents: spaceDown ? "none" : undefined }}
      >
        {project.screens.map((s) => (
          <ScreenFrame key={s.id} screen={s} project={project} zoom={view.zoom} />
        ))}
      </div>
    </div>
  );
}

function ScreenFrame({ screen, project, zoom }: { screen: Screen; project: Project; zoom: number }) {
  const selectedScreen = useEditor((s) => s.screenId === screen.id);
  const elementId = useEditor((s) => s.elementId);
  const [hover, setHover] = useState<string | null>(null);
  const runtime = useMemo(
    () => staticRuntime(Object.fromEntries(project.variables.map((v) => [v.name, v.initial]))),
    [project.variables],
  );
  const selectedEl = screen.elements.find((e) => e.id === elementId);
  const isStart = project.startScreenId === screen.id;
  const dev = DEVICES[screen.device];

  const moveScreen = (e: RPointerEvent) => {
    e.stopPropagation();
    const { select, beginTx, endTx, updateScreen } = useEditor.getState();
    select(screen.id, null);
    const sx = screen.x;
    const sy = screen.y;
    beginTx();
    drag(
      e,
      (dx, dy) =>
        updateScreen(screen.id, (s) => {
          s.x = Math.round(sx + dx);
          s.y = Math.round(sy + dy);
        }),
      endTx,
    );
  };

  const moveElement = (e: RPointerEvent, el: Element) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const { select, beginTx, endTx, updateElement } = useEditor.getState();
    select(screen.id, el.id);
    const sx = el.x;
    const sy = el.y;
    beginTx();
    drag(
      e,
      (dx, dy, ev) =>
        updateElement(el.id, (d) => {
          let nx = sx + dx;
          let ny = sy + dy;
          if (ev.shiftKey) {
            if (Math.abs(dx) > Math.abs(dy)) ny = sy;
            else nx = sx;
          }
          d.x = Math.round(nx);
          d.y = Math.round(ny);
        }),
      endTx,
    );
  };

  const resize = (e: RPointerEvent, el: Element, h: Handle) => {
    e.stopPropagation();
    const { beginTx, endTx, updateElement } = useEditor.getState();
    const start = { x: el.x, y: el.y, w: el.width, h: el.height };
    beginTx();
    drag(
      e,
      (dx, dy) =>
        updateElement(el.id, (d) => {
          let { x, y, w, h: hh } = start;
          if (h.includes("e")) w = start.w + dx;
          if (h.includes("s")) hh = start.h + dy;
          if (h.includes("w")) {
            w = start.w - dx;
            x = start.x + dx;
          }
          if (h.includes("n")) {
            hh = start.h - dy;
            y = start.y + dy;
          }
          if (w < 4) {
            if (h.includes("w")) x -= 4 - w;
            w = 4;
          }
          if (hh < 4) {
            if (h.includes("n")) y -= 4 - hh;
            hh = 4;
          }
          d.x = Math.round(x);
          d.y = Math.round(y);
          d.width = Math.round(w);
          d.height = Math.round(hh);
        }),
      endTx,
    );
  };

  const inv = 1 / zoom;
  const handleSize = 8 * inv;

  return (
    <div className="absolute" style={{ left: screen.x, top: screen.y, width: screen.width, height: screen.height }}>
      <div
        className={cn(
          "absolute left-0 flex cursor-move items-center gap-1 whitespace-nowrap select-none",
          selectedScreen ? "text-sky-400" : "text-neutral-400 hover:text-neutral-200",
        )}
        style={{ top: -26 * inv, fontSize: 12 * inv, height: 20 * inv }}
        onPointerDown={moveScreen}
        onDoubleClick={() => window.open(`/play?id=${project.id}&screen=${screen.id}`, "_self")}
        title="Drag to move · double-click to play from here"
      >
        {isStart && <Play style={{ width: 11 * inv, height: 11 * inv }} className="fill-current" />}
        <span className="font-medium">{screen.name}</span>
        <span className="opacity-60">· {dev.label}</span>
      </div>
      <div
        className="absolute inset-0"
        style={{
          borderRadius: dev.radius,
          boxShadow: selectedScreen && !elementId ? `0 0 0 ${2 * inv}px #38bdf8` : "0 10px 40px rgba(0,0,0,.45)",
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          useEditor.getState().select(screen.id, null);
        }}
      >
        <RuntimeContext.Provider value={runtime}>
          <ScreenView screen={screen} />
        </RuntimeContext.Provider>
        <div className="absolute inset-0">
          {screen.elements.map((el) =>
            el.hidden ? null : (
              <div
                key={el.id}
                className="absolute"
                style={{ left: el.x, top: el.y, width: el.width, height: el.height }}
                onPointerDown={(e) => moveElement(e, el)}
                onPointerEnter={() => setHover(el.id)}
                onPointerLeave={() => setHover((h) => (h === el.id ? null : h))}
              />
            ),
          )}
          {hover && hover !== elementId && (() => {
            const el = screen.elements.find((x) => x.id === hover);
            return el ? (
              <div
                className="pointer-events-none absolute"
                style={{ left: el.x, top: el.y, width: el.width, height: el.height, boxShadow: `0 0 0 ${1.5 * inv}px #38bdf8` }}
              />
            ) : null;
          })()}
          {selectedEl && !selectedEl.hidden && (
            <div
              className="pointer-events-none absolute"
              style={{ left: selectedEl.x, top: selectedEl.y, width: selectedEl.width, height: selectedEl.height, boxShadow: `0 0 0 ${1.5 * inv}px #0ea5e9` }}
            >
              {HANDLES.map((h) => {
                const left = h.includes("w") ? 0 : h.includes("e") ? "100%" : "50%";
                const top = h.includes("n") ? 0 : h.includes("s") ? "100%" : "50%";
                return (
                  <div
                    key={h}
                    className="pointer-events-auto absolute rounded-[1px] border-sky-500 bg-white"
                    style={{
                      left,
                      top,
                      width: handleSize,
                      height: handleSize,
                      borderWidth: 1.5 * inv,
                      transform: "translate(-50%, -50%)",
                      cursor: `${h}-resize`,
                    }}
                    onPointerDown={(e) => resize(e, selectedEl, h)}
                  />
                );
              })}
              <div
                className="absolute left-1/2 -translate-x-1/2 rounded bg-sky-500 px-1 whitespace-nowrap text-white tabular-nums"
                style={{ top: `calc(100% + ${6 * inv}px)`, fontSize: 10 * inv, lineHeight: `${16 * inv}px` }}
              >
                {selectedEl.width} × {selectedEl.height}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState, type PointerEvent as RPointerEvent } from "react";
import { Play } from "lucide-react";
import { createElement, DEVICES, type Element, type Project, type Screen } from "@/lib/model";
import { boxFromDrag, lineFromDrag, pathFromFreehand, polylineD, smoothPathD } from "@/lib/draw";
import { gridBackground, snapMaybe } from "@/lib/grid";
import { marqueeHits, scaleInGroup, unionBox, type Box } from "@/lib/selection";
import { useEditor, type EditorTool } from "@/lib/store";
import { RuntimeContext, staticRuntime } from "@/components/device/runtime-context";
import { ScreenView } from "@/components/device/screen-view";
import { cn } from "@/lib/utils";

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const NONE: string[] = [];

type Draft =
  | { tool: "pen"; points: { x: number; y: number }[] }
  | { tool: "rect" | "ellipse" | "line" | "text"; x1: number; y1: number; x2: number; y2: number };

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

function localPoint(e: { clientX: number; clientY: number }, node: HTMLElement, zoom: number) {
  const r = node.getBoundingClientRect();
  return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
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
  const tool = useEditor((s) => s.tool);
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

  const cursor = spaceDown || panning ? undefined : tool === "text" ? "text" : tool === "select" ? undefined : "crosshair";

  return (
    <div
      ref={containerRef}
      className={cn("canvas-bg relative h-full w-full overflow-hidden", spaceDown && "cursor-grab", panning && "cursor-grabbing")}
      style={{ cursor }}
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
  const elementIds = useEditor((s) => (s.screenId === screen.id ? s.elementIds : NONE));
  const tool = useEditor((s) => s.tool);
  const grid = useEditor((s) => s.grid);
  const [hover, setHover] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const runtime = useMemo(
    () => staticRuntime(Object.fromEntries(project.variables.map((v) => [v.name, v.initial]))),
    [project.variables],
  );
  const selected = screen.elements.filter((e) => elementIds.includes(e.id) && !e.hidden);
  const group = unionBox(selected);
  const isStart = project.startScreenId === screen.id;
  const dev = DEVICES[screen.device];
  const drawing = tool !== "select";

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

  const moveGroup = (e: RPointerEvent, clicked: Element) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const { select, toggleSelect, setSelection, beginTx, endTx, updateSelected, grid: g } = useEditor.getState();
    const ids = useEditor.getState().screenId === screen.id ? useEditor.getState().elementIds : [];
    if (e.shiftKey) {
      toggleSelect(screen.id, clicked.id);
      return;
    }
    if (!ids.includes(clicked.id)) select(screen.id, clicked.id);
    else setSelection(screen.id, ids);
    const start = selectedOnStart(screen, useEditor.getState().elementIds);
    beginTx();
    drag(
      e,
      (dx, dy, ev) => {
        let ox = dx;
        let oy = dy;
        if (ev.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) oy = 0;
          else ox = 0;
        }
        const snapped = start.map((el) => ({
          id: el.id,
          x: snapMaybe(el.x + ox, g),
          y: snapMaybe(el.y + oy, g),
        }));
        const byId = new Map(snapped.map((x) => [x.id, x]));
        updateSelected((d) => {
          const n = byId.get(d.id);
          if (n) {
            d.x = n.x;
            d.y = n.y;
          }
        });
      },
      endTx,
    );
  };

  const resizeGroup = (e: RPointerEvent, h: Handle) => {
    e.stopPropagation();
    if (!group) return;
    const { beginTx, endTx, updateSelected, grid: g } = useEditor.getState();
    const startBox = { ...group };
    const starts = selected.map((el) => ({ ...el }));
    beginTx();
    drag(
      e,
      (dx, dy) => {
        const next = resizeBox(startBox, h, dx, dy);
        next.x = snapMaybe(next.x, g);
        next.y = snapMaybe(next.y, g);
        next.width = Math.max(g.snap ? g.size : 4, snapMaybe(next.width, g) || next.width);
        next.height = Math.max(g.snap ? g.size : 4, snapMaybe(next.height, g) || next.height);
        const byId = new Map(starts.map((el) => [el.id, el]));
        updateSelected((d) => {
          const orig = byId.get(d.id);
          if (!orig) return;
          d.x = orig.x;
          d.y = orig.y;
          d.width = orig.width;
          d.height = orig.height;
          scaleInGroup(d, startBox, next);
        });
      },
      endTx,
    );
  };

  const resizeScreen = (e: RPointerEvent) => {
    e.stopPropagation();
    const { beginTx, endTx, updateScreen, select, grid: g } = useEditor.getState();
    select(screen.id, null);
    const start = { w: screen.width, h: screen.height };
    beginTx();
    drag(
      e,
      (dx, dy) =>
        updateScreen(screen.id, (s) => {
          s.width = Math.max(50, snapMaybe(start.w + dx, g));
          s.height = Math.max(50, snapMaybe(start.h + dy, g));
        }),
      endTx,
    );
  };

  const onSurfaceDown = (e: RPointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const node = e.currentTarget as HTMLElement;
    const raw = localPoint(e, node, zoom);
    const { grid: g, select, setSelection, beginTx, endTx, placeElement, drawStyle } = useEditor.getState();
    const pt = { x: snapMaybe(raw.x, g), y: snapMaybe(raw.y, g) };

    if (drawing) {
      beginTx();
      if (tool === "pen") {
        const points = [pt];
        setDraft({ tool: "pen", points });
        drag(
          e,
          (_dx, _dy, ev) => {
            const p = localPoint(ev, node, zoom);
            points.push({ x: snapMaybe(p.x, g), y: snapMaybe(p.y, g) });
            setDraft({ tool: "pen", points: [...points] });
          },
          () => {
            setDraft(null);
            if (points.length >= 2) {
              const geom = pathFromFreehand(points);
              placeElement(
                screen.id,
                createElement("path", { ...geom, fill: "transparent", stroke: drawStyle.stroke, strokeWidth: drawStyle.strokeWidth }),
              );
            }
            endTx();
          },
        );
        return;
      }
      const start = { ...pt };
      const last = { x: start.x, y: start.y };
      setDraft({ tool, x1: start.x, y1: start.y, x2: start.x, y2: start.y });
      drag(
        e,
        (_dx, _dy, ev) => {
          const p = localPoint(ev, node, zoom);
          last.x = snapMaybe(p.x, g);
          last.y = snapMaybe(p.y, g);
          setDraft({ tool, x1: start.x, y1: start.y, x2: last.x, y2: last.y });
        },
        (moved) => {
          setDraft(null);
          commitShape(tool, start, moved ? last : undefined, useEditor.getState().drawStyle, screen.id, placeElement, g);
          endTx();
        },
      );
      return;
    }

    if (!e.shiftKey) select(screen.id, null);
    const origin = raw;
    setMarquee({ x: origin.x, y: origin.y, width: 0, height: 0 });
    beginTx();
    drag(
      e,
      (_dx, _dy, ev) => {
        const p = localPoint(ev, node, zoom);
        setMarquee({ x: origin.x, y: origin.y, width: p.x - origin.x, height: p.y - origin.y });
      },
      (moved) => {
        setMarquee((rect) => {
          if (moved && rect) {
            const hits = marqueeHits(screen.elements, rect).map((el) => el.id);
            if (e.shiftKey) {
              const extra = new Set([...elementIds, ...hits]);
              setSelection(screen.id, [...extra]);
            } else setSelection(screen.id, hits);
          }
          return null;
        });
        endTx();
      },
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
          boxShadow: selectedScreen && !elementIds.length ? `0 0 0 ${2 * inv}px #38bdf8` : "0 10px 40px rgba(0,0,0,.45)",
          cursor: drawing ? (tool === "text" ? "text" : "crosshair") : undefined,
        }}
        onPointerDown={onSurfaceDown}
      >
        <RuntimeContext.Provider value={runtime}>
          <ScreenView screen={screen} />
        </RuntimeContext.Provider>
        {grid.visible && <div className="pointer-events-none absolute inset-0" style={gridBackground(grid.size)} />}
        <div className="absolute inset-0">
          {screen.elements.map((el) =>
            el.hidden ? null : (
              <div
                key={el.id}
                className="absolute"
                style={{ left: el.x, top: el.y, width: el.width, height: el.height, pointerEvents: drawing ? "none" : "auto" }}
                onPointerDown={(e) => moveGroup(e, el)}
                onPointerEnter={() => setHover(el.id)}
                onPointerLeave={() => setHover((h) => (h === el.id ? null : h))}
              />
            ),
          )}
          {hover && !elementIds.includes(hover) && !drawing && (() => {
            const el = screen.elements.find((x) => x.id === hover);
            return el ? (
              <div
                className="pointer-events-none absolute"
                style={{ left: el.x, top: el.y, width: el.width, height: el.height, boxShadow: `0 0 0 ${1.5 * inv}px #38bdf8` }}
              />
            ) : null;
          })()}
          {selected.map((el) => (
            <div
              key={`sel-${el.id}`}
              className="pointer-events-none absolute"
              style={{ left: el.x, top: el.y, width: el.width, height: el.height, boxShadow: `0 0 0 ${1 * inv}px #7dd3fc` }}
            />
          ))}
          {group && (
            <div
              className="pointer-events-none absolute"
              style={{ left: group.x, top: group.y, width: group.width, height: group.height, boxShadow: `0 0 0 ${1.5 * inv}px #0ea5e9` }}
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
                    onPointerDown={(e) => resizeGroup(e, h)}
                  />
                );
              })}
              <div
                className="absolute left-1/2 -translate-x-1/2 rounded bg-sky-500 px-1 whitespace-nowrap text-white tabular-nums"
                style={{ top: `calc(100% + ${6 * inv}px)`, fontSize: 10 * inv, lineHeight: `${16 * inv}px` }}
              >
                {selected.length > 1 ? `${selected.length} · ` : ""}
                {Math.round(group.width)} × {Math.round(group.height)}
              </div>
            </div>
          )}
          {screen.device === "canvas" && selectedScreen && (
            <div
              className="absolute right-0 bottom-0 rounded-[1px] border-sky-500 bg-white"
              style={{
                width: handleSize,
                height: handleSize,
                borderWidth: 1.5 * inv,
                transform: "translate(50%, 50%)",
                cursor: "se-resize",
              }}
              onPointerDown={resizeScreen}
              title="Resize canvas"
            />
          )}
          {marquee && (
            <div
              className="pointer-events-none absolute border border-sky-400 bg-sky-400/10"
              style={{
                left: Math.min(marquee.x, marquee.x + marquee.width),
                top: Math.min(marquee.y, marquee.y + marquee.height),
                width: Math.abs(marquee.width),
                height: Math.abs(marquee.height),
              }}
            />
          )}
          {draft && <DraftPreview draft={draft} />}
        </div>
      </div>
    </div>
  );
}

function selectedOnStart(screen: Screen, ids: string[]) {
  return screen.elements.filter((e) => ids.includes(e.id)).map((e) => ({ id: e.id, x: e.x, y: e.y }));
}

function resizeBox(start: Box, h: Handle, dx: number, dy: number): Box {
  let { x, y, width: w, height: hh } = start;
  if (h.includes("e")) w = start.width + dx;
  if (h.includes("s")) hh = start.height + dy;
  if (h.includes("w")) {
    w = start.width - dx;
    x = start.x + dx;
  }
  if (h.includes("n")) {
    hh = start.height - dy;
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
  return { x, y, width: w, height: hh };
}

function commitShape(
  tool: Exclude<EditorTool, "select" | "pen">,
  start: { x: number; y: number },
  end: { x: number; y: number } | undefined,
  style: { fill: string; stroke: string; strokeWidth: number },
  screenId: string,
  placeElement: (screenId: string, el: Element) => void,
  _grid: { snap: boolean; size: number },
) {
  void _grid;
  const p2 = end ?? { x: start.x + (tool === "text" ? 200 : 160), y: start.y + (tool === "ellipse" ? 140 : tool === "text" ? 24 : 100) };
  if (tool === "line") {
    if (end && Math.hypot(end.x - start.x, end.y - start.y) < 3) return;
    const geom = lineFromDrag(start.x, start.y, p2.x, p2.y);
    placeElement(screenId, createElement("line", { ...geom, fill: "transparent", stroke: style.stroke, strokeWidth: style.strokeWidth }));
    return;
  }
  const box = end ? boxFromDrag(start.x, start.y, end.x, end.y) : { x: start.x, y: start.y, width: p2.x - start.x, height: p2.y - start.y };
  if (tool === "text") {
    placeElement(screenId, createElement("text", { ...box, text: "Text" }));
    useEditor.getState().setTool("select");
    return;
  }
  placeElement(
    screenId,
    createElement(tool, {
      ...box,
      fill: style.fill,
      stroke: style.stroke,
      strokeWidth: style.strokeWidth,
    }),
  );
}

function DraftPreview({ draft }: { draft: Draft }) {
  if (draft.tool === "pen") {
    const xs = draft.points.map((p) => p.x);
    const ys = draft.points.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const w = Math.max(1, Math.max(...xs) - x);
    const h = Math.max(1, Math.max(...ys) - y);
    const pts = draft.points.map((p) => ({ x: (p.x - x) / w, y: (p.y - y) / h }));
    return (
      <svg className="pointer-events-none absolute overflow-visible" style={{ left: x, top: y, width: w, height: h }}>
        <path d={smoothPathD(pts, w, h) || polylineD(pts, w, h)} fill="none" stroke="#0ea5e9" strokeWidth={2} strokeLinecap="round" />
      </svg>
    );
  }
  const box = boxFromDrag(draft.x1, draft.y1, draft.x2, draft.y2);
  if (draft.tool === "line") {
    return (
      <svg className="pointer-events-none absolute overflow-visible" style={{ left: box.x, top: box.y, width: box.width, height: box.height }}>
        <line
          x1={draft.x1 - box.x}
          y1={draft.y1 - box.y}
          x2={draft.x2 - box.x}
          y2={draft.y2 - box.y}
          stroke="#0ea5e9"
          strokeWidth={2}
        />
      </svg>
    );
  }
  return (
    <div
      className="pointer-events-none absolute border border-sky-400 bg-sky-400/10"
      style={{
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        borderRadius: draft.tool === "ellipse" ? 999 : draft.tool === "text" ? 2 : 0,
      }}
    />
  );
}

"use client";

import { useState } from "react";
import {
  AppWindowMac,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  Copy,
  Eye,
  EyeOff,
  Frame,
  Image as ImageIcon,
  LayoutList,
  MessageSquare,
  MessagesSquare,
  Minus,
  Monitor,
  Navigation,
  PanelBottom,
  Pencil,
  Play,
  Plus,
  Presentation,
  RectangleHorizontal,
  Signal,
  Smartphone,
  Tablet,
  TextCursorInput,
  ToggleRight,
  Trash2,
  Type,
  MousePointerClick,
  WrapText,
  type LucideIcon,
} from "lucide-react";
import { isDeck, SLIDE_INSERT_TYPES, type DeviceKind, type ElementType } from "@/lib/model";
import { useEditor } from "@/lib/store";
import { RuntimeContext, staticRuntime } from "@/components/device/runtime-context";
import { ScreenView } from "@/components/device/screen-view";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const INSERT: { type: ElementType; label: string; icon: LucideIcon }[] = [
  { type: "text", label: "Text", icon: Type },
  { type: "rect", label: "Rectangle", icon: RectangleHorizontal },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "button", label: "Button", icon: MousePointerClick },
  { type: "textfield", label: "Text field", icon: TextCursorInput },
  { type: "textarea", label: "Text area", icon: WrapText },
  { type: "toggle", label: "Toggle", icon: ToggleRight },
  { type: "listrow", label: "List row", icon: LayoutList },
  { type: "navbar", label: "Nav bar", icon: Navigation },
  { type: "tabbar", label: "Tab bar", icon: PanelBottom },
  { type: "statusbar", label: "Status bar", icon: Signal },
  { type: "bubble", label: "Chat bubble", icon: MessageSquare },
  { type: "messagelist", label: "Chat thread", icon: MessagesSquare },
  { type: "mactitlebar", label: "Mac title bar", icon: AppWindowMac },
  { type: "path", label: "Path", icon: Pencil },
  { type: "ellipse", label: "Ellipse", icon: Circle },
  { type: "line", label: "Line", icon: Minus },
];

export const TYPE_ICONS: Record<ElementType, LucideIcon> = Object.fromEntries(INSERT.map((i) => [i.type, i.icon])) as Record<ElementType, LucideIcon>;

const DEVICE_ICONS: Record<DeviceKind, LucideIcon> = { iphone: Smartphone, ipad: Tablet, mac: Monitor, canvas: Frame, slide: Presentation };

export function LeftPanel() {
  const project = useEditor((s) => s.project)!;
  const screenId = useEditor((s) => s.screenId);
  const elementId = useEditor((s) => s.elementId);
  const elementIds = useEditor((s) => s.elementIds);
  const { addElement, addScreen, select, toggleSelect, updateElement, moveSlide, duplicateSelection, deleteSelection } = useEditor.getState();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const deck = isDeck(project);
  const insert = deck ? INSERT.filter((i) => (SLIDE_INSERT_TYPES as readonly string[]).includes(i.type)) : INSERT;
  const layerScreens = deck ? project.screens.filter((s) => s.id === screenId) : project.screens;

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="border-b border-border p-3">
        <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Insert</h3>
        <div className="grid grid-cols-3 gap-1">
          {insert.map(({ type, label, icon: I }) => (
            <button
              key={type}
              type="button"
              onClick={() => addElement(type)}
              className="flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[10.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={`Add ${label.toLowerCase()} to the selected ${deck ? "slide" : "screen"}`}
            >
              <I className="size-4" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </div>
      {deck && (
        <div className="border-b border-border">
          <div className="flex items-center justify-between px-3 pt-3 pb-1">
            <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Slides</h3>
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Add slide"
              onClick={() => addScreen("slide")}
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <ScrollArea className="max-h-64">
            <div className="flex flex-col gap-1.5 px-2 pb-3">
              {project.screens.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => select(s.id, null)}
                  className={cn(
                    "group flex w-full items-start gap-2 rounded-md p-1.5 text-left text-xs",
                    screenId === s.id ? "bg-sky-500/20 text-sky-100" : "hover:bg-muted",
                  )}
                >
                  <div className="relative h-[46px] w-[82px] shrink-0 overflow-hidden rounded-sm bg-black ring-1 ring-white/10">
                    <div
                      className="pointer-events-none origin-top-left"
                      style={{ width: s.width, height: s.height, transform: `scale(${82 / s.width})` }}
                    >
                      <RuntimeContext.Provider value={staticRuntime({})}>
                        <ScreenView screen={s} rounded={false} hardware={false} />
                      </RuntimeContext.Provider>
                    </div>
                    <span className="absolute top-0.5 left-0.5 rounded bg-black/60 px-1 text-[9px] text-white/80 tabular-nums">{i + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{s.name}</div>
                    <div className="mt-1 flex items-center gap-0.5 text-muted-foreground">
                      <span
                        role="button"
                        title="Move earlier"
                        className="rounded p-0.5 hover:bg-background/60 hover:text-foreground disabled:opacity-30"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveSlide(s.id, "up");
                        }}
                      >
                        <ChevronUp className="size-3" />
                      </span>
                      <span
                        role="button"
                        title="Move later"
                        className="rounded p-0.5 hover:bg-background/60 hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveSlide(s.id, "down");
                        }}
                      >
                        <ChevronDown className="size-3" />
                      </span>
                      <span
                        role="button"
                        title="Duplicate slide"
                        className="rounded p-0.5 hover:bg-background/60 hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          select(s.id, null);
                          duplicateSelection();
                        }}
                      >
                        <Copy className="size-3" />
                      </span>
                      {project.screens.length > 1 && (
                        <span
                          role="button"
                          title="Delete slide"
                          className="rounded p-0.5 hover:bg-destructive/20 hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            select(s.id, null);
                            deleteSelection();
                          }}
                        >
                          <Trash2 className="size-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Layers</h3>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-1.5 pb-4">
          {layerScreens.map((s) => {
            const DI = DEVICE_ICONS[s.device];
            const open = !collapsed[s.id];
            return (
              <div key={s.id}>
                <div
                  className={cn(
                    "group flex h-7 cursor-default items-center gap-1 rounded-md px-1 text-xs",
                    screenId === s.id && !elementId ? "bg-sky-500/20 text-sky-200" : "hover:bg-muted",
                  )}
                  onClick={() => select(s.id, null)}
                >
                  <button type="button" className="p-0.5 text-muted-foreground" onClick={(e) => (e.stopPropagation(), setCollapsed((c) => ({ ...c, [s.id]: open })))}>
                    {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                  </button>
                  <DI className="size-3.5 text-muted-foreground" />
                  <span className="truncate font-medium">{s.name}</span>
                  {project.startScreenId === s.id && <Play className="ml-auto size-3 fill-current text-sky-400" />}
                </div>
                {open &&
                  [...s.elements].reverse().map((el) => {
                    const TI = TYPE_ICONS[el.type];
                    return (
                      <div
                        key={el.id}
                        className={cn(
                          "group flex h-6 cursor-default items-center gap-1.5 rounded-md pr-1 pl-7 text-xs",
                          elementIds.includes(el.id) ? "bg-sky-500/25 text-sky-100" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          el.hidden && "opacity-50",
                        )}
                        onClick={(e) => (e.shiftKey ? toggleSelect(s.id, el.id) : select(s.id, el.id))}
                      >
                        <TI className="size-3 shrink-0" />
                        <span className="truncate">{el.name}</span>
                        {el.interactions.length > 0 && <span className="size-1.5 shrink-0 rounded-full bg-violet-400" title="Has interactions" />}
                        <button
                          type="button"
                          className={cn("ml-auto p-0.5", el.hidden ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateElement(el.id, (d) => {
                              d.hidden = !d.hidden;
                            });
                          }}
                          title={el.hidden ? "Show" : "Hide"}
                        >
                          {el.hidden ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                        </button>
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}

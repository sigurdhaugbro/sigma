"use client";

import { useState } from "react";
import {
  AppWindowMac,
  ChevronDown,
  ChevronRight,
  Circle,
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
  RectangleHorizontal,
  Signal,
  Smartphone,
  Tablet,
  TextCursorInput,
  ToggleRight,
  Type,
  MousePointerClick,
  WrapText,
  type LucideIcon,
} from "lucide-react";
import type { DeviceKind, ElementType } from "@/lib/model";
import { useEditor } from "@/lib/store";
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

const DEVICE_ICONS: Record<DeviceKind, LucideIcon> = { iphone: Smartphone, ipad: Tablet, mac: Monitor, canvas: Frame };

export function LeftPanel() {
  const project = useEditor((s) => s.project)!;
  const screenId = useEditor((s) => s.screenId);
  const elementId = useEditor((s) => s.elementId);
  const elementIds = useEditor((s) => s.elementIds);
  const { addElement, select, toggleSelect, updateElement } = useEditor.getState();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="border-b border-border p-3">
        <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Insert</h3>
        <div className="grid grid-cols-3 gap-1">
          {INSERT.map(({ type, label, icon: I }) => (
            <button
              key={type}
              type="button"
              onClick={() => addElement(type)}
              className="flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[10.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={`Add ${label.toLowerCase()} to the selected screen`}
            >
              <I className="size-4" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Layers</h3>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-1.5 pb-4">
          {project.screens.map((s) => {
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

"use client";

import { ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, Copy, Play, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { ICON_NAMES } from "@/components/device/icons";
import {
  DEVICES,
  type Action,
  type ChatMessage,
  type Element,
  type Interaction,
  type Project,
  type Screen,
  type Variable,
  uid,
} from "@/lib/model";
import { findElement, useEditor } from "@/lib/store";
import { ColorField, NumField, Row, Section, SelectField, TextField } from "./fields";
import { TYPE_ICONS } from "./left-panel";

export function PropertiesPanel({ onPlay }: { onPlay: (screenId?: string) => void }) {
  const project = useEditor((s) => s.project)!;
  const screenId = useEditor((s) => s.screenId);
  const elementId = useEditor((s) => s.elementId);
  const found = elementId ? findElement(project, elementId) : null;
  const screen = project.screens.find((s) => s.id === screenId);

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="min-h-0 flex-1">
        {found ? (
          <ElementProps el={found.el} project={project} />
        ) : screen ? (
          <ScreenProps screen={screen} project={project} onPlay={onPlay} />
        ) : (
          <ProjectProps project={project} />
        )}
      </ScrollArea>
    </div>
  );
}

/* ------------------------------ Project ------------------------------ */

function ProjectProps({ project }: { project: Project }) {
  const { mutate } = useEditor.getState();
  return (
    <>
      <Section title="Project">
        <TextField value={project.name} onChange={(v) => mutate((d) => void (d.name = v))} />
        <Row label="Start">
          <SelectField
            value={project.startScreenId}
            onChange={(v) => mutate((d) => void (d.startScreenId = v))}
            options={project.screens.map((s) => ({ value: s.id, label: s.name }))}
          />
        </Row>
      </Section>
      <VariablesSection project={project} />
      <div className="space-y-2 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
        <p>Select a screen or element on the canvas to edit it.</p>
        <p>
          <b className="text-foreground">Pan</b> scroll or drag the background · <b className="text-foreground">Zoom</b> ⌘/Ctrl + scroll ·{" "}
          <b className="text-foreground">Fit</b> Shift+1
        </p>
        <p>
          <b className="text-foreground">Duplicate</b> ⌘D · <b className="text-foreground">Delete</b> ⌫ · <b className="text-foreground">Undo</b> ⌘Z ·{" "}
          <b className="text-foreground">Nudge</b> arrows
        </p>
      </div>
    </>
  );
}

function VariablesSection({ project }: { project: Project }) {
  const { mutate } = useEditor.getState();
  const update = (i: number, fn: (v: Variable) => void) => mutate((d) => fn(d.variables[i]));
  return (
    <Section
      title="Variables"
      action={
        <Button
          size="icon-xs"
          variant="ghost"
          title="Add variable"
          onClick={() =>
            mutate((d) => {
              d.variables.push({ name: `var${d.variables.length + 1}`, type: "text", initial: "" });
            })
          }
        >
          <Plus />
        </Button>
      }
    >
      <p className="text-[11px] leading-snug text-muted-foreground">
        Bind fields and toggles to variables. Use <code className="text-foreground">{"{{name}}"}</code> in any text, or{" "}
        <code className="text-foreground">{"{{messages.last}}"}</code> for the latest chat message.
      </p>
      {project.variables.map((v, i) => (
        <div key={i} className="flex flex-col gap-1.5 rounded-md border border-border/70 p-2">
          <div className="flex items-center gap-1.5">
            <TextField className="font-mono" value={v.name} onChange={(val) => update(i, (d) => void (d.name = val.replace(/[^\w-]/g, "")))} />
            <SelectField
              className="w-28"
              value={v.type}
              onChange={(t) =>
                update(i, (d) => {
                  d.type = t;
                  d.initial = t === "boolean" ? false : t === "messages" ? [] : "";
                })
              }
              options={[
                { value: "text", label: "Text" },
                { value: "boolean", label: "On/Off" },
                { value: "messages", label: "Messages" },
              ]}
            />
            <Button size="icon-xs" variant="ghost" title="Remove" onClick={() => mutate((d) => void d.variables.splice(i, 1))}>
              <X />
            </Button>
          </div>
          {v.type === "text" && <TextField value={String(v.initial)} placeholder="Initial value" onChange={(val) => update(i, (d) => void (d.initial = val))} />}
          {v.type === "boolean" && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={!!v.initial} onCheckedChange={(c) => update(i, (d) => void (d.initial = c))} /> Initially on
            </label>
          )}
          {v.type === "messages" && <MessagesEditor value={v.initial as ChatMessage[]} onChange={(m) => update(i, (d) => void (d.initial = m))} />}
        </div>
      ))}
    </Section>
  );
}

function MessagesEditor({ value, onChange }: { value: ChatMessage[]; onChange: (m: ChatMessage[]) => void }) {
  return (
    <div className="flex flex-col gap-1">
      {value.map((m, i) => (
        <div key={m.id} className="flex items-center gap-1">
          <button
            type="button"
            className={`h-7 w-10 shrink-0 rounded-md text-[10px] font-semibold ${m.from === "me" ? "bg-sky-600 text-white" : "bg-neutral-600 text-white"}`}
            title="Switch sender"
            onClick={() => onChange(value.map((x, j) => (j === i ? { ...x, from: x.from === "me" ? "them" : "me" } : x)))}
          >
            {m.from === "me" ? "Me" : "Them"}
          </button>
          <TextField value={m.text} onChange={(t) => onChange(value.map((x, j) => (j === i ? { ...x, text: t } : x)))} />
          <Button size="icon-xs" variant="ghost" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <X />
          </Button>
        </div>
      ))}
      <Button
        size="xs"
        variant="outline"
        onClick={() => onChange([...value, { id: uid("m_"), from: value[value.length - 1]?.from === "me" ? "them" : "me", text: "New message" }])}
      >
        <Plus /> Message
      </Button>
    </div>
  );
}

/* ------------------------------ Screen ------------------------------ */

function ScreenProps({ screen, project, onPlay }: { screen: Screen; project: Project; onPlay: (id?: string) => void }) {
  const { updateScreen, mutate, duplicateSelection, deleteSelection } = useEditor.getState();
  const set = (fn: (s: Screen) => void) => updateScreen(screen.id, fn);
  return (
    <>
      <Section title={`Screen · ${DEVICES[screen.device].label}`}>
        <TextField value={screen.name} onChange={(v) => set((s) => void (s.name = v))} />
        <Row>
          <NumField label="X" value={screen.x} onChange={(v) => set((s) => void (s.x = v))} />
          <NumField label="Y" value={screen.y} onChange={(v) => set((s) => void (s.y = v))} />
        </Row>
        <Row>
          <NumField label="W" min={50} value={screen.width} onChange={(v) => set((s) => void (s.width = v))} />
          <NumField label="H" min={50} value={screen.height} onChange={(v) => set((s) => void (s.height = v))} />
        </Row>
        <Row label="Fill">
          <ColorField value={screen.background} onChange={(v) => set((s) => void (s.background = v))} />
        </Row>
      </Section>
      <Section title="Prototype">
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={project.startScreenId === screen.id}
            onCheckedChange={(c) => c && mutate((d) => void (d.startScreenId = screen.id))}
          />
          Start screen
        </label>
        <Button size="sm" variant="secondary" onClick={() => onPlay(screen.id)}>
          <Play /> Play from this screen
        </Button>
      </Section>
      <Section title="Actions">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={duplicateSelection}>
            <Copy /> Duplicate
          </Button>
          <Button size="sm" variant="destructive" className="flex-1" disabled={project.screens.length < 2} onClick={deleteSelection}>
            <Trash2 /> Delete
          </Button>
        </div>
      </Section>
      <VariablesSection project={project} />
    </>
  );
}

/* ------------------------------ Element ------------------------------ */

const WEIGHTS = [
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semibold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Heavy" },
];

const ICON_OPTIONS = [{ value: "", label: "None" }, ...ICON_NAMES.map((n) => ({ value: n, label: n }))];

const HAS_TEXT = new Set(["text", "rect", "button", "listrow", "bubble"]);
const HAS_FONT = new Set(["text", "rect", "button", "listrow", "bubble", "textfield", "textarea", "navbar", "mactitlebar", "messagelist", "tabbar"]);

function ElementProps({ el, project }: { el: Element; project: Project }) {
  const { updateElement, duplicateSelection, deleteSelection, moveLayer } = useEditor.getState();
  const set = (fn: (e: Element) => void) => updateElement(el.id, fn);
  const p = el.props;
  const TI = TYPE_ICONS[el.type];
  const varOptions = (types: Variable["type"][]) => [
    { value: "", label: "— none —" },
    ...project.variables.filter((v) => types.includes(v.type)).map((v) => ({ value: v.name, label: v.name })),
  ];

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
        <TI className="size-4 shrink-0 text-muted-foreground" />
        <TextField value={el.name} onChange={(v) => set((e) => void (e.name = v))} />
        <Button size="icon-xs" variant="ghost" title="Duplicate (⌘D)" onClick={duplicateSelection}>
          <Copy />
        </Button>
        <Button size="icon-xs" variant="ghost" title="Delete (⌫)" onClick={deleteSelection}>
          <Trash2 />
        </Button>
      </div>

      <Section
        title="Layout"
        action={
          <div className="flex">
            <Button size="icon-xs" variant="ghost" title="Bring to front" onClick={() => moveLayer("top")}>
              <ArrowUpToLine />
            </Button>
            <Button size="icon-xs" variant="ghost" title="Bring forward" onClick={() => moveLayer("up")}>
              <ChevronUp />
            </Button>
            <Button size="icon-xs" variant="ghost" title="Send backward" onClick={() => moveLayer("down")}>
              <ChevronDown />
            </Button>
            <Button size="icon-xs" variant="ghost" title="Send to back" onClick={() => moveLayer("bottom")}>
              <ArrowDownToLine />
            </Button>
          </div>
        }
      >
        <Row>
          <NumField label="X" value={el.x} onChange={(v) => set((e) => void (e.x = v))} />
          <NumField label="Y" value={el.y} onChange={(v) => set((e) => void (e.y = v))} />
        </Row>
        <Row>
          <NumField label="W" min={1} value={el.width} onChange={(v) => set((e) => void (e.width = v))} />
          <NumField label="H" min={1} value={el.height} onChange={(v) => set((e) => void (e.height = v))} />
        </Row>
        {el.type !== "statusbar" && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground" title="Moves up when the on-screen keyboard opens">
            <Switch checked={!!p.keyboardAware} onCheckedChange={(c) => set((e) => void (e.props.keyboardAware = c))} />
            Keyboard-aware (moves above keyboard)
          </label>
        )}
      </Section>

      <Section title="Appearance">
        {el.type !== "statusbar" && el.type !== "messagelist" && (
          <Row label={el.type === "toggle" ? "On color" : "Fill"}>
            <ColorField value={el.fill} onChange={(v) => set((e) => void (e.fill = v))} />
          </Row>
        )}
        <Row label="Radius">
          <NumField label="R" min={0} value={el.radius} onChange={(v) => set((e) => void (e.radius = v))} />
          <NumField label="%" min={0} step={5} value={Math.round(el.opacity * 100)} onChange={(v) => set((e) => void (e.opacity = Math.min(100, v) / 100))} />
        </Row>
      </Section>

      {(HAS_TEXT.has(el.type) || HAS_FONT.has(el.type)) && (
        <Section title="Text">
          {HAS_TEXT.has(el.type) && (
            <TextField multiline value={el.text} placeholder="Supports {{variable}}" onChange={(v) => set((e) => void (e.text = v))} />
          )}
          <Row label="Color">
            <ColorField value={el.textColor} onChange={(v) => set((e) => void (e.textColor = v))} />
          </Row>
          <Row label="Font">
            <NumField label="pt" min={6} value={el.fontSize} onChange={(v) => set((e) => void (e.fontSize = v))} />
            <SelectField value={String(el.fontWeight)} onChange={(v) => set((e) => void (e.fontWeight = Number(v)))} options={WEIGHTS} />
          </Row>
          <Row label="Align">
            <SelectField
              value={el.textAlign}
              onChange={(v) => set((e) => void (e.textAlign = v))}
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
                { value: "right", label: "Right" },
              ]}
            />
          </Row>
        </Section>
      )}

      <TypeSection el={el} project={project} set={set} varOptions={varOptions} />

      <Section title="Visibility">
        <Row label="Show if">
          <SelectField
            value={(el.showIf ?? "").replace(/^!/, "")}
            onChange={(v) => set((e) => void (e.showIf = v ? (e.showIf?.startsWith("!") ? "!" : "") + v : undefined))}
            options={varOptions(["text", "boolean", "messages"])}
          />
        </Row>
        {el.showIf && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={el.showIf.startsWith("!")}
              onCheckedChange={(c) => set((e) => void (e.showIf = (c ? "!" : "") + e.showIf!.replace(/^!/, "")))}
            />
            Invert (show when empty / off)
          </label>
        )}
      </Section>

      <InteractionsSection el={el} project={project} set={set} />
    </>
  );
}

type VarOptions = (types: Variable["type"][]) => { value: string; label: string }[];

function TypeSection({ el, project, set, varOptions }: { el: Element; project: Project; set: (fn: (e: Element) => void) => void; varOptions: VarOptions }) {
  const p = el.props;
  const prop = <K extends keyof Element["props"]>(k: K, v: Element["props"][K]) => set((e) => void (e.props[k] = v));

  switch (el.type) {
    case "button":
      return (
        <Section title="Button">
          <Row label="Style">
            <SelectField
              value={p.variant ?? "filled"}
              onChange={(v) => prop("variant", v)}
              options={[
                { value: "filled", label: "Filled" },
                { value: "tinted", label: "Tinted" },
                { value: "plain", label: "Plain" },
              ]}
            />
          </Row>
          <Row label="Icon">
            <SelectField value={p.icon ?? ""} onChange={(v) => prop("icon", v || undefined)} options={ICON_OPTIONS} />
          </Row>
        </Section>
      );
    case "textfield":
    case "textarea":
      return (
        <Section title="Input">
          <Row label="Variable">
            <SelectField value={p.variable ?? ""} onChange={(v) => prop("variable", v || undefined)} options={varOptions(["text"])} />
          </Row>
          <Row label="Hint">
            <TextField value={p.placeholder ?? ""} onChange={(v) => prop("placeholder", v)} />
          </Row>
          {el.type === "textfield" && (
            <Row label="Style">
              <SelectField
                value={p.fieldStyle ?? "rounded"}
                onChange={(v) => prop("fieldStyle", v)}
                options={[
                  { value: "rounded", label: "Rounded" },
                  { value: "pill", label: "Pill (iMessage)" },
                  { value: "search", label: "Search" },
                  { value: "plain", label: "Plain" },
                ]}
              />
            </Row>
          )}
        </Section>
      );
    case "toggle":
      return (
        <Section title="Toggle">
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={!!p.on} onCheckedChange={(c) => prop("on", c)} /> On by default
          </label>
          <Row label="Variable">
            <SelectField value={p.variable ?? ""} onChange={(v) => prop("variable", v || undefined)} options={varOptions(["boolean"])} />
          </Row>
        </Section>
      );
    case "listrow":
      return (
        <Section title="List row">
          <Row label="Subtitle">
            <TextField value={p.subtitle ?? ""} onChange={(v) => prop("subtitle", v)} />
          </Row>
          <Row label="Detail">
            <TextField value={p.detail ?? ""} onChange={(v) => prop("detail", v)} />
          </Row>
          <Row label="Avatar">
            <TextField value={p.avatar ?? ""} placeholder="Initials" onChange={(v) => prop("avatar", v || undefined)} />
          </Row>
          <Row label="Icon">
            <SelectField value={p.icon ?? ""} onChange={(v) => prop("icon", v || undefined)} options={ICON_OPTIONS} />
          </Row>
          <Row label="Tint">
            <ColorField value={p.iconBg ?? "#0A84FF"} onChange={(v) => prop("iconBg", v)} />
          </Row>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={!!p.chevron} onCheckedChange={(c) => prop("chevron", c)} /> Chevron
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={!!p.separator} onCheckedChange={(c) => prop("separator", c)} /> Separator
          </label>
        </Section>
      );
    case "navbar":
      return (
        <Section title="Navigation bar">
          <Row label="Title">
            <TextField value={p.title ?? ""} onChange={(v) => prop("title", v)} />
          </Row>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={p.backLabel !== undefined} onCheckedChange={(c) => prop("backLabel", c ? "Back" : undefined)} /> Back button
          </label>
          {p.backLabel !== undefined && (
            <Row label="Back label">
              <TextField value={p.backLabel} onChange={(v) => prop("backLabel", v)} />
            </Row>
          )}
          <Row label="Right icon">
            <SelectField value={p.rightIcon ?? ""} onChange={(v) => prop("rightIcon", v || undefined)} options={ICON_OPTIONS} />
          </Row>
          <p className="text-[11px] text-muted-foreground">Back always goes to the previous screen. Interactions below fire when the rest of the bar is tapped.</p>
        </Section>
      );
    case "tabbar":
      return (
        <Section
          title="Tabs"
          action={
            <Button size="icon-xs" variant="ghost" onClick={() => set((e) => void e.props.items!.push({ label: "Tab", icon: "star" }))}>
              <Plus />
            </Button>
          }
        >
          {(p.items ?? []).map((item, i) => (
            <div key={i} className="flex flex-col gap-1 rounded-md border border-border/70 p-2">
              <div className="flex items-center gap-1">
                <TextField value={item.label} onChange={(v) => set((e) => void (e.props.items![i].label = v))} />
                <Button size="icon-xs" variant="ghost" onClick={() => set((e) => void e.props.items!.splice(i, 1))}>
                  <X />
                </Button>
              </div>
              <div className="flex gap-1">
                <SelectField value={item.icon} onChange={(v) => set((e) => void (e.props.items![i].icon = v))} options={ICON_OPTIONS.slice(1)} />
                <SelectField
                  value={item.screenId ?? ""}
                  onChange={(v) => set((e) => void (e.props.items![i].screenId = v || undefined))}
                  options={[{ value: "", label: "No link" }, ...project.screens.map((s) => ({ value: s.id, label: `→ ${s.name}` }))]}
                />
              </div>
            </div>
          ))}
          <Row label="Active">
            <NumField label="#" min={0} value={p.activeIndex ?? 0} onChange={(v) => prop("activeIndex", Math.round(v))} />
          </Row>
        </Section>
      );
    case "statusbar":
      return (
        <Section title="Status bar">
          <Row label="Time">
            <TextField value={p.time ?? "9:41"} onChange={(v) => prop("time", v)} />
          </Row>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={!!p.dark} onCheckedChange={(c) => prop("dark", c)} /> Light content (for dark screens)
          </label>
        </Section>
      );
    case "bubble":
      return (
        <Section title="Bubble">
          <Row label="Sender">
            <SelectField
              value={p.sender ?? "them"}
              onChange={(v) => prop("sender", v)}
              options={[
                { value: "me", label: "Me (blue, right)" },
                { value: "them", label: "Them (gray, left)" },
              ]}
            />
          </Row>
        </Section>
      );
    case "messagelist":
      return (
        <Section title="Chat thread">
          <Row label="Variable">
            <SelectField value={p.variable ?? ""} onChange={(v) => prop("variable", v || undefined)} options={varOptions(["messages"])} />
          </Row>
          <p className="text-[11px] text-muted-foreground">Edit the starting messages under Variables (deselect everything). Use a “Send message” interaction to append typed text.</p>
        </Section>
      );
    case "mactitlebar":
      return (
        <Section title="Title bar">
          <Row label="Title">
            <TextField value={p.title ?? ""} onChange={(v) => prop("title", v)} />
          </Row>
        </Section>
      );
    case "image":
      return (
        <Section title="Image">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted">
            <Upload className="size-3.5" /> {p.src ? "Replace image" : "Upload image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const src = await downscale(file, 1600);
                prop("src", src);
                e.target.value = "";
              }}
            />
          </label>
          {p.src && (
            <Button size="xs" variant="ghost" onClick={() => prop("src", undefined)}>
              Remove image
            </Button>
          )}
          <Row label="Fit">
            <SelectField
              value={p.fit ?? "cover"}
              onChange={(v) => prop("fit", v)}
              options={[
                { value: "cover", label: "Fill (crop)" },
                { value: "contain", label: "Fit" },
              ]}
            />
          </Row>
        </Section>
      );
    default:
      return null;
  }
}

/** Keeps uploads small enough for localStorage. */
async function downscale(file: File, max: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ------------------------------ Interactions ------------------------------ */

const ACTION_LABELS: Record<Action["type"], string> = {
  navigate: "Go to screen",
  back: "Go back",
  toggleVariable: "Toggle variable",
  setVariable: "Set variable",
  sendMessage: "Send message",
};

function defaultAction(type: Action["type"], project: Project, el: Element): Action {
  switch (type) {
    case "navigate":
      return { type, screenId: project.screens.find((s) => !s.elements.some((e) => e.id === el.id))?.id ?? project.screens[0].id, transition: "push" };
    case "back":
      return { type };
    case "toggleVariable":
      return { type, variable: project.variables.find((v) => v.type === "boolean")?.name ?? "" };
    case "setVariable":
      return { type, variable: project.variables.find((v) => v.type === "text")?.name ?? "", value: "" };
    case "sendMessage":
      return {
        type,
        from: el.props.variable ?? project.variables.find((v) => v.type === "text")?.name ?? "",
        to: project.variables.find((v) => v.type === "messages")?.name ?? "",
        replies: [],
        replyDelayMs: 1800,
      };
  }
}

function InteractionsSection({ el, project, set }: { el: Element; project: Project; set: (fn: (e: Element) => void) => void }) {
  const canSubmit = el.type === "textfield";
  const update = (i: number, fn: (ix: Interaction) => void) => set((e) => fn(e.interactions[i]));
  const vars = (t: Variable["type"]) => project.variables.filter((v) => v.type === t).map((v) => ({ value: v.name, label: v.name }));

  return (
    <Section
      title="Interactions"
      action={
        <Button
          size="icon-xs"
          variant="ghost"
          title="Add interaction"
          onClick={() =>
            set((e) =>
              void e.interactions.push({
                id: uid("ix_"),
                trigger: canSubmit ? "submit" : "tap",
                action: defaultAction("navigate", project, el),
              }),
            )
          }
        >
          <Plus />
        </Button>
      }
    >
      {el.interactions.length === 0 && <p className="text-[11px] text-muted-foreground">No interactions. Add one to make this element do something in prototype mode.</p>}
      {el.interactions.map((ix, i) => {
        const a = ix.action;
        return (
          <div key={ix.id} className="flex flex-col gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/5 p-2">
            <div className="flex items-center gap-1">
              <SelectField
                className="w-24"
                value={ix.trigger}
                onChange={(t) => update(i, (d) => void (d.trigger = t))}
                options={canSubmit ? [{ value: "submit", label: "On return" }, { value: "tap", label: "On tap" }] : [{ value: "tap", label: "On tap" }]}
              />
              <SelectField
                value={a.type}
                onChange={(t) => update(i, (d) => void (d.action = defaultAction(t, project, el)))}
                options={(Object.keys(ACTION_LABELS) as Action["type"][]).map((k) => ({ value: k, label: ACTION_LABELS[k] }))}
              />
              <Button size="icon-xs" variant="ghost" onClick={() => set((e) => void e.interactions.splice(i, 1))}>
                <X />
              </Button>
            </div>
            {a.type === "navigate" && (
              <div className="flex gap-1">
                <SelectField
                  value={a.screenId}
                  onChange={(v) => update(i, (d) => void ((d.action as typeof a).screenId = v))}
                  options={project.screens.map((s) => ({ value: s.id, label: s.name }))}
                />
                <SelectField
                  className="w-24"
                  value={a.transition}
                  onChange={(v) => update(i, (d) => void ((d.action as typeof a).transition = v))}
                  options={[
                    { value: "push", label: "Push" },
                    { value: "modal", label: "Modal" },
                    { value: "fade", label: "Fade" },
                    { value: "none", label: "Instant" },
                  ]}
                />
              </div>
            )}
            {a.type === "toggleVariable" && (
              <SelectField value={a.variable} onChange={(v) => update(i, (d) => void ((d.action as typeof a).variable = v))} options={[{ value: "", label: "—" }, ...vars("boolean")]} />
            )}
            {a.type === "setVariable" && (
              <div className="flex gap-1">
                <SelectField value={a.variable} onChange={(v) => update(i, (d) => void ((d.action as typeof a).variable = v))} options={[{ value: "", label: "—" }, ...vars("text")]} />
                <TextField value={a.value} placeholder="Value" onChange={(v) => update(i, (d) => void ((d.action as typeof a).value = v))} />
              </div>
            )}
            {a.type === "sendMessage" && (
              <>
                <Row label="Text from">
                  <SelectField value={a.from} onChange={(v) => update(i, (d) => void ((d.action as typeof a).from = v))} options={[{ value: "", label: "—" }, ...vars("text")]} />
                </Row>
                <Row label="Append to">
                  <SelectField value={a.to} onChange={(v) => update(i, (d) => void ((d.action as typeof a).to = v))} options={[{ value: "", label: "—" }, ...vars("messages")]} />
                </Row>
                <TextField
                  multiline
                  value={a.replies.join("\n")}
                  placeholder={"Scripted replies, one per line\n(used in order, one per send)"}
                  onChange={(v) => update(i, (d) => void ((d.action as typeof a).replies = v.split("\n")))}
                />
                <Row label="Reply after">
                  <NumField label="ms" min={0} step={100} value={a.replyDelayMs} onChange={(v) => update(i, (d) => void ((d.action as typeof a).replyDelayMs = v))} />
                </Row>
              </>
            )}
          </div>
        );
      })}
    </Section>
  );
}

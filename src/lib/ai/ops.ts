import { z } from "zod";
import {
  createElement,
  createScreen,
  DEVICES,
  uid,
  type Action,
  type ChatMessage,
  type Element,
  type ElementType,
  type Interaction,
  type Project,
  type Screen,
} from "@/lib/model";

/* ------------------------------ Schema ------------------------------ */

const ELEMENT_TYPES = [
  "text",
  "rect",
  "image",
  "button",
  "textfield",
  "textarea",
  "toggle",
  "listrow",
  "navbar",
  "tabbar",
  "statusbar",
  "bubble",
  "messagelist",
  "mactitlebar",
  "path",
  "ellipse",
  "line",
] as const satisfies readonly ElementType[];

const num = z.number().finite();

const TabItemSchema = z.object({ label: z.string(), icon: z.string(), screenId: z.string().optional() });

const PropsSchema = z
  .object({
    placeholder: z.string(),
    variable: z.string(),
    variant: z.enum(["filled", "tinted", "plain"]),
    icon: z.string(),
    fieldStyle: z.enum(["rounded", "pill", "search", "plain"]),
    on: z.boolean(),
    subtitle: z.string(),
    detail: z.string(),
    chevron: z.boolean(),
    iconBg: z.string(),
    avatar: z.string(),
    separator: z.boolean(),
    title: z.string(),
    backLabel: z.string().nullable(),
    largeTitle: z.boolean(),
    rightIcon: z.string(),
    items: z.array(TabItemSchema),
    activeIndex: num,
    time: z.string(),
    dark: z.boolean(),
    sender: z.enum(["me", "them"]),
    fit: z.enum(["cover", "contain"]),
    keyboardAware: z.boolean(),
  })
  .partial();

export const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("navigate"), screenId: z.string(), transition: z.enum(["push", "modal", "fade", "none"]).default("push") }),
  z.object({ type: z.literal("back") }),
  z.object({ type: z.literal("toggleVariable"), variable: z.string() }),
  z.object({ type: z.literal("setVariable"), variable: z.string(), value: z.string() }),
  z.object({
    type: z.literal("sendMessage"),
    from: z.string(),
    to: z.string(),
    replies: z.array(z.string()).default([]),
    replyDelayMs: num.default(1800),
  }),
]);

const InteractionSchema = z.object({
  id: z.string().optional(),
  trigger: z.enum(["tap", "submit"]).default("tap"),
  action: ActionSchema,
});

const ElementFieldsSchema = z
  .object({
    name: z.string(),
    x: num,
    y: num,
    width: num.positive(),
    height: num.positive(),
    fill: z.string(),
    textColor: z.string(),
    fontSize: num.positive(),
    fontWeight: num,
    textAlign: z.enum(["left", "center", "right"]),
    radius: num.min(0),
    opacity: num.min(0).max(1),
    text: z.string(),
    stroke: z.string(),
    strokeWidth: num.min(0),
    points: z.array(z.object({ x: num, y: num })),
    showIf: z.string().nullable(),
    hidden: z.boolean(),
    props: PropsSchema,
  })
  .partial();

const ScreenFieldsSchema = z
  .object({ name: z.string(), background: z.string(), x: num, y: num, width: num.positive(), height: num.positive() })
  .partial();

const MessageSchema = z.object({ from: z.enum(["me", "them"]), text: z.string() });

export const OperationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("addScreen"),
    id: z.string().optional(),
    device: z.enum(["iphone", "ipad", "mac", "canvas"]).default("iphone"),
    name: z.string(),
    background: z.string().optional(),
    x: num.optional(),
    y: num.optional(),
  }),
  z.object({ op: z.literal("updateScreen"), screenId: z.string(), set: ScreenFieldsSchema }),
  z.object({ op: z.literal("deleteScreen"), screenId: z.string() }),
  z.object({ op: z.literal("setStartScreen"), screenId: z.string() }),
  ElementFieldsSchema.extend({
    op: z.literal("addElement"),
    id: z.string().optional(),
    screenId: z.string(),
    type: z.enum(ELEMENT_TYPES),
    interactions: z.array(InteractionSchema).optional(),
  }),
  z.object({ op: z.literal("updateElement"), elementId: z.string(), set: ElementFieldsSchema }),
  z.object({ op: z.literal("deleteElement"), elementId: z.string() }),
  z.object({ op: z.literal("addInteraction"), elementId: z.string(), trigger: z.enum(["tap", "submit"]).default("tap"), action: ActionSchema }),
  z.object({ op: z.literal("removeInteraction"), elementId: z.string(), interactionId: z.string() }),
  z.object({ op: z.literal("clearInteractions"), elementId: z.string() }),
  z.object({
    op: z.literal("setVariable"),
    name: z.string().regex(/^[\w-]+$/),
    type: z.enum(["text", "boolean", "messages"]),
    initial: z.union([z.string(), z.boolean(), z.array(MessageSchema)]).optional(),
  }),
  z.object({ op: z.literal("deleteVariable"), name: z.string() }),
]);

export type Operation = z.infer<typeof OperationSchema>;

export interface AiPlan {
  summary: string;
  operations: Operation[];
}

/** Validates each operation independently so one bad op doesn't sink the whole plan. */
export function parsePlan(raw: unknown): { plan: AiPlan; rejected: string[] } {
  const obj = (raw ?? {}) as { summary?: unknown; operations?: unknown };
  const ops = Array.isArray(obj.operations) ? obj.operations : [];
  const operations: Operation[] = [];
  const rejected: string[] = [];
  ops.forEach((op, i) => {
    const r = OperationSchema.safeParse(op);
    if (r.success) operations.push(r.data);
    else {
      const name = (op as { op?: string })?.op ?? "?";
      rejected.push(`#${i + 1} ${name}: ${r.error.issues.map((x) => `${x.path.join(".") || "op"} ${x.message}`).join("; ")}`);
    }
  });
  return { plan: { summary: typeof obj.summary === "string" ? obj.summary : "", operations }, rejected };
}

/* ------------------------------ Apply ------------------------------ */

export interface ApplyResult {
  changes: string[];
  errors: string[];
  focus?: { screenId: string; elementId: string | null };
  addedScreens: number;
}

const FULL_WIDTH: ElementType[] = ["navbar", "tabbar", "statusbar", "listrow", "messagelist", "mactitlebar"];

/** Mutates `project` in place. Callers pass a draft copy and commit it as one undo step. */
export function applyOperations(project: Project, ops: Operation[]): ApplyResult {
  const res: ApplyResult = { changes: [], errors: [], addedScreens: 0 };
  const ids = new Map<string, string>();
  const taken = new Set<string>([...project.screens.map((s) => s.id), ...project.screens.flatMap((s) => s.elements.map((e) => e.id))]);

  // Pre-assign ids so operations can reference things created later in the same plan.
  for (const op of ops) {
    if ((op.op === "addScreen" || op.op === "addElement") && op.id) {
      const real = taken.has(op.id) ? uid(op.op === "addScreen" ? "scr_" : "el_") : op.id;
      ids.set(op.id, real);
      taken.add(real);
    }
  }
  const rid = (id: string) => ids.get(id) ?? id;
  const screenOf = (id: string) => project.screens.find((s) => s.id === rid(id));
  const elementOf = (id: string) => {
    for (const s of project.screens) {
      const el = s.elements.find((e) => e.id === rid(id));
      if (el) return { screen: s, el };
    }
    return null;
  };
  const fixAction = (a: z.infer<typeof ActionSchema>): Action => (a.type === "navigate" ? { ...a, screenId: rid(a.screenId) } : a);
  const toInteraction = (ix: z.infer<typeof InteractionSchema>): Interaction => ({
    id: uid("ix_"),
    trigger: ix.trigger,
    action: fixAction(ix.action),
  });
  const fixProps = (p: z.infer<typeof PropsSchema> | undefined): Element["props"] => {
    if (!p) return {};
    const out: Element["props"] = { ...p, backLabel: p.backLabel === null ? undefined : p.backLabel };
    if (p.items) out.items = p.items.map((t) => ({ ...t, screenId: t.screenId ? rid(t.screenId) : undefined }));
    return out;
  };
  const focus = (screenId: string, elementId: string | null) => {
    res.focus ??= { screenId, elementId };
  };

  for (const op of ops) {
    try {
      switch (op.op) {
        case "addScreen": {
          const maxX = Math.max(0, ...project.screens.map((s) => s.x + s.width));
          const screen = createScreen(op.device, {
            id: op.id ? rid(op.id) : uid("scr_"),
            name: op.name,
            background: op.background ?? "#FFFFFF",
            x: op.x ?? (project.screens.length ? maxX + 100 : 0),
            y: op.y ?? 0,
          });
          project.screens.push(screen);
          res.addedScreens++;
          focus(screen.id, null);
          res.changes.push(`Added ${DEVICES[op.device].label} screen “${op.name}”`);
          break;
        }
        case "updateScreen": {
          const s = screenOf(op.screenId);
          if (!s) throw new Error(`screen ${op.screenId} not found`);
          Object.assign(s, op.set);
          res.changes.push(`Updated screen “${s.name}” (${Object.keys(op.set).join(", ")})`);
          break;
        }
        case "deleteScreen": {
          const s = screenOf(op.screenId);
          if (!s) throw new Error(`screen ${op.screenId} not found`);
          if (project.screens.length < 2) throw new Error("can't delete the only screen");
          project.screens = project.screens.filter((x) => x !== s);
          if (project.startScreenId === s.id) project.startScreenId = project.screens[0].id;
          res.changes.push(`Deleted screen “${s.name}”`);
          break;
        }
        case "setStartScreen": {
          const s = screenOf(op.screenId);
          if (!s) throw new Error(`screen ${op.screenId} not found`);
          project.startScreenId = s.id;
          res.changes.push(`Start screen is now “${s.name}”`);
          break;
        }
        case "addElement": {
          const s = screenOf(op.screenId);
          if (!s) throw new Error(`screen ${op.screenId} not found`);
          const { op: _op, id, screenId: _sid, type, interactions, props, showIf, ...fields } = op;
          void _op;
          void _sid;
          const el = createElement(type, { ...fields, props: fixProps(props), showIf: showIf ?? undefined });
          el.id = id ? rid(id) : el.id;
          if (FULL_WIDTH.includes(type) && fields.width === undefined) el.width = s.width;
          if (fields.x === undefined && !FULL_WIDTH.includes(type)) el.x = Math.round((s.width - el.width) / 2);
          if (fields.y === undefined) {
            el.y =
              type === "statusbar" || type === "mactitlebar"
                ? 0
                : type === "navbar"
                  ? s.device === "mac" ? 52 : 54
                  : type === "tabbar"
                    ? s.height - el.height
                    : Math.round((s.height - el.height) / 2);
          }
          el.interactions = (interactions ?? []).map(toInteraction);
          s.elements.push(el);
          focus(s.id, el.id);
          res.changes.push(`Added ${type} “${el.name}” to “${s.name}”`);
          break;
        }
        case "updateElement": {
          const found = elementOf(op.elementId);
          if (!found) throw new Error(`element ${op.elementId} not found`);
          const { props, showIf, ...fields } = op.set;
          Object.assign(found.el, fields);
          if (showIf !== undefined) found.el.showIf = showIf ?? undefined;
          if (props) {
            const fixed = fixProps(props);
            found.el.props = { ...found.el.props, ...fixed };
            if (props.backLabel === null) delete found.el.props.backLabel;
          }
          focus(found.screen.id, found.el.id);
          res.changes.push(`Updated “${found.el.name}” (${Object.keys(op.set).join(", ")})`);
          break;
        }
        case "deleteElement": {
          const found = elementOf(op.elementId);
          if (!found) throw new Error(`element ${op.elementId} not found`);
          found.screen.elements = found.screen.elements.filter((e) => e !== found.el);
          res.changes.push(`Deleted “${found.el.name}”`);
          break;
        }
        case "addInteraction": {
          const found = elementOf(op.elementId);
          if (!found) throw new Error(`element ${op.elementId} not found`);
          found.el.interactions.push(toInteraction(op));
          focus(found.screen.id, found.el.id);
          res.changes.push(`“${found.el.name}”: ${describeAction(fixAction(op.action), project)} on ${op.trigger === "submit" ? "return" : "tap"}`);
          break;
        }
        case "removeInteraction": {
          const found = elementOf(op.elementId);
          if (!found) throw new Error(`element ${op.elementId} not found`);
          found.el.interactions = found.el.interactions.filter((i) => i.id !== op.interactionId);
          res.changes.push(`Removed an interaction from “${found.el.name}”`);
          break;
        }
        case "clearInteractions": {
          const found = elementOf(op.elementId);
          if (!found) throw new Error(`element ${op.elementId} not found`);
          found.el.interactions = [];
          res.changes.push(`Cleared interactions on “${found.el.name}”`);
          break;
        }
        case "setVariable": {
          const initial =
            op.type === "messages"
              ? (Array.isArray(op.initial) ? op.initial : []).map((m): ChatMessage => ({ id: uid("m_"), ...m }))
              : op.type === "boolean"
                ? op.initial === true || op.initial === "true"
                : typeof op.initial === "string" ? op.initial : "";
          const existing = project.variables.find((v) => v.name === op.name);
          if (existing) {
            existing.type = op.type;
            existing.initial = initial;
            res.changes.push(`Updated variable “${op.name}”`);
          } else {
            project.variables.push({ name: op.name, type: op.type, initial });
            res.changes.push(`Added ${op.type} variable “${op.name}”`);
          }
          break;
        }
        case "deleteVariable": {
          project.variables = project.variables.filter((v) => v.name !== op.name);
          res.changes.push(`Deleted variable “${op.name}”`);
          break;
        }
      }
    } catch (e) {
      res.errors.push(`${op.op}: ${(e as Error).message}`);
    }
  }

  // Drop navigation targets that never materialised so the player can't dead-end.
  const screenIds = new Set(project.screens.map((s) => s.id));
  for (const s of project.screens)
    for (const el of s.elements) {
      const before = el.interactions.length;
      el.interactions = el.interactions.filter((i) => i.action.type !== "navigate" || screenIds.has(i.action.screenId));
      if (el.interactions.length < before) res.errors.push(`“${el.name}”: removed a link to a screen that doesn't exist`);
    }
  return res;
}

function describeAction(a: Action, project: Project) {
  switch (a.type) {
    case "navigate":
      return `go to “${project.screens.find((s) => s.id === a.screenId)?.name ?? "?"}”`;
    case "back":
      return "go back";
    case "toggleVariable":
      return `toggle {{${a.variable}}}`;
    case "setVariable":
      return `set {{${a.variable}}}`;
    case "sendMessage":
      return `send {{${a.from}}} to {{${a.to}}}`;
  }
}

/* ------------------------------ Context ------------------------------ */

/** A compact copy of the project for the model: no image data, no bookkeeping. */
export function projectForPrompt(project: Project) {
  return {
    name: project.name,
    startScreenId: project.startScreenId,
    variables: project.variables.map((v) => ({
      name: v.name,
      type: v.type,
      initial: Array.isArray(v.initial) ? v.initial.map(({ from, text }) => ({ from, text })) : v.initial,
    })),
    screens: project.screens.map((s: Screen) => ({
      id: s.id,
      name: s.name,
      device: s.device,
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
      background: s.background,
      elements: s.elements.map((e) => ({
        ...e,
        props: e.props.src ? { ...e.props, src: "[uploaded image]" } : e.props,
      })),
    })),
  };
}

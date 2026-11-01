/**
 * Project data model. Everything is plain JSON so a project can be exported,
 * re-imported, and later compiled into a PWA or native (SwiftUI) app.
 */

export type DeviceKind = "iphone" | "ipad" | "mac" | "canvas" | "slide";

/** Prototype = device-framed app UI. Deck = ordered 16:9 slides. Missing kind is a prototype. */
export type ProjectKind = "prototype" | "deck";

export type ElementType =
  | "text"
  | "rect"
  | "image"
  | "button"
  | "textfield"
  | "textarea"
  | "toggle"
  | "listrow"
  | "navbar"
  | "tabbar"
  | "statusbar"
  | "bubble"
  | "messagelist"
  | "mactitlebar"
  | "path"
  | "ellipse"
  | "line";

/** Local-space point. For path/line, stored normalized 0–1 inside the element's box. */
export interface Vec2 {
  x: number;
  y: number;
}

export type Transition = "push" | "modal" | "fade" | "none";

export type Action =
  | { type: "navigate"; screenId: string; transition: Transition }
  | { type: "back" }
  | { type: "toggleVariable"; variable: string }
  | { type: "setVariable"; variable: string; value: string }
  | {
      type: "sendMessage";
      /** Text variable holding the draft (cleared after send). */
      from: string;
      /** List variable the message is appended to. */
      to: string;
      /** Optional scripted replies, used in order, one per send. */
      replies: string[];
      replyDelayMs: number;
    };

export type Trigger = "tap" | "submit";

export interface Interaction {
  id: string;
  trigger: Trigger;
  action: Action;
}

export interface ChatMessage {
  id: string;
  text: string;
  from: "me" | "them";
}

export type VariableValue = string | boolean | ChatMessage[];

export interface Variable {
  name: string;
  type: "text" | "boolean" | "messages";
  initial: VariableValue;
}

export interface TabItem {
  label: string;
  icon: string;
  screenId?: string;
}

/** Type-specific settings. Unused keys are simply absent. */
export interface ElementProps {
  // text-ish
  placeholder?: string;
  variable?: string;
  // button
  variant?: "filled" | "tinted" | "plain";
  icon?: string;
  // textfield
  fieldStyle?: "rounded" | "pill" | "search" | "plain";
  // toggle
  on?: boolean;
  // listrow
  subtitle?: string;
  detail?: string;
  chevron?: boolean;
  iconBg?: string;
  avatar?: string;
  separator?: boolean;
  // navbar
  title?: string;
  backLabel?: string;
  largeTitle?: boolean;
  rightIcon?: string;
  // tabbar
  items?: TabItem[];
  activeIndex?: number;
  // statusbar
  time?: string;
  dark?: boolean;
  // bubble
  sender?: "me" | "them";
  // image
  src?: string;
  fit?: "cover" | "contain";
  // layout
  keyboardAware?: boolean;
}

export interface Element {
  id: string;
  type: ElementType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  textColor: string;
  fontSize: number;
  fontWeight: number;
  textAlign: "left" | "center" | "right";
  radius: number;
  opacity: number;
  text: string;
  /** Stroke color. Absent on older projects; treat as transparent. */
  stroke?: string;
  strokeWidth?: number;
  /** Normalized 0–1 points for path and line. */
  points?: Vec2[];
  /** Variable name; element only renders when truthy. Prefix with ! to negate. */
  showIf?: string;
  hidden?: boolean;
  props: ElementProps;
  interactions: Interaction[];
}

export interface Screen {
  id: string;
  name: string;
  device: DeviceKind;
  /** Position on the editor canvas. */
  x: number;
  y: number;
  width: number;
  height: number;
  background: string;
  elements: Element[];
}

export interface Project {
  id: string;
  version: 1;
  /** Defaults to "prototype" when omitted (older files). */
  kind?: ProjectKind;
  name: string;
  startScreenId: string;
  screens: Screen[];
  variables: Variable[];
  updatedAt: number;
}

export const DEVICES: Record<
  DeviceKind,
  { label: string; width: number; height: number; radius: number; bezel: number }
> = {
  iphone: { label: "iPhone 15", width: 393, height: 852, radius: 55, bezel: 14 },
  ipad: { label: "iPad 11\"", width: 834, height: 1194, radius: 18, bezel: 22 },
  mac: { label: "Mac window", width: 1200, height: 760, radius: 10, bezel: 0 },
  canvas: { label: "Canvas", width: 1200, height: 800, radius: 0, bezel: 0 },
  slide: { label: "Slide", width: 1920, height: 1080, radius: 0, bezel: 0 },
};

export const SLIDE_INSERT_TYPES = ["text", "rect", "image"] as const satisfies readonly ElementType[];

export function isDeck(project: Pick<Project, "kind">): boolean {
  return project.kind === "deck";
}

/** iPhone / iPad frames get a bezel, status bar, and home indicator. */
export function hasDeviceChrome(device: DeviceKind): boolean {
  return device === "iphone" || device === "ipad";
}

export const IOS_BLUE = "#0A84FF";
export const IOS_GREEN = "#34C759";

export function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 10);
}

const BASE: Omit<Element, "id" | "type" | "name" | "props" | "interactions"> = {
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  fill: "transparent",
  textColor: "#000000",
  fontSize: 17,
  fontWeight: 400,
  textAlign: "left",
  radius: 0,
  opacity: 1,
  text: "",
};

type Defaults = Partial<Omit<Element, "props">> & { props?: ElementProps };

export const ELEMENT_DEFAULTS: Record<ElementType, Defaults> = {
  text: { name: "Text", text: "Text", width: 200, height: 24 },
  rect: { name: "Rectangle", width: 160, height: 100, fill: "#E5E5EA", radius: 12 },
  image: { name: "Image", width: 200, height: 150, fill: "#D1D1D6", radius: 12, props: { fit: "cover" } },
  button: {
    name: "Button",
    text: "Continue",
    width: 200,
    height: 50,
    fill: IOS_BLUE,
    textColor: "#FFFFFF",
    fontWeight: 600,
    textAlign: "center",
    radius: 14,
    props: { variant: "filled" },
  },
  textfield: {
    name: "Text Field",
    width: 300,
    height: 36,
    fill: "#FFFFFF",
    radius: 10,
    props: { placeholder: "Type here", fieldStyle: "rounded" },
  },
  textarea: {
    name: "Text Area",
    width: 300,
    height: 160,
    fill: "#FFFFFF",
    radius: 10,
    props: { placeholder: "Start typing…" },
  },
  toggle: { name: "Toggle", width: 51, height: 31, fill: IOS_GREEN, props: { on: true } },
  listrow: {
    name: "List Row",
    text: "Title",
    width: 393,
    height: 52,
    fill: "#FFFFFF",
    props: { chevron: true, separator: true, subtitle: "" },
  },
  navbar: {
    name: "Nav Bar",
    width: 393,
    height: 44,
    fill: "#F9F9F9",
    fontWeight: 600,
    props: { title: "Title", backLabel: "Back" },
  },
  tabbar: {
    name: "Tab Bar",
    width: 393,
    height: 83,
    fill: "#F9F9F9",
    textColor: "#8E8E93",
    props: {
      activeIndex: 0,
      items: [
        { label: "Home", icon: "home" },
        { label: "Search", icon: "search" },
        { label: "Settings", icon: "settings" },
      ],
    },
  },
  statusbar: { name: "Status Bar", width: 393, height: 54, props: { time: "9:41", dark: false } },
  bubble: {
    name: "Chat Bubble",
    text: "Hey! Are we still on for tonight?",
    width: 260,
    height: 56,
    fill: "#E9E9EB",
    props: { sender: "them" },
  },
  messagelist: {
    name: "Message List",
    width: 393,
    height: 500,
    props: { variable: "messages" },
  },
  mactitlebar: {
    name: "Title Bar",
    width: 1200,
    height: 52,
    fill: "#ECECEC",
    fontSize: 13,
    fontWeight: 600,
    textColor: "#3C3C3C",
    textAlign: "center",
    props: { title: "Untitled" },
  },
  path: {
    name: "Path",
    width: 180,
    height: 90,
    fill: "transparent",
    stroke: "#111111",
    strokeWidth: 2.5,
    points: [
      { x: 0, y: 0.7 },
      { x: 0.2, y: 0.2 },
      { x: 0.45, y: 0.85 },
      { x: 0.7, y: 0.15 },
      { x: 1, y: 0.55 },
    ],
  },
  ellipse: {
    name: "Ellipse",
    width: 140,
    height: 140,
    fill: "#E5E5EA",
    stroke: "#111111",
    strokeWidth: 2,
    radius: 999,
  },
  line: {
    name: "Line",
    width: 160,
    height: 80,
    fill: "transparent",
    stroke: "#111111",
    strokeWidth: 2,
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
  },
};

export function createElement(type: ElementType, overrides: Defaults = {}): Element {
  const d = ELEMENT_DEFAULTS[type];
  return {
    ...BASE,
    ...d,
    ...overrides,
    id: uid("el_"),
    type,
    name: overrides.name ?? d.name ?? type,
    props: structuredClone({ ...(d.props ?? {}), ...(overrides.props ?? {}) }),
    interactions: overrides.interactions ?? [],
  };
}

export function createScreen(device: DeviceKind, overrides: Partial<Screen> = {}): Screen {
  const dev = DEVICES[device];
  return {
    id: uid("scr_"),
    name: device === "slide" ? "Slide" : device === "mac" ? "Mac Window" : device === "canvas" ? "Canvas" : "Screen",
    device,
    x: 0,
    y: 0,
    width: dev.width,
    height: dev.height,
    background: "#FFFFFF",
    elements: [],
    ...overrides,
  };
}

export function createProject(name = "Untitled project"): Project {
  const screen = createScreen("iphone", { name: "Home" });
  screen.elements.push(createElement("statusbar"));
  return {
    id: uid("prj_"),
    version: 1,
    kind: "prototype",
    name,
    startScreenId: screen.id,
    screens: [screen],
    variables: [],
    updatedAt: Date.now(),
  };
}

function starterSlideElements(): Element[] {
  return [
    createElement("text", {
      name: "Title",
      text: "Untitled presentation",
      x: 160,
      y: 400,
      width: 1600,
      height: 100,
      fontSize: 72,
      fontWeight: 700,
      textColor: "#111111",
    }),
    createElement("text", {
      name: "Subtitle",
      text: "Click to edit",
      x: 160,
      y: 520,
      width: 1600,
      height: 48,
      fontSize: 28,
      fontWeight: 400,
      textColor: "#6B6B70",
    }),
  ];
}

export function createDeck(name = "Untitled presentation"): Project {
  const slide = createScreen("slide", { name: "Slide 1", elements: starterSlideElements() });
  return {
    id: uid("prj_"),
    version: 1,
    kind: "deck",
    name,
    startScreenId: slide.id,
    screens: [slide],
    variables: [],
    updatedAt: Date.now(),
  };
}

export function cloneElement(el: Element): Element {
  const copy = structuredClone(el);
  copy.id = uid("el_");
  copy.interactions = copy.interactions.map((i) => ({ ...i, id: uid("ix_") }));
  return copy;
}

export function isProject(value: unknown): value is Project {
  const p = value as Project;
  return !!p && typeof p === "object" && p.version === 1 && Array.isArray(p.screens) && typeof p.id === "string";
}

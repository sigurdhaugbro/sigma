import type { ElementType, Project, Screen } from "@/lib/model";
import type { AiPlan, Operation } from "./ops";

const COLORS: Record<string, string> = {
  blue: "#0A84FF",
  red: "#FF3B30",
  green: "#34C759",
  orange: "#FF9500",
  yellow: "#FFCC00",
  purple: "#AF52DE",
  pink: "#FF2D55",
  teal: "#30B0C7",
  indigo: "#5856D6",
  black: "#000000",
  white: "#FFFFFF",
  gray: "#8E8E93",
  grey: "#8E8E93",
};

const TYPE_WORDS: [RegExp, ElementType][] = [
  [/text ?field|input/, "textfield"],
  [/text ?area|note/, "textarea"],
  [/toggle|switch/, "toggle"],
  [/button/, "button"],
  [/rectangle|rect|box/, "rect"],
  [/image|photo|picture/, "image"],
  [/list ?row|row|cell/, "listrow"],
  [/nav ?bar|navigation bar/, "navbar"],
  [/tab ?bar/, "tabbar"],
  [/status ?bar/, "statusbar"],
  [/chat thread|message list|thread/, "messagelist"],
  [/bubble/, "bubble"],
  [/title ?bar/, "mactitlebar"],
  [/text|label|title|heading/, "text"],
];

interface Selection {
  screenId: string | null;
  elementId: string | null;
}

const quoted = (s: string) => s.match(/["“'‘]([^"”'’]+)["”'’]/)?.[1];

function findScreen(project: Project, phrase: string): Screen | undefined {
  const p = phrase.toLowerCase();
  return [...project.screens].sort((a, b) => b.name.length - a.name.length).find((s) => p.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(p.trim()));
}

/** Finds an element mentioned by name ("the send button"), preferring the current screen. */
function findElement(project: Project, sel: Selection, phrase: string) {
  const p = phrase.toLowerCase();
  if (/\b(this|it|selected|selection)\b/.test(p) && sel.elementId) return sel.elementId;
  let best: { id: string; score: number } | null = null;
  for (const s of project.screens) {
    for (const el of s.elements) {
      const name = el.name.toLowerCase();
      const words = name.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
      let score = p.includes(name) ? name.length * 2 : words.filter((w) => p.includes(w)).length * 3;
      if (!score && el.text && p.includes(el.text.toLowerCase())) score = 4;
      if (!score) continue;
      if (TYPE_WORDS.some(([re, t]) => t === el.type && re.test(p))) score += 2;
      if (s.id === sel.screenId) score += 1;
      if (!best || score > best.score) best = { id: el.id, score };
    }
  }
  return best?.id ?? sel.elementId ?? null;
}

function parseColor(p: string) {
  const hex = p.match(/#[0-9a-f]{6}\b/i)?.[0];
  if (hex) return hex.toUpperCase();
  const word = Object.keys(COLORS).find((c) => new RegExp(`\\b${c}\\b`).test(p));
  return word ? COLORS[word] : null;
}

/**
 * Handles a few common commands without a model. Returns null when it can't understand the instruction.
 */
export function offlinePlan(project: Project, sel: Selection, instruction: string): AiPlan | null {
  const text = instruction.trim();
  const p = text.toLowerCase();
  const currentScreen = project.screens.find((s) => s.id === sel.screenId) ?? project.screens[0];
  const ops: Operation[] = [];

  // Add a screen: "add a settings screen", "add a mac window called Mail"
  const addScreen = p.match(/\badd (?:an? )?(?:new )?(?:(iphone|ipad|mac) )?(?:(.+?) )?(screen|window)\b/);
  if (addScreen && !(addScreen[2] && TYPE_WORDS.some(([re]) => re.test(addScreen[2])))) {
    const device = (addScreen[1] as "iphone" | "ipad" | "mac" | undefined) ?? (addScreen[3] === "window" ? "mac" : "iphone");
    const rawName = quoted(text) ?? text.match(/(?:called|named)\s+(.+)$/i)?.[1] ?? addScreen[2];
    const name = rawName ? rawName.replace(/\b(new|an?|the)\b/gi, "").trim().replace(/^\w/, (c) => c.toUpperCase()) : "New Screen";
    ops.push({ op: "addScreen", id: "new", device, name: name || "New Screen" });
    if (device === "mac") ops.push({ op: "addElement", screenId: "new", type: "mactitlebar", props: { title: name } });
    else {
      ops.push({ op: "addElement", screenId: "new", type: "statusbar" });
      ops.push({ op: "addElement", screenId: "new", type: "navbar", props: { title: name, backLabel: "Back" } });
    }
    const link = p.match(/(?:linked|link(?:ed)?|opened) from (?:the )?(.+?)(?: icon| button)?$/);
    if (link) {
      const from = findElement(project, { ...sel, elementId: null }, link[1]);
      if (from) ops.push({ op: "addInteraction", elementId: from, trigger: "tap", action: { type: "navigate", screenId: "new", transition: "push" } });
    }
    return { summary: `Added “${name || "New Screen"}”.`, operations: ops };
  }

  // Add an element: 'add a button saying "Call"'
  const add = p.match(/\badd (?:an? |another )?(.+)$/);
  if (add) {
    const type = TYPE_WORDS.find(([re]) => re.test(add[1]))?.[1];
    if (type) {
      const label = quoted(text);
      const color = parseColor(add[1]);
      ops.push({
        op: "addElement",
        screenId: currentScreen.id,
        type,
        ...(label ? (type === "textfield" || type === "textarea" ? { props: { placeholder: label } } : { text: label }) : {}),
        ...(color ? { fill: color } : {}),
      });
      return { summary: `Added a ${type} to “${currentScreen.name}”.`, operations: ops };
    }
  }

  // Navigation: "link the gear icon to Settings", "make Edit open Contact Details"
  const nav = p.match(/(?:link|connect)\s+(.+?)\s+to\s+(.+)$/) ?? p.match(/(?:make\s+)?(.+?)\s+(?:open|opens|go to|goes to|navigate to|navigates to)\s+(.+)$/);
  if (nav) {
    const target = findScreen(project, nav[2]);
    const el = findElement(project, sel, nav[1]);
    if (target && el) {
      ops.push({ op: "addInteraction", elementId: el, trigger: "tap", action: { type: "navigate", screenId: target.id, transition: /modal|sheet/.test(p) ? "modal" : "push" } });
      return { summary: `Tapping it now opens “${target.name}”.`, operations: ops };
    }
  }

  // Delete
  if (/^(delete|remove)\b/.test(p)) {
    const el = findElement(project, sel, p.replace(/^(delete|remove)\s+/, ""));
    if (el) return { summary: "Deleted it.", operations: [{ op: "deleteElement", elementId: el }] };
  }

  // Text: 'change the title to "Inbox"', 'set text to Hello'
  const setText = text.match(/(?:set|change|rename)\s+(.*?)\s*to\s+["“]?(.+?)["”]?$/i);
  if (setText && !parseColor(setText[2].toLowerCase())) {
    const subject = setText[1].toLowerCase();
    if (/screen/.test(subject) && sel.screenId) {
      return { summary: "Renamed the screen.", operations: [{ op: "updateScreen", screenId: sel.screenId, set: { name: setText[2] } }] };
    }
    const id = findElement(project, sel, subject || "this");
    if (id) {
      const isName = /^rename/i.test(text);
      const el = project.screens.flatMap((s) => s.elements).find((e) => e.id === id)!;
      const set = isName
        ? { name: setText[2] }
        : el.type === "navbar" || el.type === "mactitlebar"
          ? { props: { title: setText[2] } }
          : el.type === "textfield" || el.type === "textarea"
            ? { props: { placeholder: setText[2] } }
            : { text: setText[2] };
      return { summary: `Updated “${el.name}”.`, operations: [{ op: "updateElement", elementId: id, set }] };
    }
  }

  // Colors: "make the send button blue", "make the background black", "text color red"
  const color = parseColor(p);
  if (color && /\b(make|set|change|color|colour|turn|paint)\b/.test(p)) {
    if (/\bbackground\b/.test(p) && !/button|field|row|bar/.test(p) && currentScreen) {
      return { summary: `Screen background set to ${color}.`, operations: [{ op: "updateScreen", screenId: currentScreen.id, set: { background: color } }] };
    }
    const id = findElement(project, sel, p);
    if (id) {
      const field = /\btext\b|font|label color/.test(p) ? "textColor" : "fill";
      return { summary: `Set ${field === "fill" ? "fill" : "text color"} to ${color}.`, operations: [{ op: "updateElement", elementId: id, set: { [field]: color } }] };
    }
  }

  return null;
}

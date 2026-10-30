import type { ChatMessage, Element, VariableValue } from "./model";

export type Vars = Record<string, VariableValue>;

/**
 * Resolves `{{name}}` placeholders. Message lists support `{{name.last}}` and `{{name.count}}`.
 */
export function resolveText(text: string, vars: Vars): string {
  if (!text.includes("{{")) return text;
  return text.replace(/\{\{\s*([\w-]+)(?:\.(last|count))?\s*\}\}/g, (_, name: string, field?: string) => {
    const v = vars[name];
    if (Array.isArray(v)) {
      if (field === "count") return String(v.length);
      const last = v[v.length - 1] as ChatMessage | undefined;
      return last?.text ?? "";
    }
    if (typeof v === "boolean") return v ? "On" : "Off";
    return v ?? "";
  });
}

export function isTruthy(v: VariableValue | undefined): boolean {
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  return !!v;
}

export function isVisible(el: Element, vars: Vars): boolean {
  if (el.hidden) return false;
  if (!el.showIf) return true;
  const negate = el.showIf.startsWith("!");
  const name = negate ? el.showIf.slice(1) : el.showIf;
  const t = isTruthy(vars[name]);
  return negate ? !t : t;
}

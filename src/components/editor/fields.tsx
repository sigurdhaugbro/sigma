"use client";

import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEditor } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Focus opens a history transaction so a burst of typing becomes one undo step. */
function txHandlers() {
  const { beginTx, endTx } = useEditor.getState();
  return { onFocus: beginTx, onBlur: endTx };
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="border-b border-border/60 px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
        {action}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

export function Row({ label, children, className }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label && <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>}
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  );
}

export function NumField({ label, value, onChange, min, step = 1 }: { label: string; value: number; onChange: (v: number) => void; min?: number; step?: number }) {
  const [text, setText] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    if (parseFloat(text) !== value) setText(String(Math.round(value * 100) / 100));
  }
  return (
    <label className="relative flex min-w-0 flex-1 items-center">
      <span className="pointer-events-none absolute left-2 text-[11px] text-muted-foreground">{label}</span>
      <Input
        className="h-7 pl-6 text-xs tabular-nums"
        type="number"
        value={text}
        step={step}
        min={min}
        {...txHandlers()}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseFloat(e.target.value);
          if (!Number.isNaN(n)) onChange(min !== undefined ? Math.max(min, n) : n);
        }}
      />
    </label>
  );
}

export function TextField({ value, onChange, placeholder, multiline, className }: { value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; className?: string }) {
  if (multiline)
    return (
      <Textarea
        className={cn("min-h-16 text-xs", className)}
        value={value}
        placeholder={placeholder}
        {...txHandlers()}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  return <Input className={cn("h-7 text-xs", className)} value={value} placeholder={placeholder} {...txHandlers()} onChange={(e) => onChange(e.target.value)} />;
}

const HEX = /^#([0-9a-f]{6})$/i;

export function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const swatch = HEX.test(value) ? value : "#000000";
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <label
        className="relative size-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border"
        style={{ background: value === "transparent" ? "repeating-conic-gradient(#555 0 25%, #333 0 50%) 0 0/8px 8px" : value }}
      >
        <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={swatch} {...txHandlers()} onChange={(e) => onChange(e.target.value)} />
      </label>
      <TextField value={value} onChange={onChange} className="font-mono" />
    </div>
  );
}

export function SelectField<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <select
      className={cn(
        "h-7 w-full min-w-0 rounded-md border border-input bg-input/30 px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-popover">
          {o.label}
        </option>
      ))}
    </select>
  );
}

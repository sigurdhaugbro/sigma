"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EyeOff, Keyboard, Maximize, MousePointer2, RotateCcw, Smartphone, X } from "lucide-react";
import { DEVICES, type Element, type Project, type Transition, type VariableValue, uid } from "@/lib/model";
import type { Vars } from "@/lib/runtime";
import { IOSKeyboard, KEYBOARD_HEIGHT, type KeyInput } from "@/components/device/ios-keyboard";
import { RuntimeContext, type Runtime } from "@/components/device/runtime-context";
import { HardwareOverlays, ScreenView } from "@/components/device/screen-view";
import { cn } from "@/lib/utils";

const TRANSITION_MS = 420;

interface StackEntry {
  id: string;
  via: Transition;
}

interface Anim {
  from: string;
  to: string;
  kind: Transition;
  back: boolean;
  key: number;
}

export interface PlayerOptions {
  bezel: boolean;
  keyboard: boolean;
  hideCursor: boolean;
}

export function Player({ project, startScreenId, onExit }: { project: Project; startScreenId: string; onExit: () => void }) {
  const [runKey, setRunKey] = useState(0);
  const [options, setOptions] = useState<PlayerOptions>({ bezel: true, keyboard: true, hideCursor: false });
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<number | undefined>(undefined);

  const poke = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), 2200);
  }, []);

  useEffect(() => {
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), 2200);
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.("input, textarea");
      if (e.key === "Escape" && !document.fullscreenElement) onExit();
      if (!typing && e.key.toLowerCase() === "r" && e.shiftKey) setRunKey((k) => k + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit, poke]);

  const toggle = (k: keyof PlayerOptions) => setOptions((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div
      className={cn("fixed inset-0 overflow-hidden bg-black", options.hideCursor && "hide-cursor")}
      onMouseMove={(e) => {
        if (!options.hideCursor || e.clientY < 80) poke();
      }}
    >
      <Stage key={runKey} project={project} startScreenId={startScreenId} options={options} />
      <div
        className={cn(
          "fixed top-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-neutral-900/80 p-1 text-white shadow-2xl backdrop-blur-xl transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={{ cursor: "default" }}
      >
        <CtlButton label="Exit prototype (Esc)" onClick={onExit}>
          <X size={16} />
        </CtlButton>
        <span className="mx-1 h-5 w-px bg-white/15" />
        <CtlButton label="Restart (Shift+R)" onClick={() => setRunKey((k) => k + 1)}>
          <RotateCcw size={16} />
        </CtlButton>
        <CtlButton label={options.bezel ? "Hide device frame" : "Show device frame"} active={options.bezel} onClick={() => toggle("bezel")}>
          <Smartphone size={16} />
        </CtlButton>
        <CtlButton label="On-screen iOS keyboard" active={options.keyboard} onClick={() => toggle("keyboard")}>
          <Keyboard size={16} />
        </CtlButton>
        <CtlButton label={options.hideCursor ? "Show cursor" : "Hide cursor"} active={options.hideCursor} onClick={() => toggle("hideCursor")}>
          {options.hideCursor ? <EyeOff size={16} /> : <MousePointer2 size={16} />}
        </CtlButton>
        <CtlButton
          label="Fullscreen"
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
        >
          <Maximize size={16} />
        </CtlButton>
      </div>
    </div>
  );
}

function CtlButton({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn("flex size-8 items-center justify-center rounded-full transition-colors hover:bg-white/15", active && "bg-white/20")}
    >
      {children}
    </button>
  );
}

function initialVars(project: Project): Vars {
  return Object.fromEntries(project.variables.map((v) => [v.name, structuredClone(v.initial)]));
}

function Stage({ project, startScreenId, options }: { project: Project; startScreenId: string; options: PlayerOptions }) {
  const screens = useMemo(() => new Map(project.screens.map((s) => [s.id, s])), [project]);
  const [stack, setStack] = useState<StackEntry[]>([{ id: startScreenId, via: "none" }]);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [vars, setVars] = useState<Vars>(() => initialVars(project));
  const [locals, setLocals] = useState<Record<string, string>>({});
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [tabs, setTabs] = useState<Record<string, number>>({});
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [focused, setFocused] = useState<Element | null>(null);
  const replyIndex = useRef<Record<string, number>>({});
  const timers = useRef<number[]>([]);
  const [viewport, setViewport] = useState({ w: 1200, h: 800 });

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    const pending = timers.current;
    return () => {
      window.removeEventListener("resize", onResize);
      pending.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const current = screens.get(stack[stack.length - 1].id) ?? project.screens[0];
  const device = current.device;

  const go = useCallback(
    (to: string, kind: Transition, mode: "push" | "replace") => {
      if (!screens.has(to)) return;
      setStack((s) => {
        const from = s[s.length - 1].id;
        if (from === to) return s;
        if (kind !== "none") setAnim({ from, to, kind, back: false, key: Date.now() });
        return mode === "push" ? [...s, { id: to, via: kind }] : [...s.slice(0, -1), { id: to, via: "none" }];
      });
      setFocused(null);
    },
    [screens],
  );

  const back = useCallback(() => {
    setStack((s) => {
      if (s.length < 2) return s;
      const top = s[s.length - 1];
      if (top.via !== "none") setAnim({ from: top.id, to: s[s.length - 2].id, kind: top.via, back: true, key: Date.now() });
      return s.slice(0, -1);
    });
    setFocused(null);
  }, []);

  useEffect(() => {
    if (!anim) return;
    const t = window.setTimeout(() => setAnim(null), TRANSITION_MS);
    return () => window.clearTimeout(t);
  }, [anim]);

  const setVar = (name: string, value: VariableValue) => setVars((v) => ({ ...v, [name]: value }));

  const getValue = (el: Element) => {
    if (el.props.variable) {
      const v = vars[el.props.variable];
      return typeof v === "string" ? v : "";
    }
    return locals[el.id] ?? el.text;
  };
  const setValue = (el: Element, value: string) => {
    if (el.props.variable) setVar(el.props.variable, value);
    else setLocals((l) => ({ ...l, [el.id]: value }));
  };

  const fire = (el: Element, trigger: "tap" | "submit") => {
    for (const ix of el.interactions) {
      if (ix.trigger !== trigger) continue;
      const a = ix.action;
      switch (a.type) {
        case "navigate":
          go(a.screenId, a.transition, "push");
          break;
        case "back":
          back();
          break;
        case "toggleVariable":
          setVars((v) => ({ ...v, [a.variable]: !v[a.variable] }));
          break;
        case "setVariable":
          setVar(a.variable, a.value);
          break;
        case "sendMessage": {
          const text = String(vars[a.from] ?? "").trim();
          if (!text) break;
          setVars((v) => ({
            ...v,
            [a.from]: "",
            [a.to]: [...(Array.isArray(v[a.to]) ? (v[a.to] as []) : []), { id: `rt_${uid()}`, from: "me", text }],
          }));
          const idx = replyIndex.current[ix.id] ?? 0;
          const reply = a.replies.filter((r) => r.trim())[idx];
          if (reply) {
            replyIndex.current[ix.id] = idx + 1;
            later(() => setTyping((t) => ({ ...t, [a.to]: true })), 700);
            later(() => {
              setTyping((t) => ({ ...t, [a.to]: false }));
              setVars((v) => ({
                ...v,
                [a.to]: [...(Array.isArray(v[a.to]) ? (v[a.to] as []) : []), { id: `rt_${uid()}`, from: "them", text: reply }],
              }));
            }, 700 + Math.max(400, a.replyDelayMs));
          }
          break;
        }
      }
    }
  };

  const kbVisible = options.keyboard && device !== "mac" && !!focused;
  const keyboardOffset = kbVisible ? KEYBOARD_HEIGHT - 52 : 0;

  const runtime: Runtime = {
    live: true,
    vars,
    keyboardOffset,
    typing,
    getValue,
    setValue,
    getToggle: (el) => {
      if (el.props.variable) return !!vars[el.props.variable];
      return toggles[el.id] ?? !!el.props.on;
    },
    toggle: (el) => {
      if (el.props.variable) setVars((v) => ({ ...v, [el.props.variable!]: !v[el.props.variable!] }));
      else setToggles((t) => ({ ...t, [el.id]: !(t[el.id] ?? !!el.props.on) }));
      fire(el, "tap");
    },
    getTab: (el) => tabs[el.id] ?? el.props.activeIndex ?? 0,
    selectTab: (el, i) => {
      setTabs((t) => ({ ...t, [el.id]: i }));
      const target = el.props.items?.[i]?.screenId;
      if (target) go(target, "none", "replace");
    },
    setVar,
    fire,
    back,
    focusField: setFocused,
  };

  const onKey = (k: KeyInput) => {
    if (!focused) return;
    const value = getValue(focused);
    if (k.type === "char") setValue(focused, value + k.char);
    else if (k.type === "backspace") setValue(focused, [...value].slice(0, -1).join(""));
    else if (focused.type === "textarea") setValue(focused, value + "\n");
    else fire(focused, "submit");
  };

  const dev = DEVICES[device];
  const bezel = options.bezel && device !== "mac" ? dev.bezel : 0;
  const frameW = current.width + bezel * 2;
  const frameH = current.height + bezel * 2;
  const pad = options.bezel ? 48 : 0;
  const scale = Math.min((viewport.w - pad * 2) / frameW, (viewport.h - pad * 2) / frameH, device === "mac" && options.bezel ? 1 : 4);

  const layer = (id: string, cls?: string, z = 1) => {
    const s = screens.get(id);
    if (!s) return null;
    return (
      <div key={`${id}-${cls ?? "static"}`} className={cn("absolute inset-0", cls)} style={{ zIndex: z }}>
        <ScreenView screen={s} rounded={false} hardware={false}>
          {id === current.id && device !== "mac" && <IOSKeyboard visible={kbVisible} onKey={onKey} />}
        </ScreenView>
      </div>
    );
  };

  let layers: React.ReactNode;
  if (anim) {
    const k = anim.kind;
    if (!anim.back) {
      layers = [layer(anim.from, `anim-${k}-under`, 1), layer(anim.to, `anim-${k}-in`, 2)];
    } else {
      layers = [layer(anim.to, `anim-${k}-under-back`, 1), layer(anim.from, `anim-${k}-out`, 2)];
    }
  } else layers = layer(current.id);

  const screenBox = (
    <div className="relative overflow-hidden" style={{ width: current.width, height: current.height, borderRadius: options.bezel ? dev.radius : 0, background: current.background }}>
      <RuntimeContext.Provider value={runtime}>{layers}</RuntimeContext.Provider>
      <HardwareOverlays device={device} />
    </div>
  );

  return (
    <div
      className={cn("flex h-full w-full items-center justify-center", device === "mac" && options.bezel && "mac-desktop")}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) (document.activeElement as HTMLElement | null)?.blur?.();
      }}
    >
      <div style={{ width: frameW * scale, height: frameH * scale }}>
        <div style={{ width: frameW, height: frameH, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {bezel ? (
            <div className="device-bezel relative" style={{ width: frameW, height: frameH, padding: bezel, borderRadius: dev.radius + bezel }}>
              {screenBox}
            </div>
          ) : device === "mac" && options.bezel ? (
            <div className="overflow-hidden rounded-[10px] shadow-[0_30px_80px_rgba(0,0,0,.45),0_0_0_0.5px_rgba(0,0,0,.4)]">{screenBox}</div>
          ) : (
            screenBox
          )}
        </div>
      </div>
    </div>
  );
}

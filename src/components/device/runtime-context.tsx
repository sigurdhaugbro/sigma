"use client";

import { createContext, useContext } from "react";
import type { Element, Trigger, VariableValue } from "@/lib/model";
import type { Vars } from "@/lib/runtime";

export interface Runtime {
  live: boolean;
  /** Phone player with the built-in keyboard: stop iOS from also opening its own. */
  suppressNativeKeyboard?: boolean;
  /** Phone player: the real device draws the status bar. */
  hideStatusBar?: boolean;
  vars: Vars;
  /** Pixels the on-screen keyboard currently covers (keyboard-aware elements move up). */
  keyboardOffset: number;
  typing: Record<string, boolean>;
  getValue: (el: Element) => string;
  setValue: (el: Element, value: string) => void;
  getToggle: (el: Element) => boolean;
  toggle: (el: Element) => void;
  getTab: (el: Element) => number;
  selectTab: (el: Element, index: number) => void;
  setVar: (name: string, value: VariableValue) => void;
  fire: (el: Element, trigger: Trigger) => void;
  back: () => void;
  focusField: (el: Element | null) => void;
}

const noop = () => {};

export function staticRuntime(vars: Vars): Runtime {
  return {
    live: false,
    vars,
    keyboardOffset: 0,
    typing: {},
    getValue: (el) => {
      const v = el.props.variable ? vars[el.props.variable] : undefined;
      return typeof v === "string" ? v : el.text;
    },
    setValue: noop,
    getToggle: (el) => {
      const v = el.props.variable ? vars[el.props.variable] : undefined;
      return typeof v === "boolean" ? v : !!el.props.on;
    },
    toggle: noop,
    getTab: (el) => el.props.activeIndex ?? 0,
    selectTab: noop,
    setVar: noop,
    fire: noop,
    back: noop,
    focusField: noop,
  };
}

export const RuntimeContext = createContext<Runtime>(staticRuntime({}));
export const useRuntime = () => useContext(RuntimeContext);

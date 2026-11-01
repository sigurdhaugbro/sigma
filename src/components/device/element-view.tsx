"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, Search } from "lucide-react";
import { IOS_BLUE, type ChatMessage, type Element } from "@/lib/model";
import { isVisible, resolveText } from "@/lib/runtime";
import { Icon } from "./icons";
import { useRuntime } from "./runtime-context";

function textStyle(el: Element): CSSProperties {
  return {
    color: el.textColor,
    fontSize: el.fontSize,
    fontWeight: el.fontWeight,
    textAlign: el.textAlign,
  };
}

export function ElementView({ el }: { el: Element }) {
  const rt = useRuntime();
  if (el.hidden || (rt.hideStatusBar && el.type === "statusbar")) return null;
  const visible = isVisible(el, rt.vars);
  // In the editor, conditionally hidden elements stay visible (dimmed) so they can be edited.
  if (!visible && rt.live) return null;
  const shift = el.props.keyboardAware && el.type !== "messagelist" ? rt.keyboardOffset : 0;
  const height = el.type === "messagelist" && el.props.keyboardAware ? el.height - rt.keyboardOffset : el.height;
  return (
    <div
      className="absolute"
      style={{
        left: el.x,
        top: el.y,
        width: el.width,
        height,
        opacity: visible ? el.opacity : el.opacity * 0.35,
        transform: shift ? `translateY(${-shift}px)` : undefined,
        transition: rt.live ? "transform 280ms cubic-bezier(.2,.8,.2,1), height 280ms cubic-bezier(.2,.8,.2,1)" : undefined,
      }}
    >
      <Body el={el} />
    </div>
  );
}

function Body({ el }: { el: Element }) {
  switch (el.type) {
    case "text":
      return <TextEl el={el} />;
    case "rect":
      return <RectEl el={el} />;
    case "image":
      return <ImageEl el={el} />;
    case "button":
      return <ButtonEl el={el} />;
    case "textfield":
      return <FieldEl el={el} />;
    case "textarea":
      return <AreaEl el={el} />;
    case "toggle":
      return <ToggleEl el={el} />;
    case "listrow":
      return <ListRowEl el={el} />;
    case "navbar":
      return <NavBarEl el={el} />;
    case "tabbar":
      return <TabBarEl el={el} />;
    case "statusbar":
      return <StatusBarEl el={el} />;
    case "bubble":
      return <BubbleEl el={el} />;
    case "messagelist":
      return <MessageListEl el={el} />;
    case "mactitlebar":
      return <MacTitleBarEl el={el} />;
  }
}

function TextEl({ el }: { el: Element }) {
  const rt = useRuntime();
  return (
    <div
      className="h-full w-full whitespace-pre-wrap leading-tight"
      style={{ ...textStyle(el), background: el.fill, borderRadius: el.radius }}
      onClick={rt.live && el.interactions.length ? () => rt.fire(el, "tap") : undefined}
    >
      {resolveText(el.text, rt.vars)}
    </div>
  );
}

function RectEl({ el }: { el: Element }) {
  const rt = useRuntime();
  return (
    <div
      className="flex h-full w-full items-center justify-center overflow-hidden"
      style={{ ...textStyle(el), background: el.fill, borderRadius: el.radius }}
      onClick={rt.live && el.interactions.length ? () => rt.fire(el, "tap") : undefined}
    >
      {el.text ? resolveText(el.text, rt.vars) : null}
    </div>
  );
}

function ImageEl({ el }: { el: Element }) {
  const rt = useRuntime();
  return (
    <div
      className="flex h-full w-full items-center justify-center overflow-hidden"
      style={{ background: el.props.src ? undefined : el.fill, borderRadius: el.radius }}
      onClick={rt.live && el.interactions.length ? () => rt.fire(el, "tap") : undefined}
    >
      {el.props.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={el.props.src} alt="" draggable={false} className="h-full w-full" style={{ objectFit: el.props.fit ?? "cover" }} />
      ) : (
        <ImageIcon size={Math.min(el.width, el.height) * 0.3} color="#8E8E93" strokeWidth={1.5} />
      )}
    </div>
  );
}

function ButtonEl({ el }: { el: Element }) {
  const rt = useRuntime();
  const variant = el.props.variant ?? "filled";
  const iconOnly = !el.text && el.props.icon;
  const style: CSSProperties = {
    ...textStyle(el),
    borderRadius: el.radius,
    background: variant === "filled" ? el.fill : variant === "tinted" ? `color-mix(in srgb, ${el.fill} 15%, transparent)` : "transparent",
    color: variant === "tinted" ? el.fill : el.textColor,
    justifyContent: el.textAlign === "left" ? "flex-start" : el.textAlign === "right" ? "flex-end" : "center",
  };
  const iconSize = iconOnly ? Math.round(Math.min(el.width, el.height) * 0.62) : Math.round(el.fontSize * 1.15);
  return (
    <button
      type="button"
      tabIndex={rt.live ? 0 : -1}
      className="flex h-full w-full items-center gap-1.5 whitespace-nowrap transition-opacity active:opacity-50"
      style={style}
      onMouseDown={rt.live ? (e) => e.preventDefault() : undefined}
      onClick={rt.live ? () => rt.fire(el, "tap") : undefined}
    >
      <Icon name={el.props.icon} size={iconSize} strokeWidth={iconOnly && variant === "filled" ? 2.6 : 2} />
      {el.text ? resolveText(el.text, rt.vars) : null}
    </button>
  );
}

function fieldChrome(el: Element): CSSProperties {
  const style = el.props.fieldStyle ?? "rounded";
  return {
    background: el.fill,
    borderRadius: style === "pill" ? el.height / 2 : el.radius,
    border: style === "pill" ? "1px solid #C7C7CC" : style === "plain" ? "none" : undefined,
  };
}

function FieldEl({ el }: { el: Element }) {
  const rt = useRuntime();
  const value = rt.getValue(el);
  const isSearch = el.props.fieldStyle === "search";
  const placeholderColor = isSearch ? "#8E8E93" : "#A1A1A6";
  return (
    <div className="flex h-full w-full items-center gap-1.5 overflow-hidden px-3" style={fieldChrome(el)}>
      {isSearch && <Search size={Math.round(el.fontSize * 1.05)} color="#8E8E93" strokeWidth={2.2} className="-ml-1 shrink-0" />}
      {rt.live ? (
        <input
          className="device-input h-full w-full bg-transparent outline-none"
          style={{ ...textStyle(el), ["--ph" as string]: placeholderColor }}
          value={value}
          placeholder={el.props.placeholder}
          onChange={(e) => rt.setValue(el, e.target.value)}
          onFocus={() => rt.focusField(el)}
          onBlur={() => rt.focusField(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              rt.fire(el, "submit");
            }
          }}
          data-field-id={el.id}
          inputMode={rt.suppressNativeKeyboard ? "none" : undefined}
          autoComplete="off"
          spellCheck={false}
        />
      ) : (
        <span className="truncate" style={{ ...textStyle(el), color: value ? el.textColor : placeholderColor }}>
          {value || el.props.placeholder}
        </span>
      )}
    </div>
  );
}

function AreaEl({ el }: { el: Element }) {
  const rt = useRuntime();
  const value = rt.getValue(el);
  const common: CSSProperties = { ...textStyle(el), lineHeight: 1.45 };
  return (
    <div className="h-full w-full overflow-hidden p-2" style={fieldChrome(el)}>
      {rt.live ? (
        <textarea
          className="device-input h-full w-full resize-none bg-transparent outline-none"
          style={{ ...common, ["--ph" as string]: "#A1A1A6" }}
          value={value}
          placeholder={el.props.placeholder}
          onChange={(e) => rt.setValue(el, e.target.value)}
          onFocus={() => rt.focusField(el)}
          onBlur={() => rt.focusField(null)}
          data-field-id={el.id}
          inputMode={rt.suppressNativeKeyboard ? "none" : undefined}
          spellCheck={false}
        />
      ) : (
        <div className="h-full w-full whitespace-pre-wrap" style={{ ...common, color: value ? el.textColor : "#A1A1A6" }}>
          {value || el.props.placeholder}
        </div>
      )}
    </div>
  );
}

function ToggleEl({ el }: { el: Element }) {
  const rt = useRuntime();
  const on = rt.getToggle(el);
  const knob = el.height - 4;
  return (
    <button
      type="button"
      tabIndex={rt.live ? 0 : -1}
      role="switch"
      aria-checked={on}
      className="relative h-full w-full"
      style={{ borderRadius: el.height / 2, background: on ? el.fill : "#E9E9EA", transition: "background 200ms" }}
      onClick={rt.live ? () => rt.toggle(el) : undefined}
    >
      <span
        className="absolute top-0.5 left-0.5 rounded-full bg-white"
        style={{
          width: knob,
          height: knob,
          transform: `translateX(${on ? el.width - knob - 4 : 0}px)`,
          transition: "transform 220ms cubic-bezier(.3,.7,.3,1.2)",
          boxShadow: "0 3px 8px rgba(0,0,0,.15), 0 1px 1px rgba(0,0,0,.16)",
        }}
      />
    </button>
  );
}

function ListRowEl({ el }: { el: Element }) {
  const rt = useRuntime();
  const p = el.props;
  const leadSize = p.avatar ? Math.min(el.height - 18, 52) : 29;
  const hasLead = !!(p.avatar || p.icon);
  const subtitle = p.subtitle ? resolveText(p.subtitle, rt.vars) : "";
  const twoLine = el.height >= 70;
  return (
    <div
      className={`relative flex h-full w-full items-center gap-3 pl-4 ${rt.live ? "active:brightness-90" : ""}`}
      style={{ background: el.fill, borderRadius: el.radius }}
      onClick={rt.live ? () => rt.fire(el, "tap") : undefined}
    >
      {hasLead &&
        (p.avatar ? (
          <div
            className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
            style={{
              width: leadSize,
              height: leadSize,
              fontSize: leadSize * 0.4,
              background: `linear-gradient(180deg, color-mix(in srgb, ${p.iconBg ?? "#8E8E93"} 75%, white), ${p.iconBg ?? "#8E8E93"})`,
            }}
          >
            {p.avatar}
          </div>
        ) : (
          <div className="flex shrink-0 items-center justify-center rounded-[7px]" style={{ width: 29, height: 29, background: p.iconBg ?? IOS_BLUE }}>
            <Icon name={p.icon} size={18} color="#fff" />
          </div>
        ))}
      <div className="relative flex h-full min-w-0 flex-1 flex-col justify-center pr-4">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate" style={textStyle(el)}>
            {resolveText(el.text, rt.vars)}
          </span>
          {p.detail && (
            <span className="shrink-0" style={{ fontSize: Math.max(12, el.fontSize - 2), color: "#8E8E93" }}>
              {resolveText(p.detail, rt.vars)}
            </span>
          )}
          {p.chevron && <ChevronRight size={18} color="#C4C4C6" strokeWidth={2.5} className="-mr-1 shrink-0" />}
        </div>
        {subtitle && (
          <span
            className={twoLine ? "line-clamp-2" : "truncate"}
            style={{ fontSize: Math.max(11, el.fontSize - 2), color: "#8E8E93", lineHeight: 1.25 }}
          >
            {subtitle}
          </span>
        )}
        {p.separator && <div className="absolute right-0 bottom-0 left-0 h-px origin-bottom scale-y-50 bg-[#C6C6C8]" />}
      </div>
    </div>
  );
}

function NavBarEl({ el }: { el: Element }) {
  const rt = useRuntime();
  const p = el.props;
  const hasBack = p.backLabel !== undefined;
  return (
    <div
      className="relative flex h-full w-full items-center backdrop-blur-xl"
      style={{ background: el.fill, boxShadow: "0 0.5px 0 rgba(0,0,0,0.2)" }}
      onClick={rt.live && el.interactions.length ? () => rt.fire(el, "tap") : undefined}
    >
      {hasBack && (
        <button
          type="button"
          tabIndex={rt.live ? 0 : -1}
          className="relative z-10 flex h-full items-center pr-2 pl-2 active:opacity-50"
          style={{ color: IOS_BLUE, fontSize: 17 }}
          onClick={
            rt.live
              ? (e) => {
                  e.stopPropagation();
                  rt.back();
                }
              : undefined
          }
        >
          <ChevronLeft size={30} strokeWidth={2.4} className="-mr-0.5" />
          {p.backLabel}
        </button>
      )}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ ...textStyle(el), textAlign: "center" }}>
        {resolveText(p.title ?? "", rt.vars)}
      </div>
      {p.rightIcon && (
        <div className="absolute right-4 flex h-full items-center" style={{ color: IOS_BLUE }}>
          <Icon name={p.rightIcon} size={24} />
        </div>
      )}
    </div>
  );
}

function TabBarEl({ el }: { el: Element }) {
  const rt = useRuntime();
  const items = el.props.items ?? [];
  const active = rt.getTab(el);
  return (
    <div className="flex h-full w-full items-start backdrop-blur-xl" style={{ background: el.fill, boxShadow: "0 -0.5px 0 rgba(0,0,0,0.2)" }}>
      {items.map((item, i) => {
        const color = i === active ? IOS_BLUE : el.textColor;
        return (
          <button
            key={i}
            type="button"
            tabIndex={rt.live ? 0 : -1}
            className="flex flex-1 flex-col items-center gap-0.5 pt-2"
            style={{ color }}
            onClick={rt.live ? () => rt.selectTab(el, i) : undefined}
          >
            <Icon name={item.icon} size={24} strokeWidth={i === active ? 2.3 : 1.8} />
            <span style={{ fontSize: 10, fontWeight: 500 }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function StatusBarEl({ el }: { el: Element }) {
  const color = el.props.dark ? "#FFFFFF" : "#000000";
  return (
    <div className="flex h-full w-full items-center justify-between px-[34px] pt-1" style={{ color, background: el.fill }}>
      <span className="w-[54px] text-center" style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.3 }}>
        {el.props.time ?? "9:41"}
      </span>
      <span className="flex items-center gap-[6px]">
        <svg width="18" height="12" viewBox="0 0 18 12" fill={color}>
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill={color}>
          <path d="M8 2.3c2.3 0 4.4.9 6 2.4l1.2-1.2A10.2 10.2 0 0 0 8 .5 10.2 10.2 0 0 0 .8 3.5L2 4.7a8.5 8.5 0 0 1 6-2.4Z" />
          <path d="M8 5.6c1.4 0 2.6.5 3.6 1.4l1.2-1.2A6.9 6.9 0 0 0 8 3.8c-1.8 0-3.5.7-4.8 2l1.2 1.2c1-.9 2.2-1.4 3.6-1.4Z" />
          <path d="M8 8.9c.5 0 1 .2 1.3.5L8 11.5 6.7 9.4c.3-.3.8-.5 1.3-.5Z" />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.8" stroke={color} strokeOpacity="0.35" />
          <rect x="2" y="2" width="20" height="9" rx="2.5" fill={color} />
          <path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill={color} fillOpacity="0.4" />
        </svg>
      </span>
    </div>
  );
}

function Bubble({ msg, tail, appear }: { msg: Pick<ChatMessage, "text" | "from">; tail: boolean; appear?: boolean }) {
  return <div className={`imsg ${msg.from === "me" ? "me" : "them"} ${tail ? "tail" : ""} ${appear ? "imsg-in" : ""}`}>{msg.text}</div>;
}

function BubbleEl({ el }: { el: Element }) {
  const rt = useRuntime();
  const from = el.props.sender ?? "them";
  return (
    <div className={`flex h-full w-full flex-col justify-center ${from === "me" ? "items-end pr-2" : "items-start pl-2"}`} style={{ fontSize: el.fontSize }}>
      <div className="max-w-full">
        <Bubble msg={{ text: resolveText(el.text, rt.vars), from }} tail />
      </div>
    </div>
  );
}

function MessageListEl({ el }: { el: Element }) {
  const rt = useRuntime();
  const name = el.props.variable ?? "messages";
  const raw = rt.vars[name];
  const messages = Array.isArray(raw) ? raw : [];
  const typing = rt.typing[name];
  const ref = useRef<HTMLDivElement>(null);
  const lastMe = messages.findLastIndex((m) => m.from === "me");

  useEffect(() => {
    const node = ref.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: rt.live ? "smooth" : "auto" });
  }, [messages.length, typing, rt.live, rt.keyboardOffset]);

  return (
    <div ref={ref} className="no-scrollbar flex h-full w-full flex-col overflow-y-auto px-3 pb-2" style={{ fontSize: el.fontSize, background: el.fill }}>
      <div className="mt-auto" />
      <div className="pt-3 pb-2 text-center text-[11px] leading-tight text-[#8E8E93]">
        <div className="font-semibold">iMessage</div>
        Today 9:41 AM
      </div>
      {messages.map((m, i) => {
        const next = messages[i + 1];
        const prev = messages[i - 1];
        const tail = !next || next.from !== m.from;
        return (
          <div key={m.id} className="flex flex-col" style={{ marginTop: prev && prev.from !== m.from ? 10 : 2 }}>
            <Bubble msg={m} tail={tail} appear={m.id.startsWith("rt_")} />
            {i === lastMe && i === messages.length - 1 && (
              <div className="mt-0.5 mr-1 self-end text-[11px] font-medium text-[#8E8E93]">Delivered</div>
            )}
          </div>
        );
      })}
      {typing && (
        <div className="mt-2.5 flex flex-col">
          <div className="imsg them tail imsg-in typing">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
    </div>
  );
}

function MacTitleBarEl({ el }: { el: Element }) {
  const rt = useRuntime();
  return (
    <div className="relative flex h-full w-full items-center" style={{ background: el.fill }}>
      <div className="flex gap-2 pl-5">
        <span className="size-3 rounded-full bg-[#FF5F57] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,.15)]" />
        <span className="size-3 rounded-full bg-[#FEBC2E] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,.15)]" />
        <span className="size-3 rounded-full bg-[#28C840] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,.15)]" />
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={textStyle(el)}>
        {resolveText(el.props.title ?? "", rt.vars)}
      </div>
    </div>
  );
}

"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { ArrowBigUp, Delete, Globe, Mic, Smile } from "lucide-react";

export const KEYBOARD_HEIGHT = 338;

const LETTERS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const NUMBERS = ["1234567890", "-/:;()$&@\"", ".,?!'"];
const SUGGESTIONS = ['"I"', "The", "I'm"];

export type KeyInput = { type: "char"; char: string } | { type: "backspace" } | { type: "return" };

/** Visual iOS keyboard. Keys never take focus, so the focused field keeps receiving input. */
export function IOSKeyboard({ visible, onKey }: { visible: boolean; onKey: (k: KeyInput) => void }) {
  const [shift, setShift] = useState(false);
  const [numbers, setNumbers] = useState(false);
  const rows = numbers ? NUMBERS : LETTERS;

  const press = (char: string) => {
    onKey({ type: "char", char: shift ? char.toUpperCase() : char });
    if (shift) setShift(false);
  };

  return (
    <div
      className="absolute right-0 bottom-0 left-0 z-40 flex flex-col bg-[#D1D3D9]/95 backdrop-blur-xl"
      style={{
        height: KEYBOARD_HEIGHT,
        transform: `translateY(${visible ? 0 : KEYBOARD_HEIGHT + 10}px)`,
        transition: "transform 300ms cubic-bezier(.2,.8,.2,1)",
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex h-[44px] items-center px-2 text-[17px] text-black">
        {SUGGESTIONS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center justify-center">
            <button type="button" className="px-3" onClick={() => onKey({ type: "char", char: s.replace(/"/g, "") + " " })}>
              {s}
            </button>
            {i < 2 && <span className="ml-auto h-6 w-px bg-black/15" />}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-[12px] px-[3px] pt-[2px]">
        <Row>
          {rows[0].split("").map((c) => (
            <Key key={c} onClick={() => press(c)}>
              {shift ? c.toUpperCase() : c}
            </Key>
          ))}
        </Row>
        <Row inset={numbers ? 0 : 19}>
          {rows[1].split("").map((c) => (
            <Key key={c} onClick={() => press(c)}>
              {shift ? c.toUpperCase() : c}
            </Key>
          ))}
        </Row>
        <Row>
          <Key special wide onClick={() => setShift((s) => !s)} active={shift}>
            {numbers ? <span className="text-[15px]">#+=</span> : <ArrowBigUp size={22} fill={shift ? "black" : "none"} strokeWidth={1.6} />}
          </Key>
          <div className="mx-[9px] flex flex-1 gap-[6px]">
            {rows[2].split("").map((c) => (
              <Key key={c} onClick={() => press(c)}>
                {shift ? c.toUpperCase() : c}
              </Key>
            ))}
          </div>
          <Key special wide onClick={() => onKey({ type: "backspace" })}>
            <Delete size={22} strokeWidth={1.6} />
          </Key>
        </Row>
        <Row>
          <Key special wide onClick={() => setNumbers((n) => !n)}>
            <span className="text-[16px]">{numbers ? "ABC" : "123"}</span>
          </Key>
          <Key special wide onClick={() => {}}>
            <Smile size={22} strokeWidth={1.6} />
          </Key>
          <div className="flex-[5]">
            <Key onClick={() => onKey({ type: "char", char: " " })}>
              <span className="text-[16px]">space</span>
            </Key>
          </div>
          <div className="flex-[2.2]">
            <Key special onClick={() => onKey({ type: "return" })}>
              <span className="text-[16px]">return</span>
            </Key>
          </div>
        </Row>
      </div>
      <div className="flex flex-1 items-start justify-between px-[22px] pt-[12px] text-[#50555C]">
        <Globe size={26} strokeWidth={1.5} />
        <Mic size={26} strokeWidth={1.5} />
      </div>
    </div>
  );
}

function Row({ children, inset = 0 }: { children: ReactNode; inset?: number }) {
  return (
    <div className="flex gap-[6px]" style={{ paddingLeft: inset, paddingRight: inset }}>
      {children}
    </div>
  );
}

function Key({
  children,
  onClick,
  special,
  wide,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  special?: boolean;
  wide?: boolean;
  active?: boolean;
}) {
  const handle = (e: MouseEvent) => {
    e.preventDefault();
    onClick();
  };
  return (
    <button
      type="button"
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onClick={handle}
      className="flex h-[43px] w-full flex-1 items-center justify-center rounded-[5px] text-[22.5px] text-black shadow-[0_1px_0_#898A8D] active:bg-[#AEB3BC]"
      style={{
        background: active ? "#FFFFFF" : special ? "#ABB0BA" : "#FFFFFF",
        flex: wide ? "0 0 44px" : undefined,
      }}
    >
      {children}
    </button>
  );
}

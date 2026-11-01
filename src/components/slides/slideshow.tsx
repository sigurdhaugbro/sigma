"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isDeck, type Project } from "@/lib/model";
import { applySlideNav, slideIndex, slideNavFromClick, slideNavFromKey } from "@/lib/slides";
import { RuntimeContext, staticRuntime } from "@/components/device/runtime-context";
import { ScreenView } from "@/components/device/screen-view";

export function Slideshow({ project, startScreenId, onExit }: { project: Project; startScreenId: string; onExit: () => void }) {
  const slides = isDeck(project) ? project.screens : project.screens.filter((s) => s.device === "slide");
  const deck = slides.length ? slides : project.screens;
  const [index, setIndex] = useState(() => slideIndex(deck, startScreenId));
  const [hint, setHint] = useState(true);
  const [viewport, setViewport] = useState({ w: 1280, h: 720 });
  const runtime = useMemo(() => staticRuntime({}), []);

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    const hide = window.setTimeout(() => setHint(false), 2200);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(hide);
    };
  }, []);

  const go = useCallback(
    (nav: ReturnType<typeof slideNavFromKey>) => {
      if (!nav) return;
      setIndex((i) => applySlideNav(i, deck.length, nav));
      setHint(false);
    },
    [deck.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
        return;
      }
      const nav = slideNavFromKey(e.key);
      if (!nav) return;
      e.preventDefault();
      go(nav);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onExit]);

  const slide = deck[index] ?? deck[0];
  const scale = slide ? Math.min(viewport.w / slide.width, viewport.h / slide.height) : 1;

  if (!slide) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-sm text-neutral-400">
        This presentation has no slides.
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-black"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-slide-chrome]")) return;
        go(slideNavFromClick(e.clientX, viewport.w));
      }}
      role="application"
      aria-label="Presentation"
    >
      <div className="flex h-full w-full items-center justify-center">
        <div style={{ width: slide.width * scale, height: slide.height * scale }}>
          <div style={{ width: slide.width, height: slide.height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <RuntimeContext.Provider value={runtime}>
              <ScreenView screen={slide} rounded={false} hardware={false} />
            </RuntimeContext.Provider>
          </div>
        </div>
      </div>
      <div
        data-slide-chrome
        className="pointer-events-none absolute right-5 bottom-4 font-medium text-white/40 tabular-nums"
        style={{ fontSize: 13 }}
      >
        {index + 1} / {deck.length}
      </div>
      <div
        data-slide-chrome
        className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white/70 transition-opacity duration-500"
        style={{ opacity: hint ? 1 : 0 }}
      >
        ← → to move · click to advance · Esc to exit
      </div>
    </div>
  );
}

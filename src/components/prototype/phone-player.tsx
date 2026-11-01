"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, RotateCcw } from "lucide-react";
import type { Project } from "@/lib/model";
import { Stage, type PhoneOptions } from "./player";

function measureSafeArea() {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px) 0";
  document.body.appendChild(probe);
  const s = getComputedStyle(probe);
  const top = parseFloat(s.paddingTop) || 47;
  const bottom = parseFloat(s.paddingBottom) || 0;
  probe.remove();
  return { top, bottom };
}

function shortName(name: string) {
  return name.replace(/\s+/g, " ").trim().slice(0, 12) || "Sigma";
}

function setMeta(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string, extra: Record<string, string> = {}) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
  for (const [k, v] of Object.entries(extra)) el.setAttribute(k, v);
}

function installPwa(project: Project) {
  document.title = project.name;
  setMeta("apple-mobile-web-app-capable", "yes");
  setMeta("mobile-web-app-capable", "yes");
  setMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
  setMeta("apple-mobile-web-app-title", shortName(project.name));
  const icon = `/m/icon?name=${encodeURIComponent(project.name)}`;
  setLink("apple-touch-icon", `${icon}&size=180`);
  const manifest = {
    name: project.name,
    short_name: shortName(project.name),
    description: "A Sigma prototype playing on this phone.",
    start_url: `${location.pathname}${location.search}${location.hash}`,
    scope: "/m",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: `${icon}&size=192`, sizes: "192x192", type: "image/png" },
      { src: `${icon}&size=512`, sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
  const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
  setLink("manifest", URL.createObjectURL(blob));
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
}

export function PhonePlayer({ project, startScreenId }: { project: Project; startScreenId: string }) {
  const [runKey, setRunKey] = useState(0);
  const [menu, setMenu] = useState(false);
  const [keyboard, setKeyboard] = useState<PhoneOptions["keyboard"]>(() => {
    try {
      return sessionStorage.getItem("sigma:phone-kb") === "fake" ? "fake" : "native";
    } catch {
      return "native";
    }
  });
  const [safe, setSafe] = useState({ top: 47, bottom: 0 });
  const [width, setWidth] = useState(393);
  const taps = useRef({ corner: "", n: 0, at: 0 });

  useEffect(() => {
    installPwa(project);
    const onResize = () => setWidth(window.innerWidth);
    const t = window.setTimeout(() => {
      setSafe(measureSafeArea());
      onResize();
    }, 0);
    window.addEventListener("resize", onResize);

    const onMove = (e: TouchEvent) => {
      const node = (e.target as HTMLElement | null)?.closest?.(".no-scrollbar, textarea, input");
      if (node) return;
      e.preventDefault();
    };
    document.addEventListener("touchmove", onMove, { passive: false });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("touchmove", onMove);
    };
  }, [project]);

  useEffect(() => {
    try {
      sessionStorage.setItem("sigma:phone-kb", keyboard);
    } catch {
      /* ignore */
    }
  }, [keyboard]);

  const restart = useCallback(() => {
    setRunKey((k) => k + 1);
    setMenu(false);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    const zone = 64;
    const x = e.clientX;
    const y = e.clientY;
    const w = window.innerWidth;
    let corner = "";
    if (x < zone && y < zone + safe.top) corner = "tl";
    else if (x > w - zone && y < zone + safe.top) corner = "tr";
    if (!corner) return;
    const now = Date.now();
    if (taps.current.corner === corner && now - taps.current.at < 450) taps.current.n += 1;
    else taps.current = { corner, n: 1, at: now };
    taps.current.at = now;
    if (taps.current.n < 3) return;
    taps.current.n = 0;
    if (corner === "tl") restart();
    else {
      setMenu(true);
      window.setTimeout(() => setMenu(false), 2800);
    }
  };

  const cropTop = Math.round(safe.top * (393 / Math.max(1, width)));
  const phone: PhoneOptions = { keyboard, showStatusBar: false, cropTop };

  return (
    <div className="phone-lock relative h-full w-full bg-black" onPointerDown={onPointerDown}>
      <Stage
        key={runKey}
        project={project}
        startScreenId={startScreenId}
        options={{ bezel: false, keyboard: keyboard === "fake" }}
        phone={phone}
      />
      {menu && (
        <div className="absolute bottom-8 left-1/2 z-50 flex -translate-x-1/2 gap-1 rounded-full bg-black/70 p-1 text-white backdrop-blur-md">
          <button type="button" className="flex items-center gap-1 rounded-full px-3 py-2 text-xs" onClick={restart}>
            <RotateCcw size={14} /> Restart
          </button>
          <button
            type="button"
            className="flex items-center gap-1 rounded-full px-3 py-2 text-xs"
            onClick={() => setKeyboard((k) => (k === "fake" ? "native" : "fake"))}
          >
            <Keyboard size={14} /> {keyboard === "fake" ? "iPhone keyboard" : "On-screen keyboard"}
          </button>
        </div>
      )}
    </div>
  );
}

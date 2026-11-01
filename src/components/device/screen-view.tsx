"use client";

import type { ReactNode } from "react";
import { DEVICES, hasDeviceChrome, type Screen } from "@/lib/model";
import { ElementView } from "./element-view";

/** The screen surface: background, elements, and hardware overlays (Dynamic Island, home indicator). */
export function ScreenView({
  screen,
  children,
  rounded = true,
  hardware = true,
}: {
  screen: Screen;
  children?: ReactNode;
  rounded?: boolean;
  hardware?: boolean;
}) {
  const dev = DEVICES[screen.device];
  return (
    <div
      className="device-font relative overflow-hidden select-none"
      style={{
        width: screen.width,
        height: screen.height,
        background: screen.background,
        borderRadius: rounded ? dev.radius : 0,
        ["--bubble-bg" as string]: screen.background,
      }}
    >
      {screen.elements.map((el) => (
        <ElementView key={el.id} el={el} />
      ))}
      {children}
      {hardware && <HardwareOverlays device={screen.device} />}
    </div>
  );
}

export function HardwareOverlays({ device }: { device: Screen["device"] }) {
  return (
    <>
      {device === "iphone" && (
        <div className="pointer-events-none absolute top-[11px] left-1/2 z-50 h-[37px] w-[125px] -translate-x-1/2 rounded-full bg-black" />
      )}
      {hasDeviceChrome(device) && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 z-50 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-black/85" />
      )}
    </>
  );
}

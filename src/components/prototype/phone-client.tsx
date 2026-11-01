"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { decodeProject } from "@/lib/share/codec";
import { currentProjectId, loadProject } from "@/lib/storage";
import type { Project } from "@/lib/model";
import { PhonePlayer } from "./phone-player";

type Loaded = { project: Project; screen: string };

function pickScreen(project: Project, requested: string | null) {
  return requested && project.screens.some((s) => s.id === requested) ? requested : project.startScreenId;
}

async function loadFromLocation(): Promise<Loaded | "missing"> {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const encoded = hash.get("p");
  const token = query.get("t");
  const requested = hash.get("s") ?? query.get("s");
  try {
    if (encoded) {
      const project = decodeProject(encoded);
      return { project, screen: pickScreen(project, requested) };
    }
    if (token) {
      const res = await fetch(`/api/share/${encodeURIComponent(token)}`);
      if (!res.ok) return "missing";
      const body = await res.json();
      const project = decodeProject(body.data);
      return { project, screen: pickScreen(project, requested) };
    }
    const id = currentProjectId();
    const project = id ? loadProject(id) : null;
    if (!project) return "missing";
    return { project, screen: pickScreen(project, requested) };
  } catch {
    return "missing";
  }
}

export default function PhoneClient() {
  const [state, setState] = useState<Loaded | "missing" | null>(null);

  useEffect(() => {
    let alive = true;
    loadFromLocation().then((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (state === null) return <div className="h-full bg-black" />;
  if (state === "missing")
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-black px-6 text-center text-sm text-neutral-400">
        <p>This prototype isn&apos;t on this phone. Scan the QR code from Sigma&apos;s editor, or open a share link.</p>
        <Link href="/" className="text-sky-400 hover:underline">
          Open Sigma
        </Link>
      </div>
    );

  return <PhonePlayer project={state.project} startScreenId={state.screen} />;
}

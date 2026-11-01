"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isDeck } from "@/lib/model";
import { currentProjectId, loadProject } from "@/lib/storage";
import { Slideshow } from "@/components/slides/slideshow";
import { Player } from "./player";

function readFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id") ?? currentProjectId();
  const project = id ? loadProject(id) : null;
  if (!project) return null;
  const requested = params.get("slide") ?? params.get("screen");
  const screen = requested && project.screens.some((s) => s.id === requested) ? requested : project.startScreenId;
  return { project, screen };
}

/** Client-only: the project lives in localStorage. */
export default function PlayClient() {
  const router = useRouter();
  const [state] = useState(readFromUrl);

  if (!state)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-black text-sm text-neutral-400">
        <p>This project isn&apos;t saved in this browser.</p>
        <Link href="/" className="text-sky-400 hover:underline">
          Open the editor
        </Link>
      </div>
    );

  if (isDeck(state.project)) {
    return <Slideshow project={state.project} startScreenId={state.screen} onExit={() => router.push("/")} />;
  }

  return <Player project={state.project} startScreenId={state.screen} onExit={() => router.push("/")} />;
}

"use client";

import dynamic from "next/dynamic";

const PlayClient = dynamic(() => import("@/components/prototype/play-client"), {
  ssr: false,
  loading: () => <div className="h-full bg-black" />,
});

/** Fullscreen slideshow for decks. Prototypes opened here still use the live player. */
export default function PresentPage() {
  return <PlayClient />;
}

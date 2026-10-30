"use client";

import dynamic from "next/dynamic";

const PlayClient = dynamic(() => import("@/components/prototype/play-client"), {
  ssr: false,
  loading: () => <div className="h-full bg-black" />,
});

export default function PlayPage() {
  return <PlayClient />;
}

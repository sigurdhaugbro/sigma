"use client";

import dynamic from "next/dynamic";

const PhoneClient = dynamic(() => import("@/components/prototype/phone-client"), {
  ssr: false,
  loading: () => <div className="h-full bg-black" />,
});

export default function PhonePage() {
  return <PhoneClient />;
}

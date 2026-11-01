import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Sigma",
  appleWebApp: {
    capable: true,
    title: "Sigma",
    statusBarStyle: "black-translucent",
  },
  icons: { apple: "/m/icon" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function PhoneLayout({ children }: { children: ReactNode }) {
  return <div className="phone-lock h-full">{children}</div>;
}

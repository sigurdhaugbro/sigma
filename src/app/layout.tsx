import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sigma — working app UIs for film & TV",
  description: "Design iPhone and Mac app screens that actually work on camera.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden">
        {children}
        <Toaster theme="dark" position="bottom-center" />
      </body>
    </html>
  );
}

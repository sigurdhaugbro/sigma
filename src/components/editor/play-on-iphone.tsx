"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Smartphone } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Project } from "@/lib/model";
import { createShareLink, type ShareLink } from "@/lib/share/url";

export function PlayOnIPhoneDialog({
  open,
  onOpenChange,
  project,
  screenId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  screenId?: string;
}) {
  const [origin, setOrigin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  const [link, setLink] = useState<ShareLink | null>(null);
  const [qr, setQr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !origin) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setBusy(true);
      setError(null);
      setLink(null);
      setQr("");
      createShareLink(origin.replace(/\/$/, ""), project, screenId)
        .then(async (next) => {
          if (cancelled) return;
          setLink(next);
          setQr(
            await QRCode.toDataURL(next.url, {
              margin: 1,
              width: 512,
              errorCorrectionLevel: "L",
              color: { dark: "#0b0b0d", light: "#ffffff" },
            }),
          );
        })
        .catch((e) => {
          if (!cancelled) setError((e as Error).message);
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, origin, project, screenId]);

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link.url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="size-4" /> Play on iPhone
          </DialogTitle>
          <DialogDescription>
            Scan this from the phone you&apos;ll hold on camera. Add to Home Screen in Safari for a full-screen app with no browser chrome.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          {busy && <Loader2 className="size-6 animate-spin text-muted-foreground" />}
          {error && <p className="text-center text-sm text-destructive">{error}</p>}
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR code for this prototype" className="w-64 rounded-lg bg-white p-2" />
          )}
          {link && (
            <>
              <p className="text-center text-[11px] text-muted-foreground">
                {link.via === "hash"
                  ? "The whole prototype is in this link. It works offline after the first load, and nothing is stored on a server."
                  : "This project was too large to fit in the link itself (usually because of photos), so it's stored for 30 days. Smaller projects go in the QR with no server."}
              </p>
              <div className="flex w-full gap-1.5">
                <Input readOnly value={link.url} className="font-mono text-[11px]" aria-label="Prototype link" />
                <Button variant="outline" size="icon" onClick={copy} title="Copy link">
                  {copied ? <Check /> : <Copy />}
                </Button>
              </div>
            </>
          )}
          <div className="flex w-full flex-col gap-1.5">
            <Label htmlFor="share-origin">Public origin</Label>
            <Input
              id="share-origin"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="https://your-site.netlify.app"
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              If this editor is on localhost, paste a public HTTPS origin (a tunnel, or your Netlify URL) so the phone can open the link.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

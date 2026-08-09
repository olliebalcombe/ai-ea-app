"use client";

import { useRef, useState } from "react";
import { Sparkles, UploadCloud } from "lucide-react";
import { useCurrentClient } from "@/lib/clientContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ThemeTokens } from "@/lib/themeTokens";

interface Suggestion {
  primaryColorHex: string;
  backgroundColorHex: string;
  glowIntensity: number;
  cardBlur: number;
  borderOpacity: number;
  description: string;
}

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve({ base64, mediaType: file.type || "image/png" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ScreenshotRecreatorModal({
  open,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (tokens: Partial<ThemeTokens>) => void;
}) {
  const { currentClientId } = useCurrentClient();
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setPreview(null);
    setSuggestion(null);
    setError(null);
  }

  async function handleFile(file: File) {
    if (!currentClientId) return;
    reset();
    setPreview(URL.createObjectURL(file));
    setAnalyzing(true);
    try {
      const { base64, mediaType } = await fileToBase64(file);
      const res = await fetch("/api/design/analyze-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: currentClientId, image_base64: base64, media_type: mediaType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setSuggestion(data.suggestion as Suggestion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  function apply() {
    if (!suggestion) return;
    onApply({
      primary: suggestion.primaryColorHex,
      glowIntensity: Math.max(0, Math.min(1, suggestion.glowIntensity)),
      cardBlur: Math.max(0, suggestion.cardBlur),
      borderOpacity: Math.max(0, Math.min(1, suggestion.borderOpacity)),
    });
    onOpenChange(false);
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Screenshot-to-UI Recreator</DialogTitle>
          <DialogDescription>
            Claude Vision gives an approximate, interpreted read on the screenshot's colors and surface
            style — a starting point to tweak further, not exact extraction.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />

        {!preview ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-white/15 py-10 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <UploadCloud className="h-6 w-6" />
            <span className="text-sm">Click to upload a design screenshot</span>
          </button>
        ) : (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Uploaded screenshot" className="h-32 w-full rounded-lg object-cover" />

            {analyzing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                Analyzing with Claude Vision…
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            {suggestion && (
              <div className="space-y-2 rounded-lg border border-white/10 bg-secondary/20 p-3">
                <p className="text-xs text-muted-foreground">{suggestion.description}</p>
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className="h-4 w-4 rounded-full border border-white/10"
                    style={{ background: suggestion.primaryColorHex }}
                  />
                  Accent {suggestion.primaryColorHex} · Glow {suggestion.glowIntensity.toFixed(2)} · Blur{" "}
                  {suggestion.cardBlur}px · Border {suggestion.borderOpacity.toFixed(2)}
                </div>
                <Button size="sm" onClick={apply}>
                  Apply to Design Studio
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

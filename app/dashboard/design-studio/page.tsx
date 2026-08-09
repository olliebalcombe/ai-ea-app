"use client";

import { useCallback, useEffect, useState } from "react";
import { ImagePlus } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { useSandbox } from "@/lib/sandboxContext";
import { DEFAULT_TOKENS, PRESETS, applyThemeTokens, type ThemeTokens } from "@/lib/themeTokens";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import ScreenshotRecreatorModal from "@/components/ScreenshotRecreatorModal";

export default function DesignStudioPage() {
  const { currentClientId } = useCurrentClient();
  const { sandbox } = useSandbox();
  const [tokens, setTokens] = useState<ThemeTokens>(DEFAULT_TOKENS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recreatorOpen, setRecreatorOpen] = useState(false);

  const load = useCallback(async () => {
    if (!currentClientId) return;
    setLoading(true);
    const { data, error } = await supabaseBrowser
      .from("clients")
      .select("theme_tokens")
      .eq("id", currentClientId)
      .single();
    if (error) setError(error.message);
    else {
      const saved = { ...DEFAULT_TOKENS, ...(data?.theme_tokens as Partial<ThemeTokens> | null) };
      setTokens(saved);
      applyThemeTokens(saved);
    }
    setLoading(false);
  }, [currentClientId]);

  useEffect(() => {
    load();
  }, [load]);

  function update(partial: Partial<ThemeTokens>) {
    const next = { ...tokens, ...partial };
    setTokens(next);
    applyThemeTokens(partial);
  }

  function applyPreset(key: string) {
    const preset = PRESETS[key];
    if (!preset) return;
    update(preset.tokens);
  }

  async function save() {
    if (!currentClientId || sandbox) return;
    setSaving(true);
    setError(null);
    const { error } = await supabaseBrowser
      .from("clients")
      .update({ theme_tokens: tokens })
      .eq("id", currentClientId);
    setSaving(false);
    if (error) setError(error.message);
    else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight text-foreground">Design Studio</h1>
        <p className="text-sm text-muted-foreground">
          Real-time visual tokens for this business's dashboard theme — glow, blur, borders, scale, and
          accent color. Changes preview instantly; nothing is saved until you click Save.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Preset Themes</CardTitle>
          <CardDescription>One click applies a full token set — still previewed live before saving.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Object.entries(PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              className="rounded-lg border border-white/10 bg-secondary/30 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <div
                className="mb-2 h-8 w-full rounded-md"
                style={{ background: preset.tokens.primary, boxShadow: `0 0 12px 0 ${preset.tokens.primary}` }}
              />
              <div className="text-sm font-medium text-foreground">{preset.label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{preset.description}</div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tokens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Glow Intensity</Label>
              <span className="text-xs text-muted-foreground">{tokens.glowIntensity.toFixed(2)}</span>
            </div>
            <Slider
              value={[tokens.glowIntensity]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={([v]) => update({ glowIntensity: v })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Card Blur</Label>
              <span className="text-xs text-muted-foreground">{tokens.cardBlur}px</span>
            </div>
            <Slider
              value={[tokens.cardBlur]}
              min={0}
              max={24}
              step={1}
              onValueChange={([v]) => update({ cardBlur: v })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Border Opacity</Label>
              <span className="text-xs text-muted-foreground">{tokens.borderOpacity.toFixed(2)}</span>
            </div>
            <Slider
              value={[tokens.borderOpacity]}
              min={0}
              max={0.4}
              step={0.02}
              onValueChange={([v]) => update({ borderOpacity: v })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Font Scale</Label>
              <span className="text-xs text-muted-foreground">{tokens.fontScale.toFixed(2)}x</span>
            </div>
            <Slider
              value={[tokens.fontScale]}
              min={0.85}
              max={1.15}
              step={0.01}
              onValueChange={([v]) => update({ fontScale: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Colors</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Accent</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={tokens.primary}
                onChange={(e) => update({ primary: e.target.value })}
                className="h-9 w-9 shrink-0 cursor-pointer rounded border border-white/10 bg-transparent"
              />
              <span className="text-xs text-muted-foreground">{tokens.primary}</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Gradient From</Label>
            <input
              value={tokens.bgGradientFrom}
              onChange={(e) => update({ bgGradientFrom: e.target.value })}
              className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label>Gradient To</Label>
            <input
              value={tokens.bgGradientTo}
              onChange={(e) => update({ bgGradientTo: e.target.value })}
              className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Screenshot-to-UI Recreator</CardTitle>
          <CardDescription>
            Drop in a design reference screenshot — Claude Vision gives an interpreted approximation of
            its colors and surface style as a starting point, not a pixel-exact extraction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={() => setRecreatorOpen(true)}>
            <ImagePlus className="h-3.5 w-3.5" />
            Upload a screenshot
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        {sandbox ? (
          <>
            <Button disabled title="Switch to Live to save changes">
              Save changes
            </Button>
            <span className="text-xs text-amber-400">
              Sandbox Mode — previewing only. Switch to Live to save.
            </span>
          </>
        ) : (
          <>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            {saved && <span className="text-sm text-green-400">Saved.</span>}
          </>
        )}
      </div>

      <ScreenshotRecreatorModal
        open={recreatorOpen}
        onOpenChange={setRecreatorOpen}
        onApply={(suggested) => update(suggested)}
      />
    </div>
  );
}

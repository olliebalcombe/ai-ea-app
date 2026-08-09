"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ToneStyle } from "@/types";

const TONE_OPTIONS: { value: ToneStyle; label: string; description: string }[] = [
  { value: "calm_direct", label: "Calm & Direct", description: "Grounded and matter-of-fact — the default." },
  { value: "warm_friendly", label: "Warm & Friendly", description: "A bit more personable, still natural." },
  { value: "formal_executive", label: "Formal / Executive", description: "Professional, no slang or casual contractions." },
];

export default function AiSettingsPage() {
  const { currentClientId } = useCurrentClient();
  const [toneStyle, setToneStyle] = useState<ToneStyle>("calm_direct");
  const [nuances, setNuances] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentClientId) return;
    setLoading(true);
    const { data, error } = await supabaseBrowser
      .from("clients")
      .select("tone_style, business_nuances")
      .eq("id", currentClientId)
      .single();
    if (error) setError(error.message);
    else {
      setToneStyle((data?.tone_style as ToneStyle) ?? "calm_direct");
      setNuances(data?.business_nuances ?? "");
    }
    setLoading(false);
  }, [currentClientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!currentClientId) return;
    setSaving(true);
    setError(null);
    const { error } = await supabaseBrowser
      .from("clients")
      .update({ tone_style: toneStyle, business_nuances: nuances || null })
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
    <div className="max-w-xl space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tone Style</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={toneStyle} onValueChange={(v) => setToneStyle(v as ToneStyle)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONE_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-muted-foreground">
            {TONE_OPTIONS.find((t) => t.value === toneStyle)?.description}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Business Nuances &amp; Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="nuances" className="sr-only">
            Business nuances
          </Label>
          <Textarea
            id="nuances"
            value={nuances}
            onChange={(e) => setNuances(e.target.value)}
            placeholder="e.g. Tom handles all flooring jobs, Dave does plumbing/electrical. We mainly cover Guildford and the surrounding villages. Quotes over £2,000 usually need a site visit first."
            rows={5}
          />
          <p className="text-xs text-muted-foreground">
            The AI will weave this in naturally when it's relevant — team member names, areas you
            cover, pricing hints, anything worth knowing. It won't recite this as a list.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {saved && <span className="text-sm text-green-400">Saved.</span>}
      </div>
    </div>
  );
}

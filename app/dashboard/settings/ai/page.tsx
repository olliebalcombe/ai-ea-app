"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PhoneCall } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TONE_OPTIONS } from "@/lib/toneOptions";
import type { ToneStyle } from "@/types";

const VOICE_OPTIONS = [
  { value: "Polly.Amy", label: "Amy — Female (British)" },
  { value: "Polly.Brian", label: "Brian — Male (British)" },
  { value: "Polly.Emma", label: "Emma — Female (British)" },
  { value: "Polly.Arthur", label: "Arthur — Male (British)" },
];

export default function AiSettingsPage() {
  const router = useRouter();
  const { currentClientId } = useCurrentClient();
  const [assistantName, setAssistantName] = useState("");
  const [toneStyle, setToneStyle] = useState<ToneStyle>("calm_direct");
  const [nuances, setNuances] = useState("");
  const [voiceStyle, setVoiceStyle] = useState("Polly.Amy");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testCalling, setTestCalling] = useState(false);
  const [testCallResult, setTestCallResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentClientId) return;
    setLoading(true);
    const { data, error } = await supabaseBrowser
      .from("clients")
      .select("assistant_name, tone_style, business_nuances, voice_style")
      .eq("id", currentClientId)
      .single();
    if (error) setError(error.message);
    else {
      setAssistantName(data?.assistant_name ?? "");
      setToneStyle((data?.tone_style as ToneStyle) ?? "calm_direct");
      setNuances(data?.business_nuances ?? "");
      setVoiceStyle(data?.voice_style ?? "Polly.Amy");
    }
    setLoading(false);
  }, [currentClientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!currentClientId || !assistantName.trim()) return;
    setSaving(true);
    setError(null);
    const { error } = await supabaseBrowser
      .from("clients")
      .update({
        assistant_name: assistantName.trim(),
        tone_style: toneStyle,
        business_nuances: nuances || null,
        voice_style: voiceStyle,
      })
      .eq("id", currentClientId);
    setSaving(false);
    if (error) setError(error.message);
    else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    }
  }

  async function testCall() {
    if (!currentClientId) return;
    setTestCalling(true);
    setTestCallResult(null);
    try {
      const res = await fetch("/api/voice/test-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: currentClientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Call failed");
      setTestCallResult(`Calling ${data.calledNumber} now — pick up to hear it.`);
    } catch (e) {
      setTestCallResult(e instanceof Error ? e.message : "Call failed");
    } finally {
      setTestCalling(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="max-w-xl space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Assistant Identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="assistant-name" className="sr-only">
            Assistant name
          </Label>
          <Input
            id="assistant-name"
            value={assistantName}
            onChange={(e) => setAssistantName(e.target.value)}
            placeholder="e.g. Jack"
          />
          <p className="text-xs text-muted-foreground">
            The name used everywhere your assistant appears — conversations, voice calls, outbound emails, and this
            dashboard.
          </p>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Voice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={voiceStyle} onValueChange={setVoiceStyle}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICE_OPTIONS.map((v) => (
                <SelectItem key={v.value} value={v.value}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Twilio's own built-in voice, used for the missed-call callback and any AI voice line —
            real today, no separate signup needed.
          </p>
          <div className="flex items-center gap-3 border-t border-border pt-3">
            <Button size="sm" variant="outline" onClick={testCall} disabled={testCalling}>
              <PhoneCall className="h-3.5 w-3.5" />
              {testCalling ? "Calling…" : "Test Call My Phone"}
            </Button>
            {testCallResult && <span className="text-xs text-muted-foreground">{testCallResult}</span>}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving || !assistantName.trim()}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {saved && <span className="text-sm text-green-400">Saved.</span>}
      </div>
    </div>
  );
}

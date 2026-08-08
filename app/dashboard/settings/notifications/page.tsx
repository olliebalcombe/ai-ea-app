"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { NotificationPrefs } from "@/types";

function toTimeInput(value: string) {
  return value?.slice(0, 5) ?? "";
}

function Row({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange?: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <Label className={disabled ? "text-muted-foreground" : ""}>{label}</Label>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export default function NotificationsSettingsPage() {
  const { currentClientId } = useCurrentClient();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!currentClientId) return;
    setLoading(true);
    const { data, error } = await supabaseBrowser
      .from("notification_prefs")
      .select("*")
      .eq("client_id", currentClientId)
      .single();
    if (error) setError(error.message);
    else setPrefs(data as NotificationPrefs);
    setLoading(false);
  }, [currentClientId]);

  useEffect(() => {
    load();
  }, [load]);

  function update<K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) {
    setPrefs((p) => (p ? { ...p, [key]: value } : p));
    setSaved(false);
  }

  async function save() {
    if (!prefs || !currentClientId) return;
    setSaving(true);
    setError(null);
    const { error } = await supabaseBrowser
      .from("notification_prefs")
      .update({
        sms_enabled: prefs.sms_enabled,
        email_enabled: prefs.email_enabled,
        notify_new_lead: prefs.notify_new_lead,
        notify_booked: prefs.notify_booked,
        notify_lost: prefs.notify_lost,
        notify_daily_digest: prefs.notify_daily_digest,
        quiet_hours_start: prefs.quiet_hours_start,
        quiet_hours_end: prefs.quiet_hours_end,
      })
      .eq("client_id", currentClientId);
    setSaving(false);
    if (error) setError(error.message);
    else setSaved(true);
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!prefs) return <p className="text-sm text-muted-foreground">No notification preferences found.</p>;

  return (
    <div className="max-w-xl space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Channels</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <Row label="SMS" checked={prefs.sms_enabled} onCheckedChange={(v) => update("sms_enabled", v)} />
          <Row
            label="Email"
            checked={prefs.email_enabled}
            onCheckedChange={(v) => update("email_enabled", v)}
          />
          <Row label="WhatsApp (coming soon)" checked={false} disabled />
          <Row label="Push (coming soon)" checked={false} disabled />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Notify me when…</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <Row
            label="A new lead comes in"
            checked={prefs.notify_new_lead}
            onCheckedChange={(v) => update("notify_new_lead", v)}
          />
          <Row
            label="A lead books a slot"
            checked={prefs.notify_booked}
            onCheckedChange={(v) => update("notify_booked", v)}
          />
          <Row
            label="A lead is marked lost"
            checked={prefs.notify_lost}
            onCheckedChange={(v) => update("notify_lost", v)}
          />
          <Row
            label="Daily digest"
            checked={prefs.notify_daily_digest}
            onCheckedChange={(v) => update("notify_daily_digest", v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Quiet hours</CardTitle>
          <p className="text-xs text-muted-foreground">
            Non-urgent notifications are held during this window. Urgent escalations always send.
          </p>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Input
            type="time"
            value={toTimeInput(prefs.quiet_hours_start)}
            onChange={(e) => update("quiet_hours_start", e.target.value)}
            className="w-32"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="time"
            value={toTimeInput(prefs.quiet_hours_end)}
            onChange={(e) => update("quiet_hours_end", e.target.value)}
            className="w-32"
          />
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

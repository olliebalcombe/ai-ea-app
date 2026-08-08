"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import type { NotificationPrefs } from "@/types";

function toTimeInput(value: string) {
  return value?.slice(0, 5) ?? "";
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

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!prefs) return <p className="text-sm text-gray-500">No notification preferences found.</p>;

  return (
    <div className="max-w-xl space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Channels</h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between text-sm">
            <span>SMS</span>
            <input
              type="checkbox"
              checked={prefs.sms_enabled}
              onChange={(e) => update("sms_enabled", e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>Email</span>
            <input
              type="checkbox"
              checked={prefs.email_enabled}
              onChange={(e) => update("email_enabled", e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between text-sm text-gray-400">
            <span>WhatsApp (coming soon)</span>
            <input type="checkbox" checked={false} disabled />
          </label>
          <label className="flex items-center justify-between text-sm text-gray-400">
            <span>Push (coming soon)</span>
            <input type="checkbox" checked={false} disabled />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Notify me when…</h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between text-sm">
            <span>A new lead comes in</span>
            <input
              type="checkbox"
              checked={prefs.notify_new_lead}
              onChange={(e) => update("notify_new_lead", e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>A lead books a slot</span>
            <input
              type="checkbox"
              checked={prefs.notify_booked}
              onChange={(e) => update("notify_booked", e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>A lead is marked lost</span>
            <input
              type="checkbox"
              checked={prefs.notify_lost}
              onChange={(e) => update("notify_lost", e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>Daily digest</span>
            <input
              type="checkbox"
              checked={prefs.notify_daily_digest}
              onChange={(e) => update("notify_daily_digest", e.target.checked)}
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Quiet hours</h3>
        <p className="mb-3 text-xs text-gray-500">
          Non-urgent notifications are held during this window. Urgent escalations always send.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="time"
            value={toTimeInput(prefs.quiet_hours_start)}
            onChange={(e) => update("quiet_hours_start", e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <span className="text-sm text-gray-500">to</span>
          <input
            type="time"
            value={toTimeInput(prefs.quiet_hours_end)}
            onChange={(e) => update("quiet_hours_end", e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {saved && <span className="text-sm text-green-600">Saved.</span>}
      </div>
    </div>
  );
}

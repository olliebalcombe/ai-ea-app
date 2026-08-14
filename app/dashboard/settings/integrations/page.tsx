"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar, MessageCircle, Check, ExternalLink } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CalendarConnectionStatus } from "@/types";

const PROVIDER_META = {
  google: { label: "Google Calendar" },
  outlook: { label: "Outlook Calendar" },
};

export default function IntegrationsPage() {
  const { currentClientId } = useCurrentClient();
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<CalendarConnectionStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentClientId) return;
    setLoading(true);
    // Only ever selects status fields -- never access_token/refresh_token, even
    // though RLS would technically allow it for a member of this client.
    const { data } = await supabaseBrowser
      .from("calendar_connections")
      .select("provider, connected_email, expires_at")
      .eq("client_id", currentClientId);
    setConnections((data as CalendarConnectionStatus[]) ?? []);
    setLoading(false);
  }, [currentClientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function disconnect(provider: "google" | "outlook") {
    if (!currentClientId) return;
    await supabaseBrowser.from("calendar_connections").delete().eq("client_id", currentClientId).eq("provider", provider);
    load();
  }

  const connectedMsg = searchParams.get("connected");
  const errorMsg = searchParams.get("error");

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect external calendars for real free/busy checking and automatic event creation, and see
          what's needed for WhatsApp Business.
        </p>
      </div>

      {connectedMsg && (
        <p className="text-sm text-primary">Connected to {PROVIDER_META[connectedMsg as "google" | "outlook"]?.label ?? connectedMsg}.</p>
      )}
      {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

      {(["google", "outlook"] as const).map((provider) => {
        const connection = connections.find((c) => c.provider === provider);
        return (
          <Card key={provider} className="glow-hover">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-primary" /> {PROVIDER_META[provider].label}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              {connection ? (
                <>
                  <div className="flex items-center gap-1.5 text-sm text-foreground">
                    <Check className="h-3.5 w-3.5 text-primary" /> Connected as {connection.connected_email ?? "unknown account"}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => disconnect(provider)}>
                    Disconnect
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-sm text-muted-foreground">Not connected</span>
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/api/integrations/${provider}/connect?client_id=${currentClientId}`}>Connect</a>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Card className="glow-hover" style={{ borderColor: "rgba(var(--color-attention), 0.2)" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <MessageCircle className="h-4 w-4" style={{ color: "rgb(var(--color-attention))" }} /> WhatsApp Business
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Not connected — and this can't be completed from inside the app. WhatsApp Business
            (via Twilio's Meta Embedded Signup) requires a Meta Business Manager account and Twilio's
            WhatsApp Sender approval, both completed on Meta's and Twilio's own sites first, which can
            take a few days.
          </p>
          <a
            href="https://www.twilio.com/docs/whatsapp/self-sign-up"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Start Twilio's WhatsApp Sender setup <ExternalLink className="h-3 w-3" />
          </a>
          <p className="text-xs text-muted-foreground">
            Once you have a Sender approved, come back and we'll wire up the real connection here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

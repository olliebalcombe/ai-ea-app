"use client";

import { useEffect, useState } from "react";
import { PoundSterling, Phone, MessageSquare, Mail, MessageCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { waLink } from "@/lib/whatsapp";
import { Card } from "@/components/ui/card";
import type { Lead, Service } from "@/types";

type LostLead = Lead & { categories: { name: string } | null };

const CHANNEL_ICON = { call: Phone, sms: MessageSquare, email: Mail };

function fmtGBP(pence: number) {
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

export default function LostLeadsPage() {
  const { currentClientId } = useCurrentClient();
  const [lost, setLost] = useState<LostLead[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentClientId) return;
    setLoading(true);
    Promise.all([
      supabaseBrowser
        .from("leads")
        .select("*, categories:category_id(name)")
        .eq("client_id", currentClientId)
        .eq("status", "Lost")
        .order("created_at", { ascending: false }),
      supabaseBrowser.from("services").select("*").eq("client_id", currentClientId),
    ]).then(([leadsRes, servicesRes]) => {
      setLost((leadsRes.data as unknown as LostLead[]) ?? []);
      setServices((servicesRes.data as Service[]) ?? []);
      setLoading(false);
    });
  }, [currentClientId]);

  function estimatedValue(lead: LostLead) {
    if (lead.price_pence != null) return lead.price_pence;
    const inCategory = services.filter((s) => s.category_id === lead.category_id);
    if (inCategory.length === 0) return 0;
    return Math.round(inCategory.reduce((sum, s) => sum + s.price_pence, 0) / inCategory.length);
  }

  const totalEstimated = lost.reduce((sum, l) => sum + estimatedValue(l), 0);

  const reasonCounts = Object.entries(
    lost.reduce<Record<string, number>>((acc, l) => {
      const reason = l.lost_reason || "No reason given";
      acc[reason] = (acc[reason] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([reason, count]) => ({ reason, count }));

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">Lost Leads</h1>

      <Card className="mb-6 flex items-center gap-3 border-rose-500/20 bg-rose-500/[0.05] p-4">
        <PoundSterling className="h-5 w-5 text-rose-400" />
        <div className="text-sm text-foreground">
          Estimated value of lost opportunities:{" "}
          <span className="text-base font-semibold text-rose-400">{fmtGBP(totalEstimated)}</span>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 text-sm font-semibold text-foreground">Lost leads</div>
          {lost.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No lost leads for this business.</p>
          ) : (
            <div className="space-y-2">
              {lost.map((l) => {
                const Icon = CHANNEL_ICON[l.channel];
                return (
                  <div key={l.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-muted">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{l.name ?? "Unknown"}</div>
                      <div className="truncate text-xs text-muted-foreground">{l.categories?.name ?? "—"}</div>
                    </div>
                    {waLink(l.phone) && (
                      <button
                        onClick={() => window.open(waLink(l.phone)!, "_blank")}
                        title="Open in WhatsApp"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#25D366]/25 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <span className="shrink-0 rounded-full border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-[10.5px] text-rose-300">
                      {l.lost_reason || "No reason given"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 text-sm font-semibold text-foreground">Why leads are lost</div>
          {reasonCounts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={reasonCounts} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis dataKey="reason" type="category" width={130} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10.5 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  cursor={{ fill: "hsl(var(--muted))" }}
                />
                <Bar dataKey="count" fill="#fb7185" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}

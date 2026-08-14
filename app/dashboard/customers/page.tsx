"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, ArrowUpRight } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { cn } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";
import QualificationScoreCard from "@/components/QualificationScoreCard";
import type { Lead, LeadMessage } from "@/types";

interface Customer {
  key: string;
  name: string;
  phone: string | null;
  email: string | null;
  leads: Lead[];
  lifetimeValue: number;
  lastActivity: string;
}

function fmtGBP(pence: number) {
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

/** Groups real leads by contact (phone, falling back to email) at query time -- no separate customers table exists, so this is an honest computed view over real lead history, not a new entity. */
function groupIntoCustomers(leads: Lead[]): Customer[] {
  const groups = new Map<string, Lead[]>();
  for (const lead of leads) {
    const key = lead.phone?.trim() || lead.email?.trim().toLowerCase() || `lead:${lead.id}`;
    const existing = groups.get(key);
    if (existing) existing.push(lead);
    else groups.set(key, [lead]);
  }
  return Array.from(groups.entries())
    .map(([key, groupLeads]) => {
      const sorted = [...groupLeads].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const latest = sorted[0];
      const lifetimeValue = groupLeads
        .filter((l) => l.status === "Won" || l.status === "Booked")
        .reduce((sum, l) => sum + (l.price_pence ?? 0), 0);
      return {
        key,
        name: latest.name ?? "Unknown",
        phone: latest.phone,
        email: latest.email,
        leads: sorted,
        lifetimeValue,
        lastActivity: latest.created_at,
      };
    })
    .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
}

export default function CustomersPage() {
  const { currentClientId } = useCurrentClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<LeadMessage[]>([]);
  const [photoCount, setPhotoCount] = useState(0);

  useEffect(() => {
    if (!currentClientId) return;
    setLoading(true);
    supabaseBrowser
      .from("leads")
      .select("*")
      .eq("client_id", currentClientId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setLeads((data as Lead[]) ?? []);
        setLoading(false);
      });
  }, [currentClientId]);

  const customers = useMemo(() => groupIntoCustomers(leads), [leads]);
  const selected = customers.find((c) => c.key === selectedKey) ?? customers[0] ?? null;
  const latestLead = selected?.leads[0] ?? null;

  const loadDetail = useCallback(async (leadId: string) => {
    const [{ data: msgs }, { count }] = await Promise.all([
      supabaseBrowser.from("lead_messages").select("*").eq("lead_id", leadId).order("created_at", { ascending: true }),
      supabaseBrowser.from("lead_media").select("id", { count: "exact", head: true }).eq("lead_id", leadId),
    ]);
    setMessages((msgs as LeadMessage[]) ?? []);
    setPhotoCount(count ?? 0);
  }, []);

  useEffect(() => {
    if (latestLead) loadDetail(latestLead.id);
  }, [latestLead, loadDetail]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Customers</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Every contact's full relationship — grouped by phone or email across all their enquiries, quotes, and bookings.
      </p>

      {customers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No customers yet.</p>
      ) : (
        <div className="flex overflow-hidden rounded-lg border border-border" style={{ height: "calc(100vh - 16rem)" }}>
          <div className="w-80 shrink-0 overflow-y-auto border-r border-border p-2">
            {customers.map((c) => (
              <div
                key={c.key}
                onClick={() => setSelectedKey(c.key)}
                className={cn(
                  "mb-1 cursor-pointer rounded-lg p-2.5 hover:bg-accent",
                  (selected?.key ?? customers[0]?.key) === c.key && "bg-primary/10"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                  <StatusBadge status={c.leads[0].status} />
                </div>
                <div className="mt-0.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">{c.phone ?? c.email ?? "No contact info"}</span>
                  <span className="shrink-0">
                    {c.leads.length} enquir{c.leads.length === 1 ? "y" : "ies"}
                  </span>
                </div>
                {c.lifetimeValue > 0 && (
                  <div className="mt-0.5 text-xs font-medium text-primary">{fmtGBP(c.lifetimeValue)} lifetime value</div>
                )}
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {selected ? (
              <>
                <div className="mb-4">
                  <div className="text-lg font-semibold text-foreground">{selected.name}</div>
                  <div className="text-sm text-muted-foreground">{selected.phone ?? selected.email ?? "No contact info"}</div>
                </div>

                {latestLead && (
                  <div className="mb-5">
                    <QualificationScoreCard lead={latestLead} messages={messages} photoCount={photoCount} />
                  </div>
                )}

                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  History ({selected.leads.length})
                </div>
                <div className="space-y-1.5">
                  {selected.leads.map((l) => (
                    <Link
                      key={l.id}
                      href={`/dashboard/leads/${l.id}`}
                      className="glow-hover flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
                    >
                      <div className="flex items-center gap-2">
                        <StatusBadge status={l.status} />
                        <span className="text-foreground">{new Date(l.created_at).toLocaleDateString("en-GB")}</span>
                        {l.price_pence != null && <span className="text-muted-foreground">{fmtGBP(l.price_pence)}</span>}
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a customer</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

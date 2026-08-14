import { supabaseBrowser } from "@/lib/supabaseClient";

export type MentionType = "lead" | "kb" | "booking" | "component";

export const MENTION_TYPES: MentionType[] = ["lead", "kb", "booking", "component"];

export interface MentionResult {
  id: string;
  type: MentionType;
  label: string;
  sublabel?: string;
  href?: string;
  /** Real fetched context resolved for this mention, used when injected into an AI prompt. */
  context?: string;
}

const COMPONENT_PAGES = [
  { id: "today", label: "Today", href: "/dashboard" },
  { id: "inbox", label: "Inbox", href: "/dashboard/inbox" },
  { id: "approvals", label: "Approvals", href: "/dashboard/approvals" },
  { id: "leads", label: "Lead Queue", href: "/dashboard/leads" },
  { id: "lost", label: "Lost Leads", href: "/dashboard/lost" },
  { id: "follow-ups", label: "Follow-ups", href: "/dashboard/follow-ups" },
  { id: "bookings", label: "Bookings", href: "/dashboard/bookings" },
  { id: "calendar", label: "Calendar", href: "/dashboard/calendar" },
  { id: "reports", label: "Reports", href: "/dashboard/reports" },
  { id: "business-memory", label: "Business Memory", href: "/dashboard/business-memory" },
  { id: "playbooks", label: "Playbooks", href: "/dashboard/playbooks" },
  { id: "customers", label: "Customers", href: "/dashboard/customers" },
  { id: "activity", label: "Assistant Activity", href: "/dashboard/activity" },
  { id: "design-studio", label: "Design Studio", href: "/dashboard/design-studio" },
  { id: "marketplace", label: "Marketplace", href: "/dashboard/marketplace" },
  { id: "canvas", label: "Canvas", href: "/dashboard/canvas" },
  { id: "integrations", label: "Integrations", href: "/dashboard/settings/integrations" },
];

/** Parses a raw "@..." fragment (no leading @) into a mention type + remaining search text. */
export function parseMention(fragment: string): { type: MentionType | null; rest: string } {
  const m = fragment.match(/^(lead|kb|booking|component)(?:\s+(.*))?$/i);
  if (!m) return { type: null, rest: fragment };
  return { type: m[1].toLowerCase() as MentionType, rest: m[2] ?? "" };
}

export async function searchMentions(
  type: MentionType,
  rest: string,
  clientId: string
): Promise<MentionResult[]> {
  const q = rest.trim();

  if (type === "lead") {
    let query = supabaseBrowser.from("leads").select("id, name, phone, email").eq("client_id", clientId).limit(8);
    if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
    const { data } = await query;
    return (data ?? []).map((l) => ({
      id: l.id,
      type: "lead" as const,
      label: l.name ?? "Unknown",
      sublabel: l.phone ?? l.email ?? "",
      href: `/dashboard/leads/${l.id}`,
    }));
  }

  if (type === "kb") {
    let query = supabaseBrowser
      .from("knowledge_base_entries")
      .select("id, title, content, category")
      .eq("client_id", clientId)
      .limit(8);
    if (q) query = query.ilike("title", `%${q}%`);
    const { data } = await query;
    return (data ?? []).map((k) => ({
      id: k.id,
      type: "kb" as const,
      label: k.title,
      sublabel: k.category,
      context: k.content,
    }));
  }

  if (type === "booking") {
    let query = supabaseBrowser
      .from("manual_bookings")
      .select("id, customer_name, booking_date, booking_time")
      .eq("client_id", clientId)
      .order("booking_date", { ascending: false })
      .limit(8);
    if (q) query = query.ilike("customer_name", `%${q}%`);
    const { data } = await query;
    return (data ?? []).map((b) => ({
      id: b.id,
      type: "booking" as const,
      label: b.customer_name,
      sublabel: [b.booking_date, b.booking_time].filter(Boolean).join(" "),
    }));
  }

  // component
  const filtered = q
    ? COMPONENT_PAGES.filter((p) => p.label.toLowerCase().includes(q.toLowerCase()))
    : COMPONENT_PAGES;
  return filtered.map((p) => ({ id: p.id, type: "component" as const, label: p.label, href: p.href }));
}

/** Fetches real context for a lead mention (answers/notes) to ground a custom scenario prompt. */
export async function resolveLeadContext(leadId: string): Promise<string> {
  const [{ data: lead }, { data: answers }] = await Promise.all([
    supabaseBrowser.from("leads").select("name, notes, status").eq("id", leadId).single(),
    supabaseBrowser.from("lead_answers").select("question, answer").eq("lead_id", leadId),
  ]);
  const parts: string[] = [];
  if (lead?.name) parts.push(`Lead: ${lead.name} (status: ${lead.status})`);
  if (lead?.notes) parts.push(`Notes: ${lead.notes}`);
  if (answers && answers.length > 0) {
    parts.push(`Answers: ${answers.map((a) => `${a.question} — ${a.answer}`).join("; ")}`);
  }
  return parts.join("\n");
}

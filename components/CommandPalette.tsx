"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  Inbox,
  Kanban,
  XCircle,
  ClipboardList,
  Calendar,
  FileBarChart,
  BookOpen,
  Palette,
  Users,
  Wrench,
  ListChecks,
  Sparkles,
  Bell,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { parseMention, searchMentions, type MentionResult } from "@/lib/mentions";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { Lead } from "@/types";

const MENTION_LABELS: Record<string, string> = {
  lead: "Leads (@lead)",
  kb: "Knowledge Base (@kb)",
  booking: "Bookings (@booking)",
  component: "Pages (@component)",
};

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/messages", label: "Messages", icon: Inbox },
  { href: "/dashboard/leads", label: "Lead Queue", icon: Kanban },
  { href: "/dashboard/lost", label: "Lost Leads", icon: XCircle },
  { href: "/dashboard/bookings", label: "Bookings", icon: ClipboardList },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
  { href: "/dashboard/reports", label: "Reports", icon: FileBarChart },
  { href: "/dashboard/knowledge-base", label: "Knowledge Base", icon: BookOpen },
  { href: "/dashboard/design-studio", label: "Design Studio", icon: Palette },
  { href: "/dashboard/settings/staff", label: "Settings: Staff", icon: Users },
  { href: "/dashboard/settings/services", label: "Settings: Services", icon: Wrench },
  { href: "/dashboard/settings/questions", label: "Settings: Questions", icon: ListChecks },
  { href: "/dashboard/settings/ai", label: "Settings: AI", icon: Sparkles },
  { href: "/dashboard/settings/notifications", label: "Settings: Notifications", icon: Bell },
];

export default function CommandPalette() {
  const router = useRouter();
  const { currentClientId } = useCurrentClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [leadResults, setLeadResults] = useState<Lead[]>([]);
  const [mentionResults, setMentionResults] = useState<MentionResult[]>([]);

  const mention = query.startsWith("@") ? parseMention(query.slice(1)) : null;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!currentClientId || !query.trim() || mention) {
      setLeadResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabaseBrowser
        .from("leads")
        .select("*")
        .eq("client_id", currentClientId)
        .or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(8);
      setLeadResults((data as Lead[]) ?? []);
    }, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, currentClientId]);

  useEffect(() => {
    if (!currentClientId || !mention?.type) {
      setMentionResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const results = await searchMentions(mention.type!, mention.rest, currentClientId);
      setMentionResults(results);
    }, 200);
    return () => clearTimeout(timeout);
  }, [mention?.type, mention?.rest, currentClientId]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-white/10 bg-secondary/30 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/50"
      >
        <Search className="h-3.5 w-3.5" />
        Search…
        <kbd className="ml-4 rounded border border-white/10 bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search leads, jump to a page, or type @lead / @kb / @booking / @component…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {mention && !mention.type
              ? "Type @lead, @kb, @booking, or @component to filter by type."
              : "No results found."}
          </CommandEmpty>

          {mention?.type ? (
            <CommandGroup heading={MENTION_LABELS[mention.type]}>
              {mentionResults.map((r) => (
                <CommandItem
                  key={`${r.type}-${r.id}`}
                  onSelect={() =>
                    go(
                      r.href ??
                        (r.type === "kb" ? "/dashboard/knowledge-base" : "/dashboard/bookings")
                    )
                  }
                >
                  {r.label}
                  {r.sublabel && <span className="ml-2 text-xs text-muted-foreground">{r.sublabel}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : (
            <>
              {leadResults.length > 0 && (
                <CommandGroup heading="Leads">
                  {leadResults.map((lead) => (
                    <CommandItem key={lead.id} onSelect={() => go(`/dashboard/leads/${lead.id}`)}>
                      {lead.name ?? "Unknown"}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {lead.phone ?? lead.email ?? ""}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              <CommandGroup heading="Navigate">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem key={item.href} onSelect={() => go(item.href)}>
                      <Icon className="mr-2 h-4 w-4" />
                      {item.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

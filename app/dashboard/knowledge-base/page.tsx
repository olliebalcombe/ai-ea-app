"use client";

import { useCallback, useEffect, useState } from "react";
import { X, PoundSterling, HelpCircle, MapPin, UserCheck } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { KnowledgeBaseEntry, KnowledgeCategory } from "@/types";

const SECTIONS: { category: KnowledgeCategory; label: string; icon: typeof PoundSterling; placeholder: string }[] = [
  { category: "pricing_rule", label: "Pricing Rules", icon: PoundSterling, placeholder: "e.g. call-out fee waived if booked" },
  { category: "faq", label: "FAQs", icon: HelpCircle, placeholder: "e.g. do you work weekends?" },
  { category: "service_area", label: "Service Areas", icon: MapPin, placeholder: "e.g. GU postcodes" },
  { category: "team_specialty", label: "Team Specialties", icon: UserCheck, placeholder: "e.g. Tom — period properties" },
];

export default function KnowledgeBasePage() {
  const { currentClientId } = useCurrentClient();
  const [entries, setEntries] = useState<KnowledgeBaseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<KnowledgeCategory, { title: string; content: string }>>({
    pricing_rule: { title: "", content: "" },
    faq: { title: "", content: "" },
    service_area: { title: "", content: "" },
    team_specialty: { title: "", content: "" },
    business_rule: { title: "", content: "" },
  });

  const load = useCallback(async () => {
    if (!currentClientId) return;
    setLoading(true);
    const { data, error } = await supabaseBrowser
      .from("knowledge_base_entries")
      .select("*")
      .eq("client_id", currentClientId)
      .order("created_at");
    if (error) setError(error.message);
    else setEntries((data as KnowledgeBaseEntry[]) ?? []);
    setLoading(false);
  }, [currentClientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addEntry(category: KnowledgeCategory, e: React.FormEvent) {
    e.preventDefault();
    const form = forms[category];
    if (!currentClientId || !form.title.trim() || !form.content.trim()) return;
    const { error } = await supabaseBrowser.from("knowledge_base_entries").insert({
      client_id: currentClientId,
      category,
      title: form.title.trim(),
      content: form.content.trim(),
    });
    if (error) {
      setError(error.message);
      return;
    }
    setForms((f) => ({ ...f, [category]: { title: "", content: "" } }));
    load();
  }

  async function removeEntry(id: string) {
    const { error } = await supabaseBrowser.from("knowledge_base_entries").delete().eq("id", id);
    if (error) setError(error.message);
    else load();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-foreground">Knowledge Base</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Feeds directly into the AI's live conversations — pricing rules, FAQs, coverage areas, and
        team specialties it can draw on naturally when relevant.
      </p>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const items = entries.filter((e) => e.category === section.category);
          const form = forms[section.category];
          return (
            <Card key={section.category}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Icon className="h-4 w-4 text-primary" />
                  {section.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-border bg-secondary/20 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground">{item.title}</div>
                          <div className="text-xs text-muted-foreground">{item.content}</div>
                        </div>
                        <button
                          onClick={() => removeEntry(item.id)}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={(e) => addEntry(section.category, e)} className="space-y-2 border-t border-border pt-3">
                  <Input
                    value={form.title}
                    onChange={(e) =>
                      setForms((f) => ({ ...f, [section.category]: { ...f[section.category], title: e.target.value } }))
                    }
                    placeholder={section.placeholder}
                  />
                  <Textarea
                    value={form.content}
                    onChange={(e) =>
                      setForms((f) => ({ ...f, [section.category]: { ...f[section.category], content: e.target.value } }))
                    }
                    placeholder="Details…"
                    rows={2}
                  />
                  <Button type="submit" size="sm" variant="outline">
                    Add
                  </Button>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

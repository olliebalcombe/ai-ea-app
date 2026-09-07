"use client";

import { useCallback, useEffect, useState } from "react";
import { X, PoundSterling, HelpCircle, MapPin, UserCheck, ShieldAlert, BookOpen } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { KnowledgeBaseEntry, KnowledgeCategory } from "@/types";

const TAB_TRIGGER_CLASS =
  "rounded-md px-3 py-1.5 font-medium text-zinc-400 data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-none hover:text-zinc-200";

const PRIMARY_CTA_CLASS = "bg-emerald-500 hover:bg-emerald-400 text-black font-medium rounded-md px-4 py-2";

const KB_SECTIONS: { category: KnowledgeCategory; label: string; icon: typeof PoundSterling; placeholder: string }[] = [
  { category: "pricing_rule", label: "Pricing Rules", icon: PoundSterling, placeholder: "e.g. call-out fee waived if booked" },
  { category: "faq", label: "FAQs", icon: HelpCircle, placeholder: "e.g. do you work weekends?" },
  { category: "service_area", label: "Service Areas", icon: MapPin, placeholder: "e.g. GU postcodes" },
  { category: "team_specialty", label: "Team Specialties", icon: UserCheck, placeholder: "e.g. Tom — period properties" },
];

/**
 * Business Memory: the AI Assistant's editable, transparent knowledge store. Knowledge
 * Base and Hard Rules were previously two separate nav destinations -- both are just
 * filtered views over the same knowledge_base_entries table, merged here into one
 * workspace with tabs, per the spec's single named "Business Memory" workspace.
 */
export default function BusinessMemoryPage() {
  const { currentClientId, currentClient } = useCurrentClient();
  const assistantName = currentClient?.assistant_name ?? "your assistant";
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

  const businessRules = entries.filter((e) => e.category === "business_rule");

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-foreground">Business Memory</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        What {assistantName} knows about this business and the imperative rules it must never break — transparent and editable.
      </p>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <Tabs defaultValue="knowledge">
        <TabsList className="mb-4">
          <TabsTrigger value="knowledge" className={TAB_TRIGGER_CLASS}>
            <BookOpen className="h-3.5 w-3.5" /> Knowledge Base
          </TabsTrigger>
          <TabsTrigger value="rules" className={TAB_TRIGGER_CLASS}>
            <ShieldAlert className="h-3.5 w-3.5" /> Hard Rules ({businessRules.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="knowledge" className="mt-0">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {KB_SECTIONS.map((section) => {
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
                      <p className="text-sm text-zinc-400">Nothing added yet.</p>
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
                      <Button type="submit" size="sm" className={PRIMARY_CTA_CLASS}>
                        Add
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="rules" className="mt-0">
          <div className="max-w-xl">
            <p className="mb-4 text-sm text-muted-foreground">
              Hard constraints {assistantName} must never violate — e.g. "Never discount more than 10%" — distinct from Knowledge
              Base, which is soft context it draws on when relevant.
            </p>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ShieldAlert className="h-4 w-4" style={{ color: "rgb(var(--color-attention))" }} />
                  Rules
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {businessRules.length === 0 ? (
                  <p className="text-sm text-zinc-400">No rules added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {businessRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-border bg-secondary/20 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground">{rule.title}</div>
                          <div className="text-xs text-muted-foreground">{rule.content}</div>
                        </div>
                        <button
                          onClick={() => removeEntry(rule.id)}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={(e) => addEntry("business_rule", e)} className="space-y-2 border-t border-border pt-3">
                  <Input
                    value={forms.business_rule.title}
                    onChange={(e) => setForms((f) => ({ ...f, business_rule: { ...f.business_rule, title: e.target.value } }))}
                    placeholder="e.g. Discount cap"
                  />
                  <Textarea
                    value={forms.business_rule.content}
                    onChange={(e) => setForms((f) => ({ ...f, business_rule: { ...f.business_rule, content: e.target.value } }))}
                    placeholder="e.g. Never offer more than 10% off without owner approval"
                    rows={2}
                  />
                  <Button type="submit" size="sm" className={PRIMARY_CTA_CLASS}>
                    Add rule
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

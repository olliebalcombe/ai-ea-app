"use client";

import { useCallback, useEffect, useState } from "react";
import { X, ShieldAlert } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { KnowledgeBaseEntry } from "@/types";

/**
 * Reuses knowledge_base_entries with category='business_rule' -- same real
 * table and CRUD as Knowledge Base, but its own nav destination since these
 * are hard constraints (see lib/prompts.ts's imperative "never violate"
 * framing), not soft context the AI weaves in when relevant.
 */
export default function BusinessRulesPage() {
  const { currentClientId } = useCurrentClient();
  const [entries, setEntries] = useState<KnowledgeBaseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const load = useCallback(async () => {
    if (!currentClientId) return;
    setLoading(true);
    const { data, error } = await supabaseBrowser
      .from("knowledge_base_entries")
      .select("*")
      .eq("client_id", currentClientId)
      .eq("category", "business_rule")
      .order("created_at");
    if (error) setError(error.message);
    else setEntries((data as KnowledgeBaseEntry[]) ?? []);
    setLoading(false);
  }, [currentClientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    if (!currentClientId || !title.trim() || !content.trim()) return;
    const { error } = await supabaseBrowser.from("knowledge_base_entries").insert({
      client_id: currentClientId,
      category: "business_rule",
      title: title.trim(),
      content: content.trim(),
    });
    if (error) {
      setError(error.message);
      return;
    }
    setTitle("");
    setContent("");
    load();
  }

  async function removeRule(id: string) {
    const { error } = await supabaseBrowser.from("knowledge_base_entries").delete().eq("id", id);
    if (error) setError(error.message);
    else load();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="max-w-xl">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-foreground">Business Rules</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Hard constraints the AI must never violate — e.g. "Never discount more than 10%" — distinct from
        Knowledge Base, which is soft context it draws on when relevant.
      </p>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldAlert className="h-4 w-4" style={{ color: "rgb(var(--color-attention))" }} />
            Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rules added yet.</p>
          ) : (
            <div className="space-y-2">
              {entries.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-border bg-secondary/20 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{rule.title}</div>
                    <div className="text-xs text-muted-foreground">{rule.content}</div>
                  </div>
                  <button
                    onClick={() => removeRule(rule.id)}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={addRule} className="space-y-2 border-t border-border pt-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Discount cap" />
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="e.g. Never offer more than 10% off without owner approval"
              rows={2}
            />
            <Button type="submit" size="sm" variant="outline">
              Add rule
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

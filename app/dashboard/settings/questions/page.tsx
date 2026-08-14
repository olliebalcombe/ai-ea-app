"use client";

import { useCallback, useEffect, useState } from "react";
import { X, MessageSquareQuote, Sparkles } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TONE_OPTIONS } from "@/lib/toneOptions";
import type { QualifyingQuestion, ToneStyle } from "@/types";

export default function QuestionsSettingsPage() {
  const { currentClientId, currentClient } = useCurrentClient();
  const assistantName = currentClient?.assistant_name ?? "your assistant";
  const [questions, setQuestions] = useState<QualifyingQuestion[]>([]);
  const [toneStyle, setToneStyle] = useState<ToneStyle>("calm_direct");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState("");
  const [savingTone, setSavingTone] = useState(false);

  const load = useCallback(async () => {
    if (!currentClientId) return;
    setLoading(true);
    const [{ data: qData, error: qError }, { data: cData }] = await Promise.all([
      supabaseBrowser.from("qualifying_questions").select("*").eq("client_id", currentClientId).order("display_order"),
      supabaseBrowser.from("clients").select("tone_style").eq("id", currentClientId).single(),
    ]);
    if (qError) setError(qError.message);
    else setQuestions((qData as QualifyingQuestion[]) ?? []);
    setToneStyle((cData?.tone_style as ToneStyle) ?? "calm_direct");
    setLoading(false);
  }, [currentClientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveTone(v: ToneStyle) {
    if (!currentClientId) return;
    setToneStyle(v);
    setSavingTone(true);
    await supabaseBrowser.from("clients").update({ tone_style: v }).eq("id", currentClientId);
    setSavingTone(false);
  }

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!currentClientId || !newQuestion.trim()) return;
    const nextOrder = questions.length > 0 ? Math.max(...questions.map((q) => q.display_order)) + 1 : 1;
    const { error } = await supabaseBrowser.from("qualifying_questions").insert({
      client_id: currentClientId,
      question: newQuestion.trim(),
      display_order: nextOrder,
      mandatory: true,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setNewQuestion("");
    load();
  }

  async function removeQuestion(id: string) {
    const { error } = await supabaseBrowser.from("qualifying_questions").delete().eq("id", id);
    if (error) setError(error.message);
    else load();
  }

  function patchLocal(id: string, patch: Partial<QualifyingQuestion>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  async function saveQuestion(id: string, patch: Partial<QualifyingQuestion>) {
    const { error } = await supabaseBrowser.from("qualifying_questions").update(patch).eq("id", id);
    if (error) setError(error.message);
  }

  return (
    <div className="max-w-2xl space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{assistantName}'s Conversational Tone</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={toneStyle} onValueChange={(v) => saveTone(v as ToneStyle)} disabled={savingTone}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONE_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-muted-foreground">{TONE_OPTIONS.find((t) => t.value === toneStyle)?.description}</p>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-1 text-sm font-semibold text-foreground">Qualifying Questions</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          What {assistantName} needs to learn before handing a lead to your team — edit exactly how it asks, mark which
          ones are non-negotiable, and add a follow-up rule for tricky cases.
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No questions configured yet.</p>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <Card key={q.id} className="p-4">
                <div className="mb-2.5 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <MessageSquareQuote className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{q.question}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor={`mandatory-${q.id}`} className="text-[10px] text-muted-foreground">
                        Mandatory
                      </Label>
                      <Switch
                        id={`mandatory-${q.id}`}
                        checked={q.mandatory}
                        onCheckedChange={(v) => {
                          patchLocal(q.id, { mandatory: v });
                          saveQuestion(q.id, { mandatory: v });
                        }}
                      />
                    </div>
                    <button
                      onClick={() => removeQuestion(q.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <Label htmlFor={`phrasing-${q.id}`} className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Sparkles className="h-3 w-3" /> How {assistantName} actually asks it
                    </Label>
                    <Input
                      id={`phrasing-${q.id}`}
                      value={q.ai_phrasing ?? ""}
                      onChange={(e) => patchLocal(q.id, { ai_phrasing: e.target.value })}
                      onBlur={(e) => saveQuestion(q.id, { ai_phrasing: e.target.value || null })}
                      placeholder={`e.g. "${q.question === "Job type" ? "What's the job you need sorting?" : "So I can get this right — how would you put that in your own words?"}"`}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`followup-${q.id}`} className="mb-1 block text-[11px] text-muted-foreground">
                      Follow-up rule (optional)
                    </Label>
                    <Input
                      id={`followup-${q.id}`}
                      value={q.follow_up_rule ?? ""}
                      onChange={(e) => patchLocal(q.id, { follow_up_rule: e.target.value })}
                      onBlur={(e) => saveQuestion(q.id, { follow_up_rule: e.target.value || null })}
                      placeholder="e.g. if they're unsure, offer to send someone out to measure"
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <form onSubmit={addQuestion} className="mt-3 flex gap-2">
          <Input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="Add a question…" />
          <Button type="submit">Add</Button>
        </form>
      </div>
    </div>
  );
}

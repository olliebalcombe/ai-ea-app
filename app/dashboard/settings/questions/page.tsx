"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { QualifyingQuestion } from "@/types";

export default function QuestionsSettingsPage() {
  const { currentClientId } = useCurrentClient();
  const [questions, setQuestions] = useState<QualifyingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState("");

  const load = useCallback(async () => {
    if (!currentClientId) return;
    setLoading(true);
    const { data, error } = await supabaseBrowser
      .from("qualifying_questions")
      .select("*")
      .eq("client_id", currentClientId)
      .order("display_order");
    if (error) setError(error.message);
    else setQuestions((data as QualifyingQuestion[]) ?? []);
    setLoading(false);
  }, [currentClientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!currentClientId || !newQuestion.trim()) return;
    const nextOrder = questions.length > 0 ? Math.max(...questions.map((q) => q.display_order)) + 1 : 1;
    const { error } = await supabaseBrowser.from("qualifying_questions").insert({
      client_id: currentClientId,
      question: newQuestion.trim(),
      display_order: nextOrder,
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

  return (
    <div className="max-w-xl space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Qualifying questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No questions configured yet.</p>
          ) : (
            questions.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3.5 py-2.5"
              >
                <span className="text-sm text-foreground">{q.question}</span>
                <button
                  onClick={() => removeQuestion(q.id)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <form onSubmit={addQuestion} className="flex gap-2">
        <Input
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          placeholder="Add a question…"
        />
        <Button type="submit">Add</Button>
      </form>
    </div>
  );
}

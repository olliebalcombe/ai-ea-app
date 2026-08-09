"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, UploadCloud, Send, ArrowRight } from "lucide-react";
import { useCurrentClient } from "@/lib/clientContext";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { buildVoiceOpener } from "@/lib/prompts";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ViewportFrame from "@/components/ViewportFrame";
import type { SkillDefinition } from "@/lib/skills";
import type { Service } from "@/types";

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({ base64: result.split(",")[1] ?? "", mediaType: file.type || "image/jpeg" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SkillDetailSheet({
  skill,
  open,
  onOpenChange,
  enabled,
  toggling,
  onToggle,
}: {
  skill: SkillDefinition | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabled: boolean;
  toggling?: boolean;
  onToggle: () => void;
}) {
  const { currentClientId, currentClient } = useCurrentClient();

  // Vision playground
  const [visionPreview, setVisionPreview] = useState<string | null>(null);
  const [visionResult, setVisionResult] = useState<string | null>(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quote playground
  const [services, setServices] = useState<Service[]>([]);
  const [quoteServiceId, setQuoteServiceId] = useState("");
  const [quoteResult, setQuoteResult] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Reschedule playground
  const [rescheduleText, setRescheduleText] = useState("");
  const [rescheduleResult, setRescheduleResult] = useState<{ proposedDate: string; proposedTime: string; replyMessage: string } | null>(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  // Reviews config + playground
  const [reviewLink, setReviewLink] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewSaved, setReviewSaved] = useState(false);
  const [reviewTestLoading, setReviewTestLoading] = useState(false);
  const [reviewTestResult, setReviewTestResult] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !skill || !currentClientId) return;
    setError(null);
    setVisionPreview(null);
    setVisionResult(null);
    setQuoteResult(null);
    setRescheduleResult(null);
    setRescheduleText("");
    setReviewTestResult(null);

    if (skill.key === "whatsapp_ballpark_estimator") {
      supabaseBrowser
        .from("services")
        .select("*")
        .eq("client_id", currentClientId)
        .then(({ data }) => setServices((data as Service[]) ?? []));
    }
    if (skill.key === "google_reviews_booster") {
      supabaseBrowser
        .from("clients")
        .select("google_review_link")
        .eq("id", currentClientId)
        .single()
        .then(({ data }) => setReviewLink(data?.google_review_link ?? ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, skill?.key, currentClientId]);

  async function runVision(file: File) {
    if (!currentClientId) return;
    setError(null);
    setVisionPreview(URL.createObjectURL(file));
    setVisionResult(null);
    setVisionLoading(true);
    try {
      const { base64, mediaType } = await fileToBase64(file);
      const res = await fetch("/api/marketplace/playground/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: currentClientId, image_base64: base64, media_type: mediaType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setVisionResult(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setVisionLoading(false);
    }
  }

  async function runQuote() {
    if (!currentClientId) return;
    setError(null);
    setQuoteLoading(true);
    setQuoteResult(null);
    try {
      const res = await fetch("/api/marketplace/playground/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: currentClientId, service_id: quoteServiceId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Draft failed");
      setQuoteResult(data.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setQuoteLoading(false);
    }
  }

  async function runReschedule() {
    if (!currentClientId || !rescheduleText.trim()) return;
    setError(null);
    setRescheduleLoading(true);
    setRescheduleResult(null);
    try {
      const res = await fetch("/api/marketplace/playground/reschedule-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: currentClientId, message: rescheduleText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Suggestion failed");
      setRescheduleResult(data.suggestion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suggestion failed");
    } finally {
      setRescheduleLoading(false);
    }
  }

  async function saveReviewLink() {
    if (!currentClientId) return;
    setReviewSaving(true);
    setError(null);
    const { error } = await supabaseBrowser
      .from("clients")
      .update({ google_review_link: reviewLink.trim() || null })
      .eq("id", currentClientId);
    setReviewSaving(false);
    if (error) setError(error.message);
    else {
      setReviewSaved(true);
      setTimeout(() => setReviewSaved(false), 2000);
    }
  }

  async function runReviewTest() {
    if (!currentClientId) return;
    setError(null);
    setReviewTestLoading(true);
    setReviewTestResult(null);
    try {
      const res = await fetch("/api/marketplace/playground/review-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: currentClientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setReviewTestResult(`Sent to ${data.sentTo}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setReviewTestLoading(false);
    }
  }

  if (!skill) return null;
  const Icon = skill.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <div className={`skill-thumb -mx-6 -mt-6 mb-2 flex h-24 items-center justify-center bg-gradient-to-br ${skill.gradient}`}>
            <Icon className="h-8 w-8 text-foreground/80" />
          </div>
          <SheetTitle>{skill.name}</SheetTitle>
          <SheetDescription>{skill.description}</SheetDescription>
        </SheetHeader>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <div className="mt-6 space-y-4">
          <div className="text-sm font-medium text-foreground">Playground</div>

          {skill.key === "vision_site_inspector" && (
            <ViewportFrame title="Vision Site Inspector — playground">
            <div className="space-y-3 p-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) runVision(file);
                  e.target.value = "";
                }}
              />
              {!visionPreview ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-white/15 py-8 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <UploadCloud className="h-5 w-5" />
                  <span className="text-xs">Upload a sample site photo</span>
                </button>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={visionPreview} alt="Sample" className="h-32 w-full rounded-lg object-cover" />
                  {visionLoading && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" /> Analyzing…
                    </div>
                  )}
                  {visionResult && <p className="text-xs text-foreground">{visionResult}</p>}
                </>
              )}
            </div>
            </ViewportFrame>
          )}

          {skill.key === "whatsapp_ballpark_estimator" && (
            <ViewportFrame title="WhatsApp Ballpark Estimator — playground">
            <div className="space-y-2 p-3">
              <Select value={quoteServiceId} onValueChange={setQuoteServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a sample service…" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={runQuote} disabled={quoteLoading}>
                {quoteLoading ? "Drafting…" : "Draft sample estimate"}
              </Button>
              {quoteResult && (
                <div className="rounded-lg bg-black/20 px-3 py-2 text-xs text-foreground">{quoteResult}</div>
              )}
            </div>
            </ViewportFrame>
          )}

          {skill.key === "voice_ai_receptionist" && (
            <ViewportFrame title="Voice AI Receptionist — sample">
            <div className="space-y-2 p-3">
              <p className="text-xs text-muted-foreground">
                Sample opening line — sent as the first SMS moments after a missed call, using this
                business's real assistant name and tone.
              </p>
              <div className="rounded-lg bg-black/20 px-3 py-2 text-xs text-foreground">
                {currentClient
                  ? buildVoiceOpener({ assistantName: currentClient.assistant_name, toneStyle: currentClient.tone_style })
                  : "…"}
              </div>
            </div>
            </ViewportFrame>
          )}

          {skill.key === "calendar_auto_rescheduler" && (
            <ViewportFrame title="Calendar Auto-Rescheduler — playground">
            <div className="space-y-2 p-3">
              <Textarea
                value={rescheduleText}
                onChange={(e) => setRescheduleText(e.target.value)}
                placeholder="e.g. Hi, can we move my appointment to later in the week?"
                rows={3}
              />
              <Button size="sm" onClick={runReschedule} disabled={rescheduleLoading || !rescheduleText.trim()}>
                {rescheduleLoading ? "Thinking…" : "Suggest a new slot"}
              </Button>
              {rescheduleResult && (
                <div className="space-y-1 rounded-lg bg-black/20 px-3 py-2 text-xs">
                  <div className="flex items-center gap-1.5 text-foreground">
                    <ArrowRight className="h-3 w-3 text-primary" />
                    {rescheduleResult.proposedDate} at {rescheduleResult.proposedTime}
                  </div>
                  <p className="text-muted-foreground">{rescheduleResult.replyMessage}</p>
                  <p className="text-[10px] text-amber-400">
                    Suggestion only — not checked against real staff availability, and no booking was
                    changed.
                  </p>
                </div>
              )}
            </div>
            </ViewportFrame>
          )}

          {skill.key === "google_reviews_booster" && (
            <ViewportFrame title="Google Reviews Booster — preview">
            <div className="space-y-2 p-3">
              <p className="text-xs text-muted-foreground">
                {reviewLink
                  ? "Preview of the message a customer would receive when marked Won:"
                  : "Configure a review link below, then send a test to yourself."}
              </p>
              {reviewLink && currentClient && (
                <div className="rounded-lg bg-black/20 px-3 py-2 text-xs text-foreground">
                  Thanks for choosing {currentClient.name}! If you have a moment, we&apos;d really
                  appreciate a quick review: {reviewLink}
                </div>
              )}
              <Button size="sm" onClick={runReviewTest} disabled={reviewTestLoading || !reviewLink}>
                <Send className="h-3.5 w-3.5" />
                {reviewTestLoading ? "Sending…" : "Send test to my own email"}
              </Button>
              {reviewTestResult && <p className="text-xs text-green-400">{reviewTestResult}</p>}
            </div>
            </ViewportFrame>
          )}
        </div>

        {skill.key === "google_reviews_booster" && (
          <div className="mt-6 space-y-2">
            <div className="text-sm font-medium text-foreground">Configuration</div>
            <Label htmlFor="review-link" className="text-xs text-muted-foreground">
              Google review link
            </Label>
            <div className="flex gap-2">
              <Input
                id="review-link"
                value={reviewLink}
                onChange={(e) => setReviewLink(e.target.value)}
                placeholder="https://g.page/r/…/review"
              />
              <Button size="sm" variant="outline" onClick={saveReviewLink} disabled={reviewSaving}>
                {reviewSaving ? "Saving…" : "Save"}
              </Button>
            </div>
            {reviewSaved && <span className="text-xs text-green-400">Saved.</span>}
          </div>
        )}

        <div className="mt-6 border-t border-border pt-4">
          <Button className="w-full" variant={enabled ? "outline" : "default"} onClick={onToggle} disabled={toggling}>
            {enabled ? "Uninstall from EA Agent" : "Install to EA Agent"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

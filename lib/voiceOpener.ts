import { supabaseAdmin } from "@/lib/supabase";
import { runQualificationTurn } from "@/lib/anthropic";
import { buildSystemPrompt, buildVoiceOpener } from "@/lib/prompts";
import { getConversationSummary } from "@/lib/conversationSummary";
import type { Client } from "@/types";

const TIMEOUT_MS = 4000;

/**
 * Same live-grounding pattern the SMS/email webhooks already use (fetch
 * knowledge_base_entries, build the shared system prompt via buildSystemPrompt)
 * applied to the very first missed-call message, instead of the fixed
 * per-tone-style template. Falls back to that template on any error or if the
 * call takes too long, since this runs inside a live Twilio webhook that
 * needs a fast response.
 *
 * `leadId`, when passed, also grounds the opener in that lead's cross-channel
 * conversation_summaries row -- a repeat caller who already texted in gets a
 * continuity-aware opener instead of a generic one. Read-only here: there's
 * no real exchange yet to summarize, so this never writes the summary itself.
 */
export async function generateGroundedVoiceOpener(client: Client, leadId?: string): Promise<string> {
  const fallback = buildVoiceOpener({ assistantName: client.assistant_name, toneStyle: client.tone_style });

  try {
    const [{ data: knowledgeBase }, conversationSummary] = await Promise.all([
      supabaseAdmin.from("knowledge_base_entries").select("category, title, content").eq("client_id", client.id),
      leadId ? getConversationSummary(leadId) : Promise.resolve(null),
    ]);

    const systemPrompt = buildSystemPrompt({
      vertical: client.vertical,
      businessName: client.name,
      assistantName: client.assistant_name,
      channel: "sms",
      toneStyle: client.tone_style,
      businessNuances: client.business_nuances,
      knowledgeBase,
      conversationSummary,
    });

    const result = await Promise.race([
      runQualificationTurn({
        systemPrompt,
        history: [
          {
            role: "user",
            content:
              "[System note: this is the very first outbound message after a missed call -- the caller hasn't said anything yet. Write one brief, natural opening line introducing yourself and inviting them to say what they need. Don't invent details you don't have.]",
          },
        ],
        questionsRemaining: [],
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("voice opener timed out")), TIMEOUT_MS)),
    ]);

    return result.reply.trim() || fallback;
  } catch (e) {
    console.error("generateGroundedVoiceOpener failed, using fallback", e);
    return fallback;
  }
}

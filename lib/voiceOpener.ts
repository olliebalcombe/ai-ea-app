import { supabaseAdmin } from "@/lib/supabase";
import { runQualificationTurn } from "@/lib/anthropic";
import { buildSystemPrompt, buildVoiceOpener } from "@/lib/prompts";
import type { Client } from "@/types";

const TIMEOUT_MS = 4000;

/**
 * Same live-grounding pattern the SMS/email webhooks already use (fetch
 * knowledge_base_entries, build the shared system prompt via buildSystemPrompt)
 * applied to the very first missed-call message, instead of the fixed
 * per-tone-style template. Falls back to that template on any error or if the
 * call takes too long, since this runs inside a live Twilio webhook that
 * needs a fast response.
 */
export async function generateGroundedVoiceOpener(client: Client): Promise<string> {
  const fallback = buildVoiceOpener({ assistantName: client.assistant_name, toneStyle: client.tone_style });

  try {
    const { data: knowledgeBase } = await supabaseAdmin
      .from("knowledge_base_entries")
      .select("category, title, content")
      .eq("client_id", client.id);

    const systemPrompt = buildSystemPrompt({
      vertical: client.vertical,
      businessName: client.name,
      assistantName: client.assistant_name,
      channel: "sms",
      toneStyle: client.tone_style,
      businessNuances: client.business_nuances,
      knowledgeBase,
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

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

/**
 * POST /api/marketplace/playground/reschedule-suggestion
 * Body: { client_id: string, message: string }
 *
 * Marketplace Playground for "Calendar Auto-Rescheduler". A real Claude call
 * reads a sample reschedule request and proposes a plausible new slot -- it
 * is NOT checked against real staff availability (there's no lead/staff
 * context here) and never writes to manual_bookings. It's a drafting aid for
 * staff to verify, not an autonomous scheduling action.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const clientId = body?.client_id as string | undefined;
  const message = body?.message as string | undefined;
  if (!clientId || !message?.trim()) {
    return NextResponse.json({ error: "client_id and message are required" }, { status: 400 });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => req.cookies.get(name)?.value } }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { data: membership } = await supabaseAdmin
    .from("client_users")
    .select("role")
    .eq("user_id", user.id)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "not a member of this client" }, { status: 403 });

  const today = new Date().toISOString().slice(0, 10);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 300,
    tools: [
      {
        name: "suggest_reschedule",
        description: "Propose a new appointment slot in response to a customer's reschedule request.",
        input_schema: {
          type: "object",
          properties: {
            proposedDate: { type: "string", description: "YYYY-MM-DD, a plausible weekday after today" },
            proposedTime: { type: "string", description: "24h HH:MM" },
            replyMessage: { type: "string", description: "A short natural reply proposing the new slot, to send to the customer" },
          },
          required: ["proposedDate", "proposedTime", "replyMessage"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "suggest_reschedule" },
    messages: [
      {
        role: "user",
        content: `Today's date is ${today}. A customer sent this message asking to reschedule an appointment: "${message.trim()}". Propose a plausible new slot and a short reply using the suggest_reschedule tool. You have no visibility into real staff availability here, so pick a reasonable weekday/time based on what they said.`,
      },
    ],
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) return NextResponse.json({ error: "Claude did not return a structured suggestion" }, { status: 502 });

  return NextResponse.json({ suggestion: toolUse.input });
}

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";
import { runQualificationTurn, type ConversationTurn, type ExtractedAnswer } from "@/lib/anthropic";
import { buildSystemPrompt, buildVoiceOpener } from "@/lib/prompts";
import { loadQuestionConfig } from "@/lib/qualifyingQuestions";
import { logActivity } from "@/lib/activityLog";
import type { ActivityType } from "@/types";

type Mode =
  | "quick_booking"
  | "multi_room"
  | "escalate"
  | "price_objection"
  | "reschedule"
  | "missed_call_mobile"
  | "missed_call_landline"
  | "custom";
const MODES: Mode[] = [
  "quick_booking",
  "multi_room",
  "escalate",
  "price_objection",
  "reschedule",
  "missed_call_mobile",
  "missed_call_landline",
  "custom",
];

interface ThoughtStep {
  customerMessage: string;
  aiReply: string;
  extractedAnswers: ExtractedAnswer[];
  escalation: string | null;
}

interface DraftMessage {
  sender: "lead" | "ai" | "system";
  body: string;
}

interface DraftPayload {
  lead: Record<string, unknown>;
  messages: DraftMessage[];
  answers: { question: string; answer: string }[];
  booking: Record<string, unknown> | null;
  bookingUpdate?: { id: string; booking_date: string; booking_time: string; note: string };
  activity?: { type: ActivityType; summary: string };
}

/**
 * POST /api/leads/simulate
 * Body: { client_id: string, mode: Mode, sandbox?: boolean, prompt?: string (custom mode only) }
 *
 * Writes a real (clearly-labelled test) lead into the real leads table for
 * demo/QA purposes -- unless `sandbox` is true, in which case the real Claude
 * turns still run (genuine Thought Stream, genuine cost/latency) but nothing
 * is written; the would-be rows are returned as `draft` for the client to
 * either discard or POST to /api/leads/simulate/commit to actually merge in.
 *
 * "quick_booking"/"multi_room"/"escalate"/"price_objection"/"custom" drive
 * the real runQualificationTurn pipeline -- the AI replies, extracted
 * entities, and confidence scores are genuine Claude output against that
 * client's real system prompt (tone, nuances, knowledge base), not authored
 * text. "missed_call_mobile"/"missed_call_landline" mirror the real outcome
 * of the missed-call webhook without placing an actual Twilio call/lookup.
 * "reschedule" isn't an entity-extraction scenario, so it keeps a more
 * direct approach (see below).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const clientId = body?.client_id as string | undefined;
  const mode = body?.mode as Mode | undefined;
  const sandbox = Boolean(body?.sandbox);
  const customPrompt = body?.prompt as string | undefined;

  if (!clientId || !mode || !MODES.includes(mode)) {
    return NextResponse.json({ error: "client_id and a valid mode are required" }, { status: 400 });
  }
  if (mode === "custom" && !customPrompt?.trim()) {
    return NextResponse.json({ error: "prompt is required for a custom scenario" }, { status: 400 });
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

  const { data: client } = await supabaseAdmin.from("clients").select("*").eq("id", clientId).single();
  if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });

  const [{ data: services }, { data: staffList }, { data: knowledgeBase }] = await Promise.all([
    supabaseAdmin.from("services").select("*").eq("client_id", clientId),
    supabaseAdmin.from("staff").select("*").eq("client_id", clientId),
    supabaseAdmin.from("knowledge_base_entries").select("category, title, content").eq("client_id", clientId),
  ]);

  const service = services && services.length > 0 ? services[Math.floor(Math.random() * services.length)] : null;
  const staff = staffList && staffList.length > 0 ? staffList[Math.floor(Math.random() * staffList.length)] : null;

  const suffix = Math.floor(1000 + Math.random() * 9000);
  const name = `Test Lead — ${suffix}`;
  const phone = `+4477${Math.floor(10000000 + Math.random() * 89999999)}`;
  const respSeconds = () => Math.floor(8 + Math.random() * 40);

  if (mode === "quick_booking" || mode === "multi_room" || mode === "escalate" || mode === "price_objection" || mode === "custom") {
    if ((mode === "quick_booking" || mode === "multi_room" || mode === "price_objection") && (!service || !staff)) {
      return NextResponse.json(
        { error: "This business needs at least one service and one staff member configured to simulate a booking." },
        { status: 400 }
      );
    }

    const questionConfig = await loadQuestionConfig(client.id, client.vertical);

    const systemPrompt = buildSystemPrompt({
      vertical: client.vertical,
      businessName: client.name,
      assistantName: client.assistant_name,
      channel: "sms",
      toneStyle: client.tone_style,
      businessNuances: client.business_nuances,
      knowledgeBase,
      questionGuidance: questionConfig,
    });

    const scriptedCustomerTurns: Record<"quick_booking" | "multi_room" | "escalate" | "price_objection", string[]> = {
      quick_booking: [
        `Hi, I need a quote for ${service!.name.toLowerCase()} and would like to get a site visit booked in as soon as possible.`,
      ],
      multi_room: [
        `Hi, we're renovating a few rooms and need some flooring advice and a quote.`,
        "We can't decide between LVT and carpet for the living areas — what would you actually recommend, and what's the rough per-square-metre rate for each?",
        "Roughly how many square metres would you say is typical for a 3-bed house, just so I can get a ballpark figure?",
        "Would it be possible to get a couple of samples sent out before we commit to anything?",
        "That all sounds good — let's get a site visit booked in so you can measure properly.",
      ],
      price_objection: [
        `Hi, roughly how much would ${service!.name.toLowerCase()} cost?`,
        "That's a bit more than I was expecting, is there any flexibility?",
        "Okay, let's go ahead then — I'm flexible on timing, whatever you've got.",
      ],
      escalate: [
        "I am NOT happy. The job you did last week has already come apart and I want my money back.",
        "This isn't good enough — I want to speak to whoever's in charge, not a chatbot. Get someone to call me back today.",
      ],
    };

    const customerTurns = mode === "custom" ? [customPrompt!.trim()] : scriptedCustomerTurns[mode];

    let allQuestions = questionConfig.map((q) => q.question);
    const history: ConversationTurn[] = [];
    const thoughtStream: ThoughtStep[] = [];
    const allAnswers = new Map<string, ExtractedAnswer>();
    let escalationReason: string | null = null;

    try {
      for (const customerMessage of customerTurns) {
        history.push({ role: "user", content: customerMessage });
        const questionsRemaining = allQuestions.filter((q) => !allAnswers.has(q));

        const { reply, extractedAnswers, escalation } = await runQualificationTurn({
          systemPrompt,
          history,
          questionsRemaining,
        });

        history.push({ role: "assistant", content: reply });
        extractedAnswers.forEach((a) => allAnswers.set(a.question, a));
        if (escalation) escalationReason = escalation;

        thoughtStream.push({ customerMessage, aiReply: reply, extractedAnswers, escalation });

        if (escalation) break;
      }
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? `Claude call failed: ${e.message}` : "Claude call failed" },
        { status: 502 }
      );
    }

    const isEscalate = mode === "escalate";
    const isCustom = mode === "custom";
    const isBookable = !isEscalate && !isCustom;
    const bookingDate = isBookable ? nextWeekday() : null;

    const draft: DraftPayload = {
      lead: {
        client_id: clientId,
        name,
        phone,
        channel: "sms",
        category_id: isBookable ? service?.category_id ?? null : null,
        status: isEscalate ? "Qualified" : isCustom ? "Contacted" : "Booked",
        assigned_staff_id: isBookable ? staff!.id : null,
        service_id: isBookable ? service!.id : null,
        price_pence: isBookable ? service!.price_pence : null,
        response_seconds: respSeconds(),
        booking_date: bookingDate,
        booking_time: isBookable ? "10:00" : null,
        booking_source: isBookable ? "simulated" : null,
        notes: isEscalate
          ? `⚠️ High Priority — flagged for manual team takeover (simulated)${escalationReason ? `: ${escalationReason}` : ""}`
          : isCustom
          ? "Custom scenario — simulated single exchange"
          : null,
      },
      messages: history.map((turn) => ({
        sender: turn.role === "user" ? "lead" : "ai",
        body: turn.content,
      })),
      answers: Array.from(allAnswers.values()).map((a) => ({ question: a.question, answer: a.answer })),
      booking: isBookable
        ? {
            client_id: clientId,
            customer_name: name,
            service_id: service!.id,
            price_pence: service!.price_pence,
            staff_id: staff!.id,
            booking_date: bookingDate,
            booking_time: "10:00",
            note: mode === "price_objection" ? "Simulated booking — after price discussion" : "Simulated booking — auto-qualified",
          }
        : null,
    };
    if (isEscalate) {
      draft.messages.push({ sender: "system", body: "Escalated to the team for manual follow-up." });
    }

    if (sandbox) {
      return NextResponse.json({ draft, thoughtStream, mode });
    }

    const leadId = await commitDraft(draft);
    return NextResponse.json({ lead_id: leadId, thoughtStream });
  }

  if (mode === "missed_call_mobile" || mode === "missed_call_landline") {
    // Mirrors the real outcome of app/api/webhooks/twilio/voice-status/route.ts --
    // same real message text and same real buildVoiceOpener() greeting -- without
    // placing an actual Twilio Lookup or outbound call against a fake test number.
    const isLandline = mode === "missed_call_landline";
    const messages: DraftMessage[] = [{ sender: "system", body: "Missed call — no answer." }];

    if (isLandline) {
      const greeting = buildVoiceOpener({ assistantName: client.assistant_name, toneStyle: client.tone_style });
      messages.push({ sender: "system", body: "Outbound AI voice callback placed after a missed call." });
      messages.push({ sender: "ai", body: greeting });
    } else {
      const text = `Hi! Sorry we missed your call at ${client.name}. How can we help with your enquiry today?`;
      messages.push({ sender: "ai", body: text });
    }

    const draft: DraftPayload = {
      lead: {
        client_id: clientId,
        name,
        phone,
        channel: "call",
        status: "New",
        response_seconds: respSeconds(),
      },
      messages,
      answers: [],
      booking: null,
      activity: {
        type: "missed_call_recovery",
        summary: isLandline
          ? "Missed call from a landline; placed an outbound AI voice callback"
          : "Missed call from mobile; sent an instant text",
      },
    };

    const thoughtStream: ThoughtStep[] = [];

    if (sandbox) {
      return NextResponse.json({ draft, thoughtStream, mode });
    }

    const leadId = await commitDraft(draft);
    return NextResponse.json({ lead_id: leadId, thoughtStream });
  }

  // mode === "reschedule" -- not an entity-extraction scenario, keeps a more direct approach.
  const { data: existingBooking } = await supabaseAdmin
    .from("manual_bookings")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sandbox) {
    if (!existingBooking) {
      return NextResponse.json(
        { error: "No existing booking to preview a reschedule against — run Standard Booking once outside Sandbox first." },
        { status: 400 }
      );
    }
    const bookingStaffName = existingBooking.staff_id
      ? (await supabaseAdmin.from("staff").select("name").eq("id", existingBooking.staff_id).single()).data?.name ??
        "our team"
      : "our team";
    const oldDate = existingBooking.booking_date ?? nextWeekday();
    const newDate = nextWeekday(2);

    const draft: DraftPayload = {
      lead: {
        client_id: clientId,
        name,
        phone,
        channel: "sms",
        category_id: null,
        status: "Booked",
        assigned_staff_id: existingBooking.staff_id,
        service_id: existingBooking.service_id,
        price_pence: existingBooking.price_pence,
        response_seconds: respSeconds(),
        booking_date: newDate,
        booking_time: "14:00",
        booking_source: "simulated",
      },
      messages: [
        { sender: "lead", body: `Hi, I need to move my appointment on ${oldDate} if possible.` },
        { sender: "ai", body: "No problem — let me see what's available." },
        { sender: "lead", body: "Ideally later in the week if you've got anything." },
        { sender: "ai", body: `I can offer ${newDate} at 14:00 with ${bookingStaffName} instead, would that work?` },
        { sender: "lead", body: "Yes, that's great, thank you." },
        { sender: "ai", body: `Done — you're now booked for ${newDate} at 14:00 with ${bookingStaffName}.` },
      ],
      answers: [{ question: "Reason", answer: "Requested to reschedule an existing appointment" }],
      booking: null,
      bookingUpdate: {
        id: existingBooking.id,
        booking_date: newDate,
        booking_time: "14:00",
        note: "Rescheduled via simulated request",
      },
    };
    return NextResponse.json({ draft, thoughtStream: [], mode });
  }

  let bookingForReschedule = existingBooking;
  if (!bookingForReschedule) {
    if (!service || !staff) {
      return NextResponse.json(
        {
          error:
            "This business needs at least one service and one staff member configured, and no existing bookings to reschedule against.",
        },
        { status: 400 }
      );
    }
    const { data: created } = await supabaseAdmin
      .from("manual_bookings")
      .insert({
        client_id: clientId,
        customer_name: `Test Lead — ${Math.floor(1000 + Math.random() * 9000)}`,
        service_id: service.id,
        price_pence: service.price_pence,
        staff_id: staff.id,
        booking_date: nextWeekday(),
        booking_time: "10:00",
        note: "Existing booking (auto-created for reschedule demo)",
      })
      .select()
      .single();
    bookingForReschedule = created ?? null;
  }
  if (!bookingForReschedule) return NextResponse.json({ error: "could not find or create a booking to reschedule" }, { status: 500 });

  const bookingStaffName = bookingForReschedule.staff_id
    ? (await supabaseAdmin.from("staff").select("name").eq("id", bookingForReschedule.staff_id).single()).data?.name ??
      staff?.name ??
      "our team"
    : staff?.name ?? "our team";

  const oldDate = bookingForReschedule.booking_date ?? nextWeekday();
  const newDate = nextWeekday(2);

  const { data: lead, error: leadError } = await supabaseAdmin
    .from("leads")
    .insert({
      client_id: clientId,
      name,
      phone,
      channel: "sms",
      category_id: service?.category_id ?? null,
      status: "Booked",
      assigned_staff_id: bookingForReschedule.staff_id,
      service_id: bookingForReschedule.service_id,
      price_pence: bookingForReschedule.price_pence,
      response_seconds: respSeconds(),
      booking_date: newDate,
      booking_time: "14:00",
      booking_source: "simulated",
    })
    .select()
    .single();
  if (leadError || !lead) return NextResponse.json({ error: leadError?.message ?? "insert failed" }, { status: 500 });

  await supabaseAdmin.from("lead_messages").insert(
    [
      { sender: "lead", body: `Hi, I need to move my appointment on ${oldDate} if possible.` },
      { sender: "ai", body: "No problem — let me see what's available." },
      { sender: "lead", body: "Ideally later in the week if you've got anything." },
      { sender: "ai", body: `I can offer ${newDate} at 14:00 with ${bookingStaffName} instead, would that work?` },
      { sender: "lead", body: "Yes, that's great, thank you." },
      { sender: "ai", body: `Done — you're now booked for ${newDate} at 14:00 with ${bookingStaffName}.` },
    ].map((m) => ({ lead_id: lead.id, ...m }))
  );
  await supabaseAdmin.from("lead_answers").insert([
    { lead_id: lead.id, question: "Reason", answer: "Requested to reschedule an existing appointment" },
  ]);

  await supabaseAdmin
    .from("manual_bookings")
    .update({ booking_date: newDate, booking_time: "14:00", note: "Rescheduled via simulated request" })
    .eq("id", bookingForReschedule.id);

  return NextResponse.json({ lead_id: lead.id, thoughtStream: [] });
}

/** Shared by the non-sandbox path here and by /api/leads/simulate/commit. */
export async function commitDraft(draft: DraftPayload): Promise<string> {
  const { data: lead, error: leadError } = await supabaseAdmin.from("leads").insert(draft.lead).select().single();
  if (leadError || !lead) throw new Error(leadError?.message ?? "insert failed");

  if (draft.messages.length > 0) {
    await supabaseAdmin.from("lead_messages").insert(draft.messages.map((m) => ({ lead_id: lead.id, ...m })));
  }
  if (draft.answers.length > 0) {
    await supabaseAdmin.from("lead_answers").insert(draft.answers.map((a) => ({ lead_id: lead.id, ...a })));
  }
  if (draft.booking) {
    await supabaseAdmin.from("manual_bookings").insert(draft.booking);
  }
  if (draft.bookingUpdate) {
    const { id, ...update } = draft.bookingUpdate;
    await supabaseAdmin.from("manual_bookings").update(update).eq("id", id);
  }
  if (draft.activity) {
    await logActivity({ clientId: draft.lead.client_id as string, leadId: lead.id, ...draft.activity });
  }

  return lead.id;
}

function nextWeekday(skipAhead = 1): string {
  const d = new Date();
  let remaining = skipAhead;
  d.setDate(d.getDate() + 1);
  while (remaining > 0) {
    if (d.getDay() !== 0 && d.getDay() !== 6) remaining--;
    if (remaining > 0) d.setDate(d.getDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

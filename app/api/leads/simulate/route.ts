import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";

type Mode = "book" | "escalate" | "price_objection" | "reschedule";
const MODES: Mode[] = ["book", "escalate", "price_objection", "reschedule"];

/**
 * POST /api/leads/simulate
 * Body: { client_id: string, mode: Mode }
 *
 * Writes a real (clearly-labelled test) lead into the real leads table for
 * demo/QA purposes. Runs server-side with the service role because leads has
 * no client-side insert RLS policy by design -- only the webhooks are meant
 * to create leads. This route re-establishes that same guarantee itself by
 * checking the caller is actually a member of the target client before
 * writing anything.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const clientId = body?.client_id as string | undefined;
  const mode = body?.mode as Mode | undefined;

  if (!clientId || !mode || !MODES.includes(mode)) {
    return NextResponse.json({ error: "client_id and a valid mode are required" }, { status: 400 });
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

  const [{ data: services }, { data: staffList }] = await Promise.all([
    supabaseAdmin.from("services").select("*").eq("client_id", clientId),
    supabaseAdmin.from("staff").select("*").eq("client_id", clientId),
  ]);

  const service = services && services.length > 0 ? services[Math.floor(Math.random() * services.length)] : null;
  const staff = staffList && staffList.length > 0 ? staffList[Math.floor(Math.random() * staffList.length)] : null;

  const suffix = Math.floor(1000 + Math.random() * 9000);
  const name = `Test Lead — ${suffix}`;
  const phone = `+4477${Math.floor(10000000 + Math.random() * 89999999)}`;
  const respSeconds = () => Math.floor(8 + Math.random() * 40);

  if (mode === "book" || mode === "price_objection") {
    if (!service || !staff) {
      return NextResponse.json(
        { error: "This business needs at least one service and one staff member configured to simulate a booking." },
        { status: 400 }
      );
    }

    const bookingDate = nextWeekday();
    const priceLabel = `£${(service.price_pence / 100).toFixed(2)}`;

    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .insert({
        client_id: clientId,
        name,
        phone,
        channel: "sms",
        category_id: service.category_id,
        status: "Booked",
        assigned_staff_id: staff.id,
        service_id: service.id,
        price_pence: service.price_pence,
        response_seconds: respSeconds(),
        booking_date: bookingDate,
        booking_time: "10:00",
      })
      .select()
      .single();
    if (leadError || !lead) return NextResponse.json({ error: leadError?.message ?? "insert failed" }, { status: 500 });

    const messages =
      mode === "book"
        ? [
            { sender: "lead", body: `Hi, I'd like to book ${service.name.toLowerCase()}.` },
            { sender: "ai", body: "Happy to help — when were you hoping to come in?" },
            { sender: "lead", body: "Sometime this week if you've got anything, I'm pretty flexible." },
            { sender: "ai", body: `I've got ${bookingDate} at 10:00 with ${staff.name}, does that work?` },
            { sender: "lead", body: "Yes, that's perfect, thank you." },
            { sender: "ai", body: `Great — you're booked in for ${bookingDate} at 10:00 with ${staff.name}.` },
          ]
        : [
            { sender: "lead", body: `Hi, roughly how much would ${service.name.toLowerCase()} cost?` },
            { sender: "ai", body: `That one usually comes to about ${priceLabel}, depending on specifics.` },
            { sender: "lead", body: "That's a bit more than I was expecting, is there any flexibility?" },
            {
              sender: "ai",
              body: "It reflects the time and materials involved, but I can get you booked in and the team can talk through options if there's room to adjust.",
            },
            { sender: "lead", body: "Okay, let's go ahead then." },
            { sender: "ai", body: `Great — you're booked in for ${bookingDate} at 10:00 with ${staff.name}.` },
          ];

    await supabaseAdmin.from("lead_messages").insert(messages.map((m) => ({ lead_id: lead.id, ...m })));
    await supabaseAdmin.from("lead_answers").insert([
      { lead_id: lead.id, question: "Service wanted", answer: service.name },
      {
        lead_id: lead.id,
        question: mode === "book" ? "Preferred time" : "Budget range",
        answer: mode === "book" ? "Flexible" : `Queried price (${priceLabel}), proceeded after clarification`,
      },
    ]);
    await supabaseAdmin.from("manual_bookings").insert({
      client_id: clientId,
      customer_name: name,
      service_id: service.id,
      price_pence: service.price_pence,
      staff_id: staff.id,
      booking_date: bookingDate,
      booking_time: "10:00",
      note: mode === "book" ? "Simulated booking — auto-qualified" : "Simulated booking — after price discussion",
    });

    return NextResponse.json({ lead_id: lead.id });
  }

  if (mode === "escalate") {
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .insert({
        client_id: clientId,
        name,
        phone,
        channel: "sms",
        category_id: service?.category_id ?? null,
        status: "Qualified",
        response_seconds: respSeconds(),
        notes: "⚠️ High Priority — flagged for manual team takeover (simulated)",
      })
      .select()
      .single();
    if (leadError || !lead) return NextResponse.json({ error: leadError?.message ?? "insert failed" }, { status: 500 });

    await supabaseAdmin.from("lead_messages").insert(
      [
        { sender: "lead", body: "Hi, I've got a bit of an unusual one and wasn't sure who to ask." },
        { sender: "ai", body: "No problem — tell me a bit more and I'll make sure it gets to the right person." },
        {
          sender: "lead",
          body: "It's not really a standard job, more of a one-off request that doesn't fit your usual categories.",
        },
        {
          sender: "ai",
          body: "Understood — this sounds like something the team should look at directly rather than me guessing. I'll flag it as a priority for them.",
        },
        { sender: "system", body: "Escalated to the team for manual follow-up." },
      ].map((m) => ({ lead_id: lead.id, ...m }))
    );
    await supabaseAdmin.from("lead_answers").insert([
      { lead_id: lead.id, question: "Reason", answer: "Custom/edge-case request needing direct team input" },
    ]);

    return NextResponse.json({ lead_id: lead.id });
  }

  // mode === "reschedule"
  let { data: existingBooking } = await supabaseAdmin
    .from("manual_bookings")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existingBooking) {
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
    existingBooking = created ?? null;
  }
  if (!existingBooking) return NextResponse.json({ error: "could not find or create a booking to reschedule" }, { status: 500 });

  const bookingStaffName = existingBooking.staff_id
    ? (await supabaseAdmin.from("staff").select("name").eq("id", existingBooking.staff_id).single()).data?.name ??
      staff?.name ??
      "our team"
    : staff?.name ?? "our team";

  const oldDate = existingBooking.booking_date ?? nextWeekday();
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
      assigned_staff_id: existingBooking.staff_id,
      service_id: existingBooking.service_id,
      price_pence: existingBooking.price_pence,
      response_seconds: respSeconds(),
      booking_date: newDate,
      booking_time: "14:00",
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
    .eq("id", existingBooking.id);

  return NextResponse.json({ lead_id: lead.id });
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

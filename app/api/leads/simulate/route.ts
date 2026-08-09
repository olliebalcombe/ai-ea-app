import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/leads/simulate
 * Body: { client_id: string, mode: "book" | "escalate" }
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
  const mode = body?.mode as "book" | "escalate" | undefined;

  if (!clientId || !mode || !["book", "escalate"].includes(mode)) {
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

  if (mode === "book") {
    if (!service || !staff) {
      return NextResponse.json(
        { error: "This business needs at least one service and one staff member configured to simulate a booking." },
        { status: 400 }
      );
    }

    const bookingDate = nextWeekday();

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
        response_seconds: Math.floor(8 + Math.random() * 40),
        booking_date: bookingDate,
        booking_time: "10:00",
      })
      .select()
      .single();
    if (leadError || !lead) return NextResponse.json({ error: leadError?.message ?? "insert failed" }, { status: 500 });

    await supabaseAdmin.from("lead_messages").insert([
      { lead_id: lead.id, sender: "lead", body: `Hi, I'd like to book ${service.name.toLowerCase()}.` },
      {
        lead_id: lead.id,
        sender: "ai",
        body: `Great — I've got you booked in for ${bookingDate} at 10:00 with ${staff.name}.`,
      },
    ]);
    await supabaseAdmin.from("lead_answers").insert([
      { lead_id: lead.id, question: "Service wanted", answer: service.name },
      { lead_id: lead.id, question: "Preferred time", answer: "Flexible" },
    ]);
    await supabaseAdmin.from("manual_bookings").insert({
      client_id: clientId,
      customer_name: name,
      service_id: service.id,
      price_pence: service.price_pence,
      staff_id: staff.id,
      booking_date: bookingDate,
      booking_time: "10:00",
      note: "Simulated booking — auto-qualified",
    });

    return NextResponse.json({ lead_id: lead.id });
  }

  // mode === "escalate"
  const { data: lead, error: leadError } = await supabaseAdmin
    .from("leads")
    .insert({
      client_id: clientId,
      name,
      phone,
      channel: "sms",
      category_id: service?.category_id ?? null,
      status: "Qualified",
      response_seconds: Math.floor(8 + Math.random() * 40),
      notes: "⚠️ High Priority — flagged for manual team takeover (simulated)",
    })
    .select()
    .single();
  if (leadError || !lead) return NextResponse.json({ error: leadError?.message ?? "insert failed" }, { status: 500 });

  await supabaseAdmin.from("lead_messages").insert([
    { lead_id: lead.id, sender: "lead", body: "This is a bit of an unusual situation, can someone call me directly?" },
    { lead_id: lead.id, sender: "system", body: "Escalated to the team for manual follow-up." },
  ]);
  await supabaseAdmin.from("lead_answers").insert([
    { lead_id: lead.id, question: "Reason", answer: "Needs a direct conversation with the team" },
  ]);

  return NextResponse.json({ lead_id: lead.id });
}

function nextWeekday(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";
import { makeCall } from "@/lib/twilio";

function escapeXml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * POST /api/voice/test-call
 * Body: { client_id }
 *
 * Real outbound Twilio call to the business's own configured contact_phone,
 * speaking a real line in the client's chosen built-in voice -- confirms the
 * voice setup actually works, same real credentials already on file.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const clientId = body?.client_id as string | undefined;
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

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

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("name, assistant_name, voice_style, contact_phone")
    .eq("id", clientId)
    .single();
  if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });
  if (!client.contact_phone) {
    return NextResponse.json(
      { error: "No contact phone configured — add one in Settings first." },
      { status: 400 }
    );
  }

  const message = `Hi, this is a test call from your assistant setup for ${client.name}. If you can hear this clearly in ${
    client.assistant_name
  }'s voice, your voice configuration is working.`;
  const twiml = `<Response><Say voice="${client.voice_style}">${escapeXml(message)}</Say></Response>`;

  try {
    await makeCall({ to: client.contact_phone, twiml });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? `Call failed: ${e.message}` : "Call failed" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, calledNumber: client.contact_phone });
}

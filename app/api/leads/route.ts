import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/leads?client_id=...
 * Returns every lead for a client, most recent first -- this is what the
 * dashboard's Lead Queue view fetches from. Add auth/session checks here
 * before going live so a client can only ever request their own client_id.
 */
export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("*, lead_answers(*), staff:assigned_staff_id(name), services:service_id(name, price_pence)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data });
}

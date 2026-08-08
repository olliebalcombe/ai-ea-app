import { NextRequest, NextResponse } from "next/server";
import { sendNotificationForEvent, NotificationEvent } from "@/lib/notifications";

/**
 * POST /api/notifications/send
 * Body: { client_id, lead_id?, event, extra?, is_urgent? }
 * A thin manually-callable wrapper around sendNotificationForEvent. The
 * webhook routes already call this logic directly on capture/booking; this
 * endpoint exists for the daily digest (call it from a scheduled cron job)
 * and for manual testing during setup.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const event = body.event as NotificationEvent;
  if (!body.client_id || !event) return NextResponse.json({ error: "client_id and event are required" }, { status: 400 });

  const result = await sendNotificationForEvent({
    clientId: body.client_id, leadId: body.lead_id, event, extra: body.extra, isUrgent: body.is_urgent,
  });
  return NextResponse.json(result);
}

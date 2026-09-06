# AI EA — starter codebase

The real backend foundation for the AI EA product: a multi-tenant Next.js app
with a Supabase database, Twilio call/SMS handling, email handling,
Claude-powered qualification conversations, real availability-aware booking,
outbound notifications, and authenticated multi-tenant access via Row Level
Security.

## What's built here

**Data & schema** (`supabase/schema.sql`)
- Multi-tenant tables (clients, staff, categories, services, leads, messages,
  answers, manual bookings, notification preferences), every row scoped by
  `client_id`
- `scheduling_rules` — soft-constraint scheduling (e.g. "no bookings Tuesday
  mornings"), plus `buffer_minutes` and business hours per client
- `client_users` — maps a Supabase Auth user to the business/es they can
  access, with a `role` (owner/staff)
- Full **Row Level Security** policies on every client-scoped table, driven
  by an `is_client_member()` helper function — a logged-in user can only ever
  see rows for a client they're mapped to

**Conversation logic**
- `lib/prompts.ts` — vertical tone rules, natural question phrasing, and the
  sensitive-topic escalation rule (never a casual acknowledgment after bad
  news; flags anything suggesting a genuine emergency)
- `lib/anthropic.ts` — the Claude qualification-turn function, using tool
  calling for reliable structured extraction and an explicit escalation flag

**Channels**
- `app/api/webhooks/twilio/voice/route.ts` — inbound call → lead created →
  instant text-back
- `app/api/webhooks/twilio/sms/route.ts` — the full SMS qualification loop,
  now firing a real "new lead" notification on capture and an urgent one on
  escalation
- `app/api/webhooks/email/route.ts` — the same loop, adapted for email tone

**Booking** (`lib/scheduling.ts`, `app/api/leads/[id]/book/route.ts`)
- `getAvailableSlots()` computes real next-available slots per staff member,
  respecting business hours, `buffer_minutes` between bookings, and any
  `scheduling_rules` for that day
- `GET /api/leads/:id/book?staff_id=...` — returns slots to offer during a
  Tier 2 qualification conversation
- `POST /api/leads/:id/book` — re-validates the slot is still free (guards
  against a double-booking race), confirms it, and fires the "booked"
  notification

**Notifications** (`lib/notifications.ts`, `app/api/notifications/send/route.ts`)
- Reads each client's real `notification_prefs` and sends through every
  enabled channel for that event type
- Respects quiet hours, with an `isUrgent` bypass for escalations
- SMS and email are wired; WhatsApp and push are explicitly stubbed
  (`TODO`s in the code) pending the Horizon 2 integrations

**Auth**
- `lib/supabaseClient.ts` — the browser-side Supabase client (anon key) the
  dashboard UI should use, as opposed to `lib/supabase.ts` (service role key,
  server-only)
- `GET /api/auth/session` — returns the logged-in user's accessible
  business(es) via `client_users`, replacing the hardcoded `CLIENTS` array
  the UI prototypes used

## What's still not built — honestly

- WhatsApp and push notification delivery (stubbed, not connected)
- A scheduled job actually calling `/api/notifications/send` for the daily
  digest (needs a cron trigger — Vercel Cron or similar)
- Payments/deposits, voice AI, and the rest of the Horizon 2/3 roadmap

## Setup

1. `npm install`
2. Create a Supabase project, run `supabase/schema.sql` in its SQL editor
3. Copy `.env.example` to `.env.local` and fill in every key (Supabase URL +
   anon key + service role key, Anthropic, Twilio, Resend)
4. Buy a Twilio number, point its voice and SMS webhooks at your deployed
   `/api/webhooks/twilio/voice` and `/api/webhooks/twilio/sms`
5. Insert a test client row manually (set `twilio_number` and
   `contact_phone`/`contact_email` to real values), and a `client_users` row
   linking your own Supabase Auth user to it once you've signed up
6. `npm run dev` locally (webhooks need a public URL to test against Twilio —
   use ngrok or deploy to Vercel)

## Suggested next steps for Claude Code

1. Port the dashboard prototypes into real components, reading from
   `/api/auth/session` and the leads/booking/notification endpoints instead
   of hardcoded arrays
2. Wire a scheduled job for the daily digest notification
3. Add the WhatsApp Business API integration
4. Deploy, then work through the pre-launch testing checklist before
   onboarding a real first client

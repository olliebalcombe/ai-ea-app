-- Morning Briefing refactor: flooring domain intelligence, activity log,
-- leakage-detection approval queue, and Take Over Conversation.

-- Structured flooring fields, filled in by the AI's real extraction (see
-- lib/anthropic.ts's optional structured tool schema) when a client's
-- vertical is 'Flooring'. Nullable/free-form since not every field gets
-- learned in every conversation.
alter table leads add column if not exists room_type text;
alter table leads add column if not exists flooring_type text;
alter table leads add column if not exists area_sqm numeric;
alter table leads add column if not exists postcode text;
alter table leads add column if not exists budget_fit text;
alter table leads add column if not exists install_timeline text;
alter table leads add column if not exists buying_intent text;
alter table leads add column if not exists discount_requested boolean not null default false;

-- Take Over Conversation: when true, inbound webhooks store the message and
-- notify staff but skip the Claude call and AI reply entirely.
alter table leads add column if not exists ai_paused boolean not null default false;

-- Customer portal: set when a customer approves their quote via /portal/[id].
alter table leads add column if not exists quote_approved_at timestamptz;

-- Flooring becomes its own first-class vertical rather than being lumped
-- into generic 'Tradie', so the structured extraction schema above can be
-- gated on `vertical = 'Flooring'` specifically.
update clients set vertical = 'Flooring' where name = 'Bracewell Flooring';

-- Business Rules reuses knowledge_base_entries with a new category, given a
-- distinctly imperative prompt framing in lib/prompts.ts (never violate,
-- rather than the softer "draw on when relevant" framing the others get).
alter table knowledge_base_entries drop constraint if exists knowledge_base_entries_category_check;
alter table knowledge_base_entries add constraint knowledge_base_entries_category_check
  check (category in ('pricing_rule', 'faq', 'service_area', 'team_specialty', 'business_rule'));

-- Single source of truth for both the Dashboard's rich activity feed and the
-- dedicated Assistant Activity page -- server-write-only (service role),
-- same pattern as lead_messages.
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  type text not null,
  summary text not null,
  created_at timestamptz default now()
);
alter table activity_log enable row level security;
create policy "member can view their activity" on activity_log for select using (is_client_member(client_id));

-- Leakage-detection / Approval Queue items. Approve/dismiss are direct
-- client updates (RLS-permitted); actually sending a suggested message goes
-- through a server route that also writes to activity_log.
create table lead_suggestions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  type text not null,
  reason text not null,
  suggested_message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'dismissed')),
  created_at timestamptz default now(),
  resolved_at timestamptz
);
alter table lead_suggestions enable row level security;
create policy "member can manage their suggestions" on lead_suggestions for all using (is_client_member(client_id));

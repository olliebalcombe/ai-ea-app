-- One structured summary per lead, covering every channel that lead's
-- conversation has touched (voice, SMS, email, WhatsApp once it exists) --
-- lead_id is the primary key, so "one row per lead" is enforced by the
-- schema itself, not just convention. This is what lets a customer call
-- Friday and text Saturday without the AI starting over: the live prompt-
-- building flow (see lib/prompts.ts's buildSystemPrompt) can read this
-- instead of replaying the full lead_messages history every turn.
--
-- Fields are deliberately free text, not enums -- Claude is what writes
-- them (see lib/conversationSummary.ts), and natural-language summaries
-- ("wants a quote by Friday, price-sensitive") are more useful to both the
-- next prompt and a human skimming the Inbox than a forced enum would be.

create table conversation_summaries (
  lead_id uuid primary key references leads(id) on delete cascade,
  stated_needs text,
  budget_signal text,
  urgency_signal text,
  quote_given text,
  objections_raised text,
  next_action text,
  updated_at timestamptz default now()
);

alter table conversation_summaries enable row level security;

create policy "member can view their conversation summaries" on conversation_summaries for select using (
  is_client_member((select client_id from leads where leads.id = conversation_summaries.lead_id))
);

-- Server-write-only (service role), same pattern as lead_messages/activity_log --
-- there's no client-side insert/update policy because only the AI turn
-- pipeline (via supabaseAdmin) ever writes this, never a browser session.

drop trigger if exists set_conversation_summaries_updated_at on conversation_summaries;
create trigger set_conversation_summaries_updated_at
  before update on conversation_summaries
  for each row execute function set_updated_at();

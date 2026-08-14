-- Mission Control round: real Twilio built-in voice persona, calendar OAuth
-- connection storage (Google/Outlook), and missed-call recovery logging.

-- Twilio Polly voice name (e.g. 'Polly.Amy' / 'Polly.Brian') -- genuinely
-- changes the synthesized <Say> voice today, no new provider needed.
alter table clients add column if not exists voice_style text not null default 'Polly.Amy';

-- OAuth tokens for a connected external calendar. RLS-gated like every
-- other client-scoped table; the app itself only ever selects
-- provider/connected_email/expires_at client-side, never the token columns,
-- even though RLS would technically allow it.
create table calendar_connections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  provider text not null check (provider in ('google', 'outlook')),
  connected_email text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz default now(),
  unique (client_id, provider)
);
alter table calendar_connections enable row level security;
create policy "member can manage their calendar connections" on calendar_connections for all using (is_client_member(client_id));

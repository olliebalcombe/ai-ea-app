-- AI EA -- core database schema
-- Run this in the Supabase SQL editor to set up the multi-tenant data model.
-- Every table that holds client-specific data carries a client_id, which is how
-- one platform/hosting bill serves every business with fully isolated data.

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vertical text not null,
  assistant_name text not null default 'Alex',
  contact_email text,
  twilio_number text,
  brand_logo_url text,
  brand_color text,
  created_at timestamptz default now()
);

create table staff (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  name text not null,
  role text,
  created_at timestamptz default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  name text not null
);

create table services (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  name text not null,
  price_pence integer not null default 0,
  created_at timestamptz default now()
);

create table qualifying_questions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  question text not null,
  display_order integer default 0
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  name text,
  phone text,
  email text,
  channel text not null,
  category_id uuid references categories(id),
  status text not null default 'New',
  assigned_staff_id uuid references staff(id),
  service_id uuid references services(id),
  price_pence integer,
  response_seconds integer,
  lost_reason text,
  booking_date date,
  booking_time text,
  created_at timestamptz default now()
);

create table lead_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  sender text not null,
  body text not null,
  created_at timestamptz default now()
);

create table lead_answers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  question text not null,
  answer text not null
);

create table manual_bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  customer_name text not null,
  service_id uuid references services(id),
  price_pence integer not null default 0,
  staff_id uuid references staff(id),
  booking_date date,
  booking_time text,
  note text,
  created_at timestamptz default now()
);

create table notification_prefs (
  client_id uuid primary key references clients(id) on delete cascade,
  sms_enabled boolean default true,
  whatsapp_enabled boolean default false,
  email_enabled boolean default true,
  push_enabled boolean default true,
  notify_new_lead boolean default true,
  notify_booked boolean default true,
  notify_lost boolean default false,
  notify_daily_digest boolean default false,
  quiet_hours_start time default '20:00',
  quiet_hours_end time default '08:00'
);

-- Row Level Security: enable and scope every table by client_id once auth is wired up,
-- so a logged-in client can only ever see their own rows. Example for `leads`:
-- alter table leads enable row level security;
-- create policy "clients see only their own leads" on leads
--   for select using (client_id = auth.jwt() ->> 'client_id');

-- ============================================================
-- Extensions added: scheduling rules, auth mapping, RLS policies
-- ============================================================

alter table clients add column if not exists buffer_minutes integer not null default 15;
alter table clients add column if not exists business_hours_start time not null default '09:00';
alter table clients add column if not exists business_hours_end time not null default '17:30';
alter table leads add column if not exists notes text;
alter table clients add column if not exists contact_phone text;

-- Soft-constraint scheduling rules, e.g. "no bookings Tuesday mornings",
-- "block 30 minutes after any offsite visit". day_of_week: 0=Sunday..6=Saturday, null = every day.
create table scheduling_rules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  label text not null,
  day_of_week integer,
  blocked_start_time time not null,
  blocked_end_time time not null,
  created_at timestamptz default now()
);

-- Maps a Supabase Auth user to the client(s) they're allowed to access.
-- A user with two rows here (e.g. an agency staff member) can see multiple clients.
create table client_users (
  user_id uuid references auth.users(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  role text not null default 'owner', -- 'owner' | 'staff'
  primary key (user_id, client_id)
);

-- Helper used by every RLS policy below: is the current authenticated user
-- allowed to see rows belonging to this client_id?
create or replace function is_client_member(target_client_id uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from client_users
    where client_users.client_id = target_client_id
      and client_users.user_id = auth.uid()
  );
$$;

-- Row Level Security: every client-scoped table is locked down so a logged-in
-- user can only ever see rows for a client they're mapped to in client_users.
alter table clients enable row level security;
alter table staff enable row level security;
alter table categories enable row level security;
alter table services enable row level security;
alter table qualifying_questions enable row level security;
alter table leads enable row level security;
alter table lead_messages enable row level security;
alter table lead_answers enable row level security;
alter table notification_prefs enable row level security;
alter table scheduling_rules enable row level security;

create policy "member can view their client" on clients for select using (is_client_member(id));
create policy "member can view their staff" on staff for select using (is_client_member(client_id));
create policy "member can view their categories" on categories for select using (is_client_member(client_id));
create policy "member can manage their services" on services for all using (is_client_member(client_id));
create policy "member can manage their questions" on qualifying_questions for all using (is_client_member(client_id));
create policy "member can view their leads" on leads for select using (is_client_member(client_id));
create policy "member can update their leads" on leads for update using (is_client_member(client_id));
create policy "member can view their lead messages" on lead_messages for select using (
  is_client_member((select client_id from leads where leads.id = lead_messages.lead_id))
);
create policy "member can view their lead answers" on lead_answers for select using (
  is_client_member((select client_id from leads where leads.id = lead_answers.lead_id))
);
create policy "member can manage their notification prefs" on notification_prefs for all using (is_client_member(client_id));
create policy "member can manage their scheduling rules" on scheduling_rules for all using (is_client_member(client_id));

-- Note: webhook routes (Twilio/email) run server-side with the service role key,
-- which bypasses RLS entirely — that's expected and correct, since there's no
-- logged-in user in that context, only the dashboard/API routes a client's own
-- browser session calls need RLS enforcement.

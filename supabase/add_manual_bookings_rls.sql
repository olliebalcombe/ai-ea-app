-- manual_bookings exists in schema.sql but was never given RLS, unlike every
-- other "manage your own business" table (services, scheduling_rules, etc.)
-- Run this in the Supabase SQL Editor after schema.sql.

alter table manual_bookings enable row level security;

create policy "member can manage their manual bookings" on manual_bookings for all using (is_client_member(client_id));

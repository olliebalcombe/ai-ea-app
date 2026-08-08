-- Existing RLS gives client members full CRUD on "manage your own business
-- config" tables (services, qualifying_questions, notification_prefs,
-- scheduling_rules) but only left staff/categories as select-only -- that
-- looks like an oversight, since the dashboard's Settings section needs to
-- let an owner manage their own team and service categories the same way.
-- Run this in the Supabase SQL Editor after schema.sql/seed.sql.

drop policy "member can view their staff" on staff;
create policy "member can manage their staff" on staff for all using (is_client_member(client_id));

drop policy "member can view their categories" on categories;
create policy "member can manage their categories" on categories for all using (is_client_member(client_id));

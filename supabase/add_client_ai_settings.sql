-- Adds per-client AI tone/personalization controls, and (since clients
-- previously had no update policy at all -- select only) a policy letting a
-- client member update their own business row so the new Settings > AI
-- Settings page can actually save these fields.

alter table clients add column if not exists tone_style text not null default 'calm_direct'
  check (tone_style in ('calm_direct', 'warm_friendly', 'formal_executive'));
alter table clients add column if not exists business_nuances text;

create policy "member can update their client" on clients for update using (is_client_member(id));

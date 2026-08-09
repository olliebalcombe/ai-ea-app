-- leads had no updated_at column -- needed so "recently booked/escalated"
-- can be genuinely sorted by recency (e.g. the Live Activity ticker, the
-- Action Required banner) instead of guessed from created_at alone.

alter table leads add column if not exists updated_at timestamptz default now();

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_leads_updated_at on leads;
create trigger set_leads_updated_at
  before update on leads
  for each row execute function set_updated_at();

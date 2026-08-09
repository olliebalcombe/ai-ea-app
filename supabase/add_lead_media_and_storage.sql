-- Site photo attachments (dashboard-uploaded, real Claude Vision analysis).
-- Storage objects are stored under {client_id}/{lead_id}/{filename} so the
-- same is_client_member() gate used everywhere else can scope access via
-- storage.foldername(name). The bucket is private -- images are viewed via
-- short-lived signed URLs generated at render time, not public links.

create table lead_media (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  path text not null,
  ai_summary text,
  created_at timestamptz default now()
);

alter table lead_media enable row level security;

create policy "member can manage their lead media" on lead_media for all using (
  is_client_member((select client_id from leads where leads.id = lead_media.lead_id))
);

insert into storage.buckets (id, name, public)
values ('lead-media', 'lead-media', false)
on conflict (id) do nothing;

create policy "member can upload lead media" on storage.objects for insert
  with check (bucket_id = 'lead-media' and is_client_member((storage.foldername(name))[1]::uuid));

create policy "member can view lead media" on storage.objects for select
  using (bucket_id = 'lead-media' and is_client_member((storage.foldername(name))[1]::uuid));

create policy "member can delete lead media" on storage.objects for delete
  using (bucket_id = 'lead-media' and is_client_member((storage.foldername(name))[1]::uuid));

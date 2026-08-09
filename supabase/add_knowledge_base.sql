-- Structured knowledge base (pricing rules, FAQs, service areas, team
-- specialties) that gets injected directly into the live qualification
-- prompt (see lib/prompts.ts's buildSystemPrompt) -- not vector-embedding
-- RAG, just real, direct context injection, which is the right scale for a
-- small business's knowledge base.

create table knowledge_base_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  category text not null check (category in ('pricing_rule', 'faq', 'service_area', 'team_specialty')),
  title text not null,
  content text not null,
  created_at timestamptz default now()
);

alter table knowledge_base_entries enable row level security;

create policy "member can manage their knowledge base" on knowledge_base_entries for all using (is_client_member(client_id));

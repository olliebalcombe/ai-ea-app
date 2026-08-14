-- Qualifying Questions was previously cosmetic: the real conversation pipeline
-- read a hardcoded, vertical-keyed DEFAULT_QUESTIONS constant instead of this
-- per-client table, so editing a question here had zero effect on what the AI
-- actually asked. This adds the columns the real wiring needs: how the
-- assistant should actually phrase the question, whether it's mandatory
-- before a lead counts as fully qualified, and an optional follow-up rule.

alter table qualifying_questions
  add column if not exists ai_phrasing text,
  add column if not exists mandatory boolean not null default true,
  add column if not exists follow_up_rule text;

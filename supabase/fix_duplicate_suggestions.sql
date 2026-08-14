-- The leakage evaluator's old "check for an existing pending row, then
-- insert" logic had a real race: React 18 dev-mode double-invokes effects,
-- and repeated page loads over a testing session each ran their own check
-- before any prior insert had landed, so duplicate pending suggestions
-- accumulated for the same (lead_id, type). This cleans up what's already
-- there and makes duplicates structurally impossible going forward.

-- Keep only the earliest pending suggestion per (lead_id, type).
with ranked as (
  select id, row_number() over (partition by lead_id, type, status order by created_at, id) as rn
  from lead_suggestions
  where status = 'pending'
)
delete from lead_suggestions where id in (select id from ranked where rn > 1);

-- A resolved suggestion (approved/dismissed) doesn't block a fresh future
-- occurrence of the same lead/type, so this is scoped to pending rows only.
create unique index if not exists lead_suggestions_pending_unique
  on lead_suggestions (lead_id, type)
  where status = 'pending';

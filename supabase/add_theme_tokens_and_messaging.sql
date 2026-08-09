-- Design Studio: persisted per-client theme token overrides (glow, blur, border, font scale, gradient, accent).
-- Applied client-side via CSS custom properties; no RLS change needed since `clients` already has an
-- update policy scoped to is_client_member(id) from an earlier migration.
alter table clients add column if not exists theme_tokens jsonb;

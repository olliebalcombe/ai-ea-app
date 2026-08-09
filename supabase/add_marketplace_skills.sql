-- AI Plugin & Capability Hub: real, per-client toggles for the AI's skills.
-- No new RLS needed -- `clients` already has an update policy scoped to is_client_member(id).
alter table clients add column if not exists enabled_skills text[] not null default '{}';
alter table clients add column if not exists google_review_link text;

-- Vision Site Inspector, WhatsApp Ballpark Estimator, and Voice AI Receptionist all gate
-- behavior that was previously unconditional -- back-fill them as enabled so existing
-- clients don't silently lose a feature they already had. Calendar Auto-Rescheduler and
-- Google Reviews Booster are genuinely new automations, so they stay opt-in (default off).
update clients set enabled_skills = array['vision_site_inspector','whatsapp_ballpark_estimator','voice_ai_receptionist']
where enabled_skills = '{}';

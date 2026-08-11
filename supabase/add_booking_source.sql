-- Honest booking provenance: replaces the Bookings page's previous guess
-- (any `leads` row = "AI EA", anything in manual_bookings = "Manual") with
-- what actually happened. No tool in lib/anthropic.ts lets the AI
-- autonomously confirm a booking mid-conversation, so 'staff' / 'customer_portal'
-- / 'simulated' reflects who really clicked confirm, set at each real write site.
alter table leads add column if not exists booking_source text;

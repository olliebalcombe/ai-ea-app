-- Seed data matching the demo prototypes exactly, so the moment this is
-- deployed, the real database has the same four businesses, staff, and
-- services you've already been looking at throughout the design phase.
-- Run this AFTER schema.sql, in the Supabase SQL editor.

-- ============ Bracewell Flooring (Tradie) ============
do $$
declare
  v_client_id uuid;
begin
  insert into clients (name, vertical, assistant_name, contact_email, buffer_minutes)
  values ('Bracewell Flooring', 'Tradie', 'Jack', 'hello@bracewellflooring.co.uk', 15)
  returning id into v_client_id;

  insert into staff (client_id, name, role) values
    (v_client_id, 'Tom Bracewell', null),
    (v_client_id, 'Dave Reyes', null);

  insert into categories (client_id, name) values
    (v_client_id, 'Flooring'),
    (v_client_id, 'Plumbing'),
    (v_client_id, 'Electrical'),
    (v_client_id, 'Roofing');

  insert into services (client_id, category_id, name, price_pence)
  select v_client_id, c.id, v.name, v.price
  from categories c
  join (values
    ('Flooring', 'Vinyl Floor Fitting', 120000),
    ('Flooring', 'Carpet Fitting', 60000),
    ('Plumbing', 'Leak Repair', 15000),
    ('Plumbing', 'Tap Replacement', 12000),
    ('Electrical', 'Rewire (per room)', 45000),
    ('Roofing', 'Roof Tile Repair', 35000)
  ) as v(cat, name, price) on c.name = v.cat
  where c.client_id = v_client_id;

  insert into qualifying_questions (client_id, question, display_order) values
    (v_client_id, 'Job type', 1),
    (v_client_id, 'Location', 2),
    (v_client_id, 'Urgency', 3),
    (v_client_id, 'Budget range', 4);

  insert into notification_prefs (client_id, sms_enabled, whatsapp_enabled, email_enabled, notify_new_lead, notify_booked)
  values (v_client_id, true, false, true, true, true);
end $$;

-- ============ Clarke & Hart Solicitors (Law Firm) ============
do $$
declare
  v_client_id uuid;
begin
  insert into clients (name, vertical, assistant_name, contact_email, buffer_minutes)
  values ('Clarke & Hart Solicitors', 'Law Firm', 'Eleanor', 'enquiries@clarkehart.co.uk', 15)
  returning id into v_client_id;

  insert into staff (client_id, name) values
    (v_client_id, 'S. Clarke'),
    (v_client_id, 'M. Hart'),
    (v_client_id, 'J. Iqbal');

  insert into categories (client_id, name) values
    (v_client_id, 'Personal Injury'),
    (v_client_id, 'Family'),
    (v_client_id, 'Employment'),
    (v_client_id, 'Immigration');

  insert into services (client_id, category_id, name, price_pence)
  select v_client_id, c.id, v.name, v.price
  from categories c
  join (values
    ('Personal Injury', 'Personal Injury Consultation', 15000),
    ('Family', 'Family Law Consultation', 20000),
    ('Employment', 'Employment Consultation', 18000),
    ('Immigration', 'Immigration Consultation', 22000)
  ) as v(cat, name, price) on c.name = v.cat
  where c.client_id = v_client_id;

  insert into qualifying_questions (client_id, question, display_order) values
    (v_client_id, 'Case type', 1),
    (v_client_id, 'Date of incident', 2),
    (v_client_id, 'Injury?', 3),
    (v_client_id, 'Represented already?', 4);

  insert into notification_prefs (client_id, sms_enabled, whatsapp_enabled, email_enabled, notify_new_lead, notify_booked, notify_lost)
  values (v_client_id, false, false, true, true, true, true);
end $$;

-- ============ Radiance Hair Studio (Clinic) ============
do $$
declare
  v_client_id uuid;
begin
  insert into clients (name, vertical, assistant_name, contact_email, buffer_minutes)
  values ('Radiance Hair Studio', 'Clinic', 'Ava', 'book@radiancehair.co.uk', 15)
  returning id into v_client_id;

  insert into staff (client_id, name, role) values
    (v_client_id, 'Priya', 'Senior Stylist'),
    (v_client_id, 'Jordan', 'Colour Specialist'),
    (v_client_id, 'Sam', 'Junior Stylist');

  insert into categories (client_id, name) values
    (v_client_id, 'Colour'),
    (v_client_id, 'Cut & Style'),
    (v_client_id, 'Extensions'),
    (v_client_id, 'Treatment');

  insert into services (client_id, category_id, name, price_pence)
  select v_client_id, c.id, v.name, v.price
  from categories c
  join (values
    ('Colour', 'Full Head Colour', 12000),
    ('Colour', 'Balayage', 15000),
    ('Cut & Style', 'Cut & Blow Dry', 4500),
    ('Cut & Style', 'Fringe Trim', 1500),
    ('Extensions', 'Tape-In Extensions', 22000),
    ('Treatment', 'Keratin Treatment', 8000)
  ) as v(cat, name, price) on c.name = v.cat
  where c.client_id = v_client_id;

  insert into qualifying_questions (client_id, question, display_order) values
    (v_client_id, 'Service wanted', 1),
    (v_client_id, 'Preferred time', 2),
    (v_client_id, 'New or returning client?', 3);

  insert into notification_prefs (client_id, sms_enabled, whatsapp_enabled, email_enabled, notify_new_lead, notify_booked)
  values (v_client_id, false, true, false, true, true);
end $$;

-- ============ Okafor Estates (Estate Agent) ============
do $$
declare
  v_client_id uuid;
begin
  insert into clients (name, vertical, assistant_name, contact_email, buffer_minutes)
  values ('Okafor Estates', 'Estate Agent', 'Marcus', 'info@okaforestates.co.uk', 15)
  returning id into v_client_id;

  insert into staff (client_id, name) values
    (v_client_id, 'D. Okafor'),
    (v_client_id, 'L. Chen');

  insert into categories (client_id, name) values
    (v_client_id, 'Sales'),
    (v_client_id, 'Lettings'),
    (v_client_id, 'Commercial');

  insert into services (client_id, category_id, name, price_pence)
  select v_client_id, c.id, v.name, v.price
  from categories c
  join (values
    ('Sales', 'Property Valuation', 0),
    ('Sales', 'Sales Instruction Fee', 150000),
    ('Lettings', 'Letting Management Setup', 30000),
    ('Commercial', 'Commercial Appraisal', 50000)
  ) as v(cat, name, price) on c.name = v.cat
  where c.client_id = v_client_id;

  insert into qualifying_questions (client_id, question, display_order) values
    (v_client_id, 'Property of interest', 1),
    (v_client_id, 'Timeline', 2),
    (v_client_id, 'Financing status', 3);

  insert into notification_prefs (client_id, sms_enabled, whatsapp_enabled, email_enabled, notify_new_lead, notify_booked, notify_lost)
  values (v_client_id, true, true, false, true, true, true);
end $$;

-- Note: after running this, go to each client's row in the Supabase table
-- editor and fill in twilio_number and contact_phone once you've bought
-- real numbers — those are intentionally left blank here since they're
-- account-specific, not seedable data.

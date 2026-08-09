#!/usr/bin/env node
// One-time demo data seed: ~50 leads spread across the last 90 days (with
// varied statuses, channels, revenue, staff, and multi-turn message
// transcripts) plus a batch of manual_bookings, so the dashboard's charts,
// reports, and calendar have something real to show. Run from the repo root:
//   node scripts/seed-demo-data.mjs
// Uses the service-role key (bypasses RLS), same as the webhooks and the
// Simulate Lead API route -- this is a server-side operational script, not
// part of the deployed app.

process.loadEnvFile(".env.local");

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supabase = createClient(url, key);

const TOTAL_LEADS = 50;
const DAYS_BACK = 90;

const FIRST_NAMES = [
  "Karen", "Tom", "Priya", "Hannah", "David", "Sarah", "James", "Emma", "Michael", "Sophie",
  "Daniel", "Grace", "Ryan", "Olivia", "Liam", "Chloe", "Jack", "Amelia", "Noah", "Isla",
  "Oscar", "Freya", "Leo", "Ruby", "Harry", "Ella", "George", "Mia", "Charlie", "Lily",
];
const LAST_NAMES = [
  "Wills", "Bracewell", "Nair", "Turner", "Clarke", "Ahmed", "Silva", "Novak", "Osei", "Patel",
  "Chen", "Okafor", "Reyes", "Iqbal", "Hart", "Adeyemi", "Wilson", "Brown", "Taylor", "Evans",
];
const LOST_REASONS = ["Went with a competitor", "Price too high", "No response", "Bad timing", "Booked elsewhere"];
const STATUS_POOL = [
  "New", "New", "New",
  "Contacted", "Contacted", "Contacted",
  "Qualified", "Qualified", "Qualified",
  "Booked", "Booked", "Booked", "Booked",
  "Won", "Won", "Won", "Won",
  "Lost", "Lost", "Lost",
];
const CHANNEL_POOL = ["call", "call", "sms", "sms", "sms", "email"];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}
function randomDateWithinPast(days) {
  const d = new Date();
  d.setDate(d.getDate() - randInt(0, days));
  d.setHours(randInt(8, 18), randInt(0, 59), 0, 0);
  return d;
}
function dateOnly(d) {
  return d.toISOString().slice(0, 10);
}
function byClient(rows, clientId) {
  return (rows || []).filter((r) => r.client_id === clientId);
}
async function insertInChunks(table, rows, chunkSize = 200) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + chunkSize));
    if (error) throw error;
  }
}

async function main() {
  console.log("Fetching clients, categories, services, staff…");
  const { data: clients, error: clientsError } = await supabase.from("clients").select("id, name, vertical");
  if (clientsError) throw clientsError;
  if (!clients || clients.length === 0) throw new Error("No clients found -- run supabase/seed.sql first.");

  const { data: allServices } = await supabase.from("services").select("*");
  const { data: allStaff } = await supabase.from("staff").select("*");

  const base = Math.floor(TOTAL_LEADS / clients.length);
  let remainder = TOTAL_LEADS - base * clients.length;
  const counts = clients.map(() => base);
  for (let i = 0; i < remainder; i++) counts[i % counts.length]++;

  const leadsToInsert = [];
  const leadMeta = [];

  clients.forEach((client, idx) => {
    const services = byClient(allServices, client.id);
    const staffList = byClient(allStaff, client.id);
    if (services.length === 0) {
      console.log(`Skipping ${client.name} -- no services configured.`);
      return;
    }

    for (let i = 0; i < counts[idx]; i++) {
      const created = randomDateWithinPast(DAYS_BACK);
      const status = pick(STATUS_POOL);
      const channel = pick(CHANNEL_POOL);
      const service = pick(services);
      const staffMember = staffList.length > 0 ? pick(staffList) : null;
      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      const name = `${firstName} ${lastName[0]}.`;
      const phone = channel !== "email" ? `+4477${randInt(10000000, 99999999)}` : null;
      const email = channel === "email" ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com` : null;

      const isWon = status === "Won" || status === "Booked";
      let bookingDate = null;
      let bookingTime = null;
      let pricePence = null;
      let assignedStaffId = null;
      if (isWon) {
        const bookedAt = new Date(created);
        bookedAt.setDate(bookedAt.getDate() + randInt(1, 7));
        bookingDate = dateOnly(bookedAt);
        bookingTime = `${String(randInt(9, 17)).padStart(2, "0")}:00`;
        pricePence = service.price_pence;
        assignedStaffId = staffMember?.id ?? null;
      }

      leadsToInsert.push({
        client_id: client.id,
        name,
        phone,
        email,
        channel,
        category_id: service.category_id,
        status,
        assigned_staff_id: assignedStaffId,
        service_id: isWon ? service.id : null,
        price_pence: pricePence,
        response_seconds: randInt(5, 420),
        lost_reason: status === "Lost" ? pick(LOST_REASONS) : null,
        booking_date: bookingDate,
        booking_time: bookingTime,
        created_at: created.toISOString(),
      });
      leadMeta.push({ created, service, staffMember });
    }
  });

  console.log(`Inserting ${leadsToInsert.length} leads…`);
  const { data: insertedLeads, error: leadsError } = await supabase.from("leads").insert(leadsToInsert).select();
  if (leadsError) throw leadsError;

  const messages = [];
  const answers = [];
  insertedLeads.forEach((lead, i) => {
    const meta = leadMeta[i];
    const t0 = new Date(meta.created);
    const at = (mins) => new Date(t0.getTime() + mins * 60000).toISOString();

    messages.push(
      { lead_id: lead.id, sender: "lead", body: `Hi, I'm interested in ${meta.service.name.toLowerCase()}.`, created_at: at(0) },
      { lead_id: lead.id, sender: "ai", body: "Happy to help — could you tell me a bit more about what you need?", created_at: at(1) },
      { lead_id: lead.id, sender: "lead", body: "Just need a quote and rough timing really.", created_at: at(3) }
    );
    answers.push({ lead_id: lead.id, question: "Service wanted", answer: meta.service.name });

    if (lead.status === "Booked" || lead.status === "Won") {
      messages.push({
        lead_id: lead.id,
        sender: "ai",
        body: `Great — you're booked in for ${lead.booking_date} at ${lead.booking_time}${meta.staffMember ? ` with ${meta.staffMember.name}` : ""}.`,
        created_at: at(6),
      });
      answers.push({ lead_id: lead.id, question: "Preferred time", answer: "Flexible" });
    } else if (lead.status === "Lost") {
      messages.push({ lead_id: lead.id, sender: "system", body: `Marked as lost — ${lead.lost_reason}.`, created_at: at(10) });
    } else if (lead.status === "Qualified") {
      messages.push({ lead_id: lead.id, sender: "ai", body: "Thanks, that's everything I need — passing this to the team now.", created_at: at(6) });
    }
  });

  console.log(`Inserting ${messages.length} messages and ${answers.length} answers…`);
  await insertInChunks("lead_messages", messages);
  await insertInChunks("lead_answers", answers);

  const manualBookings = [];
  const PER_CLIENT_TOTAL = 5;
  const PER_CLIENT_FUTURE = 2;
  clients.forEach((client) => {
    const services = byClient(allServices, client.id);
    const staffList = byClient(allStaff, client.id);
    if (services.length === 0 || staffList.length === 0) return;
    for (let i = 0; i < PER_CLIENT_TOTAL; i++) {
      const service = pick(services);
      const staffMember = pick(staffList);
      const isFuture = i < PER_CLIENT_FUTURE;
      const day = new Date();
      if (isFuture) day.setDate(day.getDate() + randInt(0, 6));
      else day.setDate(day.getDate() - randInt(1, DAYS_BACK));
      manualBookings.push({
        client_id: client.id,
        customer_name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        service_id: service.id,
        price_pence: service.price_pence,
        staff_id: staffMember.id,
        booking_date: dateOnly(day),
        booking_time: `${String(randInt(9, 17)).padStart(2, "0")}:00`,
        note: isFuture ? "Booked directly" : "Booked directly (historical)",
      });
    }
  });

  console.log(`Inserting ${manualBookings.length} manual bookings…`);
  const { error: mbError } = await supabase.from("manual_bookings").insert(manualBookings);
  if (mbError) throw mbError;

  console.log("\nDone:");
  console.log(`  ${insertedLeads.length} leads across ${clients.length} businesses`);
  console.log(`  ${messages.length} messages, ${answers.length} answers`);
  console.log(`  ${manualBookings.length} manual bookings (${clients.length * PER_CLIENT_FUTURE} near-future, rest historical)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

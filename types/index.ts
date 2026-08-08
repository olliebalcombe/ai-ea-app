// Core shared types — mirrors the Supabase schema in supabase/schema.sql

export type Vertical = "Tradie" | "Law Firm" | "Clinic" | "Estate Agent" | string;
export type Channel = "call" | "sms" | "email";
export type LeadStatus = "New" | "Contacted" | "Qualified" | "Booked" | "Won" | "Lost";

export interface Client {
  id: string;
  name: string;
  vertical: Vertical;
  assistant_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  twilio_number: string | null;
  brand_logo_url: string | null;
  brand_color: string | null;
  buffer_minutes: number;
  business_hours_start: string;
  business_hours_end: string;
}

export interface Staff {
  id: string;
  client_id: string;
  name: string;
  role: string | null;
}

export interface Category {
  id: string;
  client_id: string;
  name: string;
}

export interface Service {
  id: string;
  client_id: string;
  category_id: string | null;
  name: string;
  price_pence: number;
}

export interface QualifyingQuestion {
  id: string;
  client_id: string;
  question: string;
  display_order: number;
}

export interface Lead {
  id: string;
  client_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  channel: Channel;
  category_id: string | null;
  status: LeadStatus;
  assigned_staff_id: string | null;
  service_id: string | null;
  price_pence: number | null;
  response_seconds: number | null;
  lost_reason: string | null;
  booking_date: string | null;
  booking_time: string | null;
  notes: string | null;
  created_at: string;
}

export interface LeadMessage {
  id: string;
  lead_id: string;
  sender: "ai" | "lead" | "system";
  body: string;
  created_at: string;
}

export interface LeadAnswer {
  id: string;
  lead_id: string;
  question: string;
  answer: string;
}

export interface SchedulingRule {
  id: string;
  client_id: string;
  label: string;
  day_of_week: number | null;
  blocked_start_time: string;
  blocked_end_time: string;
  created_at: string;
}

export interface NotificationPrefs {
  client_id: string;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  notify_new_lead: boolean;
  notify_booked: boolean;
  notify_lost: boolean;
  notify_daily_digest: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

export interface ClientUser {
  user_id: string;
  client_id: string;
  role: "owner" | "staff";
}

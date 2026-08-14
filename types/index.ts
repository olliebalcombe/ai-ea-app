// Core shared types — mirrors the Supabase schema in supabase/schema.sql

export type Vertical = "Flooring" | "Tradie" | "Law Firm" | "Clinic" | "Estate Agent" | string;
export type Channel = "call" | "sms" | "email";
export type LeadStatus = "New" | "Contacted" | "Qualified" | "Booked" | "Won" | "Lost";
export type ToneStyle = "calm_direct" | "warm_friendly" | "formal_executive";
export type BudgetFit = "strong" | "moderate" | "weak" | "unknown";
export type InstallTimeline = "within_30_days" | "1_3_months" | "flexible" | "unknown";
export type BuyingIntent = "high" | "medium" | "low";

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
  tone_style: ToneStyle;
  business_nuances: string | null;
  theme_tokens: Record<string, unknown> | null;
  enabled_skills: string[];
  google_review_link: string | null;
  voice_style: string;
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
  ai_phrasing: string | null;
  mandatory: boolean;
  follow_up_rule: string | null;
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
  booking_source: "staff" | "customer_portal" | "simulated" | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  room_type: string | null;
  flooring_type: string | null;
  area_sqm: number | null;
  postcode: string | null;
  budget_fit: BudgetFit | null;
  install_timeline: InstallTimeline | null;
  buying_intent: BuyingIntent | null;
  discount_requested: boolean;
  ai_paused: boolean;
  quote_approved_at: string | null;
}

export interface LeadMessage {
  id: string;
  lead_id: string;
  sender: "ai" | "lead" | "system" | "staff";
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

export interface ManualBooking {
  id: string;
  client_id: string;
  customer_name: string;
  service_id: string | null;
  price_pence: number;
  staff_id: string | null;
  booking_date: string | null;
  booking_time: string | null;
  note: string | null;
  created_at: string;
}

export interface LeadMedia {
  id: string;
  lead_id: string;
  path: string;
  ai_summary: string | null;
  created_at: string;
}

export type KnowledgeCategory = "pricing_rule" | "faq" | "service_area" | "team_specialty" | "business_rule";

export interface KnowledgeBaseEntry {
  id: string;
  client_id: string;
  category: KnowledgeCategory;
  title: string;
  content: string;
  created_at: string;
}

export type ActivityType =
  | "qualified"
  | "escalated"
  | "booked"
  | "message_sent"
  | "reminder_sent"
  | "review_requested"
  | "portal_action"
  | "missed_call_recovery";

export interface ActivityLogEntry {
  id: string;
  client_id: string;
  lead_id: string | null;
  type: ActivityType;
  summary: string;
  created_at: string;
}

export type SuggestionType =
  | "follow_up_reminder"
  | "site_visit_offer"
  | "high_value_review"
  | "weekend_slot_review"
  | "discount_approval";

export type SuggestionStatus = "pending" | "approved" | "dismissed";

export interface LeadSuggestion {
  id: string;
  client_id: string;
  lead_id: string;
  type: SuggestionType;
  reason: string;
  suggested_message: string | null;
  status: SuggestionStatus;
  created_at: string;
  resolved_at: string | null;
}

/** Client-side status view only -- never selects access_token/refresh_token. */
export interface CalendarConnectionStatus {
  provider: "google" | "outlook";
  connected_email: string | null;
  expires_at: string | null;
}

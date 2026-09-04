"use client";

import { Sparkles, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { Lead, LeadMessage } from "@/types";

const TIMELINE_LABEL: Record<string, string> = {
  within_30_days: "Within 30 days",
  "1_3_months": "1-3 months",
  flexible: "Flexible",
  unknown: "Unknown",
};
const BUDGET_LABEL: Record<string, string> = {
  strong: "Strong",
  moderate: "Moderate",
  weak: "Weak",
  unknown: "Unknown",
};
const INTENT_COLOR_VAR: Record<string, string> = {
  high: "--primary-rgb",
  medium: "--color-attention",
  low: "--color-info",
};

function computeCompleteness(lead: Lead): number {
  const fields = [lead.room_type, lead.flooring_type, lead.area_sqm, lead.postcode, lead.budget_fit, lead.install_timeline];
  const filled = fields.filter((f) => f != null).length;
  return Math.round((filled / fields.length) * 100);
}

function computeResponseRisk(messages: LeadMessage[]): { level: "Low" | "Medium" | "High"; label: string } {
  const sorted = [...messages].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const last = sorted[0];
  if (!last || last.sender !== "lead") return { level: "Low", label: "no reply pending" };
  const mins = Math.round((Date.now() - new Date(last.created_at).getTime()) / 60000);
  if (mins < 30) return { level: "Low", label: `waiting ${mins}m` };
  if (mins < 24 * 60) return { level: "Medium", label: `waiting ${Math.round(mins / 60)}h` };
  return { level: "High", label: `waiting ${Math.round(mins / (60 * 24))}d` };
}

/** Real breakdown of a flooring lead's qualification signals -- Claude extractions + deterministic computations, never invented. */
export default function QualificationScoreCard({
  lead,
  messages,
  photoCount,
  assistantName,
}: {
  lead: Lead;
  messages: LeadMessage[];
  photoCount: number;
  assistantName?: string;
}) {
  const hasFlooringSignal = lead.buying_intent != null || lead.budget_fit != null || lead.install_timeline != null;
  if (!hasFlooringSignal) return null;

  const completeness = computeCompleteness(lead);
  const risk = computeResponseRisk(messages);
  const riskColorVar = risk.level === "High" ? "--color-risk" : risk.level === "Medium" ? "--color-attention" : "--primary-rgb";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary" /> {assistantName ? `${assistantName}'s Qualification Scorecard` : "Qualification Score"}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-xs">
        {lead.room_type && (
          <div>
            <div className="text-muted-foreground">Room Type</div>
            <div className="mt-0.5 font-medium text-foreground">{lead.room_type}</div>
          </div>
        )}
        {lead.flooring_type && (
          <div>
            <div className="text-muted-foreground">Material</div>
            <div className="mt-0.5 font-medium text-foreground">{lead.flooring_type}</div>
          </div>
        )}
        {lead.area_sqm != null && (
          <div>
            <div className="text-muted-foreground">Area</div>
            <div className="mt-0.5 font-medium text-foreground">{lead.area_sqm} sq/m</div>
          </div>
        )}
        {lead.buying_intent && (
          <div>
            <div className="text-muted-foreground">Buying Intent</div>
            <div className="mt-0.5 font-medium capitalize" style={{ color: `rgb(var(${INTENT_COLOR_VAR[lead.buying_intent]}))` }}>
              {lead.buying_intent}
            </div>
          </div>
        )}
        {lead.install_timeline && (
          <div>
            <div className="text-muted-foreground">Timeframe</div>
            <div className="mt-0.5 font-medium text-foreground">{TIMELINE_LABEL[lead.install_timeline]}</div>
          </div>
        )}
        {lead.budget_fit && (
          <div>
            <div className="text-muted-foreground">Budget Fit</div>
            <div className="mt-0.5 font-medium text-foreground">{BUDGET_LABEL[lead.budget_fit]}</div>
          </div>
        )}
        <div>
          <div className="text-muted-foreground">Info Completeness</div>
          <div className="mt-0.5 font-medium text-foreground">{completeness}%</div>
        </div>
        <div>
          <div className="text-muted-foreground">Response Risk</div>
          <div className="mt-0.5 flex items-center gap-1 font-medium" style={{ color: `rgb(var(${riskColorVar}))` }}>
            <Clock className="h-3 w-3" /> {risk.level} ({risk.label})
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Photos uploaded</div>
          <div className="mt-0.5 font-medium text-foreground">{photoCount}</div>
        </div>
      </CardContent>
    </Card>
  );
}

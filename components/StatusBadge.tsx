import type { LeadStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const COLORS: Record<LeadStatus, string> = {
  New: "59,130,246",
  Contacted: "245,158,11",
  Qualified: "168,85,247",
  Booked: "99,102,241",
  Won: "34,197,94",
  Lost: "107,114,128",
};

const STYLES: Record<LeadStatus, string> = {
  New: "border-blue-500/25 bg-blue-500/15 text-blue-300 hover:bg-blue-500/15",
  Contacted: "border-amber-500/25 bg-amber-500/15 text-amber-300 hover:bg-amber-500/15",
  Qualified: "border-purple-500/25 bg-purple-500/15 text-purple-300 hover:bg-purple-500/15",
  Booked: "border-indigo-500/25 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/15",
  Won: "border-green-500/25 bg-green-500/15 text-green-300 hover:bg-green-500/15",
  Lost: "border-gray-500/25 bg-gray-500/15 text-gray-400 hover:bg-gray-500/15",
};

export default function StatusBadge({ status }: { status: LeadStatus }) {
  const style = STYLES[status] ?? "border-gray-500/25 bg-gray-500/15 text-gray-300";
  const rgb = COLORS[status];
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full font-medium", style)}
      style={
        status !== "Lost"
          ? { boxShadow: `0 0 10px -2px rgba(${rgb}, calc(var(--glow-intensity, 0.7)))` }
          : undefined
      }
    >
      {status}
    </Badge>
  );
}

import type { LeadStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STYLES: Record<LeadStatus, string> = {
  New: "border-blue-500/25 bg-blue-500/15 text-blue-300 hover:bg-blue-500/15 shadow-[0_0_10px_-2px_rgba(59,130,246,0.7)]",
  Contacted:
    "border-amber-500/25 bg-amber-500/15 text-amber-300 hover:bg-amber-500/15 shadow-[0_0_10px_-2px_rgba(245,158,11,0.7)]",
  Qualified:
    "border-purple-500/25 bg-purple-500/15 text-purple-300 hover:bg-purple-500/15 shadow-[0_0_10px_-2px_rgba(168,85,247,0.7)]",
  Booked:
    "border-indigo-500/25 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/15 shadow-[0_0_10px_-2px_rgba(99,102,241,0.7)]",
  Won: "border-green-500/25 bg-green-500/15 text-green-300 hover:bg-green-500/15 shadow-[0_0_10px_-2px_rgba(34,197,94,0.7)]",
  Lost: "border-gray-500/25 bg-gray-500/15 text-gray-400 hover:bg-gray-500/15",
};

export default function StatusBadge({ status }: { status: LeadStatus }) {
  const style = STYLES[status] ?? "border-gray-500/25 bg-gray-500/15 text-gray-300";
  return (
    <Badge variant="outline" className={cn("rounded-full font-medium", style)}>
      {status}
    </Badge>
  );
}

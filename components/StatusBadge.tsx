import type { LeadStatus } from "@/types";

const STYLES: Record<LeadStatus, string> = {
  New: "bg-blue-100 text-blue-800",
  Contacted: "bg-amber-100 text-amber-800",
  Qualified: "bg-purple-100 text-purple-800",
  Booked: "bg-indigo-100 text-indigo-800",
  Won: "bg-green-100 text-green-800",
  Lost: "bg-gray-200 text-gray-600",
};

export default function StatusBadge({ status }: { status: LeadStatus }) {
  const style = STYLES[status] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}

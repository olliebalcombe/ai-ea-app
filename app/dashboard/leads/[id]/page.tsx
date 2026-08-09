"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import LeadDetailContent from "@/components/LeadDetailContent";

export default function LeadDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/dashboard/leads")}
        className="mb-4 -ml-2 text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Lead Queue
      </Button>

      <LeadDetailContent leadId={params.id} />
    </div>
  );
}

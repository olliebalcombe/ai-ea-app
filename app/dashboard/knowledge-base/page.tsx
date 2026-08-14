import { redirect } from "next/navigation";

/** Knowledge Base and Business Rules merged into Business Memory -- old bookmarks still land somewhere real. */
export default function KnowledgeBaseRedirect() {
  redirect("/dashboard/business-memory");
}

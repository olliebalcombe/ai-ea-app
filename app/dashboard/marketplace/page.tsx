"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { SKILLS, CATEGORIES, type SkillDefinition, type SkillCategory } from "@/lib/skills";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import SkillCard from "@/components/SkillCard";
import SkillDetailSheet from "@/components/SkillDetailSheet";

type Filter = "All Skills" | SkillCategory;
const FILTERS: Filter[] = ["All Skills", ...CATEGORIES];

export default function MarketplacePage() {
  const { currentClientId } = useCurrentClient();
  const [enabledSkills, setEnabledSkills] = useState<string[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("All Skills");
  const [search, setSearch] = useState("");
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [openSkill, setOpenSkill] = useState<SkillDefinition | null>(null);

  const load = useCallback(async () => {
    if (!currentClientId) return;
    setLoading(true);
    const [{ data: client }, { count: photosAnalyzed }, { count: calls }, { count: won }] = await Promise.all([
      supabaseBrowser.from("clients").select("enabled_skills").eq("id", currentClientId).single(),
      supabaseBrowser
        .from("lead_media")
        .select("id, leads!inner(client_id)", { count: "exact", head: true })
        .eq("leads.client_id", currentClientId)
        .not("ai_summary", "is", null),
      supabaseBrowser
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("client_id", currentClientId)
        .eq("channel", "call"),
      supabaseBrowser
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("client_id", currentClientId)
        .eq("status", "Won"),
    ]);
    setEnabledSkills((client?.enabled_skills as string[]) ?? []);
    setStats({
      vision_site_inspector: photosAnalyzed ?? 0,
      voice_ai_receptionist: calls ?? 0,
      google_reviews_booster: won ?? 0,
    });
    setLoading(false);
  }, [currentClientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleSkill(key: string) {
    if (!currentClientId || togglingKey) return;
    setTogglingKey(key);
    const next = enabledSkills.includes(key)
      ? enabledSkills.filter((k) => k !== key)
      : [...enabledSkills, key];
    const { error } = await supabaseBrowser.from("clients").update({ enabled_skills: next }).eq("id", currentClientId);
    if (error) {
      toast.error("Couldn't save that change", { description: error.message });
    } else {
      setEnabledSkills(next);
    }
    setTogglingKey(null);
  }

  function statLine(skill: SkillDefinition): string | null {
    const n = stats[skill.key];
    if (n == null) return null;
    if (skill.key === "vision_site_inspector") return `${n} photo${n === 1 ? "" : "s"} analyzed`;
    if (skill.key === "voice_ai_receptionist") return `${n} call${n === 1 ? "" : "s"} handled`;
    if (skill.key === "google_reviews_booster") return `${n} job${n === 1 ? "" : "s"} won so far`;
    return null;
  }

  let filtered = SKILLS;
  if (filter !== "All Skills") filtered = filtered.filter((s) => s.category === filter);
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (s) => s.name.toLowerCase().includes(q) || s.subtitle.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    );
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-6 mb-6 border-b border-white/10 bg-background/80 px-6 py-4 backdrop-blur-md">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">AI Plugin &amp; Capability Hub</h1>
            <p className="text-sm text-muted-foreground">
              {SKILLS.length} Skills Available •{" "}
              <motion.span
                key={enabledSkills.length}
                initial={{ scale: 1.4 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="glow-ring inline-block rounded-full px-1.5 font-medium text-primary"
              >
                {enabledSkills.length} Active
              </motion.span>
            </p>
          </div>
          <div className="flex min-w-[240px] items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${SKILLS.length} AI Skills & Plugins…`}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                filter === f
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No skills match your search.</p>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filtered.map((skill) => (
            <motion.div key={skill.key} variants={staggerItem}>
              <SkillCard
                skill={skill}
                enabled={enabledSkills.includes(skill.key)}
                stat={statLine(skill)}
                toggling={togglingKey === skill.key}
                onToggle={() => toggleSkill(skill.key)}
                onOpen={() => setOpenSkill(skill)}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      <SkillDetailSheet
        skill={openSkill}
        open={!!openSkill}
        onOpenChange={(o) => !o && setOpenSkill(null)}
        enabled={openSkill ? enabledSkills.includes(openSkill.key) : false}
        toggling={openSkill ? togglingKey === openSkill.key : false}
        onToggle={() => openSkill && toggleSkill(openSkill.key)}
      />
    </div>
  );
}

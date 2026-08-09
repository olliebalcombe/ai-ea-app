"use client";

import { motion } from "framer-motion";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import SkillMotif from "@/components/SkillMotif";
import type { SkillDefinition } from "@/lib/skills";

export default function SkillCard({
  skill,
  enabled,
  stat,
  toggling,
  onToggle,
  onOpen,
}: {
  skill: SkillDefinition;
  enabled: boolean;
  stat?: string | null;
  toggling?: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const Icon = skill.icon;

  return (
    <Card
      onClick={onOpen}
      className="flex cursor-pointer flex-col overflow-hidden p-0 transition-colors hover:border-primary/30"
    >
      <div className={cn("skill-thumb flex h-28 items-center justify-center bg-gradient-to-br", skill.gradient)}>
        <SkillMotif skillKey={skill.key} fallbackIcon={Icon} />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            {skill.category}
          </Badge>
          {enabled && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-primary">
              <Check className="h-3 w-3" /> Active
            </span>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">{skill.name}</h3>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{skill.subtitle}</p>
        </div>

        {stat && <p className="text-[11px] text-muted-foreground">{stat}</p>}

        <motion.div whileTap={{ scale: 0.95 }} className="mt-auto">
          <Button
            size="sm"
            variant={enabled ? "outline" : "default"}
            className="w-full"
            disabled={toggling}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            {enabled ? (
              "Installed"
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" /> Enable
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </Card>
  );
}

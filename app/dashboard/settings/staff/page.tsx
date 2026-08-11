"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, Users } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { staggerContainer, staggerItem, hoverLift } from "@/lib/motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Staff } from "@/types";

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export default function StaffSettingsPage() {
  const { currentClientId } = useCurrentClient();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");

  const load = useCallback(async () => {
    if (!currentClientId) return;
    setLoading(true);
    const [{ data, error }, { data: leadRows }] = await Promise.all([
      supabaseBrowser.from("staff").select("*").eq("client_id", currentClientId).order("name"),
      supabaseBrowser
        .from("leads")
        .select("assigned_staff_id")
        .eq("client_id", currentClientId)
        .not("assigned_staff_id", "is", null),
    ]);
    if (error) setError(error.message);
    else setStaff((data as Staff[]) ?? []);
    const counts: Record<string, number> = {};
    (leadRows ?? []).forEach((r) => {
      const id = r.assigned_staff_id as string;
      counts[id] = (counts[id] ?? 0) + 1;
    });
    setLeadCounts(counts);
    setLoading(false);
  }, [currentClientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!currentClientId || !newName.trim()) return;
    const { error } = await supabaseBrowser
      .from("staff")
      .insert({ client_id: currentClientId, name: newName.trim(), role: newRole.trim() || null });
    if (error) {
      setError(error.message);
      return;
    }
    setNewName("");
    setNewRole("");
    load();
  }

  function startEdit(s: Staff) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditRole(s.role ?? "");
  }

  async function saveEdit(id: string) {
    const { error } = await supabaseBrowser
      .from("staff")
      .update({ name: editName.trim(), role: editRole.trim() || null })
      .eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setEditingId(null);
    load();
  }

  async function removeStaff(id: string) {
    if (!confirm("Remove this staff member?")) return;
    const { error } = await supabaseBrowser.from("staff").delete().eq("id", id);
    if (error) setError(error.message);
    else load();
  }

  return (
    <div className="max-w-3xl space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : staff.length === 0 ? (
        <p className="text-sm text-muted-foreground">No staff added yet.</p>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          {staff.map((s) => (
            <motion.div key={s.id} variants={staggerItem} whileHover={hoverLift}>
              <Card className="glow-hover p-4">
                {editingId === s.id ? (
                  <div className="space-y-2">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
                    <Input value={editRole} onChange={(e) => setEditRole(e.target.value)} placeholder="Role" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveEdit(s.id)}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-purple-500 text-sm font-bold text-background">
                      {initials(s.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{s.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {s.role && (
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                            {s.role}
                          </span>
                        )}
                        <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "rgba(var(--primary-rgb), 0.1)", color: "rgb(var(--primary-rgb))" }}>
                          <Users className="h-2.5 w-2.5" /> {leadCounts[s.id] ?? 0} assigned
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => removeStaff(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add staff</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addStaff} className="flex gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" required />
            <Input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="Role (optional)" />
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

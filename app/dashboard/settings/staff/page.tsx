"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Staff } from "@/types";

export default function StaffSettingsPage() {
  const { currentClientId } = useCurrentClient();
  const [staff, setStaff] = useState<Staff[]>([]);
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
    const { data, error } = await supabaseBrowser
      .from("staff")
      .select("*")
      .eq("client_id", currentClientId)
      .order("name");
    if (error) setError(error.message);
    else setStaff((data as Staff[]) ?? []);
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
    <div className="max-w-2xl space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : staff.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No staff added yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((s) => (
                  <TableRow key={s.id}>
                    {editingId === s.id ? (
                      <>
                        <TableCell>
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <Input value={editRole} onChange={(e) => setEditRole(e.target.value)} />
                        </TableCell>
                        <TableCell className="space-x-2 whitespace-nowrap">
                          <Button size="sm" onClick={() => saveEdit(s.id)}>
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-medium text-foreground">{s.name}</TableCell>
                        <TableCell className="text-muted-foreground">{s.role ?? "—"}</TableCell>
                        <TableCell className="space-x-1 whitespace-nowrap text-right">
                          <Button size="icon" variant="ghost" onClick={() => startEdit(s)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => removeStaff(s.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add staff</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addStaff} className="flex gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" required />
            <Input
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="Role (optional)"
            />
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

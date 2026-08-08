"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
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
    <div className="max-w-2xl">
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Loading…</p>
        ) : staff.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No staff added yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {staff.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-4 py-3">
                {editingId === s.id ? (
                  <div className="flex flex-1 gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />
                    <input
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      placeholder="Role"
                      className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />
                    <button
                      onClick={() => saveEdit(s.id)}
                      className="text-sm font-medium text-gray-900 hover:underline"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-sm text-gray-500 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="text-sm font-medium text-gray-900">{s.name}</span>
                      {s.role && <span className="ml-2 text-xs text-gray-500">{s.role}</span>}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => startEdit(s)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removeStaff(s.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={addStaff} className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Name"
          required
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
          placeholder="Role (optional)"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Add
        </button>
      </form>
    </div>
  );
}

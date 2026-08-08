"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import type { Category, Service } from "@/types";

function formatPrice(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

function parsePrice(input: string): number {
  const value = Math.round(parseFloat(input || "0") * 100);
  return Number.isFinite(value) ? value : 0;
}

export default function ServicesSettingsPage() {
  const { currentClientId } = useCurrentClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newService, setNewService] = useState({ name: "", price: "", categoryId: "" });

  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editService, setEditService] = useState({ name: "", price: "" });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");

  const load = useCallback(async () => {
    if (!currentClientId) return;
    setLoading(true);
    const [{ data: cats, error: catErr }, { data: svcs, error: svcErr }] = await Promise.all([
      supabaseBrowser.from("categories").select("*").eq("client_id", currentClientId).order("name"),
      supabaseBrowser.from("services").select("*").eq("client_id", currentClientId).order("name"),
    ]);
    if (catErr) setError(catErr.message);
    else if (svcErr) setError(svcErr.message);
    else setError(null);
    setCategories((cats as Category[]) ?? []);
    setServices((svcs as Service[]) ?? []);
    setLoading(false);
  }, [currentClientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!currentClientId || !newCategoryName.trim()) return;
    const { error } = await supabaseBrowser
      .from("categories")
      .insert({ client_id: currentClientId, name: newCategoryName.trim() });
    if (error) setError(error.message);
    else {
      setNewCategoryName("");
      load();
    }
  }

  async function removeCategory(id: string) {
    if (!confirm("Remove this category? Services in it will become uncategorised.")) return;
    const { error } = await supabaseBrowser.from("categories").delete().eq("id", id);
    if (error) setError(error.message);
    else load();
  }

  async function saveCategory(id: string) {
    const { error } = await supabaseBrowser
      .from("categories")
      .update({ name: editCategoryName.trim() })
      .eq("id", id);
    if (error) setError(error.message);
    else {
      setEditingCategoryId(null);
      load();
    }
  }

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    if (!currentClientId || !newService.name.trim()) return;
    const { error } = await supabaseBrowser.from("services").insert({
      client_id: currentClientId,
      name: newService.name.trim(),
      price_pence: parsePrice(newService.price),
      category_id: newService.categoryId || null,
    });
    if (error) setError(error.message);
    else {
      setNewService({ name: "", price: "", categoryId: "" });
      load();
    }
  }

  function startEditService(s: Service) {
    setEditingServiceId(s.id);
    setEditService({ name: s.name, price: (s.price_pence / 100).toFixed(2) });
  }

  async function saveService(id: string) {
    const { error } = await supabaseBrowser
      .from("services")
      .update({ name: editService.name.trim(), price_pence: parsePrice(editService.price) })
      .eq("id", id);
    if (error) setError(error.message);
    else {
      setEditingServiceId(null);
      load();
    }
  }

  async function removeService(id: string) {
    if (!confirm("Remove this service?")) return;
    const { error } = await supabaseBrowser.from("services").delete().eq("id", id);
    if (error) setError(error.message);
    else load();
  }

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;

  const uncategorised = services.filter((s) => !s.category_id);

  return (
    <div className="max-w-3xl space-y-8">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {[...categories, ...(uncategorised.length > 0 ? [null] : [])].map((cat) => {
        const catServices = cat
          ? services.filter((s) => s.category_id === cat.id)
          : uncategorised;
        return (
          <div key={cat ? cat.id : "uncategorised"} className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              {cat && editingCategoryId === cat.id ? (
                <div className="flex flex-1 gap-2">
                  <input
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                  />
                  <button onClick={() => saveCategory(cat.id)} className="text-sm font-medium hover:underline">
                    Save
                  </button>
                  <button onClick={() => setEditingCategoryId(null)} className="text-sm text-gray-500 hover:underline">
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {cat ? cat.name : "Uncategorised"}
                  </h3>
                  {cat && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setEditingCategoryId(cat.id);
                          setEditCategoryName(cat.name);
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => removeCategory(cat.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            {catServices.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-500">No services yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {catServices.map((s) => (
                  <li key={s.id} className="flex items-center justify-between px-4 py-3">
                    {editingServiceId === s.id ? (
                      <div className="flex flex-1 gap-2">
                        <input
                          value={editService.name}
                          onChange={(e) => setEditService((v) => ({ ...v, name: e.target.value }))}
                          className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                        />
                        <input
                          value={editService.price}
                          onChange={(e) => setEditService((v) => ({ ...v, price: e.target.value }))}
                          className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
                        />
                        <button onClick={() => saveService(s.id)} className="text-sm font-medium hover:underline">
                          Save
                        </button>
                        <button onClick={() => setEditingServiceId(null)} className="text-sm text-gray-500 hover:underline">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm text-gray-900">{s.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-500">{formatPrice(s.price_pence)}</span>
                          <button onClick={() => startEditService(s)} className="text-xs text-gray-500 hover:text-gray-700">
                            Edit
                          </button>
                          <button onClick={() => removeService(s.id)} className="text-xs text-red-500 hover:text-red-700">
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
        );
      })}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <form onSubmit={addCategory} className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Add category</h3>
          <div className="flex gap-2">
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name"
              required
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
              Add
            </button>
          </div>
        </form>

        <form onSubmit={addService} className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Add service</h3>
          <div className="space-y-2">
            <input
              value={newService.name}
              onChange={(e) => setNewService((v) => ({ ...v, name: e.target.value }))}
              placeholder="Service name"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <input
                value={newService.price}
                onChange={(e) => setNewService((v) => ({ ...v, price: e.target.value }))}
                placeholder="Price (£)"
                className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <select
                value={newService.categoryId}
                onChange={(e) => setNewService((v) => ({ ...v, categoryId: e.target.value }))}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Uncategorised</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

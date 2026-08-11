"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useCurrentClient } from "@/lib/clientContext";
import { staggerContainer, staggerItem, hoverLift } from "@/lib/motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const uncategorised = services.filter((s) => !s.category_id);

  return (
    <div className="max-w-3xl space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {[...categories, ...(uncategorised.length > 0 ? [null] : [])].map((cat) => {
        const catServices = cat ? services.filter((s) => s.category_id === cat.id) : uncategorised;
        return (
          <Card key={cat ? cat.id : "uncategorised"} className="glow-hover">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              {cat && editingCategoryId === cat.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                  />
                  <Button size="sm" onClick={() => saveCategory(cat.id)}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingCategoryId(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <CardTitle className="text-sm">{cat ? cat.name : "Uncategorised"}</CardTitle>
                  {cat && (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingCategoryId(cat.id);
                          setEditCategoryName(cat.name);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => removeCategory(cat.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              {catServices.length === 0 ? (
                <p className="px-2 pb-2 text-sm text-muted-foreground">No services yet.</p>
              ) : (
                <motion.div variants={staggerContainer} initial="initial" animate="animate" className="flex flex-wrap gap-2">
                  {catServices.map((s) =>
                    editingServiceId === s.id ? (
                      <div key={s.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-2">
                        <Input
                          value={editService.name}
                          onChange={(e) => setEditService((v) => ({ ...v, name: e.target.value }))}
                          className="h-8 w-32 text-xs"
                        />
                        <Input
                          value={editService.price}
                          onChange={(e) => setEditService((v) => ({ ...v, price: e.target.value }))}
                          className="h-8 w-20 text-xs"
                        />
                        <Button size="sm" className="h-7 text-xs" onClick={() => saveService(s.id)}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingServiceId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <motion.div
                        key={s.id}
                        variants={staggerItem}
                        whileHover={hoverLift}
                        className="group glow-hover flex items-center gap-2 rounded-full border border-white/10 bg-black/20 py-1.5 pl-3 pr-1.5"
                      >
                        <span className="text-sm text-foreground">{s.name}</span>
                        <span className="text-sm font-semibold text-primary">{formatPrice(s.price_pence)}</span>
                        <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEditService(s)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeService(s.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </motion.div>
                    )
                  )}
                </motion.div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Add category</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addCategory} className="flex gap-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Category name"
                required
              />
              <Button type="submit">Add</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Add service</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addService} className="space-y-2">
              <Input
                value={newService.name}
                onChange={(e) => setNewService((v) => ({ ...v, name: e.target.value }))}
                placeholder="Service name"
                required
              />
              <div className="flex gap-2">
                <Input
                  value={newService.price}
                  onChange={(e) => setNewService((v) => ({ ...v, price: e.target.value }))}
                  placeholder="Price (£)"
                  className="w-28"
                />
                <Select
                  value={newService.categoryId || "none"}
                  onValueChange={(v) =>
                    setNewService((s) => ({ ...s, categoryId: v === "none" ? "" : v }))
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Uncategorised</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">
                Add
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { DataTable } from "@/components/ui/data-table";
import { statusBadge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Category } from "@repo/shared";

export default function CategoriesPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const { data } = await api.categories.list();
      setCategories(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.categories.create({ name });
      toast.success("Category created");
      setShowForm(false);
      setName("");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create category");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: string) {
    if (!confirm("Archive this category?")) return;
    try {
      await api.categories.archive(id);
      toast.success("Category archived");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const columns: ColumnDef<Category>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "status", header: "Status", cell: (i) => statusBadge(i.getValue<string>()) },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => user?.role === "admin" && row.original.status === "active" ? (
        <button onClick={() => handleArchive(row.original.id)} className="text-xs text-red-500 hover:underline">
          Archive
        </button>
      ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        {user?.role === "admin" && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + New Category
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="flex gap-3 items-end max-w-sm">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Category Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              required
            />
          </div>
          <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60">
            {saving ? "…" : "Create"}
          </button>
          <button type="button" onClick={() => setShowForm(false)} className="rounded-md border px-4 py-2 text-sm">
            Cancel
          </button>
        </form>
      )}

      {loading ? <p className="text-sm text-gray-500">Loading…</p> : (
        <DataTable columns={columns} data={categories} filterPlaceholder="Search categories…" />
      )}
    </div>
  );
}

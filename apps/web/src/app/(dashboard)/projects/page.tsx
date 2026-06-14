"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { DataTable } from "@/components/ui/data-table";
import { statusBadge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Project } from "@repo/shared";

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", description: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const { data } = await api.projects.list();
      setProjects(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.projects.create(form);
      toast.success("Project created");
      setShowForm(false);
      setForm({ name: "", code: "", description: "" });
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: string) {
    if (!confirm("Archive this project?")) return;
    try {
      await api.projects.archive(id);
      toast.success("Project archived");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to archive project");
    }
  }

  const columns: ColumnDef<Project>[] = [
    { accessorKey: "code", header: "Code" },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "description", header: "Description", cell: (i) => i.getValue<string | null>() ?? "—" },
    { accessorKey: "status", header: "Status", cell: (i) => statusBadge(i.getValue<string>()) },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Link href={`/projects/${row.original.id}`} className="text-xs text-blue-600 hover:underline">
            View
          </Link>
          {user?.role === "admin" && row.original.status === "active" && (
            <button
              onClick={() => handleArchive(row.original.id)}
              className="text-xs text-red-500 hover:underline"
            >
              Archive
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        {user?.role === "admin" && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + New Project
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border bg-white p-6 shadow-sm space-y-4 max-w-lg">
          <h2 className="font-semibold">New Project</h2>
          {(["name", "code", "description"] as const).map((f) => (
            <div key={f}>
              <label className="block text-sm font-medium mb-1 capitalize">{f}</label>
              <input
                type="text"
                value={form[f]}
                onChange={(e) => setForm((prev) => ({ ...prev, [f]: e.target.value }))}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          ))}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Creating…" : "Create"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md border px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? <p className="text-sm text-gray-500">Loading…</p> : (
        <DataTable columns={columns} data={projects} filterPlaceholder="Search projects…" />
      )}
    </div>
  );
}

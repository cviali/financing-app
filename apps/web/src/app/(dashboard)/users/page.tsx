"use client";

import { useEffect, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { DataTable } from "@/components/ui/data-table";
import { roleBadge, statusBadge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { User } from "@repo/shared";
import { useRouter } from "next/navigation";

export default function UsersPage() {
  const { user: me } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    role: "staff" as "admin" | "staff",
    password: "",
    status: "active" as "active" | "disabled",
  });

  // Guard: only admin can access this page
  useEffect(() => {
    if (me && me.role !== "admin") router.push("/dashboard");
  }, [me, router]);

  async function load() {
    try {
      const { data } = await api.users.list();
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.users.create({ ...form, mustChangePassword: true });
      toast.success("User created");
      setShowForm(false);
      setForm({ username: "", displayName: "", role: "staff", password: "", status: "active" });
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset(id: string) {
    const pw = prompt("New temporary password (min 10 chars):");
    if (!pw) return;
    try {
      await api.users.resetPassword(id, pw);
      toast.success("Password reset");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleToggleStatus(u: User) {
    const newStatus = u.status === "active" ? "disabled" : "active";
    try {
      await api.users.updateStatus(u.id, newStatus);
      toast.success(`User ${newStatus}`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleToggleRole(u: User) {
    const newRole = u.role === "admin" ? "staff" : "admin";
    if (!confirm(`Change ${u.username}'s role to ${newRole}?`)) return;
    try {
      await api.users.updateRole(u.id, newRole);
      toast.success("Role updated");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const columns: ColumnDef<User>[] = [
    { accessorKey: "username", header: "Username" },
    { accessorKey: "displayName", header: "Display Name" },
    { accessorKey: "role", header: "Role", cell: (i) => roleBadge(i.getValue<string>()) },
    { accessorKey: "status", header: "Status", cell: (i) => statusBadge(i.getValue<string>()) },
    {
      accessorKey: "mustChangePassword",
      header: "Must Change PW",
      cell: (i) => (i.getValue<boolean>() ? "Yes" : "No"),
    },
    { accessorKey: "lastLoginAt", header: "Last Login", cell: (i) => i.getValue<string | null>() ?? "Never" },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const u = row.original;
        if (u.id === me?.id) return <span className="text-xs text-gray-400">You</span>;
        return (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => handleReset(u.id)} className="text-xs text-blue-600 hover:underline">
              Reset PW
            </button>
            <button onClick={() => handleToggleRole(u)} className="text-xs text-purple-600 hover:underline">
              {u.role === "admin" ? "→ Staff" : "→ Admin"}
            </button>
            <button onClick={() => handleToggleStatus(u)} className="text-xs text-orange-500 hover:underline">
              {u.status === "active" ? "Disable" : "Enable"}
            </button>
          </div>
        );
      },
    },
  ];

  if (me?.role !== "admin") return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + New User
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border bg-white p-6 shadow-sm space-y-4 max-w-md">
          <h2 className="font-semibold">New User</h2>
          {[
            { key: "username", label: "Username", type: "text" },
            { key: "displayName", label: "Display Name", type: "text" },
            { key: "password", label: "Temporary Password", type: "password" },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <input
                type={type}
                value={form[key as keyof typeof form] as string}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                className="w-full rounded-md border px-3 py-2 text-sm"
                required
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as "admin" | "staff" }))}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60">
              {saving ? "Creating…" : "Create User"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md border px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? <p className="text-sm text-gray-500">Loading…</p> : (
        <DataTable columns={columns} data={users} filterPlaceholder="Search users…" />
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api";
import { formatIDR, formatDate } from "@/lib/format";
import { useAuth } from "@/context/auth";
import { DataTable } from "@/components/ui/data-table";
import { paymentSourceBadge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Spending } from "@repo/shared";

export default function SpendingsPage() {
  const { user } = useAuth();
  const [spendings, setSpendings] = useState<Spending[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const { data } = await api.spendings.list();
      setSpendings(data);
    } catch (e) {
      toast.error("Failed to load spendings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleVoid(id: string) {
    const reason = prompt("Void reason:");
    if (!reason) return;
    try {
      await api.spendings.void(id, reason);
      toast.success("Spending voided");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to void spending");
    }
  }

  const columns: ColumnDef<Spending>[] = [
    { accessorKey: "spendingDate", header: "Date", cell: (i) => formatDate(i.getValue<string>()) },
    { accessorKey: "projectId", header: "Project" },
    { accessorKey: "categoryId", header: "Category" },
    { accessorKey: "description", header: "Description", cell: (i) => i.getValue<string | null>() ?? "—" },
    {
      accessorKey: "paymentSource",
      header: "Source",
      cell: (i) => paymentSourceBadge(i.getValue<string>()),
    },
    {
      accessorKey: "amountIdr",
      header: "Amount (IDR)",
      cell: (i) => (
        <span className="tabular-nums text-right block">{formatIDR(i.getValue<number>())}</span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const s = row.original;
        const canEdit =
          user?.role === "admin" || user?.id === s.createdBy;
        return (
          <div className="flex gap-2">
            {canEdit && (
              <Link
                href={`/spendings/${s.id}/edit`}
                className="text-xs text-blue-600 hover:underline"
              >
                Edit
              </Link>
            )}
            {user?.role === "admin" && !s.voidedAt && (
              <button
                onClick={() => handleVoid(s.id)}
                className="text-xs text-red-500 hover:underline"
              >
                Void
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Spendings</h1>
        <div className="flex gap-3">
          <a
            href={api.exports.spendings()}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
            download
          >
            Export Excel
          </a>
          <Link
            href="/spendings/new"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + New Spending
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <DataTable columns={columns} data={spendings} filterPlaceholder="Search spendings…" />
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatIDR } from "@/lib/format";
import type { Spending, Project } from "@repo/shared";

interface DashboardStats {
  totalThisMonth: number;
  totalAllTime: number;
  activeProjects: number;
  totalPettyCash: number;
  recentSpendings: Spending[];
  byProject: Record<string, { name: string; code: string; total: number }>;
  byCategory: Record<string, { name: string; total: number }>;
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [spendingsRes, projectsRes] = await Promise.all([
          api.spendings.list(),
          api.projects.list(),
        ]);

        const all = spendingsRes.data;
        const projects = projectsRes.data;

        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

        const totalThisMonth = all
          .filter((s) => s.spendingDate >= thisMonthStart)
          .reduce((sum, s) => sum + s.amountIdr, 0);

        const totalAllTime = all.reduce((sum, s) => sum + s.amountIdr, 0);
        const activeProjects = projects.filter((p) => p.status === "active").length;

        // Aggregate petty cash from project details would require N+1 calls;
        // show as "fetch separately" for now – the project detail page shows per-project balance
        const totalPettyCash = 0;

        const byProject: DashboardStats["byProject"] = {};
        const byCategory: DashboardStats["byCategory"] = {};

        for (const s of all) {
          if (!byProject[s.projectId]) {
            const p = projects.find((p) => p.id === s.projectId);
            byProject[s.projectId] = { name: p?.name ?? s.projectId, code: p?.code ?? "", total: 0 };
          }
          byProject[s.projectId]!.total += s.amountIdr;

          if (!byCategory[s.categoryId]) {
            byCategory[s.categoryId] = { name: s.categoryId, total: 0 };
          }
          byCategory[s.categoryId]!.total += s.amountIdr;
        }

        setStats({
          totalThisMonth,
          totalAllTime,
          activeProjects,
          totalPettyCash,
          recentSpendings: all.slice(0, 5),
          byProject,
          byCategory,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Loading dashboard…</p>;
  if (!stats) return <p className="text-sm text-red-500">Failed to load dashboard.</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Spending This Month" value={formatIDR(stats.totalThisMonth)} />
        <MetricCard title="Total Spending (All Time)" value={formatIDR(stats.totalAllTime)} />
        <MetricCard title="Active Projects" value={String(stats.activeProjects)} />
        <MetricCard title="Total Petty Cash" value={formatIDR(stats.totalPettyCash)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent spendings */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-4">Recent Spendings</h2>
          {stats.recentSpendings.length === 0 ? (
            <p className="text-sm text-gray-400">No spendings yet.</p>
          ) : (
            <ul className="divide-y">
              {stats.recentSpendings.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{s.description ?? "—"}</p>
                    <p className="text-xs text-gray-400">{s.spendingDate}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-right">
                    {formatIDR(s.amountIdr)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* By project */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-4">Spending by Project</h2>
          {Object.values(stats.byProject).length === 0 ? (
            <p className="text-sm text-gray-400">No data yet.</p>
          ) : (
            <ul className="divide-y">
              {Object.values(stats.byProject)
                .sort((a, b) => b.total - a.total)
                .map((p) => (
                  <li key={p.code} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.code}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-right">
                      {formatIDR(p.total)}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

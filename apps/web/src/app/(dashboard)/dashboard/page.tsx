"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatIDR, formatDate } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { Spending } from "@repo/shared";

interface DashboardStats {
  totalThisMonth: number;
  totalAllTime: number;
  activeProjects: number;
  recentSpendings: Spending[];
  byProject: Record<string, { name: string; code: string; total: number }>;
}

function MetricCard({
  title,
  value,
  loading,
  highlight,
}: {
  title: string;
  value: string;
  loading: boolean;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-emerald-200 bg-emerald-50/50" : ""}>
      <CardHeader className="pb-2">
        <CardDescription className={highlight ? "text-emerald-700" : ""}>{title}</CardDescription>
        <CardTitle className={`text-2xl tabular-nums ${highlight ? "text-emerald-800" : ""}`}>
          {loading ? <Skeleton className="h-8 w-36" /> : value}
        </CardTitle>
      </CardHeader>
    </Card>
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

        const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          .toISOString()
          .slice(0, 10);

        const totalThisMonth = all
          .filter((s) => s.spendingDate >= thisMonthStart)
          .reduce((sum, s) => sum + s.amountIdr, 0);

        const totalAllTime = all.reduce((sum, s) => sum + s.amountIdr, 0);
        const activeProjects = projects.filter((p) => p.status === "active").length;

        const byProject: DashboardStats["byProject"] = {};
        for (const s of all) {
          if (!byProject[s.projectId]) {
            const p = projects.find((p) => p.id === s.projectId);
            byProject[s.projectId] = {
              name: p?.name ?? s.projectId,
              code: p?.code ?? "",
              total: 0,
            };
          }
          byProject[s.projectId]!.total += s.amountIdr;
        }

        setStats({
          totalThisMonth,
          totalAllTime,
          activeProjects,
          recentSpendings: all.slice(0, 6),
          byProject,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview of your finance activity</p>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Spending This Month"
          value={loading ? "" : formatIDR(stats?.totalThisMonth ?? 0)}
          loading={loading}
        />
        <MetricCard
          title="Total Spending (All Time)"
          value={loading ? "" : formatIDR(stats?.totalAllTime ?? 0)}
          loading={loading}
        />
        <MetricCard
          title="Active Projects"
          value={loading ? "" : String(stats?.activeProjects ?? 0)}
          loading={loading}
        />
      </div>

      {/* Recent spendings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Spendings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats?.recentSpendings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                      No spendings yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  stats?.recentSpendings.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDate(s.spendingDate)}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate text-sm">
                        {s.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-sm">
                        {formatIDR(s.amountIdr)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Spending by project */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Spending by Project</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">Total Spending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.values(stats?.byProject ?? {}).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                      No data yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  Object.values(stats?.byProject ?? {})
                    .sort((a, b) => b.total - a.total)
                    .map((p) => (
                      <TableRow key={p.code}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {p.code}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{p.name}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-sm">
                          {formatIDR(p.total)}
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

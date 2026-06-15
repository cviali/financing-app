"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { formatIDR, formatDate } from "@/lib/format";
import { directionBadge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download } from "lucide-react";
import type { PettyCashMutation, Project } from "@repo/shared";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<(Project & { pettyCashBalance: number }) | null>(null);
  const [mutations, setMutations] = useState<PettyCashMutation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.projects.get(id), api.projects.pettyCash(id)]).then(([p, pc]) => {
      setProject(p.data);
      setMutations(pc.data.mutations);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) return <p className="text-muted-foreground">Project not found.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
        <p className="text-muted-foreground font-mono text-sm">{project.code}</p>
        {project.description && <p className="text-sm mt-1">{project.description}</p>}
      </div>

      {/* Petty cash balance card */}
      <div className="flex items-start gap-4">
        <Card className="w-fit min-w-[240px] border-emerald-200 bg-emerald-50/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-emerald-700">Shared Petty Cash Balance</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-emerald-800">{formatIDR(project.pettyCashBalance)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">This is the shared pool across all projects.</p>
            <Button variant="outline" size="sm" render={<a href={api.exports.projectPettyCash(id)} download />}>
              <Download className="mr-2 h-3.5 w-3.5" />
              Export This Project's Mutations
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="mutations">
        <TabsList>
          <TabsTrigger value="mutations">This Project's Mutations ({mutations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="mutations" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance After</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mutations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No petty cash mutations yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    mutations.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-muted-foreground text-xs">{formatDate(m.createdAt)}</TableCell>
                        <TableCell>{directionBadge(m.direction)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{formatIDR(m.amountIdr)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatIDR(m.balanceAfterIdr)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{m.note ?? "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

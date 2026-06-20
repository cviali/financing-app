"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { formatIDR, formatDate } from "@/lib/format";
import { directionBadge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";
import type { ProjectBalanceMutation, Project } from "@repo/shared";

function formatIDRInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("id-ID");
}

function parseIDRInput(formatted: string): number {
  return Number(formatted.replace(/\./g, "").replace(/,/g, "")) || 0;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<(Project & { balanceIdr: number }) | null>(null);
  const [mutations, setMutations] = useState<ProjectBalanceMutation[]>([]);
  const [loading, setLoading] = useState(true);
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmountDisplay, setTopupAmountDisplay] = useState("");
  const [topupNote, setTopupNote] = useState("");
  const [topupSaving, setTopupSaving] = useState(false);

  async function load() {
    const [p, b] = await Promise.all([api.projects.get(id), api.projects.balance(id)]);
    setProject(p.data);
    setMutations(b.data.mutations);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [id]);

  async function handleTopup() {
    const amountIdr = parseIDRInput(topupAmountDisplay);
    if (!amountIdr) {
      toast.error("Please enter an amount greater than zero");
      return;
    }
    setTopupSaving(true);
    try {
      await api.projects.topup(id, { amountIdr, note: topupNote || undefined });
      toast.success("Top-up recorded");
      setTopupOpen(false);
      setTopupAmountDisplay("");
      setTopupNote("");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record top-up");
    } finally {
      setTopupSaving(false);
    }
  }

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

      {/* Project balance card */}
      <div className="flex items-start gap-4">
        <Card className="w-fit min-w-[240px] border-emerald-200 bg-emerald-50/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-emerald-700">Project Balance</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-emerald-800">
              {formatIDR(project.balanceIdr)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {user?.role === "admin" && (
                <Button variant="outline" size="sm" onClick={() => setTopupOpen(true)}>
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Top Up
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                render={<a href={api.exports.projectBalance(id)} download />}
              >
                <Download className="mr-2 h-3.5 w-3.5" />
                Export This Project's Mutations
              </Button>
            </div>
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
                        No balance activity yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    mutations.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatDate(m.createdAt)}
                        </TableCell>
                        <TableCell>{directionBadge(m.direction)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatIDR(m.amountIdr)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatIDR(m.balanceAfterIdr)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {m.note ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Top Up Dialog */}
      <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Top up project balance</DialogTitle>
            <DialogDescription>Record an admin top-up to this project's balance.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
                Rp
              </span>
              <Input
                inputMode="numeric"
                placeholder="0"
                className="pl-8"
                value={topupAmountDisplay}
                onChange={(e) => setTopupAmountDisplay(formatIDRInput(e.target.value))}
              />
            </div>
            <Textarea
              placeholder="Note (optional)"
              value={topupNote}
              onChange={(e) => setTopupNote(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTopupOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTopup} disabled={topupSaving}>
              {topupSaving ? "Saving…" : "Top Up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

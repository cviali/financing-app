"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { DataTable } from "@/components/ui/data-table";
import { statusBadge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createProjectSchema, type CreateProjectInput } from "@repo/shared/schemas/projects";
import { MoreHorizontal, Plus } from "lucide-react";
import type { Project } from "@repo/shared";

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: "", code: "", description: "" },
  });

  async function load() {
    try {
      const { data } = await api.projects.list();
      setProjects(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function onSubmit(data: CreateProjectInput) {
    setSaving(true);
    try {
      await api.projects.create(data);
      toast.success("Project created");
      setSheetOpen(false);
      form.reset();
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
    { accessorKey: "code", header: "Code", cell: (i) => <span className="font-mono text-xs">{i.getValue<string>()}</span> },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "description", header: "Description", cell: (i) => <span className="text-muted-foreground">{i.getValue<string | null>() ?? "—"}</span> },
    { accessorKey: "status", header: "Status", cell: (i) => statusBadge(i.getValue<string>()) },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<Link href={`/projects/${row.original.id}`} />}>
              View Details
            </DropdownMenuItem>
            {user?.role === "admin" && row.original.status === "active" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => handleArchive(row.original.id)}
                >
                  Archive
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm">Manage and track your projects</p>
        </div>
        {user?.role === "admin" && (
          <Button onClick={() => setSheetOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Project
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <DataTable columns={columns} data={projects} filterPlaceholder="Search projects…" />
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md flex flex-col p-0 gap-0">
          <SheetHeader className="px-6 py-5 border-b">
            <SheetTitle>New Project</SheetTitle>
            <SheetDescription>Create a new project to track spendings against.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <Form {...form}>
              <form id="project-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name</FormLabel>
                      <FormControl><Input placeholder="Q3 Operations" className="w-full" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Code</FormLabel>
                      <FormControl><Input placeholder="Q3-OPS" className="font-mono w-full" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl>
                      <p className="text-xs text-muted-foreground">Uppercase letters, numbers, dashes and underscores only.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description <span className="text-muted-foreground font-normal text-xs">optional</span></FormLabel>
                      <FormControl><Textarea placeholder="Brief description of this project" rows={3} className="w-full resize-none" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>
          <div className="border-t px-6 py-4 flex gap-3">
            <Button type="submit" form="project-form" disabled={saving} className="flex-1">
              {saving ? "Creating…" : "Create Project"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

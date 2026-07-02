"use client";

import { useEffect, useState, useRef } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api";
import { formatIDR, formatDate, formatDayMonthYear, formatJakartaDateTime } from "@/lib/format";
import { useAuth } from "@/context/auth";
import { DataTable } from "@/components/ui/data-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createSpendingSchema } from "@repo/shared/schemas/spendings";
import { Download, MoreHorizontal, Plus, Paperclip, X } from "lucide-react";
import type { Spending, Project, Category } from "@repo/shared";
import type { z } from "zod";

type SpendingFormInput = z.input<typeof createSpendingSchema>;

// ── IDR helpers ────────────────────────────────────────────────────────────────
function formatIDRInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("id-ID");
}

function parseIDRInput(formatted: string): number {
  return Number(formatted.replace(/\./g, "").replace(/,/g, "")) || 0;
}

// ── Receipt upload helper ──────────────────────────────────────────────────────
async function uploadReceipt(
  file: File,
  projectId: string,
): Promise<{
  receiptObjectKey: string;
  receiptFileName: string;
  receiptContentType: string;
  receiptSizeBytes: number;
} | null> {
  try {
    const { data } = await api.receipts.upload(file, projectId, file.name);
    return {
      receiptObjectKey: data.objectKey,
      receiptFileName: data.fileName,
      receiptContentType: data.contentType,
      receiptSizeBytes: data.sizeBytes,
    };
  } catch {
    toast.error("Receipt upload failed — spending will be saved without receipt.");
    return null;
  }
}

export default function SpendingsPage() {
  const { user } = useAuth();
  const [spendings, setSpendings] = useState<Spending[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetMode, setSheetMode] = useState<"create" | "edit" | null>(null);
  const [editingSpending, setEditingSpending] = useState<Spending | null>(null);
  const [saving, setSaving] = useState(false);
  const [voidDialog, setVoidDialog] = useState<{ id: string; open: boolean }>({
    id: "",
    open: false,
  });
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [detailSpending, setDetailSpending] = useState<Spending | null>(null);
  // Receipt state — file is uploaded to R2 immediately on pick; metadata is sent on submit
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptMeta, setReceiptMeta] = useState<{
    receiptObjectKey: string;
    receiptFileName: string;
    receiptContentType: string;
    receiptSizeBytes: number;
  } | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // IDR display state
  const [amountDisplay, setAmountDisplay] = useState("");

  const form = useForm<SpendingFormInput>({
    resolver: zodResolver(createSpendingSchema),
    defaultValues: {},
  });
  const selectedProjectId = form.watch("projectId");

  async function load() {
    try {
      const [s, p, c] = await Promise.all([
        api.spendings.list(),
        api.projects.list(),
        api.categories.list(),
      ]);
      setSpendings(s.data);
      setProjects(p.data.filter((x) => x.status === "active"));
      setCategories(c.data.filter((x) => x.status === "active"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditingSpending(null);
    form.reset({});
    setAmountDisplay("");
    setReceiptFile(null);
    setReceiptMeta(null);
    setSheetMode("create");
  }

  function openEdit(s: Spending) {
    setEditingSpending(s);
    form.reset({
      projectId: s.projectId,
      categoryId: s.categoryId,
      amountIdr: s.amountIdr,
      description: s.description ?? "",
      spendingDate: s.spendingDate,
    });
    setAmountDisplay(s.amountIdr ? Number(s.amountIdr).toLocaleString("id-ID") : "");
    setReceiptFile(null);
    setReceiptMeta(null);
    setSheetMode("edit");
  }

  async function onSubmit(data: SpendingFormInput) {
    setSaving(true);
    try {
      // receiptMeta is already populated from the on-pick upload; just merge it
      const payload = { ...data, ...(receiptMeta ?? {}) };
      if (sheetMode === "edit" && editingSpending) {
        await api.spendings.update(editingSpending.id, payload);
        toast.success("Spending updated");
      } else {
        await api.spendings.create(payload);
        toast.success("Spending created");
      }
      setSheetMode(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save spending");
    } finally {
      setSaving(false);
    }
  }

  async function handleVoid() {
    if (!voidReason.trim()) {
      toast.error("Void reason is required");
      return;
    }
    setVoiding(true);
    try {
      await api.spendings.void(voidDialog.id, voidReason);
      toast.success("Spending voided");
      setVoidDialog({ id: "", open: false });
      setVoidReason("");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to void spending");
    } finally {
      setVoiding(false);
    }
  }

  const columns: ColumnDef<Spending>[] = [
    {
      accessorKey: "spendingDate",
      header: "Date",
      cell: (i) => (
        <span className="text-muted-foreground text-xs">{formatDate(i.getValue<string>())}</span>
      ),
    },
    {
      accessorKey: "projectId",
      header: "Project",
      cell: ({ row }) => {
        const p = projects.find((x) => x.id === row.original.projectId);
        return p ? (
          <span className="font-medium text-sm">{p.name}</span>
        ) : (
          <span className="text-muted-foreground text-xs">{row.original.projectId}</span>
        );
      },
    },
    {
      accessorKey: "categoryId",
      header: "Category",
      cell: ({ row }) => {
        const c = categories.find((x) => x.id === row.original.categoryId);
        return <span className="text-sm">{c?.name ?? row.original.categoryId}</span>;
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: (i) => (
        <span className="text-muted-foreground text-sm">{i.getValue<string | null>() ?? "—"}</span>
      ),
    },
    {
      accessorKey: "amountIdr",
      header: "Amount",
      cell: (i) => (
        <span className="tabular-nums font-semibold text-right block">
          {formatIDR(i.getValue<number>())}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const s = row.original;
        if (s.voidedAt) return <span className="text-xs text-muted-foreground italic">Voided</span>;
        const canEdit = user?.role === "admin" || user?.id === s.createdBy;
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon" className="h-8 w-8" />}
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem onClick={() => openEdit(s)}>Edit Spending</DropdownMenuItem>
                )}
                {user?.role === "admin" && (
                  <>
                    {canEdit && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setVoidDialog({ id: s.id, open: true })}
                    >
                      Void Spending
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const sheetOpen = sheetMode !== null;
  const isEditing = sheetMode === "edit";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Spendings</h1>
          <p className="text-muted-foreground text-sm">All recorded spending transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            render={<a href={api.exports.spendings()} download />}
          >
            <Download className="mr-2 h-3.5 w-3.5" /> Export
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New Spending
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Spendings</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <DataTable
              columns={columns}
              data={spendings}
              filterPlaceholder="Search spendings…"
              onRowClick={setDetailSpending}
            />
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={(o) => !o && setSheetMode(null)}>
        <SheetContent className="sm:max-w-md flex flex-col p-0 gap-0">
          <SheetHeader className="px-6 py-5 border-b">
            <SheetTitle>{isEditing ? "Edit Spending" : "New Spending"}</SheetTitle>
            <SheetDescription>
              {isEditing
                ? "Update the details of this spending."
                : "Record a new spending transaction."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <Form {...form}>
              <form id="spending-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {/* Project */}
                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a project…">
                              {field.value
                                ? (projects.find((p) => p.id === field.value)?.name ?? field.value)
                                : undefined}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              <span>{p.name}</span>
                              <span className="ml-1.5 text-xs text-muted-foreground font-mono">
                                ({p.code})
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Category */}
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a category…">
                              {field.value
                                ? (categories.find((c) => c.id === field.value)?.name ??
                                  field.value)
                                : undefined}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Amount IDR — formatted display */}
                <FormField
                  control={form.control}
                  name="amountIdr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (IDR)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
                            Rp
                          </span>
                          <Input
                            inputMode="numeric"
                            placeholder="0"
                            className="pl-8"
                            value={amountDisplay}
                            onChange={(e) => {
                              const fmt = formatIDRInput(e.target.value);
                              setAmountDisplay(fmt);
                              field.onChange(parseIDRInput(fmt));
                            }}
                            onBlur={field.onBlur}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Date */}
                <FormField
                  control={form.control}
                  name="spendingDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value}
                          onChange={field.onChange}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Description
                        <span className="ml-1 text-xs text-muted-foreground font-normal">
                          optional
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What was this spending for?"
                          className="resize-none w-full"
                          rows={2}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Receipt upload */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium leading-none">
                    Receipt / Invoice
                    <span className="ml-1 text-xs text-muted-foreground font-normal">
                      optional · JPG, PNG, WebP · max 5 MB
                    </span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error("File is too large. Maximum size is 5 MB.");
                        return;
                      }
                      const projectId = form.getValues("projectId");
                      if (!projectId) {
                        toast.error("Please select a project before attaching a receipt.");
                        return;
                      }
                      setReceiptFile(file);
                      setReceiptMeta(null);
                      setUploadingReceipt(true);
                      try {
                        const meta = await uploadReceipt(file, projectId);
                        if (meta) {
                          setReceiptMeta(meta);
                          toast.success("Receipt uploaded successfully.");
                        } else {
                          setReceiptFile(null);
                        }
                      } finally {
                        setUploadingReceipt(false);
                      }
                    }}
                  />
                  {receiptFile ? (
                    <div
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                        uploadingReceipt
                          ? "bg-amber-50 border-amber-200"
                          : receiptMeta
                            ? "bg-emerald-50 border-emerald-200"
                            : "bg-muted/50"
                      }`}
                    >
                      <Paperclip
                        className={`h-4 w-4 shrink-0 ${
                          uploadingReceipt
                            ? "text-amber-500 animate-pulse"
                            : receiptMeta
                              ? "text-emerald-600"
                              : "text-muted-foreground"
                        }`}
                      />
                      <span className="text-sm truncate flex-1">
                        {uploadingReceipt ? `Uploading ${receiptFile.name}…` : receiptFile.name}
                      </span>
                      {receiptMeta && (
                        <span className="text-xs text-emerald-600 shrink-0 font-medium">
                          ✓ Uploaded
                        </span>
                      )}
                      {!uploadingReceipt && (
                        <button
                          type="button"
                          onClick={() => {
                            setReceiptFile(null);
                            setReceiptMeta(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="text-muted-foreground hover:text-foreground shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!selectedProjectId || uploadingReceipt}
                    >
                      <Paperclip className="mr-2 h-4 w-4" />
                      {selectedProjectId ? "Attach receipt" : "Select a project first"}
                    </Button>
                  )}
                  {editingSpending?.receiptFileName && !receiptFile && (
                    <p className="text-xs text-muted-foreground">
                      Current:{" "}
                      <span className="font-medium">{editingSpending.receiptFileName}</span>
                    </p>
                  )}
                </div>
              </form>
            </Form>
          </div>

          {/* Footer buttons */}
          <div className="border-t px-6 py-4 flex gap-3">
            <Button
              type="submit"
              form="spending-form"
              disabled={saving || uploadingReceipt}
              className="flex-1"
            >
              {saving
                ? "Saving…"
                : uploadingReceipt
                  ? "Uploading receipt…"
                  : isEditing
                    ? "Update Spending"
                    : "Create Spending"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setSheetMode(null)}>
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Detail Sheet (read-only) */}
      <Sheet open={detailSpending !== null} onOpenChange={(o) => !o && setDetailSpending(null)}>
        <SheetContent className="sm:max-w-md flex flex-col p-0 gap-0">
          <SheetHeader className="px-6 py-5 border-b">
            <SheetTitle>Spending Detail</SheetTitle>
            <SheetDescription>Full details for this spending transaction.</SheetDescription>
          </SheetHeader>

          {detailSpending && (
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {detailSpending.voidedAt && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 space-y-1">
                  <Badge variant="destructive">Voided</Badge>
                  {detailSpending.voidReason && (
                    <p className="text-sm text-muted-foreground">{detailSpending.voidReason}</p>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Project</p>
                <p className="text-sm font-medium">
                  {(() => {
                    const p = projects.find((x) => x.id === detailSpending.projectId);
                    return p ? `${p.name} (${p.code})` : detailSpending.projectId;
                  })()}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Category</p>
                <p className="text-sm font-medium">
                  {categories.find((x) => x.id === detailSpending.categoryId)?.name ??
                    detailSpending.categoryId}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="text-sm font-semibold tabular-nums">
                  {formatIDR(detailSpending.amountIdr)}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-sm">{formatDayMonthYear(detailSpending.spendingDate)}</p>
              </div>

              {detailSpending.description && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="text-sm">{detailSpending.description}</p>
                </div>
              )}

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Created by</p>
                <p className="text-sm">
                  {detailSpending.createdByUsername ?? detailSpending.createdBy}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-xs">{formatJakartaDateTime(detailSpending.createdAt)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Updated</p>
                  <p className="text-xs">{formatJakartaDateTime(detailSpending.updatedAt)}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Receipt</p>
                {detailSpending.receiptObjectKey ? (
                  <img
                    src={api.receipts.view(detailSpending.receiptObjectKey)}
                    alt={detailSpending.receiptFileName ?? "Receipt"}
                    className="rounded-md border max-h-96 w-full object-contain"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No receipt attached</p>
                )}
              </div>
            </div>
          )}

          <div className="border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setDetailSpending(null)}
            >
              Close
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Void Dialog */}
      <Dialog open={voidDialog.open} onOpenChange={(open) => setVoidDialog({ id: "", open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void this spending?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. A reversal entry will be created on the project's
              balance automatically.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for voiding (e.g. duplicate entry, cancelled purchase)"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidDialog({ id: "", open: false })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleVoid} disabled={voiding}>
              {voiding ? "Voiding…" : "Yes, void it"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

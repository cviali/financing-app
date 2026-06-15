"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { DataTable } from "@/components/ui/data-table";
import { roleBadge, statusBadge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenuLabel,
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createUserSchema } from "@repo/shared/schemas/auth";
import type { z } from "zod";
import { MoreHorizontal, Plus } from "lucide-react";
import type { User } from "@repo/shared";

type CreateUserInput = z.output<typeof createUserSchema>;
type CreateUserFormInput = z.input<typeof createUserSchema>;

export default function UsersPage() {
  const { user: me } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetDialog, setResetDialog] = useState<{ id: string; username: string; open: boolean }>({ id: "", username: "", open: false });
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const form = useForm<CreateUserFormInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: "staff", status: "active", mustChangePassword: true },
  });

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

  async function onSubmit(data: CreateUserFormInput) {
    setSaving(true);
    try {
      await api.users.create(data as unknown as CreateUserInput);
      toast.success("User created");
      setSheetOpen(false);
      form.reset({ role: "staff", status: "active", mustChangePassword: true });
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!newPassword.trim()) { toast.error("Password is required"); return; }
    setResetting(true);
    try {
      await api.users.resetPassword(resetDialog.id, newPassword);
      toast.success("Password reset");
      setResetDialog({ id: "", username: "", open: false });
      setNewPassword("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setResetting(false);
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
    { accessorKey: "username", header: "Username", cell: (i) => <span className="font-mono text-sm">{i.getValue<string>()}</span> },
    { accessorKey: "displayName", header: "Display Name" },
    { accessorKey: "role", header: "Role", cell: (i) => roleBadge(i.getValue<string>()) },
    { accessorKey: "status", header: "Status", cell: (i) => statusBadge(i.getValue<string>()) },
    {
      accessorKey: "mustChangePassword",
      header: "Force PW Change",
      cell: (i) => <span className={i.getValue<boolean>() ? "text-amber-600 text-xs font-medium" : "text-muted-foreground text-xs"}>{i.getValue<boolean>() ? "Yes" : "No"}</span>,
    },
    {
      accessorKey: "lastLoginAt",
      header: "Last Login",
      cell: (i) => <span className="text-muted-foreground text-xs">{i.getValue<string | null>() ? new Date(i.getValue<string>()).toLocaleDateString("id-ID") : "Never"}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const u = row.original;
        if (u.id === me?.id) return <span className="text-xs text-muted-foreground">You</span>;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
            <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-muted-foreground text-xs">{u.username}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setResetDialog({ id: u.id, username: u.username, open: true })}>
                Reset Password
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleRole(u)}>
                Make {u.role === "admin" ? "Staff" : "Admin"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className={u.status === "active" ? "text-destructive focus:text-destructive" : ""}
                onClick={() => handleToggleStatus(u)}
              >
                {u.status === "active" ? "Disable" : "Enable"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (me?.role !== "admin") return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground text-sm">Manage team members and access</p>
        </div>
        <Button onClick={() => setSheetOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New User
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Users</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <DataTable columns={columns} data={users} filterPlaceholder="Search users…" />
          )}
        </CardContent>
      </Card>

      {/* Create user sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>New User</SheetTitle>
            <SheetDescription>Create a new team member account. They must change their password on first login.</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl><Input placeholder="john.doe" className="font-mono" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temporary Password</FormLabel>
                      <FormControl><Input type="password" placeholder="Min. 10 characters" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={saving} className="flex-1">
                    {saving ? "Creating…" : "Create User"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
                </div>
              </form>
            </Form>
          </div>
        </SheetContent>
      </Sheet>

      {/* Reset password dialog */}
      <Dialog open={resetDialog.open} onOpenChange={(open) => setResetDialog({ id: "", username: "", open })}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new temporary password for <strong>{resetDialog.username}</strong>. They will be required to change it on next login.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            placeholder="New password (min. 10 chars)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialog({ id: "", username: "", open: false })}>Cancel</Button>
            <Button onClick={handleReset} disabled={resetting}>
              {resetting ? "Resetting…" : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

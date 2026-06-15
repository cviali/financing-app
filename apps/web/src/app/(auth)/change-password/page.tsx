"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, type ChangePasswordInput } from "@repo/shared/schemas/auth";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ShieldCheck } from "lucide-react";

const FIELDS = [
  { name: "currentPassword" as const, label: "Current Password", autoComplete: "current-password" },
  { name: "newPassword" as const, label: "New Password", autoComplete: "new-password" },
  { name: "confirmPassword" as const, label: "Confirm New Password", autoComplete: "new-password" },
];

export default function ChangePasswordPage() {
  const router = useRouter();
  const { refetch } = useAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(data: ChangePasswordInput) {
    setLoading(true);
    try {
      const res = await api.auth.changePassword(data);
      // Cache the new CSRF token issued after password change
      if (res.data.csrfToken) {
        const { setCsrfToken } = await import("@/lib/api");
        setCsrfToken(res.data.csrfToken);
      }
      await refetch();
      toast.success("Password changed — welcome!");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-white mb-3">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900">Set a new password</h1>
          <p className="text-sm text-zinc-500 mt-1">You must change your password before continuing.</p>
        </div>

        <Card className="shadow-md">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg">Change Password</CardTitle>
            <CardDescription>Password must be at least 10 characters.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {FIELDS.map(({ name, label, autoComplete }) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{label}</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••••"
                            autoComplete={autoComplete}
                            disabled={loading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
                <Button type="submit" className="w-full mt-2" disabled={loading}>
                  {loading ? "Saving…" : "Change Password & Continue"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

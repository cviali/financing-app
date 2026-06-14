"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createSpendingSchema } from "@repo/shared/schemas/spendings";
import type { z } from "zod";

// react-hook-form uses the schema's input type; the output type (with defaults resolved)
// is what we send to the API.
type SpendingFormInput = z.input<typeof createSpendingSchema>;
type SpendingFormOutput = z.output<typeof createSpendingSchema>;
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { Project, Category } from "@repo/shared";

export default function NewSpendingPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<SpendingFormInput>({
    resolver: zodResolver(createSpendingSchema),
    defaultValues: { pettyCashCutIdr: 0, paymentSource: "external" },
  });

  const paymentSource = watch("paymentSource");

  useEffect(() => {
    Promise.all([api.projects.list(), api.categories.list()]).then(([p, c]) => {
      setProjects(p.data.filter((x) => x.status === "active"));
      setCategories(c.data.filter((x) => x.status === "active"));
    });
  }, []);

  async function onSubmit(data: SpendingFormInput) {
    const payload = data as unknown as SpendingFormOutput;
    setLoading(true);
    try {
      await api.spendings.create(payload);
      toast.success("Spending created");
      router.push("/spendings");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create spending");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">New Spending</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium mb-1">Project</label>
          <select className="w-full rounded-md border px-3 py-2 text-sm" {...register("projectId")}>
            <option value="">Select project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
            ))}
          </select>
          {errors.projectId && <p className="text-xs text-red-500 mt-1">{errors.projectId.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select className="w-full rounded-md border px-3 py-2 text-sm" {...register("categoryId")}>
            <option value="">Select category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {errors.categoryId && <p className="text-xs text-red-500 mt-1">{errors.categoryId.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Payment Source</label>
          <select className="w-full rounded-md border px-3 py-2 text-sm" {...register("paymentSource")}>
            <option value="external">External</option>
            <option value="project_petty_cash">Project Petty Cash</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Amount (IDR)</label>
          <input
            type="number"
            min={1}
            step={1}
            className="w-full rounded-md border px-3 py-2 text-sm"
            {...register("amountIdr", { valueAsNumber: true })}
          />
          {errors.amountIdr && <p className="text-xs text-red-500 mt-1">{errors.amountIdr.message}</p>}
        </div>

        {paymentSource === "external" && (
          <div>
            <label className="block text-sm font-medium mb-1">Petty Cash Cut (IDR)</label>
            <input
              type="number"
              min={0}
              step={1}
              className="w-full rounded-md border px-3 py-2 text-sm"
              {...register("pettyCashCutIdr", { valueAsNumber: true })}
            />
            {errors.pettyCashCutIdr && (
              <p className="text-xs text-red-500 mt-1">{errors.pettyCashCutIdr.message}</p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <input
            type="text"
            className="w-full rounded-md border px-3 py-2 text-sm"
            {...register("description")}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <input
            type="date"
            className="w-full rounded-md border px-3 py-2 text-sm"
            {...register("spendingDate")}
          />
          {errors.spendingDate && <p className="text-xs text-red-500 mt-1">{errors.spendingDate.message}</p>}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Saving…" : "Create Spending"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

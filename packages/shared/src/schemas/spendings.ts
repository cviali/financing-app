import { z } from "zod";
import { PAYMENT_SOURCES, ALLOWED_RECEIPT_MIME_TYPES } from "../constants.js";

export const createSpendingSchema = z
  .object({
    projectId: z.string().min(1),
    categoryId: z.string().min(1),
    amountIdr: z.number().int().positive("Amount must be a positive integer IDR"),
    paymentSource: z.enum(PAYMENT_SOURCES),
    pettyCashCutIdr: z.number().int().min(0, "Petty cash cut must be >= 0").default(0),
    description: z.string().max(500).optional(),
    spendingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  })
  .refine(
    (d) => {
      if (d.paymentSource === "project_petty_cash") {
        return d.pettyCashCutIdr === 0;
      }
      return true;
    },
    { message: "petty_cash_cut_idr must be 0 for project_petty_cash payments", path: ["pettyCashCutIdr"] },
  )
  .refine(
    (d) => {
      if (d.paymentSource === "external") {
        return d.pettyCashCutIdr <= d.amountIdr;
      }
      return true;
    },
    { message: "petty_cash_cut_idr must be <= amount_idr", path: ["pettyCashCutIdr"] },
  );

export const updateSpendingSchema = z
  .object({
    projectId: z.string().min(1).optional(),
    categoryId: z.string().min(1).optional(),
    amountIdr: z.number().int().positive().optional(),
    paymentSource: z.enum(PAYMENT_SOURCES).optional(),
    pettyCashCutIdr: z.number().int().min(0).optional(),
    description: z.string().max(500).optional(),
    spendingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .refine(
    (d) => {
      if (d.paymentSource === "project_petty_cash") {
        return d.pettyCashCutIdr === 0 || d.pettyCashCutIdr === undefined;
      }
      return true;
    },
    { message: "petty_cash_cut_idr must be 0 for project_petty_cash payments", path: ["pettyCashCutIdr"] },
  );

export const voidSpendingSchema = z.object({
  voidReason: z.string().min(1).max(500),
});

export const uploadUrlSchema = z.object({
  projectId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_RECEIPT_MIME_TYPES),
  sizeBytes: z.number().int().min(1).max(5 * 1024 * 1024),
});

export type CreateSpendingInput = z.infer<typeof createSpendingSchema>;
export type UpdateSpendingInput = z.infer<typeof updateSpendingSchema>;
export type VoidSpendingInput = z.infer<typeof voidSpendingSchema>;
export type UploadUrlInput = z.infer<typeof uploadUrlSchema>;

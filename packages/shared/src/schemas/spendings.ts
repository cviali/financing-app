import { z } from "zod";
import { ALLOWED_RECEIPT_MIME_TYPES } from "../constants.js";

export const createSpendingSchema = z.object({
  projectId: z.string().min(1, "Please select a project"),
  categoryId: z.string().min(1, "Please select a category"),
  amountIdr: z
    .number()
    .int("Amount must be a whole number")
    .positive("Amount must be greater than zero"),
  description: z.string().max(500, "Description is too long (max 500 characters)").optional(),
  spendingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please enter a valid date"),
  receiptObjectKey: z.string().min(1).optional(),
  receiptFileName: z.string().min(1).max(255).optional(),
  receiptContentType: z.enum(ALLOWED_RECEIPT_MIME_TYPES).optional(),
  receiptSizeBytes: z
    .number()
    .int()
    .min(1)
    .max(5 * 1024 * 1024)
    .optional(),
});

export const updateSpendingSchema = z.object({
  projectId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  amountIdr: z.number().int().positive().optional(),
  description: z.string().max(500).optional(),
  spendingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  receiptObjectKey: z.string().min(1).optional(),
  receiptFileName: z.string().min(1).max(255).optional(),
  receiptContentType: z.enum(ALLOWED_RECEIPT_MIME_TYPES).optional(),
  receiptSizeBytes: z
    .number()
    .int()
    .min(1)
    .max(5 * 1024 * 1024)
    .optional(),
});

export const voidSpendingSchema = z.object({
  voidReason: z.string().min(1).max(500),
});

export const uploadUrlSchema = z.object({
  projectId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_RECEIPT_MIME_TYPES),
  sizeBytes: z
    .number()
    .int()
    .min(1)
    .max(5 * 1024 * 1024),
});

export type CreateSpendingInput = z.infer<typeof createSpendingSchema>;
export type UpdateSpendingInput = z.infer<typeof updateSpendingSchema>;
export type VoidSpendingInput = z.infer<typeof voidSpendingSchema>;
export type UploadUrlInput = z.infer<typeof uploadUrlSchema>;

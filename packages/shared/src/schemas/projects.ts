import { z } from "zod";
import { PROJECT_STATUSES } from "../constants.js";

export const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100, "Name is too long"),
  code: z
    .string()
    .min(1, "Project code is required")
    .max(20, "Code must be 20 characters or less")
    .regex(
      /^[A-Z0-9_\-]+$/,
      "Code must use uppercase letters, numbers, dashes, or underscores only",
    ),
  description: z.string().max(500, "Description is too long").optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100).optional(),
  description: z.string().max(500).optional(),
});

export const topupProjectSchema = z.object({
  amountIdr: z
    .number()
    .int("Amount must be a whole number")
    .positive("Amount must be greater than zero"),
  note: z.string().max(500, "Note is too long (max 500 characters)").optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100, "Name is too long"),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type TopupProjectInput = z.infer<typeof topupProjectSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

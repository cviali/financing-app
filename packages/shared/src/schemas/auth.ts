import { z } from "zod";
import { USERNAME_REGEX, PASSWORD_MIN_LENGTH, ROLES, USER_STATUSES } from "../constants.js";

export const usernameSchema = z
  .string()
  .regex(USERNAME_REGEX, "Username must be 3-32 lowercase letters, numbers, underscore, dot, or dash");

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`);

export const loginSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const createUserSchema = z.object({
  username: usernameSchema,
  displayName: z.string().min(1).max(100),
  role: z.enum(ROLES),
  password: passwordSchema,
  status: z.enum(USER_STATUSES).default("active"),
  mustChangePassword: z.boolean().default(true),
});

export const updateUserSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  status: z.enum(USER_STATUSES).optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(ROLES),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(USER_STATUSES),
});

export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

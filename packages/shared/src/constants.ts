// shared constants
export const USERNAME_REGEX = /^[a-z0-9_.\-]{3,32}$/;
export const PASSWORD_MIN_LENGTH = 10;

export const ROLES = ["admin", "staff"] as const;
export const USER_STATUSES = ["active", "disabled"] as const;
export const PROJECT_STATUSES = ["active", "archived"] as const;
export const CATEGORY_STATUSES = ["active", "archived"] as const;
export const MUTATION_DIRECTIONS = ["in", "out"] as const;
export const AUTH_PROVIDERS = ["local"] as const;

export const ALLOWED_RECEIPT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export type Role = (typeof ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type CategoryStatus = (typeof CATEGORY_STATUSES)[number];
export type MutationDirection = (typeof MUTATION_DIRECTIONS)[number];

const API_BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:8787";

// Reads the csrf_token cookie (set as non-HttpOnly by the API on login)
function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1] ?? "") : "";
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("X-CSRF-Token", getCsrfToken());
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error((body as { error?: string }).error ?? "Request failed"), {
      status: res.status,
    });
  }

  return res.json() as Promise<T>;
}

// Auth
export const api = {
  auth: {
    login: (body: { username: string; password: string }) =>
      apiFetch<{ data: { id: string; username: string; displayName: string; role: string; mustChangePassword: boolean } }>(
        "/auth/login",
        { method: "POST", body: JSON.stringify(body) },
      ),
    logout: () => apiFetch<{ data: { ok: boolean } }>("/auth/logout", { method: "POST" }),
    me: () => apiFetch<{ data: import("@repo/shared").User }>("/auth/me"),
    changePassword: (body: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      apiFetch<{ data: { ok: boolean } }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },
  users: {
    list: () => apiFetch<{ data: import("@repo/shared").User[] }>("/users"),
    create: (body: unknown) =>
      apiFetch<{ data: import("@repo/shared").User }>("/users", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: unknown) =>
      apiFetch<{ data: { ok: boolean } }>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    updateRole: (id: string, role: string) =>
      apiFetch<{ data: { ok: boolean } }>(`/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
    updateStatus: (id: string, status: string) =>
      apiFetch<{ data: { ok: boolean } }>(`/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    resetPassword: (id: string, newPassword: string) =>
      apiFetch<{ data: { ok: boolean } }>(`/users/${id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ newPassword }),
      }),
  },
  projects: {
    list: () => apiFetch<{ data: import("@repo/shared").Project[] }>("/projects"),
    get: (id: string) =>
      apiFetch<{ data: import("@repo/shared").Project & { pettyCashBalance: number } }>(`/projects/${id}`),
    create: (body: unknown) =>
      apiFetch<{ data: import("@repo/shared").Project }>("/projects", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: unknown) =>
      apiFetch<{ data: { ok: boolean } }>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    archive: (id: string) =>
      apiFetch<{ data: { ok: boolean } }>(`/projects/${id}/archive`, { method: "POST" }),
    pettyCash: (id: string) =>
      apiFetch<{ data: { balance: number; mutations: import("@repo/shared").PettyCashMutation[] } }>(
        `/projects/${id}/petty-cash`,
      ),
  },
  categories: {
    list: () => apiFetch<{ data: import("@repo/shared").Category[] }>("/categories"),
    create: (body: unknown) =>
      apiFetch<{ data: import("@repo/shared").Category }>("/categories", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: string, body: unknown) =>
      apiFetch<{ data: { ok: boolean } }>(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    archive: (id: string) =>
      apiFetch<{ data: { ok: boolean } }>(`/categories/${id}/archive`, { method: "POST" }),
  },
  spendings: {
    list: () => apiFetch<{ data: import("@repo/shared").Spending[] }>("/spendings"),
    get: (id: string) => apiFetch<{ data: import("@repo/shared").Spending }>(`/spendings/${id}`),
    create: (body: unknown) =>
      apiFetch<{ data: import("@repo/shared").Spending }>("/spendings", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: string, body: unknown) =>
      apiFetch<{ data: { ok: boolean } }>(`/spendings/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    void: (id: string, voidReason: string) =>
      apiFetch<{ data: { ok: boolean } }>(`/spendings/${id}/void`, {
        method: "POST",
        body: JSON.stringify({ voidReason }),
      }),
  },
  receipts: {
    getUploadUrl: (body: { projectId: string; fileName: string; contentType: string; sizeBytes: number }) =>
      apiFetch<{
        data: { uploadUrl: string; objectKey: string; fileName: string; contentType: string; sizeBytes: number };
      }>("/receipts/upload-url", { method: "POST", body: JSON.stringify(body) }),
  },
  exports: {
    spendings: () => `${API_BASE}/exports/spendings`,
    projectPettyCash: (id: string) => `${API_BASE}/exports/projects/${id}/petty-cash`,
  },
};

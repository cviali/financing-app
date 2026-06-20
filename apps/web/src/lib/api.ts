// Same-origin Next.js proxy (see app/api/proxy/[...path]/route.ts) — required so the
// session cookie lands host-only on whatever origin the browser is actually on
// (workers.dev prod subdomain, localhost in dev, etc). A direct cross-site fetch to the
// API would get a cookie scoped to .christianviali0.workers.dev with SameSite=Lax, which
// browsers never attach to a request from a different site (e.g. localhost).
const API_BASE = "/api/proxy";

// In-memory CSRF token cache — set from login/me response bodies.
// Avoids relying on document.cookie cross-origin visibility (workers.dev PSL issue).
let _csrfToken = "";

export function setCsrfToken(token: string) {
  _csrfToken = token;
}

function getCsrfToken(): string {
  if (_csrfToken) return _csrfToken;
  // Fallback: try cookie (works when both subdomains are truly same-site)
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
    login: async (body: { username: string; password: string }) => {
      const res = await apiFetch<{
        data: {
          id: string;
          username: string;
          displayName: string;
          role: string;
          mustChangePassword: boolean;
          csrfToken?: string;
        };
      }>("/auth/login", { method: "POST", body: JSON.stringify(body) });
      if (res.data.csrfToken) setCsrfToken(res.data.csrfToken);
      return res;
    },
    logout: () => apiFetch<{ data: { ok: boolean } }>("/auth/logout", { method: "POST" }),
    me: async () => {
      const res = await apiFetch<{ data: import("@repo/shared").User & { csrfToken?: string } }>(
        "/auth/me",
      );
      if (res.data.csrfToken) setCsrfToken(res.data.csrfToken);
      return res;
    },
    changePassword: (body: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }) =>
      apiFetch<{ data: { ok: boolean; csrfToken?: string } }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },
  users: {
    list: () => apiFetch<{ data: import("@repo/shared").User[] }>("/users"),
    create: (body: unknown) =>
      apiFetch<{ data: import("@repo/shared").User }>("/users", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: string, body: unknown) =>
      apiFetch<{ data: { ok: boolean } }>(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    updateRole: (id: string, role: string) =>
      apiFetch<{ data: { ok: boolean } }>(`/users/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    updateStatus: (id: string, status: string) =>
      apiFetch<{ data: { ok: boolean } }>(`/users/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    resetPassword: (id: string, newPassword: string) =>
      apiFetch<{ data: { ok: boolean } }>(`/users/${id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ newPassword }),
      }),
  },
  projects: {
    list: () => apiFetch<{ data: import("@repo/shared").Project[] }>("/projects"),
    get: (id: string) =>
      apiFetch<{ data: import("@repo/shared").Project & { balanceIdr: number } }>(
        `/projects/${id}`,
      ),
    create: (body: unknown) =>
      apiFetch<{ data: import("@repo/shared").Project }>("/projects", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: string, body: unknown) =>
      apiFetch<{ data: { ok: boolean } }>(`/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    archive: (id: string) =>
      apiFetch<{ data: { ok: boolean } }>(`/projects/${id}/archive`, { method: "POST" }),
    balance: (id: string) =>
      apiFetch<{
        data: { balance: number; mutations: import("@repo/shared").ProjectBalanceMutation[] };
      }>(`/projects/${id}/balance`),
    topup: (id: string, body: { amountIdr: number; note?: string | undefined }) =>
      apiFetch<{ data: { ok: boolean; balance: number } }>(`/projects/${id}/topup`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },
  categories: {
    list: () => apiFetch<{ data: import("@repo/shared").Category[] }>("/categories"),
    create: (body: unknown) =>
      apiFetch<{ data: import("@repo/shared").Category }>("/categories", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: string, body: unknown) =>
      apiFetch<{ data: { ok: boolean } }>(`/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
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
      apiFetch<{ data: { ok: boolean } }>(`/spendings/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    void: (id: string, voidReason: string) =>
      apiFetch<{ data: { ok: boolean } }>(`/spendings/${id}/void`, {
        method: "POST",
        body: JSON.stringify({ voidReason }),
      }),
  },
  receipts: {
    getUploadUrl: (body: {
      projectId: string;
      fileName: string;
      contentType: string;
      sizeBytes: number;
    }) =>
      apiFetch<{
        data: {
          uploadUrl: string;
          objectKey: string;
          fileName: string;
          contentType: string;
          sizeBytes: number;
        };
      }>("/receipts/upload-url", { method: "POST", body: JSON.stringify(body) }),
  },
  exports: {
    spendings: () => `${API_BASE}/exports/spendings`, // requires session cookie -> must go via proxy
    projectBalance: (id: string) => `${API_BASE}/exports/projects/${id}/balance-mutations`,
  },
};

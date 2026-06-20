/**
 * Seed script – run via wrangler d1 execute or a local worker.
 * Usage (local):  node --import=tsx src/seed.ts local
 *         remote: node --import=tsx src/seed.ts remote
 *
 * For CI/CD pair with `wrangler d1 execute financing-app --file=seed.sql`
 * by first running this to generate the hash and then substituting.
 *
 * This file is intentionally framework-free (pure WebCrypto + D1 REST-like
 * calls) so it can run in both Node 22 (WebCrypto global) and Workers.
 */

const ADMIN_USERNAME = "admin";
const ADMIN_DISPLAY_NAME = "System Administrator";
const ADMIN_PASSWORD = "ChangeMeAdmin123!";

// ─── PBKDF2 helpers ───────────────────────────────────────────────────────────

const SALT_LEN = 16;
const ITERATIONS = 100_000; // Cloudflare Workers WebCrypto max
const KEY_LEN = 32;
const ALGO = "SHA-256";

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: ALGO },
    keyMaterial,
    KEY_LEN * 8,
  );
  const hashArr = new Uint8Array(derivedBits);
  const saltHex = Array.from(salt, (b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(hashArr, (b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2:${ALGO}:${ITERATIONS}:${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 5 || parts[0] !== "pbkdf2") return false;
  const [, algo, itersStr, saltHex, expectedHash] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];
  const iters = parseInt(itersStr, 10);
  const saltBytes = new Uint8Array(
    (saltHex.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)),
  );
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: iters, hash: algo },
    keyMaterial,
    KEY_LEN * 8,
  );
  const derivedHex = Array.from(new Uint8Array(derivedBits), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  // Constant-time comparison
  if (derivedHex.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < derivedHex.length; i++) {
    diff |= derivedHex.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
}

function generateId(): string {
  return crypto.randomUUID();
}

// ─── Seed ────────────────────────────────────────────────────────────────────

export async function seedAdmin(db: D1Database): Promise<void> {
  // Check if admin already exists
  const existing = await db
    .prepare("SELECT id FROM users WHERE username = ?")
    .bind(ADMIN_USERNAME)
    .first<{ id: string }>();

  if (existing) {
    console.log("Admin user already exists – skipping seed.");
    return;
  }

  const hash = await hashPassword(ADMIN_PASSWORD);
  const now = new Date().toISOString();
  const id = generateId();

  await db
    .prepare(
      `INSERT INTO users (id, username, display_name, password_hash, role, status, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'admin', 'active', 1, ?, ?)`,
    )
    .bind(id, ADMIN_USERNAME, ADMIN_DISPLAY_NAME, hash, now, now)
    .run();

  console.log(`✓ Admin user seeded (username: ${ADMIN_USERNAME})`);
}

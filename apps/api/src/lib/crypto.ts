// PBKDF2 password hashing via WebCrypto (Workers-native, no WASM needed)

const SALT_LEN = 16;
const ITERATIONS = 310_000;
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
  const [, algo, itersStr, saltHex, expectedHash] = parts as [string, string, string, string, string];
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
  if (derivedHex.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < derivedHex.length; i++) {
    diff |= derivedHex.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
}

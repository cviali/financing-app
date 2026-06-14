// Double-submit CSRF protection.
// On login we issue a csrf token in a readable cookie and expect it back in the
// X-CSRF-Token header on state-changing requests (POST/PATCH/PUT/DELETE).
// Both the cookie and the header value are HMAC-SHA256 tokens derived from the
// user's session JWT so they are bound together.

export async function generateCsrfToken(sessionToken: string, csrfSecret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(csrfSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(sessionToken));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyCsrfToken(
  sessionToken: string,
  csrfToken: string,
  csrfSecret: string,
): Promise<boolean> {
  const expected = await generateCsrfToken(sessionToken, csrfSecret);
  if (expected.length !== csrfToken.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ csrfToken.charCodeAt(i);
  }
  return diff === 0;
}

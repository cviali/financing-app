import type { Env } from "../types/env.js";

type AllowedMime = "image/jpeg" | "image/png" | "image/webp";
const EXT_MAP: Record<AllowedMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function buildReceiptObjectKey(
  projectId: string,
  contentType: AllowedMime,
): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const ext = EXT_MAP[contentType];
  const uuid = crypto.randomUUID();
  return `receipts/${projectId}/${yyyy}/${mm}/${uuid}.${ext}`;
}

// R2 presigned PUT URL via the Workers R2 binding .sign() method.
// Available in Workers runtime since 2024-09-23 compatibility date.
export async function generateUploadUrl(
  env: Env,
  objectKey: string,
  contentType: string,
  expiresInSeconds = 300,
): Promise<string> {
  // R2Bucket.sign() is a Workers runtime API not yet in @cloudflare/workers-types
  // Cast to any to call it safely.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bucket = env.RECEIPTS_BUCKET as any;
  const signed = (await bucket.sign(
    new Request(`https://bucket/${objectKey}`, {
      method: "PUT",
      headers: { "Content-Type": contentType },
    }),
    { expiresIn: expiresInSeconds },
  )) as { url: string };
  return signed.url;
}

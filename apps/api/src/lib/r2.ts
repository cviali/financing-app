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

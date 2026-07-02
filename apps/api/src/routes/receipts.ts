import { Hono } from "hono";
import { ALLOWED_RECEIPT_MIME_TYPES, MAX_RECEIPT_SIZE_BYTES } from "@repo/shared";
import { buildReceiptObjectKey } from "../lib/r2.js";
import { dbMiddleware, authMiddleware } from "../middleware/auth.js";
import type { AppContext } from "../types/context.js";

export const receiptsRouter = new Hono<AppContext>();

receiptsRouter.use("*", dbMiddleware, authMiddleware);

// POST /receipts/upload?projectId=...&fileName=...
// Body: raw file bytes. Content-Type header identifies the MIME type.
receiptsRouter.post("/upload", async (c) => {
  const projectId = c.req.query("projectId");
  const fileName = c.req.query("fileName");

  if (!projectId) return c.json({ error: "Missing projectId query param" }, 400);
  if (!fileName) return c.json({ error: "Missing fileName query param" }, 400);

  const contentType = c.req.header("Content-Type") ?? "";
  if (
    !ALLOWED_RECEIPT_MIME_TYPES.includes(contentType as (typeof ALLOWED_RECEIPT_MIME_TYPES)[number])
  ) {
    return c.json(
      {
        error: `Unsupported content type "${contentType}". Allowed: ${ALLOWED_RECEIPT_MIME_TYPES.join(", ")}`,
      },
      422,
    );
  }

  const body = await c.req.arrayBuffer();
  const sizeBytes = body.byteLength;

  if (sizeBytes < 1) {
    return c.json({ error: "Empty file body" }, 400);
  }
  if (sizeBytes > MAX_RECEIPT_SIZE_BYTES) {
    return c.json(
      { error: `File too large: ${sizeBytes} bytes (max ${MAX_RECEIPT_SIZE_BYTES})` },
      422,
    );
  }

  const objectKey = buildReceiptObjectKey(
    projectId,
    contentType as "image/jpeg" | "image/png" | "image/webp",
  );

  await c.env.RECEIPTS_BUCKET.put(objectKey, body, {
    httpMetadata: { contentType },
  });

  return c.json({
    data: {
      objectKey,
      fileName,
      contentType,
      sizeBytes,
    },
  });
});

// GET /receipts/view?key=<objectKey>
receiptsRouter.get("/view", async (c) => {
  const key = c.req.query("key");
  if (!key) return c.json({ error: "Missing key query param" }, 400);

  // Matches buildReceiptObjectKey()'s shape — blocks arbitrary R2 key probing.
  if (!/^receipts\/[^/]+\/\d{4}\/\d{2}\/[0-9a-f-]+\.(jpg|png|webp)$/.test(key)) {
    return c.json({ error: "Invalid receipt key" }, 400);
  }

  const object = await c.env.RECEIPTS_BUCKET.get(key);
  if (!object) return c.json({ error: "Receipt not found" }, 404);

  const headers = new Headers();
  headers.set("Content-Type", object.httpMetadata?.contentType ?? "application/octet-stream");
  headers.set("Content-Length", String(object.size));
  headers.set("Cache-Control", "private, max-age=86400");
  headers.set("Content-Disposition", "inline");

  return new Response(object.body, { headers });
});

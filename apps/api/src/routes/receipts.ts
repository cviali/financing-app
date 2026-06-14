import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { uploadUrlSchema } from "@repo/shared/schemas/spendings";
import { buildReceiptObjectKey, generateUploadUrl } from "../lib/r2.js";
import { dbMiddleware, authMiddleware } from "../middleware/auth.js";
import type { AppContext } from "../types/context.js";

export const receiptsRouter = new Hono<AppContext>();

receiptsRouter.use("*", dbMiddleware, authMiddleware);

// POST /receipts/upload-url
receiptsRouter.post("/upload-url", zValidator("json", uploadUrlSchema), async (c) => {
  const { projectId, fileName, contentType, sizeBytes } = c.req.valid("json");

  const objectKey = buildReceiptObjectKey(projectId, contentType as "image/jpeg" | "image/png" | "image/webp");
  const uploadUrl = await generateUploadUrl(c.env, objectKey, contentType);

  return c.json({
    data: {
      uploadUrl,
      objectKey,
      fileName,
      contentType,
      sizeBytes,
    },
  });
});

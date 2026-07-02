import { Hono } from "hono";
import { eq, isNull, desc } from "drizzle-orm";
import { spendings, projectBalanceMutations, projects, categories, users } from "@repo/db/schema";
import writeXlsx from "write-excel-file/universal";
import { dbMiddleware, authMiddleware } from "../middleware/auth.js";
import { formatJakartaDate, formatJakartaDateTime } from "../lib/date.js";
import type { AppContext } from "../types/context.js";

export const exportsRouter = new Hono<AppContext>();

exportsRouter.use("*", dbMiddleware, authMiddleware);

// GET /exports/spendings
exportsRouter.get("/spendings", async (c) => {
  const db = c.get("db");

  const rows = await db
    .select({
      spendingDate: spendings.spendingDate,
      projectCode: projects.code,
      projectName: projects.name,
      categoryName: categories.name,
      description: spendings.description,
      amountIdr: spendings.amountIdr,
      createdByUsername: users.username,
      receiptObjectKey: spendings.receiptObjectKey,
      createdAt: spendings.createdAt,
      updatedAt: spendings.updatedAt,
    })
    .from(spendings)
    .leftJoin(projects, eq(spendings.projectId, projects.id))
    .leftJoin(categories, eq(spendings.categoryId, categories.id))
    .leftJoin(users, eq(spendings.createdBy, users.id))
    .where(isNull(spendings.voidedAt))
    .orderBy(desc(spendings.spendingDate), desc(spendings.createdAt))
    .all();

  const header = [
    { value: "Date", fontWeight: "bold" },
    { value: "Project Code", fontWeight: "bold" },
    { value: "Project Name", fontWeight: "bold" },
    { value: "Category", fontWeight: "bold" },
    { value: "Description", fontWeight: "bold" },
    { value: "Amount IDR", fontWeight: "bold", align: "right" },
    { value: "Created By", fontWeight: "bold" },
    { value: "Receipt Object Key", fontWeight: "bold" },
    { value: "Created At", fontWeight: "bold" },
    { value: "Updated At", fontWeight: "bold" },
  ] as const;

  const dataRows = rows.map((r) => [
    { value: r.spendingDate ?? "" },
    { value: r.projectCode ?? "" },
    { value: r.projectName ?? "" },
    { value: r.categoryName ?? "" },
    { value: r.description ?? "" },
    { value: r.amountIdr, type: Number, align: "right" as const },
    { value: r.createdByUsername ?? "" },
    { value: r.receiptObjectKey ?? "" },
    { value: formatJakartaDateTime(r.createdAt) },
    { value: formatJakartaDateTime(r.updatedAt) },
  ]);

  const blob = await writeXlsx([[...header], ...dataRows] as unknown as Parameters<
    typeof writeXlsx
  >[0]).toBlob();
  const arrayBuffer = await blob.arrayBuffer();

  return new Response(arrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="spendings-${formatJakartaDate(new Date())}.xlsx"`,
    },
  });
});

// GET /exports/projects/:id/balance-mutations
exportsRouter.get("/projects/:id/balance-mutations", async (c) => {
  const db = c.get("db");
  const { id } = c.req.param();

  const rows = await db
    .select({
      createdAt: projectBalanceMutations.createdAt,
      direction: projectBalanceMutations.direction,
      amountIdr: projectBalanceMutations.amountIdr,
      balanceAfterIdr: projectBalanceMutations.balanceAfterIdr,
      spendingId: projectBalanceMutations.spendingId,
      note: projectBalanceMutations.note,
      createdByUsername: users.username,
    })
    .from(projectBalanceMutations)
    .leftJoin(users, eq(projectBalanceMutations.createdBy, users.id))
    .where(eq(projectBalanceMutations.projectId, id))
    .orderBy(projectBalanceMutations.createdAt)
    .all();

  const header = [
    { value: "Date", fontWeight: "bold" },
    { value: "Direction", fontWeight: "bold" },
    { value: "Amount IDR", fontWeight: "bold", align: "right" },
    { value: "Balance After IDR", fontWeight: "bold", align: "right" },
    { value: "Related Spending ID", fontWeight: "bold" },
    { value: "Note", fontWeight: "bold" },
    { value: "Created By", fontWeight: "bold" },
  ] as const;

  const dataRows = rows.map((r) => [
    { value: formatJakartaDate(r.createdAt) },
    { value: r.direction },
    { value: r.amountIdr, type: Number, align: "right" as const },
    { value: r.balanceAfterIdr, type: Number, align: "right" as const },
    { value: r.spendingId ?? "" },
    { value: r.note ?? "" },
    { value: r.createdByUsername ?? "" },
  ]);

  const blob = await writeXlsx([[...header], ...dataRows] as unknown as Parameters<
    typeof writeXlsx
  >[0]).toBlob();
  const arrayBuffer = await blob.arrayBuffer();

  return new Response(arrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="balance-${id}-${formatJakartaDate(new Date())}.xlsx"`,
    },
  });
});

import type { DrizzleD1Database } from "@repo/db";
import { auditLogs } from "@repo/db/schema";

interface AuditEntry {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

export async function writeAuditLog(db: DrizzleD1Database, entry: AuditEntry): Promise<void> {
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: entry.actorUserId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    beforeJson: entry.before !== undefined ? JSON.stringify(entry.before) : null,
    afterJson: entry.after !== undefined ? JSON.stringify(entry.after) : null,
  });
}

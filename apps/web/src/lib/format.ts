import { format, parse } from "date-fns";
import { formatIDR } from "@repo/shared/money";
export { formatIDR };

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Formats a "yyyy-MM-dd" date string as "01 July 2026" (parsed as local, not UTC). */
export function formatDayMonthYear(dateStr: string): string {
  const date = parse(dateStr, "yyyy-MM-dd", new Date());
  return format(date, "dd MMMM yyyy");
}

/** Formats an ISO timestamp as "01 July 2026, 14:30" in Asia/Jakarta local time. */
export function formatJakartaDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(iso))
    .replace(",", "");
}

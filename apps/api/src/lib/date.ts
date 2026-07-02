const JAKARTA_TZ = "Asia/Jakarta";

/** Formats a Date/ISO string as YYYY-MM-DD in Asia/Jakarta local time. */
export function formatJakartaDate(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  // en-CA locale formats as yyyy-MM-dd natively.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Formats a Date/ISO string as "YYYY-MM-DD HH:mm:ss" in Asia/Jakarta local time (24h). */
export function formatJakartaDateTime(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: JAKARTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

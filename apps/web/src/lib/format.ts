import { formatIDR } from "@repo/shared/money";
export { formatIDR };

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

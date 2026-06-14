import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "bg-gray-100 text-gray-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-yellow-100 text-yellow-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function roleBadge(role: string) {
  return <Badge variant={role === "admin" ? "info" : "default"}>{role}</Badge>;
}

export function statusBadge(status: string) {
  return (
    <Badge variant={status === "active" ? "success" : status === "archived" ? "warning" : "danger"}>
      {status}
    </Badge>
  );
}

export function paymentSourceBadge(source: string) {
  return (
    <Badge variant={source === "project_petty_cash" ? "warning" : "default"}>
      {source === "project_petty_cash" ? "Petty Cash" : "External"}
    </Badge>
  );
}

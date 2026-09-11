import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "@/lib/types";

const STYLES: Record<BookingStatus, { label: string; cls: string }> = {
  NEW: { label: "New", cls: "bg-warning text-warning-foreground hover:bg-warning" },
  ASSIGNED: { label: "Assigned", cls: "bg-secondary text-secondary-foreground hover:bg-secondary" },
  PENDING_SUPPLIER: {
    label: "Pending supplier",
    cls: "bg-warning text-warning-foreground hover:bg-warning",
  },
  AWAITING_CUSTOMER: {
    label: "Awaiting customer",
    cls: "border border-border text-muted-foreground hover:bg-accent",
  },
  AWAITING_PAYMENT: {
    label: "Awaiting payment",
    cls: "bg-warning text-warning-foreground hover:bg-warning",
  },
  CONFIRMED: { label: "Confirmed", cls: "bg-success text-success-foreground hover:bg-success" },
  CANCELLED: {
    label: "Cancelled",
    cls: "bg-destructive text-destructive-foreground hover:bg-destructive",
  },
  COMPLETED: { label: "Completed", cls: "bg-secondary text-muted-foreground hover:bg-secondary" },
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const s = STYLES[status] ?? {
    label: status,
    cls: "bg-muted text-muted-foreground hover:bg-muted",
  };
  return <Badge className={s.cls}>{s.label}</Badge>;
}

export const BOOKING_STATUSES = Object.keys(STYLES) as BookingStatus[];

export const NEXT_STATUS: Partial<Record<BookingStatus, BookingStatus>> = {
  NEW: "ASSIGNED",
  ASSIGNED: "PENDING_SUPPLIER",
  PENDING_SUPPLIER: "AWAITING_PAYMENT",
  AWAITING_PAYMENT: "CONFIRMED",
  CONFIRMED: "COMPLETED",
};

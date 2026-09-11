import { useEffect, useState } from "react";
import { Building2, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createSupplierConfirmation,
  getBookingCosting,
  listSuppliers,
  listSupplierConfirmations,
  updateSupplierConfirmation,
} from "@/lib/api/suppliers";
import type {
  BookingCostingDTO,
  SupplierConfirmationDTO,
  SupplierDTO,
  SupplierStatus,
} from "@/lib/types";
import { money } from "@/lib/pricing";

const STATUS_LABEL: Record<SupplierStatus, string> = {
  REQUESTED: "Awaiting confirmation",
  CONFIRMED: "Confirmed",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
};

function statusBadge(status: SupplierStatus) {
  const cls =
    status === "CONFIRMED"
      ? "bg-success text-success-foreground hover:bg-success"
      : status === "DECLINED" || status === "CANCELLED"
        ? "bg-destructive text-destructive-foreground hover:bg-destructive"
        : "bg-warning text-warning-foreground hover:bg-warning";
  return <Badge className={cls}>{STATUS_LABEL[status]}</Badge>;
}

export function SupplierPanel({
  bookingId,
  propertyName,
}: {
  bookingId: string;
  propertyName: string;
}) {
  const [suppliers, setSuppliers] = useState<SupplierDTO[]>([]);
  const [confirmations, setConfirmations] = useState<SupplierConfirmationDTO[]>([]);
  const [costing, setCosting] = useState<BookingCostingDTO | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const [supplierList, confs, cost] = await Promise.all([
      listSuppliers(),
      listSupplierConfirmations({ data: bookingId }),
      getBookingCosting({ data: bookingId }),
    ]);
    setSuppliers(supplierList);
    setConfirmations(confs);
    setCosting(cost);
  };

  useEffect(() => {
    void refresh();
  }, [bookingId]);

  const handleRequest = async () => {
    if (!selectedSupplier) return;
    setBusy(true);
    try {
      await createSupplierConfirmation({
        data: {
          bookingId,
          supplierId: selectedSupplier,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
      });
      setSelectedSupplier("");
      setNotes("");
      await refresh();
      toast.success("Confirmation requested");
    } catch (error) {
      toast.error(
        "Could not request",
        error instanceof Error ? { description: error.message } : {},
      );
    } finally {
      setBusy(false);
    }
  };

  const handleStatus = async (id: string, status: SupplierStatus) => {
    try {
      await updateSupplierConfirmation({ data: { id, status } });
      await refresh();
      toast.success(`Supplier marked ${status.toLowerCase()}`);
    } catch (error) {
      toast.error("Could not update", error instanceof Error ? { description: error.message } : {});
    }
  };

  return (
    <div className="space-y-6">
      {/* Costing */}
      {costing && (
        <div className="grid gap-3 sm:grid-cols-3">
          <CostCard label="Booking revenue" value={money(costing.revenue)} />
          <CostCard label="Supplier cost" value={money(costing.supplierCost)} />
          <CostCard
            label="Gross profit"
            value={`${money(costing.grossProfit)} (${costing.marginPercent.toFixed(1)}%)`}
            highlight={costing.grossProfit > 0}
          />
        </div>
      )}

      {/* Request confirmation */}
      <div className="rounded-xl border bg-secondary/30 p-4">
        <p className="text-sm font-semibold">Request supplier confirmation</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
            <SelectTrigger>
              <SelectValue placeholder="Select supplier…" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.type.toLowerCase()})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button disabled={!selectedSupplier || busy} onClick={handleRequest}>
            Request
          </Button>
        </div>
      </div>

      {/* Confirmations */}
      {confirmations.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No supplier confirmations yet. Request one above.
        </p>
      ) : (
        <div className="space-y-3">
          {confirmations.map((c) => (
            <div key={c.id} className="rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-primary" />
                  <p className="font-medium">{c.supplierName}</p>
                  {statusBadge(c.status)}
                </div>
              </div>
              {c.reference && (
                <p className="mt-2 text-sm text-muted-foreground">Reference: {c.reference}</p>
              )}
              {c.notes && <p className="mt-1 text-sm text-muted-foreground">{c.notes}</p>}
              {c.status === "REQUESTED" && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => handleStatus(c.id, "CONFIRMED")}>
                    <Check className="size-4" /> Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatus(c.id, "DECLINED")}
                  >
                    <X className="size-4" /> Decline
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CostCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? "bg-success/10" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-display text-lg font-semibold">{value}</p>
    </div>
  );
}

import { useState } from "react";
import { Banknote, CheckCircle2, UploadCloud, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { requestPayment, updatePaymentStatus } from "@/lib/api/payments";
import type { PaymentDTO, PaymentType } from "@/lib/types";
import { money } from "@/lib/pricing";

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Requested",
  SUBMITTED: "Proof submitted",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

function statusBadge(status: string) {
  const cls =
    status === "VERIFIED"
      ? "bg-success text-success-foreground hover:bg-success"
      : status === "REJECTED"
        ? "bg-destructive text-destructive-foreground hover:bg-destructive"
        : status === "SUBMITTED"
          ? "bg-warning text-warning-foreground hover:bg-warning"
          : "bg-secondary text-muted-foreground hover:bg-secondary";
  return <Badge className={cls}>{STATUS_LABEL[status] ?? status}</Badge>;
}

export function PaymentsPanel({
  bookingId,
  payments,
  onRefresh,
}: {
  bookingId: string;
  payments: PaymentDTO[];
  onRefresh: () => void;
}) {
  const [type, setType] = useState<PaymentType>("DEPOSIT");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [busy, setBusy] = useState(false);

  const handleRequest = async () => {
    const amt = Number(amount);
    if (!amount || !Number.isFinite(amt) || amt <= 0) return;
    setBusy(true);
    try {
      await requestPayment({
        data: {
          bookingId,
          type,
          amount: amt,
          ...(method.trim() ? { paymentMethod: method.trim() } : {}),
        },
      });
      setAmount("");
      setMethod("");
      await onRefresh();
      toast.success(`${type.toLowerCase()} payment requested`);
    } catch (error) {
      toast.error(
        "Could not request payment",
        error instanceof Error ? { description: error.message } : {},
      );
    } finally {
      setBusy(false);
    }
  };

  const handleStatus = async (paymentId: string, status: "VERIFIED" | "REJECTED") => {
    try {
      await updatePaymentStatus({ data: { paymentId, status } });
      await onRefresh();
      toast.success(`Payment ${status.toLowerCase()}`);
    } catch (error) {
      toast.error("Could not update", error instanceof Error ? { description: error.message } : {});
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-secondary/30 p-4">
        <p className="text-sm font-semibold">Request a payment</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Select value={type} onValueChange={(v) => setType(v as PaymentType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DEPOSIT">Deposit</SelectItem>
              <SelectItem value="BALANCE">Balance</SelectItem>
              <SelectItem value="REFUND">Refund</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Amount (USD)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input
            placeholder="Method (Bank transfer…)"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          />
          <Button disabled={!amount || busy} onClick={handleRequest}>
            Request
          </Button>
        </div>
      </div>

      {payments.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No payments yet. Request a deposit or balance payment above.
        </p>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <div key={p.id} className="rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {p.type.toLowerCase()} · {money(p.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.paymentMethod ?? "Method not set"} · {new Date(p.createdAt).toLocaleString()}
                  </p>
                </div>
                {statusBadge(p.status)}
              </div>

              {p.proofs.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.proofs.map((proof) => (
                    <a
                      key={proof.id}
                      href={proof.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary/50"
                    >
                      <UploadCloud className="size-3.5" /> {proof.filename}
                    </a>
                  ))}
                </div>
              )}

              {p.status === "SUBMITTED" && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => handleStatus(p.id, "VERIFIED")}>
                    <CheckCircle2 className="size-4" /> Verify
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatus(p.id, "REJECTED")}
                  >
                    <XCircle className="size-4" /> Reject
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

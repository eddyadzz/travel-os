import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  History,
  MessageSquare,
  Paperclip,
  SendHorizonal,
  ShieldCheck,
  Banknote,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { sendMessage } from "@/lib/api/conversation";
import { uploadPaymentProof } from "@/lib/api/payments";
import { getPortalBooking, portalStatusLabel, type PortalBookingDTO } from "@/lib/api/portal";
import { money } from "@/lib/pricing";

export const Route = createFileRoute("/track/$reference")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
  }),
  loader: async ({ params, location }) => {
    const search = location.search as { token?: string };
    const token = typeof search.token === "string" ? search.token : "";
    const dto = await getPortalBooking({
      data: {
        reference: params.reference,
        token,
        userAgent: "server-side",
      },
    });
    if (!dto) throw notFound();
    return { dto, token };
  },
  head: () => ({
    meta: [
      { title: "Track your booking | TravelOS by Boliflow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TrackPage,
});

function TrackPage() {
  const { dto: initial, token } = Route.useLoaderData();
  const [dto, setDto] = useState<PortalBookingDTO>(initial);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const refresh = async () => {
    const updated = await getPortalBooking({ data: { reference: dto.reference, token } });
    if (updated) setDto(updated);
  };

  const handleSend = async () => {
    if (!draft.trim()) return;
    setSending(true);
    try {
      await sendMessage({
        data: {
          bookingId: dto.id,
          senderType: "CUSTOMER",
          senderName: dto.customerName,
          message: draft,
        },
      });
      setDraft("");
      await refresh();
      toast.success("Message sent", { description: "An agent will reply shortly." });
    } catch (error) {
      toast.error("Could not send", error instanceof Error ? { description: error.message } : {});
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-secondary/30 pb-16">
      <header className="surface-glass sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4">
          <span className="text-display text-lg font-semibold">TravelOS by Boliflow</span>
          <Badge variant="outline">{dto.reference}</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 pt-6">
        {/* Status card */}
        <section className="rounded-2xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">Booking status</p>
          <div className="mt-1 flex items-center gap-3">
            <span className="gradient-lagoon flex size-10 items-center justify-center rounded-xl text-primary-foreground">
              <CheckCircle2 className="size-5" />
            </span>
            <div>
              <p className="text-xl font-semibold">{portalStatusLabel(dto.status)}</p>
              <p className="text-sm text-muted-foreground">{dto.property}</p>
            </div>
          </div>

          <Separator className="my-5" />

          <dl className="grid grid-cols-2 gap-4 text-sm">
            <PortalRow label="Property" value={dto.property} />
            <PortalRow label="Room" value={dto.room} />
            <PortalRow label="Check-in" value={dto.checkIn} />
            <PortalRow label="Check-out" value={dto.checkOut} />
            <PortalRow label="Guests" value={`${dto.adults} adults, ${dto.children} children`} />
            <PortalRow label="Nights" value={String(dto.nights)} />
            {dto.addons.length > 0 && <PortalRow label="Add-ons" value={dto.addons.join(", ")} />}
          </dl>

          <Separator className="my-5" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Estimated total</span>
            <span className="text-display text-2xl font-semibold">{money(dto.total)}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Rates in USD, taxes included. No payment taken until confirmed.
          </p>
        </section>

        {/* Payment summary */}
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Banknote className="size-4 text-primary" /> Payment summary
          </h2>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <BalanceCard label="Total booking" value={money(dto.total)} />
            <BalanceCard label="Paid" value={money(dto.paymentsVerified)} />
            <BalanceCard label="Outstanding" value={money(dto.outstandingBalance)} />
          </div>
        </section>

        {/* Timeline */}
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <History className="size-4 text-primary" /> Updates
          </h2>
          {dto.timeline.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No updates yet.</p>
          ) : (
            <ol className="mt-4 space-y-0">
              {dto.timeline.map((e, i) => (
                <li key={e.id} className="relative flex gap-4 pb-5 last:pb-0">
                  {i < dto.timeline.length - 1 && (
                    <span className="absolute left-[5px] top-4 h-full w-px bg-border" />
                  )}
                  <span className="relative mt-1.5 size-[11px] shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-sm font-medium">{e.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Conversation */}
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MessageSquare className="size-4 text-primary" /> Messages
          </h2>
          <div className="mt-4 space-y-3">
            {dto.messages.length === 0 && (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No messages yet. Send us a message below.
              </p>
            )}
            {dto.messages.map((m) => {
              const isCustomer = m.senderType === "CUSTOMER";
              return (
                <div key={m.id} className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                      isCustomer
                        ? "gradient-lagoon text-primary-foreground"
                        : m.senderType === "SYSTEM"
                          ? "border bg-muted text-muted-foreground"
                          : "border bg-card"
                    }`}
                  >
                    <p className="text-xs font-medium opacity-80">
                      {m.senderType === "CUSTOMER" ? "You" : m.senderName}
                    </p>
                    <p className="mt-0.5">{m.message}</p>
                    <p className="mt-1 text-xs opacity-70">
                      {new Date(m.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 space-y-2">
            <Textarea
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about transfers, room changes, extra nights…"
            />
            <Button className="w-full" disabled={!draft.trim() || sending} onClick={handleSend}>
              <SendHorizonal className="size-4" /> Send message
            </Button>
          </div>
        </section>

        {/* Documents */}
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Paperclip className="size-4 text-primary" /> Documents
          </h2>
          {dto.documents.length === 0 && dto.attachments.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Documents (quotation, voucher, invoice) will appear here once available.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {dto.documents.map((d) => (
                <li
                  key={`doc-${d.id}`}
                  className="flex items-center justify-between rounded-xl border p-3 text-sm"
                >
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {d.filename}
                  </a>
                  <span className="text-xs text-muted-foreground">
                    v{d.version} · {new Date(d.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
              {dto.attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-xl border p-3 text-sm"
                >
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {a.filename}
                  </a>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.uploadedAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Payments */}
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Banknote className="size-4 text-primary" /> Payments
          </h2>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <BalanceCard label="Total booking" value={money(dto.total)} />
            <BalanceCard label="Paid" value={money(dto.paymentsVerified)} />
            <BalanceCard label="Outstanding" value={money(dto.outstandingBalance)} />
          </div>

          <div className="mt-5 space-y-3">
            {dto.payments.length === 0 && (
              <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                No payments required yet.
              </p>
            )}
            {dto.payments.map((p) => (
              <div key={p.id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {p.type.toLowerCase()} payment · {money(p.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.paymentMethod ?? "Payment"} · Status:{" "}
                      {p.status.toLowerCase().replaceAll("_", " ")}
                    </p>
                  </div>
                </div>
                {p.proofs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.proofs.map((proof) => (
                      <a
                        key={proof.id}
                        href={proof.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary/50"
                      >
                        <UploadCloud className="size-3.5" /> {proof.filename}
                      </a>
                    ))}
                  </div>
                )}
                {p.status === "REQUESTED" && (
                  <UploadProofButton paymentId={p.id} onUploaded={refresh} />
                )}
              </div>
            ))}
          </div>
        </section>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" /> This page is secured with your personal tracking
          link.
        </p>
      </main>
    </div>
  );
}

function PortalRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function BalanceCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-display text-lg font-semibold">{value}</p>
    </div>
  );
}

function UploadProofButton({
  paymentId,
  onUploaded,
}: {
  paymentId: string;
  onUploaded: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("paymentId", paymentId);
      form.append("file", file);
      await uploadPaymentProof({ data: form });
      await onUploaded();
      toast.success("Payment proof submitted", { description: "An agent will verify it shortly." });
    } catch (error) {
      toast.error("Could not upload", error instanceof Error ? { description: error.message } : {});
    } finally {
      setUploading(false);
    }
  };

  return (
    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent">
      <UploadCloud className="size-4" /> {uploading ? "Uploading…" : "Upload payment proof"}
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        disabled={uploading}
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

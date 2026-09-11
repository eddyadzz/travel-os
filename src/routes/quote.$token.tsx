import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Download, FileText, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  acceptQuote,
  declineQuote,
  getQuoteByToken,
  requestQuoteChanges,
} from "@/lib/api/quote-portal";
import type { QuoteDetailDTO } from "@/lib/types";
import { money } from "@/lib/pricing";

export const Route = createFileRoute("/quote/$token")({
  loader: async ({ params }) => {
    const detail = await getQuoteByToken({ data: params.token });
    if (!detail) throw notFound();
    return { detail };
  },
  head: () => ({
    meta: [
      { title: "Your travel quote | TravelOS by Boliflow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QuotePage,
});

function QuotePage() {
  const { detail: initial } = Route.useLoaderData();
  const [detail, setDetail] = useState<QuoteDetailDTO>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"view" | "changes" | "decline">("view");
  const [result, setResult] = useState<{
    reference: string;
    deposit: number;
    portalUrl: string;
  } | null>(null);

  const quote = detail.quote;
  const token = quote.token ?? "";

  const refresh = async () => {
    const d = await getQuoteByToken({ data: token });
    if (d) setDetail(d);
  };

  const handleAccept = async () => {
    setBusy(true);
    try {
      const res = await acceptQuote({ data: token });
      setResult(res);
      await refresh();
      toast.success(`Booking ${res.reference} confirmed`);
    } catch (error) {
      toast.error("Could not accept", error instanceof Error ? { description: error.message } : {});
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    setBusy(true);
    try {
      await declineQuote({
        data: { token, ...(message.trim() ? { reason: message.trim() } : {}) },
      });
      setMode("view");
      setMessage("");
      await refresh();
      toast.success("Quote declined");
    } catch (error) {
      toast.error(
        "Could not decline",
        error instanceof Error ? { description: error.message } : {},
      );
    } finally {
      setBusy(false);
    }
  };

  const handleChanges = async () => {
    if (!message.trim()) return;
    setBusy(true);
    try {
      await requestQuoteChanges({ data: { token, message: message.trim() } });
      setMode("view");
      setMessage("");
      await refresh();
      toast.success("Changes requested — an agent will reply");
    } catch (error) {
      toast.error("Could not submit", error instanceof Error ? { description: error.message } : {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30 pb-16">
      <header className="surface-glass sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4">
          <span className="text-display text-lg font-semibold">TravelOS by Boliflow</span>
          {quote.reference && <Badge variant="outline">{quote.reference}</Badge>}
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 pt-6">
        {result ? (
          <section className="rounded-2xl border bg-card p-8 text-center">
            <span className="gradient-lagoon mx-auto flex size-14 items-center justify-center rounded-2xl text-primary-foreground">
              <CheckCircle2 className="size-7" />
            </span>
            <h1 className="mt-5 text-2xl">Booking confirmed</h1>
            <p className="mt-2 text-muted-foreground">
              Your booking <strong>{result.reference}</strong> has been created. A{" "}
              {money(result.deposit)} deposit was requested — you'll receive the details by email.
            </p>
            <Button asChild className="mt-6">
              <a href={result.portalUrl}>Open your booking portal</a>
            </Button>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border bg-card p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Travel quote</p>
                  <h1 className="mt-1 text-2xl">{detail.propertyName}</h1>
                  <p className="mt-1 text-muted-foreground">{detail.roomName}</p>
                </div>
                <Badge variant={quote.status === "PENDING" ? "default" : "secondary"}>
                  {quote.status}
                </Badge>
              </div>

              <Separator className="my-5" />

              <dl className="grid grid-cols-2 gap-4 text-sm">
                <PortalRow label="Check-in" value={quote.checkIn ?? "—"} />
                <PortalRow label="Check-out" value={quote.checkOut ?? "—"} />
                <PortalRow label="Nights" value={String(detail.nights)} />
                <PortalRow
                  label="Guests"
                  value={`${quote.adults ?? 0} adults, ${quote.children ?? 0} children`}
                />
                <PortalRow label="Quote valid until" value={quote.validUntil} />
                {quote.notes && <PortalRow label="Notes" value={quote.notes} />}
              </dl>

              <Separator className="my-5" />

              <div className="flex items-center justify-between">
                <span className="font-semibold">Estimated total</span>
                <span className="text-display text-3xl font-semibold">
                  {money(quote.totalPrice)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Rates in USD, taxes included. A {money(Math.round(quote.totalPrice * 0.5))} deposit
                is required to confirm.
              </p>

              {quote.documentUrl && (
                <Button asChild variant="outline" className="mt-4">
                  <a href={quote.documentUrl} target="_blank" rel="noreferrer">
                    <FileText className="size-4" /> Download quote PDF
                  </a>
                </Button>
              )}
            </section>

            {quote.status === "ACCEPTED" ? (
              <section className="rounded-2xl border bg-card p-6 text-center">
                <p className="font-medium">This quote has been accepted.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your booking is being processed.
                </p>
              </section>
            ) : quote.status === "DECLINED" ? (
              <section className="rounded-2xl border bg-card p-6 text-center">
                <p className="font-medium">This quote has been declined.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  We are happy to prepare a new offer.
                </p>
              </section>
            ) : detail.expired ? (
              <section className="rounded-2xl border bg-card p-6 text-center">
                <p className="flex items-center justify-center gap-2 font-medium">
                  <XCircle className="size-4 text-destructive" /> This quote has expired.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Please contact us for a new quote.
                </p>
              </section>
            ) : (
              <section className="rounded-2xl border bg-card p-6">
                {mode === "view" ? (
                  <div className="space-y-2">
                    <Button className="w-full" disabled={busy} onClick={handleAccept}>
                      <CheckCircle2 className="size-4" /> Accept & confirm booking
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" disabled={busy} onClick={() => setMode("changes")}>
                        Request changes
                      </Button>
                      <Button variant="ghost" disabled={busy} onClick={() => setMode("decline")}>
                        Decline
                      </Button>
                    </div>
                    <p className="pt-2 text-center text-xs text-muted-foreground">
                      Accepting confirms your booking instantly and requests the deposit.
                    </p>
                  </div>
                ) : mode === "changes" ? (
                  <div className="space-y-2">
                    <p className="font-medium">Request changes</p>
                    <Textarea
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell us what you'd like to change — dates, room, add-ons…"
                    />
                    <div className="flex gap-2">
                      <Button disabled={!message.trim() || busy} onClick={handleChanges}>
                        Submit request
                      </Button>
                      <Button variant="outline" onClick={() => setMode("view")}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="font-medium">Decline this quote</p>
                    <Textarea
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Optional reason (helps us improve)"
                    />
                    <div className="flex gap-2">
                      <Button variant="destructive" disabled={busy} onClick={handleDecline}>
                        <XCircle className="size-4" /> Confirm decline
                      </Button>
                      <Button variant="outline" onClick={() => setMode("view")}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, X, Pencil, Inbox, CalendarCheck, Ban, TrendingUp, Upload } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listBookings, updateBookingStatus } from "@/lib/api/bookings";
import type { BookingDTO, BookingStatus } from "@/lib/types";
import { money } from "@/lib/pricing";

export const Route = createFileRoute("/agent/")({
  loader: async () => {
    const bookings = await listBookings();
    return { bookings };
  },
  head: () => ({
    meta: [
      { title: "Agent Dashboard — Booking Requests | Ocean Atlas" },
      { name: "description", content: "Review, confirm, modify or reject incoming Maldives booking requests in one queue." },
      { property: "og:title", content: "Agent Dashboard | Ocean Atlas" },
      { property: "og:description", content: "Manage incoming Maldives booking requests." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AgentDashboard,
});

function AgentDashboard() {
  const { bookings } = Route.useLoaderData();
  const [requests, setRequests] = useState<BookingDTO[]>(bookings);

  const setStatus = async (id: string, status: BookingStatus) => {
    try {
      const updated = await updateBookingStatus({ data: { id, status } });
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
      toast.success(`Request ${status.toLowerCase()}`, { description: "The customer has been notified by email." });
    } catch (error) {
      toast.error("Could not update status", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const count = (s: BookingStatus) => requests.filter((r) => r.status === s).length;
  const revenue = requests.filter((r) => r.status === "CONFIRMED").reduce((s, r) => s + r.total, 0);

  const stats = [
    { icon: Inbox, label: "New requests", value: String(count("NEW")) },
    { icon: CalendarCheck, label: "Confirmed", value: String(count("CONFIRMED")) },
    { icon: Ban, label: "Rejected", value: String(count("REJECTED")) },
    { icon: TrendingUp, label: "Confirmed value", value: money(revenue) },
  ];

  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl">Agent dashboard</h1>
            <p className="mt-2 text-muted-foreground">Every request arrives complete — you only confirm, modify or reject.</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/agent/imports"><Upload className="size-4" /> Rate & availability imports</Link>
          </Button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border bg-card p-5">
              <s.icon className="size-5 text-primary" />
              <p className="mt-3 text-display text-2xl font-semibold">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="NEW" className="mt-10">
          <TabsList>
            {(["NEW", "CONFIRMED", "REJECTED"] as BookingStatus[]).map((s) => (
              <TabsTrigger key={s} value={s}>
                {s} ({count(s)})
              </TabsTrigger>
            ))}
          </TabsList>

          {(["NEW", "CONFIRMED", "REJECTED"] as BookingStatus[]).map((s) => (
            <TabsContent key={s} value={s} className="mt-6 space-y-4">
              {requests.filter((r) => r.status === s).length === 0 && (
                <div className="rounded-2xl border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">
                  Nothing in this queue.
                </div>
              )}
              {requests
                .filter((r) => r.status === s)
                .map((r) => (
                  <article key={r.id} className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-soft)]">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{r.customer.name}</p>
                          <Badge variant="secondary">{r.reference}</Badge>
                          <StatusBadge status={r.status} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {r.customer.email} · {r.customer.phone} · {r.customer.country}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-display text-2xl font-semibold">{money(r.total)}</p>
                        <p className="text-xs text-muted-foreground">
                          submitted {new Date(r.submittedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-4">
                      <Field label="Property" value={r.property} />
                      <Field label="Room" value={r.room} />
                      <Field label="Dates" value={`${r.checkIn} → ${r.checkOut} (${r.nights}n)`} />
                      <Field label="Guests" value={`${r.adults} adults, ${r.children} children`} />
                    </dl>

                    {r.addons.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {r.addons.map((a) => (
                          <Badge key={a} variant="outline">{a}</Badge>
                        ))}
                      </div>
                    )}

                    {r.specialRequests && (
                      <p className="mt-4 rounded-xl bg-secondary/60 p-3 text-sm text-muted-foreground">
                        “{r.specialRequests}”
                      </p>
                    )}

                    {r.status === "NEW" && (
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => setStatus(r.id, "CONFIRMED")}>
                          <Check className="size-4" /> Confirm
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toast("Modify request", { description: "Send the customer an amended quote." })}>
                          <Pencil className="size-4" /> Modify
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "REJECTED")}>
                          <X className="size-4" /> Reject
                        </Button>
                      </div>
                    )}
                  </article>
                ))}
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const cls =
    status === "CONFIRMED"
      ? "bg-success text-success-foreground hover:bg-success"
      : status === "REJECTED"
        ? "bg-destructive text-destructive-foreground hover:bg-destructive"
        : "bg-warning text-warning-foreground hover:bg-warning";
  return <Badge className={cls}>{status}</Badge>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

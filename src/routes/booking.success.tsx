import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, Users, Sparkles, Plane } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getBookingByReference } from "@/lib/api/bookings";
import { money } from "@/lib/pricing";

export const Route = createFileRoute("/booking/success")({
  validateSearch: (search: Record<string, unknown>) => ({
    reference: typeof search["reference"] === "string" ? search["reference"] : "",
  }),
  loader: async ({ location }) => {
    const search = location.search as { reference?: string };
    const reference = typeof search.reference === "string" ? search.reference : "";
    if (!reference) throw notFound();
    const booking = await getBookingByReference({ data: reference });
    if (!booking) throw notFound();
    return { booking };
  },
  head: () => ({
    meta: [
      { title: "Booking request received | Ocean Atlas" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookingSuccess,
});

function BookingSuccess() {
  const { booking } = Route.useLoaderData();

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-14">
        <div className="rounded-2xl border bg-card p-8 shadow-[var(--shadow-soft)]">
          <span className="gradient-lagoon flex size-12 items-center justify-center rounded-2xl text-primary-foreground">
            <CheckCircle2 className="size-6" />
          </span>
          <h1 className="mt-5 text-3xl">Booking request received</h1>
          <p className="mt-2 text-muted-foreground">
            Your package is with our agents. You'll get an email confirmation within a few hours.
          </p>

          <div className="mt-6 flex items-center justify-between rounded-xl border bg-secondary/40 p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Reference</p>
              <p className="mt-1 text-display text-2xl font-semibold">{booking.reference}</p>
            </div>
            <Badge className="bg-warning text-warning-foreground hover:bg-warning">
              Pending confirmation
            </Badge>
          </div>

          <div className="mt-6 space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Property</span>
              <span className="font-medium">{booking.property}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Room</span>
              <span className="font-medium">{booking.room}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarDays className="size-4" /> Dates
              </span>
              <span className="font-medium">
                {booking.checkIn} → {booking.checkOut} ({booking.nights} nights)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="size-4" /> Guests
              </span>
              <span className="font-medium">
                {booking.adults} adults, {booking.children} children
              </span>
            </div>
            {booking.addons.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Sparkles className="size-4" /> Add-ons
                </span>
                <span className="max-w-[60%] text-right font-medium">
                  {booking.addons.join(", ")}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Plane className="size-4" /> Transfers
              </span>
              <span className="font-medium">Included in estimate</span>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="flex items-center justify-between">
            <span className="font-semibold">Estimated total</span>
            <span className="text-display text-3xl font-semibold">{money(booking.total)}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Rates in USD, taxes included. No payment taken — an agent confirms live availability
            before you pay.
          </p>
        </div>

        <div className="mt-6 grid gap-3">
          {booking.trackingToken && (
            <Button asChild>
              <Link
                to="/track/$reference"
                params={{ reference: booking.reference }}
                search={{ token: booking.trackingToken }}
              >
                Track your booking & reply
              </Link>
            </Button>
          )}
          <div className="flex gap-3">
            <Button asChild variant="outline" className="flex-1">
              <Link to="/properties" search={{ type: "all" }}>
                Browse more stays
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link to="/">Back home</Link>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

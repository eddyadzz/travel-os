import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  MapPin,
  Star,
  Plane,
  Check,
  Users,
  CalendarDays,
  Sparkles,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { createBooking } from "@/lib/api/bookings";
import { generateAutoQuote } from "@/lib/api/quotes";
import { getPropertyById, listProperties } from "@/lib/api/properties";
import { calculatePrice, money } from "@/lib/pricing";

export const Route = createFileRoute("/properties/$propertyId")({
  loader: async ({ params }) => {
    const [property, all] = await Promise.all([
      getPropertyById({ data: params.propertyId }),
      listProperties(),
    ]);
    if (!property) throw notFound();
    const similar = all.filter((p) => p.id !== property.id).slice(0, 3);
    return { property, similar };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Property unavailable | TravelOS by Boliflow" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const p = loaderData.property;
    const description = `${p.name} in ${p.location}, ${p.atoll}. ${p.transfer.method} transfer, rooms from ${money(p.fromPrice)} per night. Build a package and request a booking.`;
    return {
      meta: [
        { title: `${p.name} — ${p.type} in ${p.atoll} | TravelOS by Boliflow` },
        { name: "description", content: description },
        { property: "og:title", content: `${p.name} | TravelOS by Boliflow` },
        { property: "og:description", content: description },
      ],
    };
  },
  component: PropertyDetail,
});

const steps = ["Dates & guests", "Room", "Add-ons", "Your details"];

function PropertyDetail() {
  const { property, similar } = Route.useLoaderData();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [roomId, setRoomId] = useState(property.rooms[0]?.id ?? "");
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"book" | "quote">("book");
  const [quoteResult, setQuoteResult] = useState<{
    reference: string;
    total: number;
    bookingLink: string;
  } | null>(null);

  const room = property.rooms.find((r) => r.id === roomId);
  const selectedAddons = property.addons.filter((a) => addonIds.includes(a.id));

  const quoteValidUntil = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  const price = useMemo(
    () =>
      calculatePrice({
        transferPricePerPerson: property.transfer.pricePerPerson,
        room,
        checkIn,
        checkOut,
        adults,
        children,
        addons: selectedAddons,
      }),
    [property.transfer.pricePerPerson, room, checkIn, checkOut, adults, children, selectedAddons],
  );

  const datesValid = price.nights > 0;

  const toggleAddon = (id: string) =>
    setAddonIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        <section className="relative">
          <img
            src={property.image}
            alt={`${property.name}, ${property.type} in ${property.atoll}`}
            width={1200}
            height={800}
            className="h-[46vh] min-h-[320px] w-full object-cover"
          />
          <div className="hero-overlay absolute inset-0" />
          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto max-w-6xl px-4 pb-8 text-primary-foreground">
              <Link
                to="/properties"
                search={{ type: "all" }}
                className="mb-4 inline-flex items-center gap-1.5 text-sm opacity-90 hover:opacity-100"
              >
                <ArrowLeft className="size-4" /> All stays
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-card text-card-foreground hover:bg-card">
                  {property.type}
                </Badge>
                <span className="flex items-center gap-1 text-sm">
                  <Star className="size-4 fill-warning text-warning" /> {property.rating}
                </span>
              </div>
              <h1 className="mt-3 text-4xl sm:text-5xl">{property.name}</h1>
              <p className="mt-2 flex items-center gap-1.5 text-sm opacity-90">
                <MapPin className="size-4" /> {property.location}, {property.atoll}
              </p>
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[1fr_400px]">
          <div className="space-y-10">
            <section>
              <h2 className="text-2xl">About this {property.type.toLowerCase()}</h2>
              <p className="mt-3 text-muted-foreground">{property.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {property.highlights.map((h) => (
                  <Badge key={h} variant="secondary">
                    {h}
                  </Badge>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-2xl">Gallery</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {property.gallery.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`${property.name} view ${i + 1}`}
                    loading="lazy"
                    width={1200}
                    height={800}
                    className="aspect-[4/3] w-full rounded-xl object-cover"
                  />
                ))}
              </div>
            </section>

            <section className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-2xl border bg-card p-6">
                <h2 className="text-xl">Amenities</h2>
                <ul className="mt-4 grid gap-2 text-sm text-muted-foreground">
                  {property.amenities.map((a) => (
                    <li key={a} className="flex items-center gap-2">
                      <Check className="size-4 text-primary" /> {a}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border bg-card p-6">
                <h2 className="text-xl">Getting there</h2>
                <p className="mt-4 flex items-center gap-2 text-sm">
                  <Plane className="size-4 text-primary" /> {property.transfer.method}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Approx. {property.transfer.duration} from Velana International Airport (MLE).
                </p>
                <p className="mt-4 text-sm">
                  <span className="font-semibold">{money(property.transfer.pricePerPerson)}</span>
                  <span className="text-muted-foreground"> per person, round trip</span>
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl">Room types</h2>
              <div className="mt-4 space-y-3">
                {property.rooms.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5"
                  >
                    <div>
                      <p className="font-semibold">{r.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {r.size} · up to {r.maxGuests} guests · {r.boardBasis}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Extra guest {money(r.extraGuestRate)} / night · {r.availableUnits} units
                        left
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-display text-xl font-semibold">{money(r.nightlyRate)}</p>
                      <p className="text-xs text-muted-foreground">per night</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => {
                          setRoomId(r.id);
                          setStep(1);
                          document
                            .getElementById("booking")
                            ?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        Select
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Booking builder */}
          <aside id="booking" className="h-fit lg:sticky lg:top-24">
            <div className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-lift)]">
              {quoteResult ? (
                <QuoteSuccess result={quoteResult} />
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">From</p>
                  <p className="text-display text-3xl font-semibold">
                    {money(property.fromPrice)}{" "}
                    <span className="text-base font-normal text-muted-foreground">/ night</span>
                  </p>

                  <div className="mt-4 flex rounded-xl bg-secondary/50 p-1">
                    <button
                      type="button"
                      onClick={() => setMode("book")}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        mode === "book"
                          ? "bg-card shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Book now
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("quote")}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        mode === "quote"
                          ? "bg-card shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Get a quote
                    </button>
                  </div>

                  <ol className="mt-5 flex items-center gap-1">
                    {steps.map((s, i) => (
                      <li key={s} className="flex flex-1 items-center gap-1">
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                            i <= step
                              ? "gradient-lagoon text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {i + 1}
                        </span>
                        {i < steps.length - 1 && (
                          <span
                            className={`h-px flex-1 ${i < step ? "bg-primary" : "bg-border"}`}
                          />
                        )}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 text-sm font-medium">{steps[step]}</p>

                  <Separator className="my-5" />

                  {step === 0 && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="ci">Check-in</Label>
                          <Input
                            id="ci"
                            type="date"
                            value={checkIn}
                            onChange={(e) => setCheckIn(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="co">Check-out</Label>
                          <Input
                            id="co"
                            type="date"
                            value={checkOut}
                            onChange={(e) => setCheckOut(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="ad">Adults</Label>
                          <Input
                            id="ad"
                            type="number"
                            min={1}
                            max={8}
                            value={adults}
                            onChange={(e) => setAdults(Number(e.target.value))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="ch">Children</Label>
                          <Input
                            id="ch"
                            type="number"
                            min={0}
                            max={6}
                            value={children}
                            onChange={(e) => setChildren(Number(e.target.value))}
                          />
                        </div>
                      </div>
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="size-3.5" />
                        {datesValid
                          ? `${price.nights} nights selected`
                          : "Choose your travel dates to continue"}
                      </p>
                      <Button className="w-full" disabled={!datesValid} onClick={() => setStep(1)}>
                        Continue
                      </Button>
                    </div>
                  )}

                  {step === 1 && (
                    <div className="space-y-3">
                      {property.rooms.map((r) => {
                        const selected = r.id === roomId;
                        const fits = adults + children <= r.maxGuests;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            disabled={!fits}
                            onClick={() => setRoomId(r.id)}
                            className={`w-full rounded-xl border p-4 text-left transition-colors disabled:opacity-50 ${
                              selected ? "border-primary bg-secondary/60" : "hover:bg-secondary/40"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium">{r.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {r.boardBasis} · up to {r.maxGuests} guests
                                </p>
                                {!fits && (
                                  <p className="text-xs text-destructive">
                                    Too small for {adults + children} guests
                                  </p>
                                )}
                              </div>
                              <p className="shrink-0 text-sm font-semibold">
                                {money(r.nightlyRate)}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>
                          Back
                        </Button>
                        <Button className="flex-1" disabled={!room} onClick={() => setStep(2)}>
                          Continue
                        </Button>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-3">
                      {property.addons.map((a) => (
                        <label
                          key={a.id}
                          onClick={() => toggleAddon(a.id)}
                          className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors hover:bg-secondary/40"
                        >
                          <Checkbox
                            checked={addonIds.includes(a.id)}
                            className="pointer-events-none mt-0.5"
                          />
                          <span className="flex-1">
                            <span className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium">{a.name}</span>
                              <span className="text-sm font-semibold">{money(a.price)}</span>
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {a.description}
                            </span>
                            <Badge variant="secondary" className="mt-2">
                              {a.pricing}
                            </Badge>
                          </span>
                        </label>
                      ))}
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                          Back
                        </Button>
                        <Button className="flex-1" onClick={() => setStep(3)}>
                          Continue
                        </Button>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <form
                      className="space-y-3"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!room) return;
                        const form = new FormData(e.currentTarget);
                        const specialRequests = String(form.get("creq") ?? "").trim();
                        const fullName = String(form.get("cname") ?? "");
                        const email = String(form.get("cemail") ?? "").trim();
                        try {
                          if (mode === "quote") {
                            const result = await generateAutoQuote({
                              data: {
                                propertyId: property.id,
                                roomId: room.id,
                                checkIn,
                                checkOut,
                                adults,
                                children,
                                addonIds: selectedAddons.map((a) => a.id),
                                customerName: fullName,
                                customerEmail: email,
                                validUntil: quoteValidUntil,
                                ...(specialRequests ? { notes: specialRequests } : {}),
                              },
                            });
                            setQuoteResult({
                              reference: result.reference,
                              total: result.breakdown.total,
                              bookingLink: result.quote.bookingLink ?? `/quote/${result.reference}`,
                            });
                          } else {
                            const booking = await createBooking({
                              data: {
                                propertyId: property.id,
                                roomId: room.id,
                                checkIn,
                                checkOut,
                                adults,
                                children,
                                addonIds: selectedAddons.map((a) => a.id),
                                customer: {
                                  fullName,
                                  email,
                                  phone: String(form.get("cphone") ?? ""),
                                  country: String(form.get("ccountry") ?? ""),
                                },
                                ...(specialRequests ? { specialRequests } : {}),
                              },
                            });
                            await navigate({
                              to: "/booking/success",
                              search: { reference: booking.reference },
                            });
                          }
                        } catch (error) {
                          toast.error("Could not be submitted", {
                            description:
                              error instanceof Error ? error.message : "Please try again.",
                          });
                        }
                      }}
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="cname">Full name</Label>
                        <Input id="cname" required placeholder="Jane Doe" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="cemail">Email</Label>
                        <Input id="cemail" type="email" required placeholder="jane@email.com" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="cphone">Phone</Label>
                          <Input id="cphone" required placeholder="+1 555 010 2030" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="ccountry">Country</Label>
                          <Input id="ccountry" required placeholder="United States" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="creq">Special requests</Label>
                        <Textarea
                          id="creq"
                          rows={3}
                          placeholder="Honeymoon, dietary needs, late check-out…"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setStep(2)}
                        >
                          Back
                        </Button>
                        <Button type="submit" className="flex-1">
                          Submit request
                        </Button>
                      </div>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ShieldCheck className="size-3.5" /> No payment now — an agent confirms
                        availability first.
                      </p>
                    </form>
                  )}

                  <Separator className="my-5" />

                  <div className="space-y-2 text-sm">
                    <p className="flex items-center gap-2 font-semibold">
                      <Sparkles className="size-4 text-primary" /> Estimated price
                    </p>
                    <Row
                      label={`Accommodation${price.nights ? ` · ${price.nights} nights` : ""}`}
                      value={price.accommodation}
                    />
                    {price.extraGuests > 0 && (
                      <Row label="Extra guest charges" value={price.extraGuests} />
                    )}
                    <Row label={`Transfers · ${price.guests} guests`} value={price.transfers} />
                    <Row label={`Add-ons · ${selectedAddons.length}`} value={price.addons} />
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Estimated total</span>
                      <span className="text-display text-2xl font-semibold">
                        {money(price.total)}
                      </span>
                    </div>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="size-3.5" /> {adults} adults, {children} children · rates in
                      USD, taxes included.
                    </p>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>

        <section className="mx-auto max-w-6xl px-4 pb-8">
          <h2 className="text-2xl">You might also like</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((p) => (
              <Link
                key={p.id}
                to="/properties/$propertyId"
                params={{ propertyId: p.id }}
                className="group overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-[var(--shadow-lift)]"
              >
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  width={1200}
                  height={800}
                  className="aspect-[16/10] w-full object-cover"
                />
                <div className="p-4">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.atoll} · from {money(p.fromPrice)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">{money(value)}</span>
    </div>
  );
}

function QuoteSuccess({
  result,
}: {
  result: { reference: string; total: number; bookingLink: string };
}) {
  return (
    <div className="text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/20">
        <Check className="size-6 text-success" />
      </div>
      <h3 className="mt-3 font-semibold">Your quote is ready</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {result.reference} · total{" "}
        <span className="font-semibold text-foreground">{money(result.total)}</span>
      </p>
      <Button asChild className="mt-4 w-full">
        <Link to={result.bookingLink} target="_blank" rel="noreferrer">
          Review & accept your quote
        </Link>
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">
        A quote has been created for you. Review the breakdown and accept it online to confirm your
        booking — no payment until you're happy.
      </p>
    </div>
  );
}

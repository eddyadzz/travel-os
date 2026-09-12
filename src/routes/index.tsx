import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Search,
  ShieldCheck,
  Sparkles,
  Ship,
  Building2,
  Home,
  Palmtree,
  ArrowRight,
  Users,
} from "lucide-react";
import hero from "@/assets/hero-maldives.jpg";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PropertyCard } from "@/components/property-card";
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
import { listProperties } from "@/lib/api/properties";
import { getPublicSite } from "@/lib/api/cms";
import { PromotionalBlock } from "@/components/promotional-block";
import type { SiteContentData } from "@/lib/types";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [properties, site] = await Promise.all([listProperties(), getPublicSite()]);
    return { properties, site };
  },
  head: ({ loaderData }) => {
    const content = loaderData?.site?.content;
    return {
      meta: [
        {
          title: content?.heroHeadline
            ? `TravelOS by Boliflow — ${content.heroHeadline}`
            : "TravelOS by Boliflow — Maldives Resorts, Guesthouses & Safari Boats",
        },
        {
          name: "description",
          content:
            content?.heroSubheadline ??
            "Browse Maldives resorts, hotels, guesthouses and safari boats, build your package with add-ons and get an instant estimated price before you request a booking.",
        },
        { property: "og:title", content: "TravelOS by Boliflow — Maldives Travel Booking" },
        {
          property: "og:description",
          content:
            "Build your Maldives package online and get an instant estimate. Agents confirm every reservation.",
        },
      ],
    };
  },
  component: Index,
});

const typeIcons = {
  Resort: Palmtree,
  Hotel: Building2,
  Guesthouse: Home,
  "Safari Boat": Ship,
} as const;
const typeOrder = ["Resort", "Hotel", "Guesthouse", "Safari Boat"] as const;

function Index() {
  const { properties, site } = Route.useLoaderData();
  const content: SiteContentData = site.content;
  const navigate = useNavigate();
  const [type, setType] = useState("all");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const featured = content.featuredPropertySlugs?.length
    ? content.featuredPropertySlugs
        .map((slug) => properties.find((p) => p.slug === slug))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
    : properties.filter((p) => p.featured);
  const propertyTypes = typeOrder.filter((t) => properties.some((p) => p.type === t));

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        <section className="relative">
          <img
            src={hero}
            alt="Aerial view of Maldives overwater villas at sunset"
            width={1920}
            height={1088}
            className="h-[78vh] min-h-[520px] w-full object-cover"
          />
          <div className="hero-overlay absolute inset-0" />
          <div className="absolute inset-0 flex items-center">
            <div className="mx-auto w-full max-w-6xl px-4">
              <div className="max-w-2xl text-primary-foreground">
                <p className="text-sm uppercase tracking-[0.25em] opacity-90">
                  {content.heroEyebrow}
                </p>
                <h1 className="mt-4 text-4xl leading-[1.05] sm:text-6xl">{content.heroHeadline}</h1>
                <p className="mt-5 max-w-xl text-base opacity-90">{content.heroSubheadline}</p>
              </div>

              <div className="mt-10 rounded-2xl border bg-card p-4 shadow-[var(--shadow-lift)] sm:p-5">
                <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto]">
                  <div className="space-y-1.5">
                    <Label htmlFor="checkin">Check-in</Label>
                    <Input
                      id="checkin"
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="checkout">Check-out</Label>
                    <Input
                      id="checkout"
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Property type</Label>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Any type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any type</SelectItem>
                        {propertyTypes.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      className="w-full md:w-auto"
                      onClick={() =>
                        navigate({
                          to: "/search",
                          search: { checkIn, checkOut, adults, children, type, transfer: "all" },
                        })
                      }
                    >
                      <Search className="size-4" /> Search availability
                    </Button>
                  </div>
                </div>
                <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="size-3.5" />
                  {adults} adults, {children} children · pick dates to see only stays with
                  availability
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Marketing block — below hero */}
        <PromotionalBlock block={content.marketingBlocks?.belowHero} />

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {propertyTypes.map((t) => {
              const Icon = typeIcons[t];
              const count = properties.filter((p) => p.type === t).length;
              return (
                <Link
                  key={t}
                  to="/properties"
                  search={{ type: t }}
                  className="group rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-secondary/50"
                >
                  <Icon className="size-6 text-primary" />
                  <p className="mt-4 font-semibold">{t}s</p>
                  <p className="text-sm text-muted-foreground">
                    {count} {count === 1 ? "property" : "properties"} listed
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm text-primary">
                    Browse{" "}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl">Featured islands</h2>
              <p className="mt-2 text-muted-foreground">
                Hand-picked stays our agents book most this season.
              </p>
            </div>
            <Button asChild variant="outline" className="hidden sm:inline-flex">
              <Link to="/properties" search={{ type: "all" }}>
                View all stays
              </Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        </section>

        <section className="bg-secondary/40 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl">How a booking works</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {[
                {
                  icon: Search,
                  title: "Browse & build",
                  text: "Choose property, dates, room and add-ons in one flow.",
                },
                {
                  icon: Sparkles,
                  title: "See the estimate",
                  text: "Accommodation, transfers, add-ons and extra guests, itemised.",
                },
                {
                  icon: ShieldCheck,
                  title: "Agent confirms",
                  text: "We verify live availability and confirm within a few hours.",
                },
              ].map((s, i) => (
                <div
                  key={s.title}
                  className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-soft)]"
                >
                  <span className="gradient-lagoon flex size-10 items-center justify-center rounded-xl text-primary-foreground">
                    <s.icon className="size-5" />
                  </span>
                  <p className="mt-4 text-sm text-muted-foreground">Step {i + 1}</p>
                  <p className="text-lg font-semibold">{s.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {content.testimonials && content.testimonials.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-3xl">What guests say</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {content.testimonials.map((t, i) => (
                <figure
                  key={i}
                  className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-soft)]"
                >
                  <blockquote className="text-muted-foreground">“{t.quote}”</blockquote>
                  <figcaption className="mt-4 text-sm">
                    <span className="font-semibold">{t.name}</span>
                    {t.role && <span className="text-muted-foreground"> · {t.role}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* Marketing block — above footer */}
        <PromotionalBlock block={content.marketingBlocks?.aboveFooter} />
      </main>

      <SiteFooter />
    </div>
  );
}

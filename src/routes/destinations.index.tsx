import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { listProperties } from "@/lib/api/properties";
import type { PropertyDTO } from "@/lib/types";

export const Route = createFileRoute("/destinations/")({
  loader: async () => {
    const properties = await listProperties();
    return { properties };
  },
  head: () => ({
    meta: [
      { title: "Maldives Destinations by Atoll | TravelOS by Boliflow" },
      {
        name: "description",
        content:
          "Explore Maldives atolls — from North Malé atolls to the deep south. Compare resorts, guesthouses and safari boats by atoll.",
      },
      { property: "og:title", content: "Maldives Destinations by Atoll | TravelOS by Boliflow" },
      {
        property: "og:description",
        content: "Compare Maldives stays by atoll, transfer type and nightly rate.",
      },
    ],
  }),
  component: DestinationsPage,
});

type AtollGroup = {
  atoll: string;
  slug: string;
  count: number;
  minPrice: number;
  islands: string[];
  names: string[];
};

function slugify(atoll: string) {
  return atoll
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function DestinationsPage() {
  const { properties } = Route.useLoaderData();

  const groups = properties.reduce<Map<string, AtollGroup>>((acc, p: PropertyDTO) => {
    const atoll = p.atoll;
    const existing = acc.get(atoll) ?? {
      atoll,
      slug: slugify(atoll),
      count: 0,
      minPrice: Infinity,
      islands: [],
      names: [],
    };
    existing.count += 1;
    existing.minPrice = Math.min(existing.minPrice, p.fromPrice);
    if (!existing.names.includes(p.name)) existing.names.push(p.name);
    if (p.location && !existing.islands.includes(p.location)) existing.islands.push(p.location);
    acc.set(atoll, existing);
    return acc;
  }, new Map());

  const sorted = [...groups.values()].sort((a, b) => a.atoll.localeCompare(b.atoll));

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-4xl">Explore the Maldives by atoll</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          From the buzzy North Malé Atoll to the deep south — find the right island for your trip.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((g) => (
            <Link
              key={g.atoll}
              to="/destinations/$atoll"
              params={{ atoll: g.slug }}
              className="group rounded-2xl border bg-card p-6 transition-shadow hover:shadow-[var(--shadow-lift)]"
            >
              <div className="flex items-center justify-between">
                <MapPin className="size-5 text-primary" />
                <span className="text-sm text-muted-foreground">
                  {g.count} propert{g.count === 1 ? "y" : "ies"}
                </span>
              </div>
              <h2 className="mt-3 text-xl font-semibold group-hover:text-primary">{g.atoll}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {g.islands.slice(0, 3).join(", ")}
                {g.islands.length > 3 ? "…" : ""}
              </p>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="font-semibold">From ${g.minPrice}/night</span>
                <span className="flex items-center gap-1 text-primary">
                  Explore{" "}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border bg-secondary/30 p-8 text-center">
          <h2 className="text-2xl">Not sure which atoll?</h2>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
            Tell us your dates and we'll match you with islands that fit your budget and style.
          </p>
          <Button asChild className="mt-5">
            <Link to="/properties" search={{ type: "all" }}>
              Browse all stays
            </Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

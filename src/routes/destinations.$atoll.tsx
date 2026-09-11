import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PropertyCard } from "@/components/property-card";
import { Button } from "@/components/ui/button";
import { listProperties } from "@/lib/api/properties";
import type { PropertyDTO } from "@/lib/types";

export const Route = createFileRoute("/destinations/$atoll")({
  loader: async ({ params }) => {
    const properties = await listProperties();
    const slug = params.atoll.toLowerCase();
    const matches = properties.filter(
      (p) =>
        p.atoll
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") === slug,
    );
    return { atoll: matches[0]?.atoll ?? slug, properties: matches };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Destination | TravelOS by Boliflow" }] };
    }
    return {
      meta: [
        { title: `${loaderData.atoll} — Maldives Stays | TravelOS by Boliflow` },
        {
          name: "description",
          content: `Find ${loaderData.properties.length} resorts, guesthouses and safari boats in the ${loaderData.atoll}. Compare rates and plan your trip.`,
        },
        { property: "og:title", content: `${loaderData.atoll} — Maldives Stays | TravelOS by Boliflow` },
      ],
    };
  },
  component: DestinationPage,
});

function DestinationPage() {
  const { atoll, properties } = Route.useLoaderData();
  const types = Array.from(new Set(properties.map((p) => p.type))).join(", ");
  const minPrice = properties.length > 0 ? Math.min(...properties.map((p) => p.fromPrice)) : 0;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <Link
          to="/destinations"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> All destinations
        </Link>

        <div className="mt-4 rounded-3xl bg-secondary/40 p-8">
          <h1 className="flex items-center gap-2 text-4xl">
            <MapPin className="size-7 text-primary" /> {atoll}
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {properties.length} propert{properties.length === 1 ? "y" : "ies"} · {types || "stays"}{" "}
            · stays from <span className="font-semibold text-foreground">${minPrice}/night</span>
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link
                to="/search"
                search={{
                  checkIn: "",
                  checkOut: "",
                  adults: 2,
                  children: 0,
                  type: "all",
                  transfer: "all",
                }}
              >
                Check availability
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/contact">Ask an expert</Link>
            </Button>
          </div>
        </div>

        {properties.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed p-12 text-center">
            <p className="font-semibold">No stays found in this atoll yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We're adding more islands —{" "}
              <Link to="/contact" className="underline">
                get in touch
              </Link>{" "}
              and we'll source it for you.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {properties.map((p) => (
              <PropertyCard key={p.id} property={p as PropertyDTO} />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

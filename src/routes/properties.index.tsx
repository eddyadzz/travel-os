import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PropertyCard } from "@/components/property-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { atolls, properties, propertyTypes } from "@/lib/mock-data";
import { money } from "@/lib/pricing";

type PropertySearch = { type: string };

export const Route = createFileRoute("/properties/")({
  validateSearch: (search: Record<string, unknown>): PropertySearch => ({
    type: typeof search["type"] === "string" ? (search["type"] as string) : "all",
  }),
  head: () => ({
    meta: [
      { title: "Maldives Stays — Resorts, Guesthouses & Safari Boats | Ocean Atlas" },
      {
        name: "description",
        content:
          "Compare Maldives resorts, hotels, guesthouses and liveaboard safari boats by atoll, transfer type and nightly rate.",
      },
      { property: "og:title", content: "Maldives Stays | Ocean Atlas" },
      { property: "og:description", content: "Compare Maldives properties by atoll, type and nightly rate." },
    ],
  }),
  component: PropertiesPage,
});

function PropertiesPage() {
  const { type } = Route.useSearch();
  const navigate = useNavigate({ from: "/properties/" });
  const [query, setQuery] = useState("");
  const [atoll, setAtoll] = useState("all");
  const [maxPrice, setMaxPrice] = useState(1500);
  const [sort, setSort] = useState("recommended");

  const activeType = type;

  const results = useMemo(() => {
    const list = properties.filter((p) => {
      const matchesType = activeType === "all" || p.type === activeType;
      const matchesAtoll = atoll === "all" || p.atoll === atoll;
      const matchesPrice = p.fromPrice <= maxPrice;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q || [p.name, p.location, p.atoll, p.type].some((f) => f.toLowerCase().includes(q));
      return matchesType && matchesAtoll && matchesPrice && matchesQuery;
    });
    if (sort === "price-asc") return [...list].sort((a, b) => a.fromPrice - b.fromPrice);
    if (sort === "price-desc") return [...list].sort((a, b) => b.fromPrice - a.fromPrice);
    if (sort === "rating") return [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [activeType, atoll, maxPrice, query, sort]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-4xl">Find your island</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {properties.length} properties across the Maldives — every rate below is an estimate confirmed by an agent
          before you pay.
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
          <aside className="h-fit rounded-2xl border bg-card p-5 lg:sticky lg:top-24">
            <p className="flex items-center gap-2 font-semibold">
              <SlidersHorizontal className="size-4" /> Filters
            </p>

            <div className="mt-5 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="q">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Island or name" className="pl-9" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Property type</Label>
                <Select
                  value={activeType}
                  onValueChange={(v) => navigate({ search: { type: v } })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {propertyTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Atoll</Label>
                <Select value={atoll} onValueChange={setAtoll}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All atolls</SelectItem>
                    {atolls.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Max nightly rate: {money(maxPrice)}</Label>
                <Slider value={[maxPrice]} onValueChange={(v) => setMaxPrice(v[0] ?? 1500)} min={50} max={1500} step={25} />
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setQuery("");
                  setAtoll("all");
                  setMaxPrice(1500);
                  navigate({ search: { type: "all" } });
                }}
              >
                Reset filters
              </Button>
            </div>
          </aside>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{results.length} properties match</p>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommended">Recommended</SelectItem>
                  <SelectItem value="price-asc">Price: low to high</SelectItem>
                  <SelectItem value="price-desc">Price: high to low</SelectItem>
                  <SelectItem value="rating">Guest rating</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {results.length === 0 ? (
              <div className="mt-10 rounded-2xl border border-dashed p-12 text-center">
                <p className="font-semibold">No properties match these filters</p>
                <p className="mt-1 text-sm text-muted-foreground">Try widening the price range or clearing the atoll.</p>
              </div>
            ) : (
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                {results.map((p) => (
                  <PropertyCard key={p.id} property={p} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

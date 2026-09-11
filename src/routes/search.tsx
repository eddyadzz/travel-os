import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, Search as SearchIcon, SlidersHorizontal, Users } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SearchResultCard } from "@/components/search-result-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { searchAvailableProperties } from "@/lib/api/search";
import { money } from "@/lib/pricing";

type SearchQuery = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  type: string;
  transfer: string;
};

const defaultSearch: SearchQuery = {
  checkIn: "",
  checkOut: "",
  adults: 2,
  children: 0,
  type: "all",
  transfer: "all",
};

const toInt = (v: unknown, fallback: number) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return fallback;
};

const toStr = (v: unknown, fallback: string) => (typeof v === "string" && v ? v : fallback);

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): SearchQuery => ({
    checkIn: toStr(search["checkIn"], ""),
    checkOut: toStr(search["checkOut"], ""),
    adults: toInt(search["adults"], 2),
    children: toInt(search["children"], 0),
    type: toStr(search["type"], "all"),
    transfer: toStr(search["transfer"], "all"),
  }),
  loader: async ({ location }) => {
    const search = location.search as Partial<SearchQuery>;
    const { checkIn = "", checkOut = "" } = search;
    if (!checkIn || !checkOut) return { results: [], searched: false, checkIn, checkOut };
    const results = await searchAvailableProperties({
      data: {
        checkIn,
        checkOut,
        adults: search.adults ?? 2,
        children: search.children ?? 0,
        ...(search.type && search.type !== "all" ? { propertyType: search.type } : {}),
        ...(search.transfer && search.transfer !== "all" ? { transfer: search.transfer } : {}),
      },
    });
    return { results, searched: true, checkIn, checkOut };
  },
  head: () => ({
    meta: [
      { title: "Search Available Stays by Date | TravelOS by Boliflow" },
      {
        name: "description",
        content:
          "Search Maldives resorts, guesthouses and safari boats by travel dates. Only properties with availability and a valid seasonal rate for your dates are shown.",
      },
      { property: "og:title", content: "Search Available Stays | TravelOS by Boliflow" },
      {
        property: "og:description",
        content: "Find a Maldives stay with real availability for your dates.",
      },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { results, searched, checkIn, checkOut } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const [maxPrice, setMaxPrice] = useState(1500);

  const filtered = useMemo(
    () => results.filter((r) => r.fromPrice <= maxPrice),
    [results, maxPrice],
  );

  const updateSearch = (patch: Partial<SearchQuery>) => {
    void navigate({ search: { ...search, ...patch } });
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-4xl">Find an island for your dates</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Only stays with availability and a valid seasonal rate for your dates are shown.
        </p>

        <form
          className="mt-8 rounded-2xl border bg-card p-5 shadow-[var(--shadow-soft)]"
          onSubmit={(e) => {
            e.preventDefault();
            updateSearch({});
          }}
        >
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label>Check-in</Label>
              <Input
                type="date"
                value={search.checkIn}
                onChange={(e) => updateSearch({ checkIn: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Check-out</Label>
              <Input
                type="date"
                value={search.checkOut}
                onChange={(e) => updateSearch({ checkOut: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adults">Adults</Label>
              <Input
                id="adults"
                type="number"
                min={1}
                max={8}
                value={search.adults}
                onChange={(e) => updateSearch({ adults: Number(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="children">Children</Label>
              <Input
                id="children"
                type="number"
                min={0}
                max={6}
                value={search.children}
                onChange={(e) => updateSearch({ children: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full md:w-auto">
                <SearchIcon className="size-4" /> Search
              </Button>
            </div>
          </div>
        </form>

        {!searched || !checkIn ? (
          <div className="mt-10 rounded-2xl border border-dashed p-14 text-center">
            <CalendarDays className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-semibold">Pick your dates to see what's available</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We'll check live inventory and seasonal rates across every property.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
            <aside className="h-fit rounded-2xl border bg-card p-5 lg:sticky lg:top-24">
              <p className="flex items-center gap-2 font-semibold">
                <SlidersHorizontal className="size-4" /> Filters
              </p>

              <div className="mt-5 space-y-5">
                <div className="space-y-1.5">
                  <Label>Property type</Label>
                  <Select value={search.type} onValueChange={(v) => updateSearch({ type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="Resort">Resort</SelectItem>
                      <SelectItem value="Hotel">Hotel</SelectItem>
                      <SelectItem value="Guesthouse">Guesthouse</SelectItem>
                      <SelectItem value="Safari Boat">Safari Boat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Transfer</Label>
                  <Select
                    value={search.transfer}
                    onValueChange={(v) => updateSearch({ transfer: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any transfer</SelectItem>
                      <SelectItem value="seaplane">Seaplane</SelectItem>
                      <SelectItem value="speedboat">Speedboat</SelectItem>
                      <SelectItem value="flight">Domestic flight</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label>Max nightly rate: {money(maxPrice)}</Label>
                  <Slider
                    value={[maxPrice]}
                    onValueChange={(v) => setMaxPrice(v[0] ?? 1500)}
                    min={50}
                    max={1500}
                    step={25}
                  />
                </div>

                <Button variant="outline" className="w-full" onClick={() => setMaxPrice(1500)}>
                  Reset filters
                </Button>
              </div>
            </aside>

            <section>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-4" />
                {search.adults} adults, {search.children} children · {checkIn} → {checkOut}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "property" : "properties"} with
                availability
              </p>

              {filtered.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed p-12 text-center">
                  <p className="font-semibold">No stays match these filters</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try widening the price range or changing your dates.
                  </p>
                </div>
              ) : (
                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  {filtered.map((r) => (
                    <SearchResultCard key={r.id} result={r} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

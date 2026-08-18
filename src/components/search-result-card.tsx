import { Link } from "@tanstack/react-router";
import { MapPin, Plane, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AvailabilityBadge } from "@/components/availability-badge";
import { money } from "@/lib/pricing";
import type { SearchPropertyResult } from "@/lib/api/search";

export function SearchResultCard({ result }: { result: SearchPropertyResult }) {
  const minInventory = result.rooms[0]?.minInventory ?? null;
  return (
    <Link
      to="/properties/$propertyId"
      params={{ propertyId: result.id }}
      className="group overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-soft)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={result.image}
          alt={`${result.name} in ${result.location}`}
          loading="lazy"
          width={1200}
          height={800}
          className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3">
          <AvailabilityBadge status={result.bestStatus} inventory={minInventory} />
        </div>
        <Badge className="absolute right-3 top-3 bg-card text-card-foreground hover:bg-card">
          {result.type}
        </Badge>
      </div>
      <div className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold leading-snug">{result.name}</h3>
          <span className="flex shrink-0 items-center gap-1 text-sm font-medium">
            <Star className="size-4 fill-warning text-warning" /> {result.rating}
          </span>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4" /> {result.location}, {result.atoll}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Plane className="size-4" /> {result.transfer.method} · {result.transfer.duration}
        </p>
        <div className="flex items-end justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">
            from
            <span className="ml-1 text-display text-xl font-semibold text-foreground">
              {money(result.fromPrice)}
              <span className="text-sm font-normal text-muted-foreground"> / night</span>
            </span>
          </span>
          <span className="text-xs text-muted-foreground">{result.roomCount} room types</span>
        </div>
      </div>
    </Link>
  );
}

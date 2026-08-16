import { Link } from "@tanstack/react-router";
import { MapPin, Star, Plane } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { money } from "@/lib/pricing";
import type { Property } from "@/lib/mock-data";

export function PropertyCard({ property }: { property: Property }) {
  return (
    <Link
      to="/properties/$propertyId"
      params={{ propertyId: property.id }}
      className="group overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-soft)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={property.image}
          alt={`${property.name} in ${property.location}`}
          loading="lazy"
          width={1200}
          height={800}
          className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <Badge className="absolute left-3 top-3 bg-card text-card-foreground hover:bg-card">{property.type}</Badge>
        {property.featured && (
          <Badge className="absolute right-3 top-3 bg-coral text-coral-foreground hover:bg-coral">Featured</Badge>
        )}
      </div>
      <div className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold leading-snug">{property.name}</h3>
          <span className="flex shrink-0 items-center gap-1 text-sm font-medium">
            <Star className="size-4 fill-warning text-warning" />
            {property.rating}
          </span>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4" /> {property.location}, {property.atoll}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Plane className="size-4" /> {property.transfer.method} · {property.transfer.duration}
        </p>
        <div className="flex items-end justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">from</span>
          <span className="text-display text-xl font-semibold">
            {money(property.fromPrice)}
            <span className="text-sm font-normal text-muted-foreground"> / night</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

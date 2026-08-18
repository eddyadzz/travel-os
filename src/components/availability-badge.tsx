import { Badge } from "@/components/ui/badge";
import type { AvailabilityStatus } from "@/lib/api/search";

export function AvailabilityBadge({
  status,
  inventory,
}: {
  status: AvailabilityStatus;
  inventory?: number | null;
}) {
  if (status === "AVAILABLE") {
    return <Badge className="bg-success text-success-foreground hover:bg-success">Available</Badge>;
  }
  if (status === "LOW_AVAILABILITY") {
    return (
      <Badge className="bg-warning text-warning-foreground hover:bg-warning">
        Only {inventory ?? "a few"} rooms left
      </Badge>
    );
  }
  if (status === "ON_REQUEST") {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Availability on request
      </Badge>
    );
  }
  return (
    <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive">
      Sold out
    </Badge>
  );
}

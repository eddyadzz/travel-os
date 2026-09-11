import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { CalendarDays, Info } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listProperties } from "@/lib/api/properties";
import { getRoomCalendar } from "@/lib/api/availability";
import type { RoomCalendarDTO } from "@/lib/types";

export const Route = createFileRoute("/availability")({
  validateSearch: (search: Record<string, unknown>) => ({
    roomId: typeof search["roomId"] === "string" ? search["roomId"] : "",
  }),
  loader: async ({ location }) => {
    const search = location.search as { roomId?: string };
    const roomId = typeof search.roomId === "string" ? search.roomId : "";
    const properties = await listProperties();
    let calendar: RoomCalendarDTO | null = null;
    if (roomId) {
      calendar = await getRoomCalendar({ data: { roomId, days: 30 } });
    }
    return { properties, calendar, roomId };
  },
  head: () => ({
    meta: [
      { title: "Availability Calendar | TravelOS by Boliflow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AvailabilityPage,
});

function AvailabilityPage() {
  const { properties, calendar, roomId } = Route.useLoaderData();
  const navigate = useNavigate({ from: "/availability" });

  const rooms = useMemo(
    () =>
      properties.flatMap((p) => p.rooms.map((r) => ({ id: r.id, name: r.name, property: p.name }))),
    [properties],
  );

  const cellStyle = (status: RoomCalendarDTO["days"][number]["status"]) => {
    switch (status) {
      case "AVAILABLE":
        return "bg-success/70 text-success-foreground";
      case "LOW":
        return "bg-warning/70 text-warning-foreground";
      case "SOLD_OUT":
        return "bg-destructive/70 text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl">Availability calendar</h1>
            <p className="mt-2 text-muted-foreground">
              Next 30 days by room · green available, yellow low, red sold out, grey on request
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <div className="w-72 space-y-1.5">
            <p className="text-sm text-muted-foreground">Room</p>
            <Select value={roomId} onValueChange={(v) => navigate({ search: { roomId: v } })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a room…" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.property} — {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!calendar ? (
          <div className="mt-10 rounded-2xl border border-dashed p-14 text-center">
            <CalendarDays className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-semibold">Pick a room to see its availability</p>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">
                {calendar.propertyName} — {calendar.roomName}
              </h2>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="size-3 rounded bg-success/70" /> Available
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-3 rounded bg-warning/70" /> Low
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-3 rounded bg-destructive/70" /> Sold out
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-3 rounded bg-muted" /> On request
                </span>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-5 gap-2 sm:grid-cols-10">
              {calendar.days.map((d) => (
                <div key={d.date} className="text-center">
                  <div
                    className={`flex h-10 items-center justify-center rounded-lg text-sm font-semibold ${cellStyle(d.status)}`}
                  >
                    {d.inventory ?? "—"}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(d.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { money } from "@/lib/pricing";

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function icsDate(d: Date, allDay = true): string {
  // YYYYMMDD or YYYYMMDDTHHMMSSZ for timed events.
  return allDay
    ? d.toISOString().slice(0, 10).replace(/-/g, "")
    : d
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
}

function icsEvent(opts: {
  uid: string;
  summary: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  allDay?: boolean;
}): string {
  const allDay = opts.allDay ?? true;
  const lines = [
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${icsDate(new Date(), false)}`,
    `DTSTART:${allDay ? "VALUE=DATE:" : ""}${icsDate(opts.start, allDay)}`,
    `DTEND:${allDay ? "VALUE=DATE:" : ""}${icsDate(opts.end, allDay)}`,
    `SUMMARY:${esc(opts.summary)}`,
  ];
  if (opts.description) lines.push(`DESCRIPTION:${esc(opts.description)}`);
  if (opts.location) lines.push(`LOCATION:${esc(opts.location)}`);
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

export function buildBookingIcs(booking: {
  reference: string;
  checkIn: Date;
  checkOut: Date;
  propertyName: string;
  roomName: string;
  totalPrice: number;
  supplierDeadline?: Date;
  paymentDeadline?: Date;
}): string {
  const events = [
    icsEvent({
      uid: `arrival-${booking.reference}`,
      summary: `Arrival — ${booking.reference} ${booking.propertyName}`,
      start: booking.checkIn,
      end: new Date(booking.checkIn.getTime() + 86_400_000),
      description: `${booking.propertyName} · ${booking.roomName} · ${money(booking.totalPrice)}`,
      location: booking.propertyName,
    }),
    icsEvent({
      uid: `departure-${booking.reference}`,
      summary: `Departure — ${booking.reference} ${booking.propertyName}`,
      start: booking.checkOut,
      end: new Date(booking.checkOut.getTime() + 86_400_000),
      location: booking.propertyName,
    }),
  ];
  if (booking.supplierDeadline) {
    events.push(
      icsEvent({
        uid: `supplier-${booking.reference}`,
        summary: `Supplier deadline — ${booking.reference}`,
        start: booking.supplierDeadline,
        end: new Date(booking.supplierDeadline.getTime() + 86_400_000),
        description: `Confirm ${booking.propertyName} by this date`,
      }),
    );
  }
  if (booking.paymentDeadline) {
    events.push(
      icsEvent({
        uid: `payment-${booking.reference}`,
        summary: `Payment deadline — ${booking.reference}`,
        start: booking.paymentDeadline,
        end: new Date(booking.paymentDeadline.getTime() + 86_400_000),
        description: `Outstanding balance for ${booking.reference}`,
      }),
    );
  }
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ocean Atlas//Booking//EN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

function googleCalendarUrl(booking: {
  reference: string;
  checkIn: Date;
  checkOut: Date;
  propertyName: string;
}): string {
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${booking.reference} — ${booking.propertyName}`,
    dates: `${fmt(booking.checkIn)}/${fmt(booking.checkOut)}`,
    details: `Booking ${booking.reference} at ${booking.propertyName}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export const getBookingCalendar = createServerFn({ method: "GET" })
  .validator((bookingId: string) => bookingId)
  .handler(async ({ data: bookingId }) => {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: { property: { select: { name: true } }, room: { select: { name: true } } },
    });
    if (!booking) return null;
    const ics = buildBookingIcs({
      reference: booking.reference,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      propertyName: booking.property.name,
      roomName: booking.room.name,
      totalPrice: Number(booking.totalPrice),
      paymentDeadline: new Date(booking.checkIn.getTime() - 7 * 86_400_000),
    });
    return {
      reference: booking.reference,
      ics,
      googleUrl: googleCalendarUrl({
        reference: booking.reference,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        propertyName: booking.property.name,
      }),
      outlookUrl: `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`,
      filename: `${booking.reference}_calendar.ics`,
    };
  });

export const getAgencyCalendarFeed = createServerFn({ method: "GET" })
  .validator((input?: { from?: string; to?: string }) => input)
  .handler(async ({ data }) => {
    const from = new Date(data?.from ? `${data.from}T00:00:00.000Z` : Date.now() - 90 * 86_400_000);
    const to = new Date(data?.to ? `${data.to}T23:59:59.999Z` : Date.now() + 90 * 86_400_000);
    const bookings = await db.booking.findMany({
      where: {
        status: { not: "CANCELLED" },
        checkIn: { gte: from, lte: to },
      },
      include: { property: { select: { name: true } }, room: { select: { name: true } } },
      orderBy: { checkIn: "asc" },
    });
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Ocean Atlas//Agency Calendar//EN",
      ...bookings.flatMap((b) => [
        icsEvent({
          uid: `arrival-${b.reference}`,
          summary: `Arrival — ${b.reference} ${b.property.name}`,
          start: b.checkIn,
          end: new Date(b.checkIn.getTime() + 86_400_000),
          location: b.property.name,
        }),
        icsEvent({
          uid: `departure-${b.reference}`,
          summary: `Departure — ${b.reference} ${b.property.name}`,
          start: b.checkOut,
          end: new Date(b.checkOut.getTime() + 86_400_000),
          location: b.property.name,
        }),
      ]),
      "END:VCALENDAR",
    ].join("\r\n");
    return { bookings: bookings.length, ics, filename: "agency-calendar.ics" };
  });

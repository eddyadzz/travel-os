import type { AddonDTO } from "@/lib/types";

export type PriceBreakdown = {
  nights: number;
  guests: number;
  accommodation: number;
  extraGuests: number;
  transfers: number;
  addons: number;
  total: number;
};

type PriceRoom = {
  nightlyRate: number;
  baseGuests: number;
  extraGuestRate: number;
};

type PriceAddon = { pricing: AddonDTO["pricing"]; price: number };

export function nightsBetween(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0;
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return ms > 0 ? Math.round(ms / 86_400_000) : 0;
}

export function calculatePrice(opts: {
  transferPricePerPerson: number;
  room?: PriceRoom | undefined;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  addons: PriceAddon[];
  rooms?: number | undefined;
}): PriceBreakdown {
  const { transferPricePerPerson, room, checkIn, checkOut, adults, children, addons } = opts;
  const roomCount = opts.rooms ?? 1;
  const nights = nightsBetween(checkIn, checkOut);
  const guests = adults + children;

  if (!room || nights === 0) {
    return { nights, guests, accommodation: 0, extraGuests: 0, transfers: 0, addons: 0, total: 0 };
  }

  const accommodation = room.nightlyRate * nights * roomCount;
  const extra = Math.max(0, guests - room.baseGuests * roomCount);
  const extraGuests = extra * room.extraGuestRate * nights;
  const transfers = transferPricePerPerson * guests;

  const addonTotal = addons.reduce((sum, a) => {
    if (a.pricing === "Per Person") return sum + a.price * guests;
    if (a.pricing === "Per Room") return sum + a.price * roomCount;
    return sum + a.price;
  }, 0);

  return {
    nights,
    guests,
    accommodation,
    extraGuests,
    transfers,
    addons: addonTotal,
    total: accommodation + extraGuests + transfers + addonTotal,
  };
}

export const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

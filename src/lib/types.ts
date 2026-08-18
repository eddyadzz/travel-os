// Shared, client-safe types used by both the frontend and the server API.
// These mirror the DB models (via the DTO mappers in src/lib/server) and are
// shaped to match what the UI components already consume.

export type PropertyType = "Resort" | "Hotel" | "Guesthouse" | "Safari Boat";

export type RoomDTO = {
  id: string;
  name: string;
  maxGuests: number;
  baseGuests: number;
  nightlyRate: number;
  extraGuestRate: number;
  boardBasis: string;
  size: string;
  availableUnits: number;
};

export type AddonPricing = "Per Person" | "Per Room" | "Fixed Amount";

export type AddonDTO = {
  id: string;
  name: string;
  description: string;
  pricing: AddonPricing;
  price: number;
  category: string;
};

export type PropertyDTO = {
  id: string;
  slug: string;
  name: string;
  type: PropertyType;
  location: string;
  atoll: string;
  description: string;
  highlights: string[];
  image: string;
  gallery: string[];
  amenities: string[];
  transfer: { method: string; duration: string; pricePerPerson: number };
  featured: boolean;
  rating: number;
  fromPrice: number;
  rooms: RoomDTO[];
  addons: AddonDTO[];
};

export type BookingStatus = "NEW" | "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED";

export type BookingDTO = {
  id: string;
  reference: string;
  status: BookingStatus;
  property: string;
  room: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  addons: string[];
  total: number;
  customer: { name: string; email: string; phone: string; country: string };
  submittedAt: string;
  specialRequests?: string;
};

export type CreateBookingInput = {
  propertyId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  addonIds: string[];
  customer: { fullName: string; email: string; phone: string; country: string };
  specialRequests?: string;
};

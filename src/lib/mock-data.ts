import prop1 from "@/assets/prop-1.jpg";
import prop2 from "@/assets/prop-2.jpg";
import prop3 from "@/assets/prop-3.jpg";
import prop4 from "@/assets/prop-4.jpg";

export type PropertyType = "Resort" | "Hotel" | "Guesthouse" | "Safari Boat";

export type Room = {
  id: string;
  name: string;
  maxGuests: number;
  baseGuests: number;
  /** nightly rate for the room */
  nightlyRate: number;
  /** charge per extra guest beyond baseGuests, per night */
  extraGuestRate: number;
  boardBasis: string;
  size: string;
  availableUnits: number;
};

export type Addon = {
  id: string;
  name: string;
  description: string;
  pricing: "Per Person" | "Per Room" | "Fixed Amount";
  price: number;
  category: "Spa" | "Dining" | "Diving" | "Excursion" | "Transfer";
};

export type Property = {
  id: string;
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
  rooms: Room[];
  addons: Addon[];
};

const sharedAddons: Addon[] = [
  {
    id: "a1",
    name: "Sunset Spa Ritual",
    description: "90-minute couples massage with lagoon view.",
    pricing: "Per Person",
    price: 180,
    category: "Spa",
  },
  {
    id: "a2",
    name: "Romantic Sandbank Dinner",
    description: "Private 5-course dinner on a private sandbank.",
    pricing: "Fixed Amount",
    price: 450,
    category: "Dining",
  },
  {
    id: "a3",
    name: "3-Dive Discovery Package",
    description: "Guided reef dives with full equipment rental.",
    pricing: "Per Person",
    price: 320,
    category: "Diving",
  },
  {
    id: "a4",
    name: "Dolphin Cruise Excursion",
    description: "Two-hour sunset dolphin safari with refreshments.",
    pricing: "Per Person",
    price: 75,
    category: "Excursion",
  },
  {
    id: "a5",
    name: "In-Villa Breakfast Setup",
    description: "Floating breakfast tray served in your pool.",
    pricing: "Per Room",
    price: 140,
    category: "Dining",
  },
];

export const properties: Property[] = [
  {
    id: "velaa-lagoon-resort",
    name: "Velaa Lagoon Resort & Spa",
    type: "Resort",
    location: "Fushi Island",
    atoll: "Baa Atoll",
    description:
      "A five-star private island wrapped in a house reef, with overwater villas, three restaurants and an award-winning spa suspended above the lagoon.",
    highlights: ["House reef snorkelling", "Overwater spa", "All-inclusive option"],
    image: prop1,
    gallery: [prop1, prop2, prop4],
    amenities: [
      "Private pool villas",
      "House reef",
      "Spa & wellness",
      "Dive centre",
      "3 restaurants",
      "Kids club",
      "Free Wi-Fi",
      "Water sports",
    ],
    transfer: { method: "Seaplane", duration: "35 min", pricePerPerson: 545 },
    featured: true,
    rating: 4.9,
    fromPrice: 620,
    rooms: [
      {
        id: "r1",
        name: "Beach Villa with Pool",
        maxGuests: 3,
        baseGuests: 2,
        nightlyRate: 620,
        extraGuestRate: 145,
        boardBasis: "Half Board",
        size: "120 m²",
        availableUnits: 6,
      },
      {
        id: "r2",
        name: "Overwater Villa",
        maxGuests: 3,
        baseGuests: 2,
        nightlyRate: 890,
        extraGuestRate: 165,
        boardBasis: "Half Board",
        size: "145 m²",
        availableUnits: 3,
      },
      {
        id: "r3",
        name: "Two-Bedroom Family Residence",
        maxGuests: 6,
        baseGuests: 4,
        nightlyRate: 1480,
        extraGuestRate: 190,
        boardBasis: "Full Board",
        size: "260 m²",
        availableUnits: 2,
      },
    ],
    addons: sharedAddons,
  },
  {
    id: "kaani-beach-hotel",
    name: "Kaani Beach Hotel",
    type: "Hotel",
    location: "Maafushi",
    atoll: "Kaafu Atoll",
    description:
      "Contemporary beachfront hotel steps from the bikini beach, ideal for travellers who want island life with easy speedboat access from Malé.",
    highlights: ["Bikini beach access", "Rooftop bar", "Excursion desk"],
    image: prop2,
    gallery: [prop2, prop3, prop1],
    amenities: [
      "Beachfront",
      "Rooftop restaurant",
      "Airport pickup",
      "Snorkelling gear",
      "Air conditioning",
      "Laundry",
    ],
    transfer: { method: "Speedboat", duration: "45 min", pricePerPerson: 55 },
    featured: true,
    rating: 4.5,
    fromPrice: 145,
    rooms: [
      {
        id: "r1",
        name: "Deluxe Sea View",
        maxGuests: 3,
        baseGuests: 2,
        nightlyRate: 145,
        extraGuestRate: 45,
        boardBasis: "Bed & Breakfast",
        size: "28 m²",
        availableUnits: 8,
      },
      {
        id: "r2",
        name: "Family Suite",
        maxGuests: 4,
        baseGuests: 3,
        nightlyRate: 210,
        extraGuestRate: 50,
        boardBasis: "Half Board",
        size: "42 m²",
        availableUnits: 4,
      },
    ],
    addons: sharedAddons.filter((a) => a.category !== "Spa"),
  },
  {
    id: "dhigurah-sands",
    name: "Dhigurah Sands Guesthouse",
    type: "Guesthouse",
    location: "Dhigurah",
    atoll: "South Ari Atoll",
    description:
      "Family-run guesthouse on a 3 km sand-spit island famous for year-round whale shark sightings and relaxed local-island living.",
    highlights: ["Whale shark trips", "Long beach", "Home-cooked meals"],
    image: prop3,
    gallery: [prop3, prop2, prop4],
    amenities: ["Free bicycles", "Whale shark tours", "Beach BBQ", "Wi-Fi", "Airport transfer desk"],
    transfer: { method: "Domestic flight + speedboat", duration: "1h 20m", pricePerPerson: 295 },
    featured: false,
    rating: 4.7,
    fromPrice: 95,
    rooms: [
      {
        id: "r1",
        name: "Garden Double",
        maxGuests: 2,
        baseGuests: 2,
        nightlyRate: 95,
        extraGuestRate: 30,
        boardBasis: "Bed & Breakfast",
        size: "22 m²",
        availableUnits: 5,
      },
      {
        id: "r2",
        name: "Beach Front Triple",
        maxGuests: 3,
        baseGuests: 2,
        nightlyRate: 130,
        extraGuestRate: 35,
        boardBasis: "Half Board",
        size: "30 m²",
        availableUnits: 3,
      },
    ],
    addons: sharedAddons.filter((a) => a.category !== "Spa"),
  },
  {
    id: "blue-horizon-safari",
    name: "Blue Horizon Safari Boat",
    type: "Safari Boat",
    location: "Central Atolls Route",
    atoll: "Multi-atoll",
    description:
      "Seven-night liveaboard cruising the central atolls with two to three dives a day, sandbank picnics and surf breaks depending on the season.",
    highlights: ["Liveaboard diving", "Sandbank picnics", "Nitrox available"],
    image: prop4,
    gallery: [prop4, prop1, prop3],
    amenities: ["Dive deck", "Sun deck", "Full board", "Nitrox", "Dhoni support boat"],
    transfer: { method: "Speedboat to marina", duration: "20 min", pricePerPerson: 40 },
    featured: true,
    rating: 4.8,
    fromPrice: 240,
    rooms: [
      {
        id: "r1",
        name: "Lower Deck Twin Cabin",
        maxGuests: 2,
        baseGuests: 2,
        nightlyRate: 240,
        extraGuestRate: 60,
        boardBasis: "Full Board",
        size: "14 m²",
        availableUnits: 4,
      },
      {
        id: "r2",
        name: "Upper Deck Master Cabin",
        maxGuests: 3,
        baseGuests: 2,
        nightlyRate: 330,
        extraGuestRate: 70,
        boardBasis: "Full Board",
        size: "20 m²",
        availableUnits: 2,
      },
    ],
    addons: sharedAddons.filter((a) => a.category === "Diving" || a.category === "Excursion"),
  },
];

export const propertyTypes: PropertyType[] = ["Resort", "Hotel", "Guesthouse", "Safari Boat"];

export const atolls = Array.from(new Set(properties.map((p) => p.atoll)));

export function getProperty(id: string) {
  return properties.find((p) => p.id === id);
}

export type BookingStatus = "New" | "Confirmed" | "Rejected";

export type BookingRequest = {
  id: string;
  reference: string;
  customer: { name: string; email: string; phone: string; country: string };
  property: string;
  room: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  addons: string[];
  total: number;
  status: BookingStatus;
  submittedAt: string;
  specialRequests?: string;
};

export const bookingRequests: BookingRequest[] = [
  {
    id: "b1",
    reference: "MV-24081",
    customer: { name: "Amelia Rossi", email: "amelia.rossi@mail.com", phone: "+39 340 118 2244", country: "Italy" },
    property: "Velaa Lagoon Resort & Spa",
    room: "Overwater Villa",
    checkIn: "2026-09-12",
    checkOut: "2026-09-17",
    nights: 5,
    adults: 2,
    children: 0,
    addons: ["Sunset Spa Ritual", "Romantic Sandbank Dinner"],
    total: 6410,
    status: "New",
    submittedAt: "2 hours ago",
    specialRequests: "Honeymoon trip — sea view room if possible, late check-out.",
  },
  {
    id: "b2",
    reference: "MV-24080",
    customer: { name: "Daniel Okafor", email: "d.okafor@mail.com", phone: "+44 7700 900112", country: "United Kingdom" },
    property: "Blue Horizon Safari Boat",
    room: "Upper Deck Master Cabin",
    checkIn: "2026-10-03",
    checkOut: "2026-10-10",
    nights: 7,
    adults: 2,
    children: 0,
    addons: ["3-Dive Discovery Package"],
    total: 3550,
    status: "New",
    submittedAt: "5 hours ago",
  },
  {
    id: "b3",
    reference: "MV-24078",
    customer: { name: "Hana Sato", email: "hana.sato@mail.jp", phone: "+81 90 2233 1188", country: "Japan" },
    property: "Kaani Beach Hotel",
    room: "Family Suite",
    checkIn: "2026-08-28",
    checkOut: "2026-09-02",
    nights: 5,
    adults: 2,
    children: 2,
    addons: ["Dolphin Cruise Excursion"],
    total: 1620,
    status: "Confirmed",
    submittedAt: "Yesterday",
  },
  {
    id: "b4",
    reference: "MV-24075",
    customer: { name: "Lucas Meyer", email: "lucas.meyer@mail.de", phone: "+49 151 2233 4455", country: "Germany" },
    property: "Dhigurah Sands Guesthouse",
    room: "Beach Front Triple",
    checkIn: "2026-09-01",
    checkOut: "2026-09-06",
    nights: 5,
    adults: 3,
    children: 0,
    addons: [],
    total: 1535,
    status: "Confirmed",
    submittedAt: "2 days ago",
  },
  {
    id: "b5",
    reference: "MV-24070",
    customer: { name: "Sofia Alvarez", email: "sofia.alvarez@mail.es", phone: "+34 611 223 344", country: "Spain" },
    property: "Velaa Lagoon Resort & Spa",
    room: "Beach Villa with Pool",
    checkIn: "2026-12-24",
    checkOut: "2026-12-31",
    nights: 7,
    adults: 2,
    children: 1,
    addons: ["In-Villa Breakfast Setup"],
    total: 7480,
    status: "Rejected",
    submittedAt: "4 days ago",
    specialRequests: "Peak season — no availability for the requested villa category.",
  },
];

export const rateImports = [
  { id: "i1", file: "velaa-rates-2026-q4.xlsx", property: "Velaa Lagoon Resort & Spa", rows: 1840, range: "01 Oct – 31 Dec 2026", uploaded: "Today, 09:12", status: "Applied" },
  { id: "i2", file: "kaani-rates-aug-sep.csv", property: "Kaani Beach Hotel", rows: 620, range: "01 Aug – 30 Sep 2026", uploaded: "Yesterday, 17:40", status: "Applied" },
  { id: "i3", file: "blue-horizon-cruises.xlsx", property: "Blue Horizon Safari Boat", rows: 96, range: "01 Sep – 30 Nov 2026", uploaded: "2 days ago", status: "Needs review" },
];

export const availabilityImports = [
  { id: "v1", file: "availability-2026-08-16.csv", property: "All properties", rows: 412, range: "16 Aug 2026", uploaded: "Today, 06:00", status: "Applied" },
  { id: "v2", file: "availability-2026-08-15.csv", property: "All properties", rows: 409, range: "15 Aug 2026", uploaded: "Yesterday, 06:00", status: "Applied" },
  { id: "v3", file: "dhigurah-manual.xlsx", property: "Dhigurah Sands Guesthouse", rows: 31, range: "01 – 31 Sep 2026", uploaded: "3 days ago", status: "Applied" },
];

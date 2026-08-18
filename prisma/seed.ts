import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";

// Seeds the Ocean Atlas database with the same catalogue, add-ons, bookings
// and imports the frontend currently serves from mock-data.ts.
// Run with: npm run db:seed

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) throw new Error("DATABASE_URL is not set. Add it to your .env file.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const images = {
  prop1: "/images/prop-1.jpg",
  prop2: "/images/prop-2.jpg",
  prop3: "/images/prop-3.jpg",
  prop4: "/images/prop-4.jpg",
} as const;

const addonDefs = [
  {
    id: "a1",
    name: "Sunset Spa Ritual",
    description: "90-minute couples massage with lagoon view.",
    pricingType: "PER_PERSON",
    amount: 180,
    category: "SPA",
  },
  {
    id: "a2",
    name: "Romantic Sandbank Dinner",
    description: "Private 5-course dinner on a private sandbank.",
    pricingType: "FIXED",
    amount: 450,
    category: "DINING",
  },
  {
    id: "a3",
    name: "3-Dive Discovery Package",
    description: "Guided reef dives with full equipment rental.",
    pricingType: "PER_PERSON",
    amount: 320,
    category: "DIVING",
  },
  {
    id: "a4",
    name: "Dolphin Cruise Excursion",
    description: "Two-hour sunset dolphin safari with refreshments.",
    pricingType: "PER_PERSON",
    amount: 75,
    category: "EXCURSION",
  },
  {
    id: "a5",
    name: "In-Villa Breakfast Setup",
    description: "Floating breakfast tray served in your pool.",
    pricingType: "PER_ROOM",
    amount: 140,
    category: "DINING",
  },
] satisfies Array<Prisma.AddonUncheckedCreateInput>;

const properties = [
  {
    slug: "velaa-lagoon-resort",
    name: "Velaa Lagoon Resort & Spa",
    type: "RESORT",
    atoll: "Baa Atoll",
    island: "Fushi Island",
    description:
      "A five-star private island wrapped in a house reef, with overwater villas, three restaurants and an award-winning spa suspended above the lagoon.",
    highlights: ["House reef snorkelling", "Overwater spa", "All-inclusive option"],
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
    gallery: [images.prop1, images.prop2, images.prop4],
    transferMethod: "Seaplane",
    transferDuration: "35 min",
    transferPricePerPerson: 545,
    featured: true,
    rating: 4.9,
    fromPrice: 620,
    addonIds: ["a1", "a2", "a3", "a4", "a5"],
    rooms: [
      {
        name: "Beach Villa with Pool",
        size: "120 m²",
        boardBasis: "Half Board",
        maxAdults: 3,
        maxChildren: 0,
        extraGuestRate: 145,
        rate: 620,
        units: 6,
      },
      {
        name: "Overwater Villa",
        size: "145 m²",
        boardBasis: "Half Board",
        maxAdults: 3,
        maxChildren: 0,
        extraGuestRate: 165,
        rate: 890,
        units: 3,
      },
      {
        name: "Two-Bedroom Family Residence",
        size: "260 m²",
        boardBasis: "Full Board",
        maxAdults: 4,
        maxChildren: 2,
        extraGuestRate: 190,
        rate: 1480,
        units: 2,
      },
    ],
  },
  {
    slug: "kaani-beach-hotel",
    name: "Kaani Beach Hotel",
    type: "HOTEL",
    atoll: "Kaafu Atoll",
    island: "Maafushi",
    description:
      "Contemporary beachfront hotel steps from the bikini beach, ideal for travellers who want island life with easy speedboat access from Malé.",
    highlights: ["Bikini beach access", "Rooftop bar", "Excursion desk"],
    amenities: [
      "Beachfront",
      "Rooftop restaurant",
      "Airport pickup",
      "Snorkelling gear",
      "Air conditioning",
      "Laundry",
    ],
    gallery: [images.prop2, images.prop3, images.prop1],
    transferMethod: "Speedboat",
    transferDuration: "45 min",
    transferPricePerPerson: 55,
    featured: true,
    rating: 4.5,
    fromPrice: 145,
    addonIds: ["a2", "a3", "a4", "a5"],
    rooms: [
      {
        name: "Deluxe Sea View",
        size: "28 m²",
        boardBasis: "Bed & Breakfast",
        maxAdults: 3,
        maxChildren: 0,
        extraGuestRate: 45,
        rate: 145,
        units: 8,
      },
      {
        name: "Family Suite",
        size: "42 m²",
        boardBasis: "Half Board",
        maxAdults: 3,
        maxChildren: 1,
        extraGuestRate: 50,
        rate: 210,
        units: 4,
      },
    ],
  },
  {
    slug: "dhigurah-sands",
    name: "Dhigurah Sands Guesthouse",
    type: "GUESTHOUSE",
    atoll: "South Ari Atoll",
    island: "Dhigurah",
    description:
      "Family-run guesthouse on a 3 km sand-spit island famous for year-round whale shark sightings and relaxed local-island living.",
    highlights: ["Whale shark trips", "Long beach", "Home-cooked meals"],
    amenities: [
      "Free bicycles",
      "Whale shark tours",
      "Beach BBQ",
      "Wi-Fi",
      "Airport transfer desk",
    ],
    gallery: [images.prop3, images.prop2, images.prop4],
    transferMethod: "Domestic flight + speedboat",
    transferDuration: "1h 20m",
    transferPricePerPerson: 295,
    featured: false,
    rating: 4.7,
    fromPrice: 95,
    addonIds: ["a2", "a3", "a4", "a5"],
    rooms: [
      {
        name: "Garden Double",
        size: "22 m²",
        boardBasis: "Bed & Breakfast",
        maxAdults: 2,
        maxChildren: 0,
        extraGuestRate: 30,
        rate: 95,
        units: 5,
      },
      {
        name: "Beach Front Triple",
        size: "30 m²",
        boardBasis: "Half Board",
        maxAdults: 3,
        maxChildren: 0,
        extraGuestRate: 35,
        rate: 130,
        units: 3,
      },
    ],
  },
  {
    slug: "blue-horizon-safari",
    name: "Blue Horizon Safari Boat",
    type: "SAFARI_BOAT",
    atoll: "Multi-atoll",
    island: "Central Atolls Route",
    description:
      "Seven-night liveaboard cruising the central atolls with two to three dives a day, sandbank picnics and surf breaks depending on the season.",
    highlights: ["Liveaboard diving", "Sandbank picnics", "Nitrox available"],
    amenities: ["Dive deck", "Sun deck", "Full board", "Nitrox", "Dhoni support boat"],
    gallery: [images.prop4, images.prop1, images.prop3],
    transferMethod: "Speedboat to marina",
    transferDuration: "20 min",
    transferPricePerPerson: 40,
    featured: true,
    rating: 4.8,
    fromPrice: 240,
    addonIds: ["a3", "a4"],
    rooms: [
      {
        name: "Lower Deck Twin Cabin",
        size: "14 m²",
        boardBasis: "Full Board",
        maxAdults: 2,
        maxChildren: 0,
        extraGuestRate: 60,
        rate: 240,
        units: 4,
      },
      {
        name: "Upper Deck Master Cabin",
        size: "20 m²",
        boardBasis: "Full Board",
        maxAdults: 3,
        maxChildren: 0,
        extraGuestRate: 70,
        rate: 330,
        units: 2,
      },
    ],
  },
] as const;

const bookings = [
  {
    reference: "MV-24081",
    customer: {
      fullName: "Amelia Rossi",
      email: "amelia.rossi@mail.com",
      phone: "+39 340 118 2244",
      country: "Italy",
    },
    propertySlug: "velaa-lagoon-resort",
    roomName: "Overwater Villa",
    checkIn: "2026-09-12",
    checkOut: "2026-09-17",
    adults: 2,
    children: 0,
    total: 6410,
    status: "NEW",
    addonNames: ["Sunset Spa Ritual", "Romantic Sandbank Dinner"],
    specialRequests: "Honeymoon trip — sea view room if possible, late check-out.",
    submittedAt: "2026-08-16T10:00:00.000Z",
  },
  {
    reference: "MV-24080",
    customer: {
      fullName: "Daniel Okafor",
      email: "d.okafor@mail.com",
      phone: "+44 7700 900112",
      country: "United Kingdom",
    },
    propertySlug: "blue-horizon-safari",
    roomName: "Upper Deck Master Cabin",
    checkIn: "2026-10-03",
    checkOut: "2026-10-10",
    adults: 2,
    children: 0,
    total: 3550,
    status: "NEW",
    addonNames: ["3-Dive Discovery Package"],
    submittedAt: "2026-08-16T05:00:00.000Z",
  },
  {
    reference: "MV-24078",
    customer: {
      fullName: "Hana Sato",
      email: "hana.sato@mail.jp",
      phone: "+81 90 2233 1188",
      country: "Japan",
    },
    propertySlug: "kaani-beach-hotel",
    roomName: "Family Suite",
    checkIn: "2026-08-28",
    checkOut: "2026-09-02",
    adults: 2,
    children: 2,
    total: 1620,
    status: "CONFIRMED",
    addonNames: ["Dolphin Cruise Excursion"],
    submittedAt: "2026-08-15T09:00:00.000Z",
  },
  {
    reference: "MV-24075",
    customer: {
      fullName: "Lucas Meyer",
      email: "lucas.meyer@mail.de",
      phone: "+49 151 2233 4455",
      country: "Germany",
    },
    propertySlug: "dhigurah-sands",
    roomName: "Beach Front Triple",
    checkIn: "2026-09-01",
    checkOut: "2026-09-06",
    adults: 3,
    children: 0,
    total: 1535,
    status: "CONFIRMED",
    addonNames: [],
    submittedAt: "2026-08-14T09:00:00.000Z",
  },
  {
    reference: "MV-24070",
    customer: {
      fullName: "Sofia Alvarez",
      email: "sofia.alvarez@mail.es",
      phone: "+34 611 223 344",
      country: "Spain",
    },
    propertySlug: "velaa-lagoon-resort",
    roomName: "Beach Villa with Pool",
    checkIn: "2026-12-24",
    checkOut: "2026-12-31",
    adults: 2,
    children: 1,
    total: 7480,
    status: "REJECTED",
    addonNames: ["In-Villa Breakfast Setup"],
    specialRequests: "Peak season — no availability for the requested villa category.",
    submittedAt: "2026-08-12T09:00:00.000Z",
  },
] as const;

async function main() {
  console.log("Clearing existing data…");
  await db.bookingAddon.deleteMany();
  await db.booking.deleteMany();
  await db.availability.deleteMany();
  await db.rate.deleteMany();
  await db.addon.deleteMany();
  await db.room.deleteMany();
  await db.property.deleteMany();
  await db.customer.deleteMany();
  await db.user.deleteMany();

  const addons = new Map<string, string>();
  for (const a of addonDefs) {
    const created = await db.addon.create({ data: a });
    addons.set(a.name, created.id);
  }

  const propertyIds = new Map<string, string>();
  const roomIds = new Map<string, { propertyId: string; roomId: string }>();

  for (const p of properties) {
    const property = await db.property.create({
      data: {
        slug: p.slug,
        name: p.name,
        type: p.type,
        atoll: p.atoll,
        island: p.island,
        description: p.description,
        highlights: p.highlights,
        amenities: p.amenities,
        gallery: p.gallery,
        transferMethod: p.transferMethod,
        transferDuration: p.transferDuration,
        transferPricePerPerson: p.transferPricePerPerson,
        featured: p.featured,
        rating: p.rating,
        addons: { connect: p.addonIds.map((id) => ({ id })) },
      },
    });
    propertyIds.set(p.slug, property.id);

    for (const r of p.rooms) {
      const room = await db.room.create({
        data: {
          propertyId: property.id,
          name: r.name,
          size: r.size,
          boardBasis: r.boardBasis,
          maxAdults: r.maxAdults,
          maxChildren: r.maxChildren,
          extraGuestRate: r.extraGuestRate,
          rates: {
            create: [
              {
                propertyId: property.id,
                validFrom: new Date("2026-11-01"),
                validTo: new Date("2027-03-31"),
                amount: Math.round(r.rate * 1.25),
                season: "High",
              },
              {
                propertyId: property.id,
                validFrom: new Date("2026-04-01"),
                validTo: new Date("2026-10-31"),
                amount: r.rate,
                season: "Low",
              },
            ],
          },
          availabilities: {
            create: Array.from({ length: 90 }, (_, i) => ({
              propertyId: property.id,
              date: new Date(Date.now() + i * 86_400_000),
              inventory: i % 7 === 0 ? 0 : r.units,
            })),
          },
        },
      });
      roomIds.set(`${p.slug}:${r.name}`, { propertyId: property.id, roomId: room.id });
    }
  }

  for (const b of bookings) {
    const propertyId = propertyIds.get(b.propertySlug);
    const room = roomIds.get(`${b.propertySlug}:${b.roomName}`);
    if (!propertyId || !room) throw new Error(`Seed data missing for booking ${b.reference}`);

    const customer = await db.customer.create({
      data: {
        fullName: b.customer.fullName,
        email: b.customer.email,
        phone: b.customer.phone,
        country: b.customer.country,
      },
    });

    const addonRows = b.addonNames
      .map((name) => ({ name, id: addons.get(name) }))
      .filter((x): x is { name: string; id: string } => Boolean(x.id));

    await db.booking.create({
      data: {
        reference: b.reference,
        status: b.status,
        propertyId,
        roomId: room.roomId,
        customerId: customer.id,
        checkIn: new Date(b.checkIn),
        checkOut: new Date(b.checkOut),
        nights: Math.round(
          (new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / 86_400_000,
        ),
        adults: b.adults,
        children: b.children,
        totalPrice: b.total,
        specialRequests: b.specialRequests,
        submittedAt: new Date(b.submittedAt),
        addons: {
          create: addonRows.map((a) => ({ addonId: a.id, priceSnapshot: 0 })),
        },
      },
    });
  }

  await db.user.create({
    data: {
      email: "admin@oceanatlas.mv",
      fullName: "Ocean Atlas Admin",
      passwordHash: "REPLACE_WITH_BCRYPT_HASH",
      role: "SUPER_ADMIN",
    },
  });

  console.log("Seed complete.");
  console.log(`  properties: ${properties.length}`);
  console.log(`  rooms:      ${[...roomIds.keys()].length}`);
  console.log(`  bookings:   ${bookings.length}`);
  console.log("  users:      1 (admin@oceanatlas.mv — set a real password hash in Phase 2)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

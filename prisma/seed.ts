import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma, $Enums } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/crypto.server";

// Seeds the TravelOS by Boliflow database with the same catalogue, add-ons, bookings
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

type SeedBooking = {
  reference: string;
  customer: { fullName: string; email: string; phone: string; country: string };
  propertySlug: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  total: number;
  status: $Enums.BookingStatus;
  addonNames: string[];
  specialRequests?: string;
  submittedAt: string;
  assignedAgentEmail?: string;
  supplierReference?: string;
  supplierStatus?: string;
  notes?: string[];
  conversation?: Array<{
    senderType: $Enums.MessageSenderType;
    senderName: string;
    message: string;
    isInternal?: boolean;
  }>;
};

const bookings: SeedBooking[] = [
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
    assignedAgentEmail: "ahmed@oceanatlas.mv",
    supplierReference: "VELAA-2026-8812",
    supplierStatus: "Requested",
    notes: [
      "Customer prefers upper deck — will confirm with resort.",
      "Supplier offered overwater sunrise upgrade for +$120/night.",
    ],
    conversation: [
      {
        senderType: "CUSTOMER",
        senderName: "Amelia Rossi",
        message: "Hi — can we get a room with a sunset view?",
      },
      {
        senderType: "AGENT",
        senderName: "Ahmed Hassan",
        message:
          "We've requested availability from the resort — the sunrise-facing villas are confirmed.",
      },
      { senderType: "CUSTOMER", senderName: "Amelia Rossi", message: "That's perfect, thank you!" },
      {
        senderType: "AGENT",
        senderName: "Ahmed Hassan",
        message: "Waiting on seaplane schedule confirmation — will share shortly.",
        isInternal: true,
      },
    ],
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
    notes: ["Waiting for liveaboard availability confirmation."],
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
    assignedAgentEmail: "ahmed@oceanatlas.mv",
    supplierReference: "KAANI-2026-4401",
    supplierStatus: "Confirmed",
    notes: ["Payment received via card — booking confirmed."],
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
    assignedAgentEmail: "fatima@oceanatlas.mv",
    notes: ["Customer requested late checkout; guesthouse agreed."],
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
    status: "CANCELLED",
    addonNames: ["In-Villa Breakfast Setup"],
    specialRequests: "Peak season — no availability for the requested villa category.",
    submittedAt: "2026-08-12T09:00:00.000Z",
    assignedAgentEmail: "fatima@oceanatlas.mv",
    notes: [
      "No availability for requested villa category in peak season — cancelled at customer request.",
    ],
  },
];

const suppliers = [
  {
    name: "Velaa Private Island",
    type: "RESORT",
    email: "reservations@velaaisland.com",
    phone: "+960 660 8800",
    contactPerson: "Reservations Team",
  },
  {
    name: "Kaani Beach Hotel",
    type: "HOTEL",
    email: "bookings@kaanibeach.com",
    phone: "+960 664 4424",
    contactPerson: "Front Office",
  },
  {
    name: "Dhigurah Sands",
    type: "GUESTHOUSE",
    email: "stay@dhigurahsands.mv",
    phone: "+960 999 2222",
    contactPerson: "Ismail",
  },
  {
    name: "Blue Horizon Cruises",
    type: "SAFARI",
    email: "charter@bluehorizon.mv",
    phone: "+960 777 0011",
    contactPerson: "Captain",
  },
  {
    name: "Trans Maldivian Airways",
    type: "TRANSFER",
    email: "reservations@transmaldivian.aero",
    phone: "+960 331 0000",
    contactPerson: "Reservations",
  },
  {
    name: "Ocean Dive Centre",
    type: "DIVE_CENTER",
    email: "dive@oceandive.mv",
    phone: "+960 770 5566",
    contactPerson: "Dive Master",
  },
] as const;

const leads = [
  {
    source: "INSTAGRAM",
    status: "QUOTED",
    fullName: "Mia Thompson",
    email: "mia.thompson@mail.com",
    phone: "+1 415 555 0101",
    destination: "Velaa Lagoon Resort & Spa",
    checkIn: "2026-11-20",
    checkOut: "2026-11-27",
    adults: 2,
    children: 0,
    notes: "Honeymoon — interested in overwater villa.",
    quote: {
      totalPrice: 8200,
      validUntil: "2026-09-30",
      notes: "High season, overwater villa, half board",
    },
  },
  {
    source: "WHATSAPP",
    status: "NEW",
    fullName: "Omar Farouk",
    email: "omar.farouk@mail.com",
    phone: "+971 50 555 0199",
    destination: "Blue Horizon Safari Boat",
    checkIn: "2026-12-02",
    checkOut: "2026-12-09",
    adults: 2,
    children: 0,
    notes: "Liveaboard diver — wants 7 nights with dive package.",
  },
  {
    source: "WEBSITE",
    status: "FOLLOW_UP",
    fullName: "Elena Petrova",
    email: "elena.petrova@mail.ru",
    phone: "+7 999 555 0142",
    destination: "Kaani Beach Hotel",
    checkIn: "2026-10-05",
    checkOut: "2026-10-12",
    adults: 2,
    children: 2,
    notes: "Family trip — needs 2 connecting rooms.",
    quote: { totalPrice: 2100, validUntil: "2026-09-15" },
    task: { dueAt: "2026-08-25", note: "Follow up on quote — awaiting response" },
  },
  {
    source: "REFERRAL",
    status: "WON",
    fullName: "James Carter",
    email: "james.carter@mail.com",
    phone: "+44 20 5555 0130",
    destination: "Dhigurah Sands Guesthouse",
    checkIn: "2026-09-10",
    checkOut: "2026-09-15",
    adults: 2,
    children: 1,
    notes: "Referred by a past guest.",
    bookingRef: "MV-24075",
    quote: { totalPrice: 1535, validUntil: "2026-08-30" },
  },
  {
    source: "PHONE",
    status: "LOST",
    fullName: "Lucia Fernandez",
    email: "lucia.fernandez@mail.es",
    phone: "+34 611 555 0177",
    destination: "Velaa Lagoon Resort & Spa",
    checkIn: "2026-12-24",
    checkOut: "2026-12-31",
    adults: 2,
    children: 0,
    notes: "Too expensive — went elsewhere.",
  },
] as const;

async function main() {
  console.log("Clearing existing data…");
  await db.leadTask.deleteMany();
  await db.quote.deleteMany();
  await db.lead.deleteMany();
  await db.bookingAddon.deleteMany();
  await db.bookingDocument.deleteMany();
  await db.supplierConfirmation.deleteMany();
  await db.contractRate.deleteMany();
  await db.supplierContact.deleteMany();
  await db.booking.deleteMany();
  await db.availability.deleteMany();
  await db.rate.deleteMany();
  await db.addon.deleteMany();
  await db.promotion.deleteMany();
  await db.package.deleteMany();
  await db.room.deleteMany();
  await db.property.deleteMany();
  await db.supplier.deleteMany();
  await db.customer.deleteMany();
  await db.user.deleteMany();

  // Ensure the default tenant exists (idempotent) so the platform is usable
  // out of the box — the homepage/CMS/deploy look this up by slug.
  const tenant = await db.tenant.upsert({
    where: { slug: "ocean-atlas" },
    create: { slug: "ocean-atlas", name: "TravelOS by Boliflow", plan: "PROFESSIONAL" },
    update: {},
  });

  // Default homepage content.
  const defaultContent = {
    heroEyebrow: "Maldives specialists",
    heroHeadline: "Build your Maldives escape, priced before you ask.",
    heroSubheadline:
      "Pick an island, choose your villa, add spa, diving and transfers — see the estimate instantly and send one complete request to our agents.",
    heroCtaLabel: "Search availability",
    heroCtaTarget: "/search",
    heroCtas: [
      { label: "Explore holidays", target: "/properties" },
      { label: "View offers", target: "/#offers" },
      { label: "Contact an expert", target: "/contact" },
    ],
    featuredPropertySlugs: [],
    testimonials: [
      {
        name: "Amelia R.",
        quote:
          "Flawless from quote to check-in — the deposit was simple and the vouchers arrived automatically.",
        role: "Overwater villa · Sep 2026",
      },
      {
        name: "Daniel O.",
        quote: "Instant pricing and one request. The team confirmed our safari boat within hours.",
        role: "Liveaboard · Oct 2026",
      },
    ],
    aboutSummary:
      "We are a Maldives travel agency delivering resorts, guesthouses and safari boats with transparent pricing and a fully digital booking experience.",
    specialOffers: [
      {
        title: "Stay 4, Pay 3",
        subtitle: "One complimentary night on ocean villas",
        property: "Velaa Lagoon Resort & Spa",
        description: "Extend a four-night stay to five for the price of four.",
        discount: "1 night free",
        image: images.prop1,
        ctaLabel: "View offer",
        ctaUrl: "/properties",
        active: true,
      },
      {
        title: "Complimentary seaplane transfers",
        subtitle: "Round-trip for two, included",
        property: "Selected Noonu Atoll resorts",
        description: "Book seven nights or more and we cover the seaplane both ways.",
        discount: "Free transfers",
        image: images.prop2,
        ctaLabel: "View offer",
        ctaUrl: "/properties",
        active: true,
      },
      {
        title: "Honeymoon benefits",
        subtitle: "Sparkling wine, spa credit and a private dinner",
        property: "All resorts",
        description: "A welcome amenity, one spa treatment per person and a beach dinner.",
        discount: "Honeymoon",
        image: images.prop3,
        ctaLabel: "View offer",
        ctaUrl: "/properties",
        active: true,
      },
    ],
    marketingBlocks: {
      belowHero: {
        enabled: true,
        title: "Complimentary speedboat transfers this season",
        subtitle:
          "Reserve any resort villa for five nights or more and we'll include the round-trip speedboat transfer for two — worth up to $1,100.",
        buttonLabel: "Search availability",
        buttonUrl: "/search",
      },
    },
  };
  const existingContent = await db.siteContent.findUnique({ where: { tenantId: tenant.id } });
  if (existingContent) {
    await db.siteContent.update({
      where: { id: existingContent.id },
      data: { data: defaultContent },
    });
  } else {
    await db.siteContent.create({ data: { tenantId: tenant.id, data: defaultContent } });
  }

  // Starter pages (About + FAQ) only when none exist for this tenant.
  const pageCount = await db.cmsPage.count({ where: { tenantId: tenant.id } });
  if (pageCount === 0) {
    await db.cmsPage.create({
      data: {
        tenantId: tenant.id,
        slug: "about",
        title: "About us",
        body: "We are a Maldives travel agency.\n\nFrom overwater resorts to guesthouses and liveaboard safari boats, we build your trip with transparent pricing and handle every detail — availability, transfers, vouchers and 24/7 support — in one place.",
        published: true,
        sortOrder: 0,
      },
    });
    await db.cmsPage.create({
      data: {
        tenantId: tenant.id,
        slug: "faq",
        title: "Frequently asked questions",
        body: "How do payments work?\n\nBook with a 50% deposit, then settle the balance before arrival. Pay securely through your booking portal.\n\nHow do I get my vouchers?\n\nVouchers are generated automatically three days before arrival and emailed to you.",
        published: true,
        sortOrder: 1,
      },
    });
  }

  const addons = new Map<string, string>();
  for (const a of addonDefs) {
    const created = await db.addon.create({ data: a });
    addons.set(a.name, created.id);
  }

  // Suppliers must exist before properties (Property.supplierId).
  const supplierIds = new Map<string, string>();
  for (const s of suppliers) {
    const supplier = await db.supplier.create({ data: s });
    supplierIds.set(s.name.toLowerCase(), supplier.id);
    await db.supplierContact.createMany({
      data: [
        {
          supplierId: supplier.id,
          name: "Reservations",
          role: "Reservations",
          email: s.email,
          phone: s.phone,
        },
        { supplierId: supplier.id, name: "Accounts", role: "Finance", email: s.email },
      ],
    });
  }

  const propertyIds = new Map<string, string>();
  const roomIds = new Map<string, { propertyId: string; roomId: string }>();
  const bookingIds = new Map<string, string>();

  const supplierByProperty: Record<string, string> = {
    "velaa-lagoon-resort": "velaa private island",
    "kaani-beach-hotel": "kaani beach hotel",
    "dhigurah-sands": "dhigurah sands",
    "blue-horizon-safari": "blue horizon cruises",
  };

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
        ...(supplierByProperty[p.slug]
          ? { supplierId: supplierIds.get(supplierByProperty[p.slug]) ?? null }
          : {}),
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

  // Sample packages & promotions so the catalogue editor starts populated.
  const velaaId = propertyIds.get("velaa-lagoon-resort");
  const velaaBeachVilla = roomIds.get("velaa-lagoon-resort:Beach Villa with Pool")?.roomId;
  if (velaaId) {
    await db.package.createMany({
      data: [
        {
          propertyId: velaaId,
          name: "Honeymoon Package",
          description:
            "5 nights in a beach villa with breakfast, one couples spa ritual and a private beach dinner.",
          price: 4950,
          validFrom: new Date("2026-01-01"),
          validTo: new Date("2027-12-31"),
          included: ["Breakfast", "Couples spa ritual", "Private beach dinner"],
          active: true,
        },
        {
          propertyId: velaaId,
          name: "Dive Discovery",
          description: "7 nights half-board with 5 guided dives and equipment rental.",
          price: 6200,
          validFrom: new Date("2026-01-01"),
          validTo: new Date("2027-12-31"),
          included: ["Half board", "5 guided dives", "Equipment rental"],
          active: true,
        },
      ],
    });
    await db.promotion.createMany({
      data: [
        {
          propertyId: velaaId,
          roomId: velaaBeachVilla ?? null,
          name: "Stay 4 Pay 3",
          discountType: "PERCENTAGE",
          value: 25,
          validFrom: new Date("2026-05-01"),
          validTo: new Date("2026-09-30"),
          active: true,
        },
        {
          propertyId: velaaId,
          name: "Early Bird 15%",
          discountType: "PERCENTAGE",
          value: 15,
          validFrom: new Date("2026-01-01"),
          validTo: new Date("2026-04-30"),
          active: true,
        },
      ],
    });
  }

  const users = [
    { email: "admin@oceanatlas.mv", fullName: "TravelOS Admin", role: "SUPER_ADMIN" },
    { email: "ahmed@oceanatlas.mv", fullName: "Ahmed Hassan", role: "BOOKING_AGENT" },
    { email: "fatima@oceanatlas.mv", fullName: "Fatima Naseer", role: "BOOKING_AGENT" },
  ] as const;

  const agentIds = new Map<string, string>();
  for (const u of users) {
    const user = await db.user.create({
      data: {
        email: u.email,
        fullName: u.fullName,
        passwordHash: hashPassword("changeme123"),
        role: u.role,
        tenantId: tenant.id,
      },
    });
    agentIds.set(u.email, user.id);
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

    const assignedAgentId = b.assignedAgentEmail ? agentIds.get(b.assignedAgentEmail) : undefined;

    const booking = await db.booking.create({
      data: {
        reference: b.reference,
        status: b.status,
        propertyId,
        roomId: room.roomId,
        customerId: customer.id,
        ...(assignedAgentId ? { assignedAgentId } : {}),
        ...(b.supplierReference ? { supplierReference: b.supplierReference } : {}),
        ...(b.supplierStatus ? { supplierStatus: b.supplierStatus } : {}),
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
    bookingIds.set(b.reference, booking.id);

    await db.bookingEvent.create({
      data: { bookingId: booking.id, type: "BOOKING_CREATED", message: "Booking created" },
    });
    if (assignedAgentId) {
      const agentName = users.find((u) => u.email === b.assignedAgentEmail)?.fullName;
      await db.bookingEvent.create({
        data: {
          bookingId: booking.id,
          type: "ASSIGNED",
          message: `Assigned to ${agentName ?? "an agent"}`,
        },
      });
    }
    if (b.supplierReference) {
      await db.bookingEvent.create({
        data: {
          bookingId: booking.id,
          type: "SUPPLIER_UPDATED",
          message: `Supplier reference ${b.supplierReference} (${b.supplierStatus ?? "pending"})`,
        },
      });
    }
    for (const note of b.notes ?? []) {
      await db.bookingNote.create({
        data: { bookingId: booking.id, content: note },
      });
      await db.bookingEvent.create({
        data: { bookingId: booking.id, type: "NOTE_ADDED", message: "Note added" },
      });
    }
    if (b.conversation && b.conversation.length > 0) {
      const conversation = await db.bookingConversation.create({
        data: { bookingId: booking.id },
      });
      for (const m of b.conversation) {
        await db.bookingMessage.create({
          data: {
            conversationId: conversation.id,
            senderType: m.senderType,
            senderName: m.senderName,
            message: m.message,
            isInternal: m.isInternal ?? false,
          },
        });
      }
    }
  }

  // Supplier confirmations — one REQUESTED, one CONFIRMED, one DECLINED
  const confirmationSeed: Array<{
    bookingRef: string;
    supplier: string;
    status: $Enums.SupplierStatus;
    reference?: string;
    notes?: string;
  }> = [
    {
      bookingRef: "MV-24081",
      supplier: "velaa private island",
      status: "CONFIRMED",
      reference: "VEL-2026-8812",
      notes: "Confirmed by reservations team",
    },
    {
      bookingRef: "MV-24080",
      supplier: "blue horizon cruises",
      status: "REQUESTED",
      notes: "Sent to supplier, awaiting response",
    },
    {
      bookingRef: "MV-24070",
      supplier: "velaa private island",
      status: "DECLINED",
      notes: "No availability in peak season",
    },
  ];
  for (const c of confirmationSeed) {
    const bookingId = bookingIds.get(c.bookingRef);
    const supplierId = supplierIds.get(c.supplier);
    if (!bookingId || !supplierId) continue;
    await db.supplierConfirmation.create({
      data: {
        bookingId,
        supplierId,
        status: c.status,
        ...(c.reference ? { reference: c.reference } : {}),
        ...(c.notes ? { notes: c.notes } : {}),
        ...(c.status === "CONFIRMED" ? { confirmedAt: new Date() } : {}),
      },
    });
  }

  // Contract rates — net rate vs sell rate (margin)
  for (const p of properties) {
    const supplierName = supplierByProperty[p.slug];
    const supplierId = supplierName ? supplierIds.get(supplierName) : undefined;
    if (!supplierId) continue;
    for (const r of p.rooms) {
      const roomId = roomIds.get(`${p.slug}:${r.name}`)?.roomId;
      if (!roomId) continue;
      await db.contractRate.create({
        data: {
          supplierId,
          roomId,
          validFrom: new Date("2026-04-01"),
          validTo: new Date("2027-03-31"),
          netRate: Math.round(r.rate * 0.8), // 80% of sell rate -> ~20% margin
        },
      });
    }
  }

  // Leads & CRM
  for (const l of leads) {
    const lead = await db.lead.create({
      data: {
        source: l.source,
        status: l.status,
        fullName: l.fullName,
        ...(l.email ? { email: l.email } : {}),
        ...(l.phone ? { phone: l.phone } : {}),
        ...(l.destination ? { destination: l.destination } : {}),
        ...(l.checkIn ? { checkIn: new Date(l.checkIn) } : {}),
        ...(l.checkOut ? { checkOut: new Date(l.checkOut) } : {}),
        adults: l.adults,
        children: l.children,
        ...(l.notes ? { notes: l.notes } : {}),
        ...(l.bookingRef ? { bookingId: bookingIds.get(l.bookingRef) } : {}),
      },
    });
    if (l.quote) {
      await db.quote.create({
        data: {
          leadId: lead.id,
          totalPrice: l.quote.totalPrice,
          validUntil: new Date(l.quote.validUntil),
          ...(l.quote.notes ? { notes: l.quote.notes } : {}),
        },
      });
    }
    if (l.task) {
      await db.leadTask.create({
        data: {
          leadId: lead.id,
          dueAt: new Date(l.task.dueAt),
          note: l.task.note,
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log(`  properties: ${properties.length}`);
  console.log(`  rooms:      ${[...roomIds.keys()].length}`);
  console.log(`  bookings:   ${bookings.length}`);
  console.log(`  users:      ${users.length} (agents seeded)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

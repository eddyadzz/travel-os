import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { getDefaultTenantId } from "@/lib/tenant-context.server";

export type DemoLoadResult = {
  branded: boolean;
  content: "created" | "updated" | "kept";
  pagesCreated: number;
  addonsAdded: number;
  leadsAdded: number;
  quotesAdded: number;
};

const DEMO_BRAND = {
  name: "Paradise Holidays Maldives",
  primaryColor: "#0d9488",
  accentColor: "#f59e0b",
  emailFrom: "bookings@paradiseholidays.mv",
  customDomain: "demo.paradiseholidays.mv",
};

const DEMO_CONTENT = {
  heroEyebrow: "Maldives specialists",
  heroHeadline: "Build your Maldives escape, priced before you ask.",
  heroSubheadline:
    "Compare resorts, guesthouses and safari boats. Add spa, diving and transfers — see the estimate instantly and confirm with one request.",
  heroCtaLabel: "Search availability",
  heroCtaTarget: "/search",
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
    {
      name: "Hana S.",
      quote:
        "Everything in one portal — payments, vouchers, transfer details. Best trip we've booked.",
      role: "Guesthouse · Aug 2026",
    },
  ],
  aboutSummary:
    "Paradise Holidays Maldives is a full-service travel agency — resorts, guesthouses and liveaboards with transparent pricing, instant quotes and a fully digital booking experience.",
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

async function defaultTenant() {
  const id = await getDefaultTenantId();
  const tenant = await db.tenant.findUnique({ where: { id } });
  if (!tenant) throw new Error("Default tenant not found.");
  return tenant;
}

/**
 * Populates a fresh deployment with a complete demo dataset + brand so it can be
 * shown to prospects in ~15 minutes. Intended for demo deployments only — it
 * applies the demo brand when the tenant is still in its default state, then tops
 * up content, excursions, leads and quotes without touching real records.
 */
export async function loadDemoData(): Promise<DemoLoadResult> {
  const tenant = await defaultTenant();
  const result: DemoLoadResult = {
    branded: false,
    content: "kept",
    pagesCreated: 0,
    addonsAdded: 0,
    leadsAdded: 0,
    quotesAdded: 0,
  };

  // 1. Brand the deployment (only when still default/unbranded).
  const isDefault = !tenant.primaryColor || tenant.primaryColor === "#0f766e";
  if (isDefault) {
    await db.tenant.update({
      where: { id: tenant.id },
      data: {
        name: DEMO_BRAND.name,
        primaryColor: DEMO_BRAND.primaryColor,
        accentColor: DEMO_BRAND.accentColor,
        emailFrom: DEMO_BRAND.emailFrom,
        customDomain: DEMO_BRAND.customDomain,
      },
    });
    result.branded = true;
  }

  // 2. Demo homepage content.
  const existingContent = await db.siteContent.findUnique({ where: { tenantId: tenant.id } });
  if (existingContent) {
    await db.siteContent.update({
      where: { id: existingContent.id },
      data: { data: DEMO_CONTENT as object },
    });
    result.content = "updated";
  } else {
    await db.siteContent.create({ data: { tenantId: tenant.id, data: DEMO_CONTENT as object } });
    result.content = "created";
  }

  // 3. Starter pages if none exist.
  const pageCount = await db.cmsPage.count({ where: { tenantId: tenant.id } });
  if (pageCount === 0) {
    await db.cmsPage.create({
      data: {
        tenantId: tenant.id,
        slug: "about",
        title: "About us",
        body: "Paradise Holidays Maldives is a full-service travel agency.\n\nFrom overwater resorts to guesthouses and liveaboard safari boats, we build your trip with transparent pricing and handle every detail — availability, transfers, vouchers and 24/7 support — in one place.",
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
    result.pagesCreated = 2;
  }

  // 4. Excursion add-ons on every property that lacks one.
  const properties = await db.property.findMany({ select: { id: true, name: true } });
  for (const property of properties) {
    const hasExcursion = await db.addon.findFirst({
      where: { propertyId: property.id, category: "EXCURSION" },
    });
    if (hasExcursion) continue;
    await db.addon.create({
      data: {
        propertyId: property.id,
        name: "Dolphin Cruise Excursion",
        description: "Two-hour sunset dolphin safari with refreshments.",
        pricingType: "PER_PERSON",
        amount: 75,
        category: "EXCURSION",
        active: true,
        sortOrder: 10,
      },
    });
    result.addonsAdded += 1;
  }

  // 5. Top-up leads so the pipeline looks alive.
  const leadCount = await db.lead.count();
  if (leadCount < 5) {
    const demoLeads: Array<{
      fullName: string;
      email: string;
      phone: string;
      source: "WEBSITE" | "WHATSAPP" | "REFERRAL";
      destination?: string;
      adults: number;
      children?: number;
      notes?: string;
    }> = [
      {
        fullName: "Liam Carter",
        email: "liam@mail.com",
        phone: "+44 20 7946 0958",
        source: "WEBSITE",
        destination: "Baa Atoll",
        adults: 2,
        notes: "Honeymoon",
      },
      {
        fullName: "Sofia Bianchi",
        email: "sofia@mail.com",
        phone: "+39 02 1234 5678",
        source: "WHATSAPP",
        destination: "South Ari Atoll",
        adults: 4,
        children: 2,
        notes: "Family villa",
      },
      {
        fullName: "Noah Fischer",
        email: "noah@mail.com",
        phone: "+49 30 1234 567",
        source: "REFERRAL",
        destination: "Noonu Atoll",
        adults: 2,
        notes: "Diving trip",
      },
    ];
    for (const l of demoLeads) {
      await db.lead.create({
        data: {
          fullName: l.fullName,
          email: l.email,
          phone: l.phone,
          source: l.source,
          status: "NEW",
          ...(l.destination ? { destination: l.destination } : {}),
          adults: l.adults,
          ...(l.children !== undefined ? { children: l.children } : {}),
          ...(l.notes ? { notes: l.notes } : {}),
        },
      });
      result.leadsAdded += 1;
    }
  }

  // 6. Top-up open quotes so the quote pipeline looks alive.
  const quoteCount = await db.quote.count({ where: { status: "PENDING" } });
  const firstProperty = properties[0];
  const firstRoom = firstProperty
    ? await db.room.findFirst({ where: { propertyId: firstProperty.id } })
    : null;
  if (quoteCount < 2 && firstRoom && firstProperty) {
    const rate = await db.rate.findFirst({ where: { roomId: firstRoom.id } });
    if (rate) {
      const nights = 5;
      await db.quote.create({
        data: {
          propertyId: firstProperty.id,
          roomId: firstRoom.id,
          checkIn: new Date(Date.now() + 30 * 86_400_000),
          checkOut: new Date(Date.now() + (30 + nights) * 86_400_000),
          adults: 2,
          children: 0,
          addonIds: [],
          customerName: "Liam Carter",
          customerEmail: "liam@mail.com",
          totalPrice: Number(rate.amount) * nights * 1.22,
          validUntil: new Date(Date.now() + 30 * 86_400_000),
          status: "PENDING",
        },
      });
      result.quotesAdded += 1;
    }
  }

  return result;
}

export const loadDemoDataFn = createServerFn({ method: "POST" }).handler(async () =>
  loadDemoData(),
);

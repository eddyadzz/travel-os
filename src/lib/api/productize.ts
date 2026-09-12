import { createServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { db } from "@/lib/db.server";
import { DEFAULT_TENANT_SLUG } from "@/lib/tenant-context.server";
import { listBackups, verifyBackup } from "@/lib/backup.server";
import { runReadinessCheck } from "@/lib/api/readiness";

export type SetupStatus = {
  company: { name: string; emailFrom?: string; customDomain?: string };
  branding: { applied: boolean };
  email: { configured: boolean; sender?: string };
  counts: {
    properties: number;
    rooms: number;
    suppliers: number;
    users: number;
    leads: number;
    bookings: number;
  };
  lastBackup?: string;
  lastJob?: { key: string; status: string; at: string };
};

export type SystemInfo = {
  nodeEnv: string;
  port: string;
  database: { connected: boolean; urlHost: string };
  email: { sender?: string; providerConfigured: boolean };
  baseDomain: string;
  counts: {
    properties: number;
    rooms: number;
    suppliers: number;
    users: number;
    leads: number;
    bookings: number;
    pages: number;
  };
  lastBackup?: { filename: string; valid: boolean };
  lastJob?: { key: string; status: string; startedAt: string };
  readiness: { readyPercent: number; blockers: string[] };
};

async function baseCounts() {
  const [properties, rooms, suppliers, users, leads, bookings, pages] = await Promise.all([
    db.property.count().catch(() => 0),
    db.room.count().catch(() => 0),
    db.supplier.count().catch(() => 0),
    db.user.count().catch(() => 0),
    db.lead.count().catch(() => 0),
    db.booking.count().catch(() => 0),
    db.cmsPage.count().catch(() => 0),
  ]);
  return { properties, rooms, suppliers, users, leads, bookings, pages };
}

async function latestBackup() {
  const backups = await listBackups().catch(() => []);
  const first = backups[0];
  if (!first) return undefined;
  return { filename: first.filename, valid: verifyBackup(first.filename).valid };
}

async function latestJob() {
  const job = await db.jobRun.findFirst({ orderBy: { startedAt: "desc" } }).catch(() => null);
  return job
    ? { key: job.jobKey, status: job.status, startedAt: job.startedAt.toISOString() }
    : undefined;
}

export const getSetupStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<SetupStatus> => {
    const tenant = await db.tenant.findUnique({ where: { slug: DEFAULT_TENANT_SLUG } });
    const counts = await baseCounts();
    const isDefaultColor = !tenant?.primaryColor || tenant.primaryColor === "#0f766e";
    const backup = await latestBackup();
    const job = await latestJob();
    return {
      company: {
        name: tenant?.name ?? "—",
        ...(tenant?.emailFrom ? { emailFrom: tenant.emailFrom } : {}),
        ...(tenant?.customDomain ? { customDomain: tenant.customDomain } : {}),
      },
      branding: { applied: !isDefaultColor || Boolean(tenant?.customDomain) },
      email: {
        configured: Boolean(process.env["RESEND_API_KEY"]),
        ...(process.env["EMAIL_FROM"]
          ? { sender: process.env["EMAIL_FROM"] }
          : tenant?.emailFrom
            ? { sender: tenant.emailFrom }
            : {}),
      },
      counts,
      ...(backup ? { lastBackup: backup.filename } : {}),
      ...(job ? { lastJob: { key: job.key, status: job.status, at: job.startedAt } } : {}),
    };
  },
);

export const getSystemInfo = createServerFn({ method: "GET" }).handler(
  async (): Promise<SystemInfo> => {
    const url = process.env["DATABASE_URL"] ?? "";
    const [counts, backup, job, readiness] = await Promise.all([
      baseCounts(),
      latestBackup(),
      latestJob(),
      runReadinessCheck().catch(
        () =>
          ({ readyPercent: 0, blockers: ["readiness failed"] }) as {
            readyPercent: number;
            blockers: string[];
          },
      ),
    ]);
    return {
      nodeEnv: process.env["NODE_ENV"] ?? "development",
      port: process.env["PORT"] ?? "8081",
      database: {
        connected: true,
        urlHost: url.includes("@") ? (url.split("@")[1]!.split("/")[0] ?? "") : url,
      },
      email: {
        ...(process.env["EMAIL_FROM"] ? { sender: process.env["EMAIL_FROM"] } : {}),
        providerConfigured: Boolean(process.env["RESEND_API_KEY"]),
      },
      baseDomain: process.env["TENANT_BASE_DOMAIN"] ?? "oceanatlas.mv",
      counts,
      ...(backup ? { lastBackup: backup } : {}),
      ...(job ? { lastJob: job } : {}),
      readiness,
    };
  },
);

export const getSupportBundle = createServerFn({ method: "GET" }).handler(async () => {
  const [info, jobs] = await Promise.all([
    getSystemInfo(),
    db.jobRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 }).catch(() => []),
  ]);
  const lines = [
    "BoliFlow support bundle",
    "========================",
    `Generated: ${new Date().toISOString()}`,
    "",
    "SYSTEM",
    JSON.stringify(info, null, 2),
    "",
    "RECENT JOBS",
    jobs
      .map(
        (j) =>
          `${j.startedAt.toISOString()} ${j.jobKey} ${j.status}${j.error ? ` — ${j.error}` : ""}`,
      )
      .join("\n") || "(none)",
    "",
    "READINESS",
    `Ready ${info.readiness.readyPercent}%`,
    info.readiness.blockers.length
      ? `Blockers: ${info.readiness.blockers.join(", ")}`
      : "No blockers",
  ];
  return {
    filename: `boliflow-support-${new Date().toISOString().slice(0, 10)}.txt`,
    content: lines.join("\n"),
  };
});

// ---------------------------------------------------------------------------
// Import templates (Excel) — headers + example rows with validation hints
// ---------------------------------------------------------------------------

type TemplateSpec = { format: string; filename: string; aoa: (string | number)[][] };

const TEMPLATES: TemplateSpec[] = [
  {
    format: "Properties",
    filename: "properties-template.xlsx",
    aoa: [
      [
        "name",
        "slug",
        "type",
        "atoll",
        "island",
        "description",
        "transferMethod",
        "transferDuration",
        "transferPricePerPerson",
        "featured",
        "highlights",
        "amenities",
      ],
      [
        "Velaa Private Island",
        "velaa",
        "RESORT",
        "Baa Atoll",
        "Velaa",
        "Overwater luxury resort.",
        "Seaplane",
        "45 min",
        950,
        "yes",
        "Overwater pool villa|Spa",
        "Restaurant|Pool|Spa",
      ],
      [
        "Note",
        "type: RESORT | HOTEL | GUESTHOUSE | SAFARI_BOAT",
        "highlights/amenities: separate with |",
      ],
    ],
  },
  {
    format: "Rooms",
    filename: "rooms-template.xlsx",
    aoa: [
      [
        "propertyName",
        "name",
        "description",
        "size",
        "boardBasis",
        "pricingMethod",
        "maxAdults",
        "maxChildren",
        "extraGuestRate",
      ],
      [
        "Velaa Private Island",
        "Beach Villa with Pool",
        "Private pool villa",
        "95 m2",
        "BB",
        "PER_ROOM",
        2,
        0,
        120,
      ],
      ["Note", "pricingMethod: PER_ROOM | PER_PERSON"],
    ],
  },
  {
    format: "Rates",
    filename: "rates-template.xlsx",
    aoa: [
      ["propertyName", "roomName", "validFrom", "validTo", "amount", "currency", "season"],
      [
        "Velaa Private Island",
        "Beach Villa with Pool",
        "2026-11-01",
        "2026-12-20",
        650,
        "USD",
        "High",
      ],
      ["Note", "dates: YYYY-MM-DD. Rate must cover the full stay to be used."],
    ],
  },
  {
    format: "Suppliers",
    filename: "suppliers-template.xlsx",
    aoa: [
      ["name", "type", "email", "phone", "contactPerson"],
      ["Velaa Private Island", "RESORT", "res@velaa.com", "+960 660 8800", "Reservations Team"],
      ["Note", "type: RESORT | HOTEL | GUESTHOUSE | SAFARI | TRANSFER | DIVE_CENTER"],
    ],
  },
  {
    format: "Customers",
    filename: "customers-template.xlsx",
    aoa: [
      ["fullName", "email", "phone", "country", "emailNotifications"],
      ["Jane Doe", "jane@mail.com", "+1 555 010 2030", "United States", "yes"],
    ],
  },
  {
    format: "Leads",
    filename: "leads-template.xlsx",
    aoa: [
      [
        "fullName",
        "email",
        "phone",
        "source",
        "destination",
        "checkIn",
        "checkOut",
        "adults",
        "children",
        "notes",
      ],
      [
        "Jane Doe",
        "jane@mail.com",
        "+1 555 010 2030",
        "WEBSITE",
        "Baa Atoll",
        "2026-12-01",
        "2026-12-08",
        2,
        0,
        "Honeymoon",
      ],
      [
        "Note",
        "source: WEBSITE | WHATSAPP | EMAIL | PHONE | WALK_IN | REFERRAL | FACEBOOK | INSTAGRAM",
      ],
    ],
  },
];

export const getImportTemplates = createServerFn({ method: "GET" }).handler(async () => {
  return TEMPLATES.map((t) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t.aoa), "Template");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return { format: t.format, filename: t.filename, base64: buf.toString("base64") };
  });
});

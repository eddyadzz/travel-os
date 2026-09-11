import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getCmsAdmin,
  getPublicSite,
  getPublishedPage,
  saveCmsPage,
  saveSiteContent,
} from "@/lib/api/cms";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    tenant: { findUnique: vi.fn(), update: vi.fn() },
    siteContent: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    cmsPage: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db.server", () => ({ db: mockDb }));
vi.mock("@tanstack/react-start", () => {
  const handler = (h: (ctx: { data: unknown }) => unknown) => async (opts?: { data: unknown }) =>
    h({ data: opts?.data });
  return {
    createServerFn: () => ({
      validator: () => ({ handler }),
      handler,
    }),
  };
});

const tenant = {
  id: "t1",
  name: "Ocean Atlas",
  slug: "ocean-atlas",
  logoUrl: null,
  primaryColor: "#0f766e",
  accentColor: null,
  fontFamily: null,
  emailFrom: null,
  customDomain: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.tenant.findUnique.mockResolvedValue(tenant);
  mockDb.siteContent.findUnique.mockResolvedValue({
    id: "sc1",
    tenantId: "t1",
    data: { heroHeadline: "Custom headline", featuredPropertySlugs: ["velaa"] },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  mockDb.cmsPage.findMany.mockResolvedValue([
    {
      id: "p1",
      tenantId: "t1",
      slug: "about",
      title: "About us",
      body: "Paragraph one.\n\nParagraph two.",
      published: true,
      seoTitle: null,
      seoDescription: null,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  mockDb.cmsPage.findUnique.mockResolvedValue({
    id: "p1",
    tenantId: "t1",
    slug: "about",
    title: "About us",
    body: "Body",
    published: true,
    seoTitle: null,
    seoDescription: null,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  mockDb.siteContent.create.mockResolvedValue({
    id: "sc2",
    tenantId: "t1",
    data: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  mockDb.siteContent.update.mockResolvedValue({
    id: "sc1",
    tenantId: "t1",
    data: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  mockDb.cmsPage.create.mockResolvedValue({
    id: "p2",
    tenantId: "t1",
    slug: "faq",
    title: "FAQ",
    body: "Body",
    published: true,
    seoTitle: null,
    seoDescription: null,
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  mockDb.cmsPage.update.mockResolvedValue({
    id: "p1",
    tenantId: "t1",
    slug: "about",
    title: "About us",
    body: "Body",
    published: true,
    seoTitle: null,
    seoDescription: null,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
});

describe("getPublicSite", () => {
  it("merges content over defaults and includes branding", async () => {
    const site = await getPublicSite();
    expect(site.content.heroHeadline).toBe("Custom headline");
    expect(site.content.heroEyebrow).toBe("Maldives specialists"); // default retained
    expect(site.branding).toMatchObject({ name: "Ocean Atlas", primaryColor: "#0f766e" });
  });
});

describe("getPublishedPage", () => {
  it("returns a published page", async () => {
    const page = await getPublishedPage({ data: "about" });
    expect(page).not.toBeNull();
    expect(page?.slug).toBe("about");
  });

  it("returns null for an unpublished page", async () => {
    mockDb.cmsPage.findUnique.mockResolvedValue({
      id: "p2",
      tenantId: "t1",
      slug: "draft",
      title: "Draft",
      body: "",
      published: false,
      seoTitle: null,
      seoDescription: null,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(await getPublishedPage({ data: "draft" })).toBeNull();
  });
});

describe("getCmsAdmin", () => {
  it("returns content, branding and pages", async () => {
    const admin = await getCmsAdmin();
    expect(admin.content.heroHeadline).toBe("Custom headline");
    expect(admin.branding.name).toBe("Ocean Atlas");
    expect(admin.pages).toHaveLength(1);
    expect(admin.pages[0].published).toBe(true);
  });
});

describe("saveSiteContent / saveCmsPage", () => {
  it("updates the existing content row", async () => {
    await saveSiteContent({ data: { heroHeadline: "New" } });
    expect(mockDb.siteContent.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sc1" } }),
    );
  });

  it("creates a page", async () => {
    mockDb.cmsPage.findUnique.mockResolvedValue(null);
    await saveCmsPage({ data: { slug: "FAQ", title: "FAQ", body: "Body", published: true } });
    expect(mockDb.cmsPage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: "faq" }) }),
    );
  });
});

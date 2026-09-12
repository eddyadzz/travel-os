import { createServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db.server";
import { getDefaultTenantId } from "@/lib/tenant-context.server";
import type { CmsPageDTO, PublicSiteDTO, SiteContentData } from "@/lib/types";

const DEFAULT_CONTENT: SiteContentData = {
  heroEyebrow: "Maldives specialists",
  heroHeadline: "Build your Maldives escape, priced before you ask.",
  heroSubheadline:
    "Pick an island, choose your villa, add spa, diving and transfers — see the estimate instantly and send one complete request to our agents.",
  heroCtaLabel: "Search availability",
  heroCtaTarget: "/search",
  featuredPropertySlugs: [],
  testimonials: [],
  aboutSummary: "",
};

async function defaultTenant() {
  const id = await getDefaultTenantId();
  const tenant = await db.tenant.findUnique({ where: { id } });
  if (!tenant) throw new Error("Default tenant not found.");
  return tenant;
}

function toPageDTO(p: {
  id: string;
  slug: string;
  title: string;
  body: string;
  published: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  sortOrder: number;
  updatedAt: Date;
}): CmsPageDTO {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    body: p.body,
    published: p.published,
    ...(p.seoTitle ? { seoTitle: p.seoTitle } : {}),
    ...(p.seoDescription ? { seoDescription: p.seoDescription } : {}),
    sortOrder: p.sortOrder,
    updatedAt: p.updatedAt.toISOString(),
  };
}

// Public -----------------------------------------------------------------------------------------

export const getPublicSite = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicSiteDTO> => {
    const tenant = await defaultTenant();
    const row = await db.siteContent.findUnique({ where: { tenantId: tenant.id } });
    const content: SiteContentData = {
      ...DEFAULT_CONTENT,
      ...((row?.data ?? {}) as SiteContentData),
    };
    return {
      content,
      branding: {
        name: tenant.name,
        ...(tenant.logoUrl ? { logoUrl: tenant.logoUrl } : {}),
        ...(tenant.primaryColor ? { primaryColor: tenant.primaryColor } : {}),
        ...(tenant.accentColor ? { accentColor: tenant.accentColor } : {}),
        ...(tenant.fontFamily ? { fontFamily: tenant.fontFamily } : {}),
        ...(tenant.emailFrom ? { emailFrom: tenant.emailFrom } : {}),
      },
    };
  },
);

export const getPublishedPage = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<CmsPageDTO | null> => {
    const tenant = await defaultTenant();
    const page = await db.cmsPage.findUnique({
      where: { tenantId_slug: { tenantId: tenant.id, slug } },
    });
    if (!page || !page.published) return null;
    return toPageDTO(page);
  });

// Admin ------------------------------------------------------------------------------------------

export const getCmsAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const tenant = await defaultTenant();
  const [content, pages] = await Promise.all([
    db.siteContent.findUnique({ where: { tenantId: tenant.id } }),
    db.cmsPage.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    }),
  ]);
  return {
    content: { ...DEFAULT_CONTENT, ...((content?.data ?? {}) as SiteContentData) },
    branding: {
      name: tenant.name,
      logoUrl: tenant.logoUrl ?? "",
      primaryColor: tenant.primaryColor ?? "#0f766e",
      accentColor: tenant.accentColor ?? "",
      fontFamily: tenant.fontFamily ?? "",
      emailFrom: tenant.emailFrom ?? "",
      customDomain: tenant.customDomain ?? "",
    },
    pages: pages.map(toPageDTO),
  };
});

export const saveSiteContent = createServerFn({ method: "POST" })
  .validator((input: SiteContentData) => input)
  .handler(async ({ data }) => {
    const tenant = await defaultTenant();
    const existing = await db.siteContent.findUnique({ where: { tenantId: tenant.id } });
    if (existing) {
      await db.siteContent.update({ where: { id: existing.id }, data: { data: data as object } });
    } else {
      await db.siteContent.create({ data: { tenantId: tenant.id, data: data as object } });
    }
    return { ok: true };
  });

export const saveBranding = createServerFn({ method: "POST" })
  .validator(
    (input: {
      name?: string;
      logoUrl?: string;
      primaryColor?: string;
      accentColor?: string;
      fontFamily?: string;
      emailFrom?: string;
      customDomain?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const id = await getDefaultTenantId();
    await db.tenant.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
        ...(data.primaryColor !== undefined ? { primaryColor: data.primaryColor } : {}),
        ...(data.accentColor !== undefined ? { accentColor: data.accentColor || null } : {}),
        ...(data.fontFamily !== undefined ? { fontFamily: data.fontFamily || null } : {}),
        ...(data.emailFrom !== undefined ? { emailFrom: data.emailFrom } : {}),
        ...(data.customDomain !== undefined ? { customDomain: data.customDomain || null } : {}),
      },
    });
    return { ok: true };
  });

export const listCmsPages = createServerFn({ method: "GET" }).handler(
  async (): Promise<CmsPageDTO[]> => {
    const tenant = await defaultTenant();
    const pages = await db.cmsPage.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    });
    return pages.map(toPageDTO);
  },
);

export const saveCmsPage = createServerFn({ method: "POST" })
  .validator(
    (input: {
      id?: string;
      slug: string;
      title: string;
      body: string;
      published?: boolean;
      seoTitle?: string;
      seoDescription?: string;
      sortOrder?: number;
    }) => input,
  )
  .handler(async ({ data }) => {
    const tenant = await defaultTenant();
    const slug = data.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/(^-|-$)/g, "");
    if (!slug) throw new Error("A page slug is required.");
    const payload = {
      tenantId: tenant.id,
      slug,
      title: data.title.trim(),
      body: data.body,
      ...(data.published !== undefined ? { published: data.published } : {}),
      ...(data.seoTitle ? { seoTitle: data.seoTitle } : {}),
      ...(data.seoDescription ? { seoDescription: data.seoDescription } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
    };
    if (data.id) {
      const page = await db.cmsPage.update({ where: { id: data.id }, data: payload });
      return toPageDTO(page);
    }
    const page = await db.cmsPage.create({ data: payload });
    return toPageDTO(page);
  });

export const deleteCmsPage = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    await db.cmsPage.delete({ where: { id } });
    return { ok: true };
  });

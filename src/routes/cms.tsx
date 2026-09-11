import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  LayoutTemplate,
  FileText,
  Palette,
  Plus,
  Trash2,
  RefreshCw,
  Save,
  Eye,
  Pencil,
  Images,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getCmsAdmin,
  saveBranding,
  saveCmsPage,
  saveSiteContent,
  deleteCmsPage,
} from "@/lib/api/cms";
import { listProperties, updateProperty } from "@/lib/api/properties";
import { ImageDropzone } from "@/components/image-dropzone";
import type { CmsPageDTO, PropertyDTO, SiteContentData } from "@/lib/types";

export const Route = createFileRoute("/cms")({
  loader: async () => getCmsAdmin(),
  head: () => ({
    meta: [{ title: "Website CMS | TravelOS by Boliflow" }, { name: "robots", content: "noindex" }],
  }),
  component: CmsPage,
});

function CmsPage() {
  const initial = Route.useLoaderData();
  const [tab, setTab] = useState<"home" | "pages" | "brand" | "gallery">("home");
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [properties, setProperties] = useState<PropertyDTO[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("");

  const refresh = async () => setData(await getCmsAdmin());

  const loadGallery = async () => {
    const props = await listProperties();
    setProperties(props);
    if (!selectedProperty && props.length > 0) setSelectedProperty(props[0]!.id);
  };

  const addGalleryImage = async (url: string) => {
    const property = properties.find((p) => p.id === selectedProperty);
    if (!property) return;
    await updateProperty({
      data: { id: property.id, data: { gallery: [...property.gallery, url] } },
    });
    await loadGallery();
    toast.success("Image added to gallery");
  };

  const removeGalleryImage = async (url: string) => {
    const property = properties.find((p) => p.id === selectedProperty);
    if (!property) return;
    await updateProperty({
      data: { id: property.id, data: { gallery: property.gallery.filter((g) => g !== url) } },
    });
    await loadGallery();
    toast.success("Image removed");
  };

  // Homepage form
  const c = data.content;
  const [hero, setHero] = useState({
    heroEyebrow: c.heroEyebrow ?? "",
    heroHeadline: c.heroHeadline ?? "",
    heroSubheadline: c.heroSubheadline ?? "",
    heroCtaLabel: c.heroCtaLabel ?? "",
    heroCtaTarget: c.heroCtaTarget ?? "",
    featuredPropertySlugs: (c.featuredPropertySlugs ?? []).join(", "),
    testimonials: JSON.stringify(c.testimonials ?? [], null, 2),
    aboutSummary: c.aboutSummary ?? "",
  });

  // Branding form
  const b = data.branding;
  const [brand, setBrand] = useState({
    name: b.name,
    logoUrl: b.logoUrl,
    primaryColor: b.primaryColor,
    accentColor: b.accentColor,
    fontFamily: b.fontFamily,
    emailFrom: b.emailFrom,
    customDomain: b.customDomain,
  });

  // Page editor
  const [editing, setEditing] = useState<CmsPageDTO | null>(null);
  const [pageForm, setPageForm] = useState({
    slug: "",
    title: "",
    body: "",
    published: true,
    seoTitle: "",
    seoDescription: "",
  });

  const saveHome = async () => {
    setBusy(true);
    try {
      let testimonials: SiteContentData["testimonials"] = [];
      if (hero.testimonials.trim()) {
        testimonials = JSON.parse(hero.testimonials);
      }
      await saveSiteContent({
        data: {
          heroEyebrow: hero.heroEyebrow,
          heroHeadline: hero.heroHeadline,
          heroSubheadline: hero.heroSubheadline,
          heroCtaLabel: hero.heroCtaLabel,
          heroCtaTarget: hero.heroCtaTarget,
          featuredPropertySlugs: hero.featuredPropertySlugs
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          testimonials: testimonials ?? [],
          aboutSummary: hero.aboutSummary,
        },
      });
      toast.success("Homepage saved");
      await refresh();
    } catch {
      toast.error('Testimonials must be valid JSON: [{"name":"...","quote":"..."}]');
    } finally {
      setBusy(false);
    }
  };

  const saveBrand = async () => {
    setBusy(true);
    try {
      await saveBranding({
        data: {
          name: brand.name,
          logoUrl: brand.logoUrl,
          primaryColor: brand.primaryColor,
          ...(brand.accentColor ? { accentColor: brand.accentColor } : {}),
          ...(brand.fontFamily ? { fontFamily: brand.fontFamily } : {}),
          emailFrom: brand.emailFrom,
          ...(brand.customDomain ? { customDomain: brand.customDomain } : {}),
        },
      });
      toast.success("Branding saved — refresh the public site to see it");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const openNewPage = () => {
    setEditing(null);
    setPageForm({
      slug: "",
      title: "",
      body: "",
      published: true,
      seoTitle: "",
      seoDescription: "",
    });
  };

  const openEditPage = (p: CmsPageDTO) => {
    setEditing(p);
    setPageForm({
      slug: p.slug,
      title: p.title,
      body: p.body,
      published: p.published,
      seoTitle: p.seoTitle ?? "",
      seoDescription: p.seoDescription ?? "",
    });
  };

  const savePage = async () => {
    setBusy(true);
    try {
      await saveCmsPage({
        data: {
          ...(editing ? { id: editing.id } : {}),
          slug: pageForm.slug,
          title: pageForm.title,
          body: pageForm.body,
          published: pageForm.published,
          ...(pageForm.seoTitle ? { seoTitle: pageForm.seoTitle } : {}),
          ...(pageForm.seoDescription ? { seoDescription: pageForm.seoDescription } : {}),
        },
      });
      toast.success(editing ? "Page updated" : "Page created");
      setEditing(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const removePage = async (id: string) => {
    await deleteCmsPage({ data: id });
    await refresh();
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="surface-glass sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-display text-lg font-semibold">TravelOS by Boliflow</span>
          </Link>
          <Link to="/agent" className="text-sm text-muted-foreground hover:text-foreground">
            Back to dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="flex items-center gap-2 text-4xl">
          <LayoutTemplate className="size-8 text-primary" /> Website & branding
        </h1>
        <p className="mt-2 text-muted-foreground">
          Edit the public website, content pages and the deployment's brand identity
        </p>

        <div className="mt-6 flex gap-2">
          <Button
            variant={tab === "home" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("home")}
          >
            <LayoutTemplate className="size-4" /> Homepage
          </Button>
          <Button
            variant={tab === "pages" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("pages")}
          >
            <FileText className="size-4" /> Pages
          </Button>
          <Button
            variant={tab === "brand" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("brand")}
          >
            <Palette className="size-4" /> Branding
          </Button>
          <Button
            variant={tab === "gallery" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setTab("gallery");
              void loadGallery();
            }}
          >
            <Images className="size-4" /> Gallery
          </Button>
        </div>

        {tab === "home" && (
          <div className="mt-6 rounded-2xl border bg-card p-6">
            <h2 className="font-semibold">Homepage hero</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Eyebrow</Label>
                <Input
                  value={hero.heroEyebrow}
                  onChange={(e) => setHero({ ...hero, heroEyebrow: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Headline</Label>
                <Input
                  value={hero.heroHeadline}
                  onChange={(e) => setHero({ ...hero, heroHeadline: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 grid gap-1.5">
                <Label>Subheadline</Label>
                <Textarea
                  rows={3}
                  value={hero.heroSubheadline}
                  onChange={(e) => setHero({ ...hero, heroSubheadline: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>CTA label</Label>
                <Input
                  value={hero.heroCtaLabel}
                  onChange={(e) => setHero({ ...hero, heroCtaLabel: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>CTA target (route)</Label>
                <Input
                  value={hero.heroCtaTarget}
                  onChange={(e) => setHero({ ...hero, heroCtaTarget: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 grid gap-1.5">
                <Label>Featured property slugs (comma separated)</Label>
                <Input
                  value={hero.featuredPropertySlugs}
                  onChange={(e) => setHero({ ...hero, featuredPropertySlugs: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 grid gap-1.5">
                <Label>Testimonials (JSON)</Label>
                <Textarea
                  rows={5}
                  className="font-mono text-xs"
                  value={hero.testimonials}
                  onChange={(e) => setHero({ ...hero, testimonials: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 grid gap-1.5">
                <Label>About summary</Label>
                <Textarea
                  rows={3}
                  value={hero.aboutSummary}
                  onChange={(e) => setHero({ ...hero, aboutSummary: e.target.value })}
                />
              </div>
            </div>
            <Button className="mt-4" onClick={saveHome} disabled={busy}>
              <Save className="size-4" /> Save homepage
            </Button>
          </div>
        )}

        {tab === "pages" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border bg-card p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{editing ? "Edit page" : "New page"}</h2>
                <Button size="sm" variant="outline" onClick={openNewPage}>
                  <Plus className="size-4" /> New
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5">
                    <Label>Slug</Label>
                    <Input
                      value={pageForm.slug}
                      placeholder="about"
                      onChange={(e) => setPageForm({ ...pageForm, slug: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Title</Label>
                    <Input
                      value={pageForm.title}
                      onChange={(e) => setPageForm({ ...pageForm, title: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Body (blank line = new paragraph)</Label>
                  <Textarea
                    rows={10}
                    value={pageForm.body}
                    onChange={(e) => setPageForm({ ...pageForm, body: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5">
                    <Label>SEO title</Label>
                    <Input
                      value={pageForm.seoTitle}
                      onChange={(e) => setPageForm({ ...pageForm, seoTitle: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>SEO description</Label>
                    <Input
                      value={pageForm.seoDescription}
                      onChange={(e) => setPageForm({ ...pageForm, seoDescription: e.target.value })}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={pageForm.published}
                    onChange={(e) => setPageForm({ ...pageForm, published: e.target.checked })}
                  />
                  Published
                </label>
                <Button className="w-full" onClick={savePage} disabled={busy}>
                  <Save className="size-4" /> {editing ? "Save changes" : "Create page"}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-6">
              <h2 className="font-semibold">Pages</h2>
              <div className="mt-4 space-y-2">
                {data.pages.length === 0 && <p className="text-muted-foreground">No pages yet.</p>}
                {data.pages.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border px-4 py-3"
                  >
                    <div>
                      <p className="font-medium">
                        {p.title}
                        <Badge variant={p.published ? "default" : "outline"} className="ml-2">
                          {p.published ? "live" : "draft"}
                        </Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">/{p.slug}</p>
                    </div>
                    <div className="flex gap-1">
                      {p.published && (
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/pages/$slug" params={{ slug: p.slug }}>
                            <Eye className="size-4" />
                          </Link>
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => openEditPage(p)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removePage(p.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "brand" && (
          <div className="mt-6 rounded-2xl border bg-card p-6">
            <h2 className="font-semibold">Deployment branding</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Company name</Label>
                <Input
                  value={brand.name}
                  onChange={(e) => setBrand({ ...brand, name: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Logo</Label>
                <ImageDropzone
                  folder="branding"
                  value={brand.logoUrl}
                  onUploaded={(url) => setBrand({ ...brand, logoUrl: url })}
                  onClear={() => setBrand({ ...brand, logoUrl: "" })}
                />
                <Input
                  value={brand.logoUrl}
                  placeholder="…or paste a logo URL"
                  onChange={(e) => setBrand({ ...brand, logoUrl: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Primary color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brand.primaryColor}
                    onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })}
                    className="h-9 w-12 rounded border"
                  />
                  <Input
                    value={brand.primaryColor}
                    onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Accent color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brand.accentColor || "#0ea5e9"}
                    onChange={(e) => setBrand({ ...brand, accentColor: e.target.value })}
                    className="h-9 w-12 rounded border"
                  />
                  <Input
                    value={brand.accentColor}
                    onChange={(e) => setBrand({ ...brand, accentColor: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Font family (typography)</Label>
                <Input
                  value={brand.fontFamily}
                  placeholder="e.g. Inter, ui-sans-serif"
                  onChange={(e) => setBrand({ ...brand, fontFamily: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Email sender</Label>
                <Input
                  value={brand.emailFrom}
                  placeholder="bookings@client.mv"
                  onChange={(e) => setBrand({ ...brand, emailFrom: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 grid gap-1.5">
                <Label>Custom domain</Label>
                <Input
                  value={brand.customDomain}
                  placeholder="travel.client.mv"
                  onChange={(e) => setBrand({ ...brand, customDomain: e.target.value })}
                />
              </div>
            </div>
            <Button className="mt-4" onClick={saveBrand} disabled={busy}>
              <RefreshCw className="size-4" /> Save branding
            </Button>
          </div>
        )}

        {tab === "gallery" && (
          <div className="mt-6 rounded-2xl border bg-card p-6">
            <h2 className="font-semibold">Property gallery</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload images (drag & drop) and manage each property's photo gallery.
            </p>

            <div className="mt-4 grid gap-6 lg:grid-cols-[280px_1fr]">
              <div className="space-y-2">
                <Label>Property</Label>
                {properties.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProperty(p.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                      selectedProperty === p.id
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/40"
                    }`}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {p.gallery.length} images
                    </span>
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                {(() => {
                  const property = properties.find((p) => p.id === selectedProperty);
                  if (!property)
                    return <p className="text-sm text-muted-foreground">Select a property.</p>;
                  return (
                    <>
                      <ImageDropzone
                        folder={`properties/${property.slug}`}
                        onUploaded={addGalleryImage}
                      />
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {property.gallery.map((src) => (
                          <div key={src} className="group relative">
                            <img
                              src={src}
                              alt={property.name}
                              className="aspect-[4/3] w-full rounded-lg object-cover"
                            />
                            <button
                              onClick={() => removeGalleryImage(src)}
                              className="absolute right-1 top-1 hidden size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover:flex"
                              aria-label="Remove image"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      {property.gallery.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No images yet — drop one above.
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

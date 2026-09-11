import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getPublishedPage } from "@/lib/api/cms";

export const Route = createFileRoute("/pages/$slug")({
  loader: async ({ params }) => {
    const page = await getPublishedPage({ data: params.slug });
    if (!page) throw notFound();
    return { page };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.page.title} | Ocean Atlas` : "Ocean Atlas" },
      ...(loaderData?.page.seoDescription
        ? [{ name: "description", content: loaderData.page.seoDescription }]
        : []),
    ],
  }),
  component: PageView,
});

function PageView() {
  const { page } = Route.useLoaderData();
  const paragraphs = page.body.split(/\n\s*\n/).filter(Boolean);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Home
        </Link>
        <h1 className="mt-4 text-4xl">{page.title}</h1>
        <div className="mt-6 space-y-5 text-muted-foreground">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

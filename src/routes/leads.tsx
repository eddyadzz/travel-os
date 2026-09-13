import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireAuth } from "@/lib/require-auth";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/leads")({
  beforeLoad: requireAuth,
  head: () => ({
    meta: [{ title: "Leads & CRM | TravelOS by Boliflow" }, { name: "robots", content: "noindex" }],
  }),
  component: LeadsLayout,
});

function LeadsLayout() {
  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <Outlet />
      </main>
    </div>
  );
}

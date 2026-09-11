import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, MapPin, MessageCircle, Phone, Clock } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Our Maldives Travel Agents | TravelOS by Boliflow" },
      {
        name: "description",
        content:
          "Reach the TravelOS by Boliflow team by phone, WhatsApp or email for help with resorts, transfers and package planning.",
      },
      { property: "og:title", content: "Contact TravelOS by Boliflow" },
      { property: "og:description", content: "Phone, WhatsApp and email support from Malé-based Maldives specialists." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-14">
        <h1 className="text-4xl">Talk to a Maldives specialist</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Most questions are answered by the booking flow — but if you need a custom multi-island itinerary, we are one
          message away.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
          <form
            className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-soft)]"
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
              toast.success("Message sent", { description: "An agent will reply within a few hours." });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" required placeholder="Jane Doe" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required placeholder="jane@email.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone / WhatsApp</Label>
                <Input id="phone" placeholder="+1 555 010 2030" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="country">Country</Label>
                <Input id="country" placeholder="United States" />
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="msg">How can we help?</Label>
              <Textarea id="msg" rows={6} required placeholder="Travel dates, number of guests, islands you like…" />
            </div>
            <Button type="submit" className="mt-5">{sent ? "Message sent" : "Send message"}</Button>
          </form>

          <aside className="space-y-4">
            {[
              { icon: Phone, title: "Call us", value: "+960 330 4412" },
              { icon: MessageCircle, title: "WhatsApp", value: "+960 771 8890 — 24/7" },
              { icon: Mail, title: "Email", value: "stay@oceanatlas.mv" },
              { icon: MapPin, title: "Office", value: "Boduthakurufaanu Magu, Malé 20026" },
              { icon: Clock, title: "Hours", value: "Sun–Thu 09:00–18:00 (GMT+5)" },
            ].map((c) => (
              <div key={c.title} className="flex items-start gap-3 rounded-2xl border bg-card p-5">
                <span className="gradient-lagoon flex size-10 shrink-0 items-center justify-center rounded-xl text-primary-foreground">
                  <c.icon className="size-5" />
                </span>
                <div>
                  <p className="font-semibold">{c.title}</p>
                  <p className="text-sm text-muted-foreground">{c.value}</p>
                </div>
              </div>
            ))}
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

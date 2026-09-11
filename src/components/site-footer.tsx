import { Link } from "@tanstack/react-router";
import { Mail, MessageCircle, Phone } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t bg-secondary/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-display text-lg font-semibold">TravelOS by Boliflow</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Maldives specialists since 2011. Build your package online, we confirm every reservation by hand.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold">Explore</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/properties" search={{ type: "all" }} className="hover:text-foreground">All stays</Link></li>
            <li><Link to="/properties" search={{ type: "Resort" }} className="hover:text-foreground">Resorts</Link></li>
            <li><Link to="/properties" search={{ type: "Guesthouse" }} className="hover:text-foreground">Guesthouses</Link></li>
            <li><Link to="/properties" search={{ type: "Safari Boat" }} className="hover:text-foreground">Safari boats</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Company</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/contact" className="hover:text-foreground">Contact</Link></li>
            <li><Link to="/agent" className="hover:text-foreground">Agent dashboard</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Talk to an agent</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><Phone className="size-4" /> +960 330 4412</li>
            <li className="flex items-center gap-2"><MessageCircle className="size-4" /> WhatsApp 24/7</li>
            <li className="flex items-center gap-2"><Mail className="size-4" /> stay@oceanatlas.mv</li>
          </ul>
        </div>
      </div>
      <div className="border-t py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} TravelOS by Boliflow Pvt Ltd, Malé, Maldives.
      </div>
    </footer>
  );
}

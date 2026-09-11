# Installation Checklist

One-page go-live checklist. Follow it top to bottom for every new client deployment.
The interactive version of this flow is the **Client Onboarding wizard** (`/onboard`).

## 1 · Server
- [ ] Provision a Linux VPS (2 CPU / 4 GB minimum; scale with catalogue + bookings volume).
- [ ] Install Docker + Docker Compose.
- [ ] Point the client domain at the server (A / AAAA record).

## 2 · DNS
- [ ] `A` record: `travel.client.mv` → server IP.
- [ ] (Optional) wildcard `*.oceanatlas.mv` → server IP for tenant subdomains.

## 3 · SSL
- [ ] Reverse proxy (Caddy recommended: automatic HTTPS) in front of port 8080.
- [ ] Confirm `https://travel.client.mv` loads the public site with a valid cert.

## 4 · Email
- [ ] Add + verify the Resend sender domain.
- [ ] Set `RESEND_API_KEY` and `EMAIL_FROM` in `.env`.

## 5 · Migrations
- [ ] `docker compose up -d --build`
- [ ] Run `scripts/docker-entrypoint.sh` (schema sync + seed).
- [ ] Confirm the app responds on the domain.

## 6 · Import catalogue
- [ ] Download import templates (`/deploy` → Import templates).
- [ ] Fill Properties / Rooms / Rates / Suppliers / Customers / Leads.
- [ ] Upload via the import tool.
- [ ] Connect supplier channels (`/connectors`) and map rooms.

## 7 · Configure branding
- [ ] Apply logo, brand color, accent, typography, email sender (`/cms` → Branding).
- [ ] Set the custom domain.
- [ ] Confirm homepage hero, pages and portals render in the client's brand.

## 8 · Create admin user
- [ ] Create the client's admin + agent accounts.
- [ ] Confirm agents can reach the Agent console.

## 9 · Verify backups
- [ ] Create a backup (`/deploy`).
- [ ] Verify it passes integrity.
- [ ] Download a copy off the server.

## 10 · Run readiness check
- [ ] `/deploy` → First client — readiness check.
- [ ] Resolve every blocker (backup, email, PWA, audit, branding, data).

## 11 · Go live
- [ ] Confirm scheduled automation is enabled (`/jobs`).
- [ ] Send the client their portal links and training guides.
- [ ] Archive a post-go-live backup.

## First-client post-checks
- [ ] Restore the backup into a temporary database and confirm counts match.
- [ ] Send a test customer email and confirm delivery.
- [ ] Install the PWA on a phone and confirm offline shell + icon.
# First-Time Setup — First-Client Playbook

A repeatable, end-to-end runbook for onboarding a new agency. Each step names the
tool/screen that completes it.

```
Client agreement → Provision server → Deploy Docker → Configure domain →
Configure email → Import inventory → Apply branding → Run readiness check →
Staff training → Go live
```

## Stage 1 — Agreement & provisioning

- [ ] Sign the service agreement and confirm scope (properties, users, domains).
- [ ] Provision a VPS (CPU/RAM sized to catalogue + bookings volume).
- [ ] Point the client domain (or subdomain) at the server, DNS propagated.

## Stage 2 — Deploy

- [ ] Clone the repository, copy `.env.example` → `.env`.
- [ ] Fill `DATABASE_URL`, `POSTGRES_*`, `RESEND_API_KEY`, `EMAIL_FROM`, `TENANT_BASE_DOMAIN`.
- [ ] `docker compose up -d --build`
- [ ] Run `scripts/docker-entrypoint.sh` (schema + seed).
- [ ] Put Caddy/Nginx in front with TLS for the client domain.
- See the [Deployment Guide](deployment-guide.md).

## Stage 3 — Configure

- [ ] **Email**: confirm Resend sender domain; send a test customer email.
- [ ] **Domain**: set the client's `customDomain` so host resolution + branding apply.
- [ ] **Agencies** (`/admin/tenants`): confirm/onboard the tenant, set its plan,
      brand color, logo and email sender.
- [ ] **Users**: create the client's agents (admin + booking staff).

## Stage 4 — Import inventory

- [ ] Import the client's properties/rooms/rates (spreadsheet import) or connect a
      supplier channel and run a sync (`/connectors`).
- [ ] Map external room codes to internal rooms for any connected channel.
- [ ] Verify availability covers the coming season; spot-check a live quote.

## Stage 5 — Brand & verify

- [ ] Apply the client's **branding** in `/deploy` (logo, brand color, email sender).
- [ ] Confirm the public site, destination pages and customer portal render in the
      client's brand.
- [ ] Create an initial **backup** in `/deploy`.
- [ ] **Verify** the backup passes integrity; download a copy off-box.

## Stage 6 — Readiness gate

- [ ] Run the **Client readiness check** in `/deploy`.
- [ ] Resolve every blocker — a go-live requires:
  - a verified backup,
  - a configured email provider,
  - PWA assets present,
  - an active audit trail,
  - client branding applied,
  - a loaded catalogue,
  - a reachable database.

## Stage 7 — Training

- [ ] **Agents**: walk through the [Agent User Guide](agent-user-guide.md) — leads,
      quotes, bookings, payments, documents, conversations.
- [ ] **Administrator**: review the [Administrator Manual](administrator-manual.md) —
      markup, commissions, automation, jobs, reporting, suppliers.
- [ ] **Suppliers**: send each supplier their portal link and the
      [Supplier Portal Guide](supplier-portal-guide.md).
- [ ] **Support**: confirm job-failure alerts and daily reports reach the client inbox.

## Stage 8 — Go live

- [ ] Enable scheduled automation (`/jobs` shows the schedule; run-now is available).
- [ ] Announce the customer portal and public website.
- [ ] Record the go-live date and archive a post-go-live backup.

## Demo environment (sales / training)

For demos, seed a fresh database with the sample catalogue (the seed creates
properties, leads, quotes, bookings, payments, documents and supplier updates).
Brand it with a demo agency and show the full loop: **search → quote → accept →
booking → deposit → voucher → travel**. Never demo against a client's live data.
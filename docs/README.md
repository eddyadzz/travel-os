# BoliFlow — Documentation

BoliFlow is a complete travel-agency operations platform for dedicated single-agency
deployments. Each deployment gets its own database, branding, domain and infrastructure.

## The platform in one line

```
Lead → CRM → Quote → Acceptance → Booking → Operations → Supplier → Payments →
Documents → Travel → Finance → Analytics → Forecasting → Automation → Intelligence
```

## Guides

| Guide | Audience | What it covers |
|-------|----------|----------------|
| [Installation Checklist](installation-checklist.md) | Onboarding lead | The one-page go-live checklist (11 steps) |
| [Administrator Manual](administrator-manual.md) | Platform owner / admin | Tenants, suppliers, pricing, automation, jobs, reporting, assistant |
| [Agent User Guide](agent-user-guide.md) | Bookings agents | Leads, quotes, bookings, operations, payments, documents, communications |
| [Supplier Portal Guide](supplier-portal-guide.md) | Supplier staff | Inventory, rates, blackouts, promotions, packages, allocations |
| [Client Owner Guide](client-owner-guide.md) | Agency owners | Revenue, profit, forecasting, agent performance, scorecards, command center |
| [Deployment Guide](deployment-guide.md) | Deployment engineer | Docker stack (containers + compose) |
| [Deployment Guide — Bare Metal](deployment-guide-bare-metal.md) | Deployment engineer | **nginx + PM2 + local PostgreSQL + Cloudflare origin certs** (current production setup) |
| [Backup & Recovery Guide](backup-recovery-guide.md) | Deployment engineer | Backup, verification, restore, disaster recovery |
| [First-Time Setup](first-time-setup.md) | Onboarding lead | The repeatable first-client playbook, end to end |
| [Demo Script](demo-script.md) | Sales / onboarding | The guided ~15-minute demonstration path |
| [Technical Debt](technical-debt.md) | Engineering | Deferred cleanup tracked for after the demo |

## Where things live

- **Public website** — `/`, `/properties`, `/properties/:id`, `/destinations`, `/destinations/:atoll`, `/search`, `/availability`, `/contact`
- **Customer** — quote acceptance at `/quote/:token`, booking portal at `/track/:reference`
- **Agent console** — `/agent`, plus dedicated tools under `/leads`, `/quotes`, `/agent/bookings/:id`, `/finance`, `/revenue`, `/scorecards`, `/intelligence`, `/command`, `/assistant`, `/automation`, `/jobs`, `/supplier-updates`, `/connectors`, `/deploy`
- **Supplier portal** — `/supplier/:token`
- **Super admin** — `/admin/tenants`

## Key concepts

- **Quotes are the binding price**: a quote carries the agency markup and a secure
  acceptance link. Accepting a quote auto-creates a booking and a 50% deposit request.
- **Automation runs itself**: reminders, supplier escalations, arrival sequences and
  daily reports run on a schedule and are logged in the job history.
- **Finance is auditable**: P&L, outstanding, deposits, ledger and agent commissions
  export to CSV / Excel / QuickBooks / Xero.
- **Deployment is repeatable**: the readiness check gates a client go-live on backup,
  email, PWA, audit trail, branding and data.
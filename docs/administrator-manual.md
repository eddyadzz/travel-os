# Administrator Manual

This manual is for the person who runs the BoliFlow deployment: configures pricing,
manages suppliers, reviews automation, and keeps the platform healthy.

## 1. Getting around

The admin entry point is the **Agent dashboard** (`/agent`). The header links to every
management tool. Route summary:

| Tool | Route | Purpose |
|------|-------|---------|
| Command center | `/command` | Revenue, attention, arrivals, contracts, agents at a glance |
| Intelligence | `/intelligence` | Revenue forecast, booking forecast, lead intelligence, supplier risk |
| Supplier scorecards | `/scorecards` | Reliability score, confirmation rate, response time, contract expiry |
| Finance | `/finance` | P&L, outstanding, deposits, ledger, agent performance + exports |
| Revenue | `/revenue` | Dynamic markup rules + agent commission rates |
| Assistant | `/assistant` | AI-style recommendations, drafted follow-ups, answers, lead scoring |
| Automation | `/automation` | Run payment / supplier / arrival automation and the daily report |
| Background jobs | `/jobs` | Schedule, history, success rate, failure alerts, run-now |
| Supplier updates | `/supplier-updates` | Chase suppliers for availability/rates; portal access links |
| Supplier channels | `/connectors` | Live supplier API channels + property/room mapping |
| Deployment | `/deploy` | Environment validation, onboarding checklist, backups, readiness |
| Agencies | `/admin/tenants` | Tenants, plans, usage, branding, domains |

## 2. Pricing

**Dynamic markup** (`/revenue`) — the agency margin added to every quote and booking.

- Defaults by property type: Resort/Hotel **22%**, Guesthouse **18%**, Safari **25%**.
- Rules override defaults with precedence: **property rule > supplier rule > type rule**.
- Higher `priority` wins among conflicting rules.
- The markup is baked into the quote total and the generated booking, so the price a
  customer accepts matches what the agency is paid.

**Agent commissions** (`/revenue` → Commission rates) — each agent has a commission %
applied to the gross profit of their confirmed bookings. The commission column appears
in the Finance → Agents report and its exports.

## 3. Suppliers

- **Supplier portal access** (`/supplier-updates`): select a supplier and choose
  *Copy portal link* or *Email access link*. The supplier uses the link to manage their
  own inventory in real time — no spreadsheets.
- **Scorecards** (`/scorecards`): suppliers are ranked automatically on response time,
  confirmation rate, cancellation rate, volume, revenue, profit and contract expiry.
  Tiers: Reliable / Needs Attention / At Risk.
- **Update automation** (`/automation` + `/jobs`): the supplier-scan job opens an update
  request when a supplier's availability data is stale; reminders and escalations are
  sent automatically.

## 4. Automation & scheduled jobs

Automation runs on a schedule inside the server process and is logged in `/jobs`:

| Job | Schedule | What it does |
|-----|----------|--------------|
| supplier-scan | every 6h | Open update requests for stale supplier data |
| payment-automation | every 2h | Deposit + balance reminders |
| supplier-escalation | hourly | First reminder / escalation for unanswered requests |
| arrival-automation | hourly | T-7 summary, T-3 vouchers, T-1 instructions |
| daily-report | 08:00 | Daily operations report by email |
| accounting-sync | 06:30 | Xero + QuickBooks journals, stored |
| channel-sync | every 3h | Pull live availability/rates from supplier channels |

Any job can be run immediately with **Run now**. Failures retry with backoff and alert
the admin by email after retries are exhausted.

## 5. Reporting & exports

`/finance` provides live reports and downloads:

- **Profit & Loss**, **Outstanding**, **Deposits**, **Payment ledger**, **Agent performance**
- Export formats: **CSV**, **Excel (.xlsx)**, **QuickBooks journal**, **Xero journal**
- **Accounting sync** generates and stores both journals for the selected period —
  download the latest from the sync history.

`/intelligence` adds forecasting: expected revenue/profit/collections, expected
confirmations, per-source lead conversion, and supplier risk detection.

## 6. Supplier channels & mapping

`/connectors` manages live supplier API channels. For a channel, **Map rooms** links the
provider's external room codes to your internal catalogue. Sync resolves each incoming
row (explicit mapping → fallback) and reports mapped/unmapped counts. Unmapped rows are
skipped. The channel-sync job pulls enabled channels automatically.

## 7. Tenants & agencies

`/admin/tenants` manages agency tenants: plans (Starter/Professional/Enterprise),
usage limits, branding (logo, colors, email sender), and custom domains. Onboarding an
agency creates the tenant plus its first admin user.

## 8. Keeping the platform healthy

- **Jobs** — check `/jobs` for failed runs and success rates.
- **Automation log** — `/automation` shows every automation action.
- **Environment validation + readiness** — `/deploy` runs the go-live gate (backup,
  email, PWA, audit trail, branding, data).
- **Backups** — create, verify, download and restore from `/deploy` (see the
  [Backup & Recovery Guide](backup-recovery-guide.md)).
# Agent User Guide

This guide is for reservations agents who work leads, issue quotes, manage bookings,
and communicate with customers and suppliers.

## 1. Your workspace

Everything starts from the **Agent dashboard** (`/agent`): upcoming arrivals, open
bookings, supplier updates, and quick links to your tools.

## 2. Leads & CRM

**Leads** (`/leads`) — every enquiry from the website, WhatsApp, phone or other sources.

- Open a lead to see its details, contact history and any quotes.
- Assign yourself (or a colleague) so it has an owner.
- Move status through the pipeline: `NEW → CONTACTED → QUOTED → FOLLOW_UP → WON/LOST`.
- Use **Assistant → leads most likely to convert** to prioritise follow-ups by
  conversion probability.

## 3. Quoting

**Quotes** (`/quotes`) — generate a quote for any property/room/dates.

- The quote applies the **dynamic markup** automatically and produces a PDF plus a
  secure acceptance link (`/quote/:token`).
- Send it by email with the **Send** action.
- A customer who **accepts** the quote auto-creates a booking and a 50% deposit request.
  Quotes can also be declined or marked "changes requested".

### The public booking loop
Customers can also self-serve: they search → pick a property → **Book now** or
**Get a quote** → accept online → pay the deposit → track via the portal. You don't
need to touch that flow unless a confirmation or payment issue arises.

## 4. Bookings & operations

**Booking detail** (`/agent/bookings/:id`) is your main work screen with tabs:

- **Conversation** — chat with the customer and the agent team.
- **Payments** — request/submit/verify deposits and balances.
- **Timeline** — every event on the booking.
- **Notes** — internal notes only your team can see.
- **Attachments** — upload customer files.
- **Documents** — generate vouchers, invoices and confirmations.
- **Supplier** — link the supplier reference/status and **ingest inbound emails**.

Actions:

- **Change status** through the workflow (New → Assigned → Awaiting supplier →
  Awaiting customer → Awaiting payment → Confirmed → Completed, or Cancelled).
- **Assign / unassign** an agent.
- **Calendar sync** — one click to add the stay to Google Calendar or download an
  `.ics` file.
- **Email ingestion** — paste a supplier's reply and it is linked to the booking,
  appended to the conversation, and marks their update request received.

## 5. Payments

- **Request** a deposit or balance payment for any amount.
- Customers pay via the booking portal; you **submit** proof and **verify** it.
- **Finance → Outstanding** shows every booking with an unpaid balance.
- Payment reminders run automatically (`automation`), but you can request a payment
  manually at any time.

## 6. Customer portal

Customers track their booking at `/track/:reference?token=...` — they see the stay,
payments, documents and messages, and can send you a message. Arrival sequences (T-7
summary, T-3 vouchers, T-1 instructions) are sent automatically before travel.

## 7. Communications

Every booking has a **conversation**. Messages are customer-visible unless marked
internal. Use the **Communications** area to read and reply; the customer sees the
thread in their portal. Supplier emails ingested against a booking also appear here.

## 8. Your performance

**Finance → Agents** shows each agent's bookings, revenue, profit and commission.
**Assistant → Management** can answer "which agent is performing best?" and
"which leads are likely to convert?"
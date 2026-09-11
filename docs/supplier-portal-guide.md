# Supplier Portal Guide

This guide is for supplier staff who manage their property's live inventory and rates
in BoliFlow. You only need your **portal link** (emailed by the agency) — no account
or password.

## Your portal

Open the link you were sent: `https://<your-domain>/supplier/<token>`.
Keep the link private — it is your access key.

## Tabs

### Dashboard
An overview of your properties, open update requests, and which of your properties
need attention. The **Update** button jumps straight to Availability.

### Availability
The most important tab — it controls what customers see on the website.

1. Pick a **property** and a **room**.
2. The grid shows the next **30 days**. Set how many rooms are available for sale
   on each day (0 = sold out).
3. Use **Fill all days** to set the whole month quickly, then adjust individual days.
4. **Block** a day to force it sold out (e.g. maintenance, full property buyout) —
   you can unblock it later.
5. **Save all** writes your changes to the live site.

Changes appear on the website in real time — there is no emailing spreadsheets.

### Rates
Set the nightly selling price per room.

- **Add rate**: choose property + room, the valid-from/to dates, the nightly amount
  (USD) and an optional season label.
- **Edit / Delete** existing rates inline.
- Rates must cover a stay's full date range for the quote/booking engine to use them.

### Blackout dates
List every day a room is blocked (e.g. maintenance) at a glance.

- **Add blackout** by picking the room, date and an optional reason — the day is
  automatically set to sold out.
- **Clear** a blackout to re-open the day.

### Promotions
Create offers that appear with your property:

- Name, discount type (**% off** or **fixed USD off**), value, validity window.
- Optionally target a single room; otherwise the promotion applies to the property.
- Pause/activate anytime.

### Packages
Bundle a stay into a package:

- Name, description, price, validity window, and a comma-separated list of what's
  included (e.g. "Transfer, Breakfast, 1 excursion").

### Allocations
Rooms **reserved for this agency** on specific dates — the units your partner holds.

- Add a room, date and number of units.
- **Set to 0** releases an allocation.

## How updates reach the site

1. You change inventory/rates in your portal.
2. The change is saved immediately and the open **update request** from the agency is
   auto-marked as received — you won't be chased again.
3. The agency's automation stops sending reminders once your data is fresh.

## Tips

- Keep availability current at least weekly — the platform flags stale suppliers.
- If you can't open your portal link, ask the agency to resend it.
- Rates and availability must both cover a date range for a booking to be possible:
  availability says *is it sellable*, rates say *how much*.
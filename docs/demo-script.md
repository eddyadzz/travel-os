# Demo Script

A guided, ~15-minute path that tells the complete story of the platform — from a
prospect landing on the public site through to a paid booking and the back office.

Load the demo data first (see [First-Time Setup](first-time-setup.md)), then walk
this path top to bottom.

## The flow

```
Homepage → Destination → Property → Get Quote → Quote Portal → Accept Quote →
Booking → Customer Portal → Supplier Operations → Finance → Intelligence → CMS →
Deployment Toolkit
```

## Step-by-step

### 1. Public website — `/`
- Point out the hero ("Build your Maldives escape, priced before you ask") and the
  promotional block directly below it (CMS-driven, shown live).
- Scroll to testimonials, then the footer.

### 2. Destination page — `/destinations`, `/destinations/:atoll`
- Show atoll categories and one destination detail page.

### 3. Property — `/properties`, `/properties/:id`
- Pick a resort; show gallery, rooms, add-ons and pricing.

### 4. Instant quote — `/search` or the property "Get quote"
- Enter dates, guests and budget; the estimate (accommodation + transfers +
  add-ons + markup) renders instantly.

### 5. Quote portal — `/quote/:token`
- Open the acceptance link; the customer sees the itemised quote and the 50%
  deposit requirement.

### 6. Accept quote
- Accept → a booking is auto-created, the deposit request is issued, and activity
  is logged.

### 7. Customer portal — `/track/:reference`
- Show payments, vouchers, documents and the itinerary in the self-serve portal.

### 8. Supplier operations — `/supplier-updates`, `/supplier/:token`
- Show supplier requests, confirmations, and the supplier self-service portal.

### 9. Finance — `/finance`, `/revenue`
- Show P&L, deposits, outstanding balances and agent performance; export a report.

### 10. Intelligence — `/intelligence`, `/scorecards`, `/command`
- Show forecasts, lead-source analytics, supplier risk and the daily command center.

### 11. CMS — `/cms`
- Edit a headline or enable a promotional block and reload the homepage to show the
  change live — this is the most tangible feature for a travel-business owner.

### 12. Deployment toolkit — `/deploy`
- Run the readiness check, create a backup, and show the onboarding checklist.

## Tips

- Keep the whole run to **under 15 minutes**; skip straight from 1 → 6 if time is short.
- If email is in dev mode (`RESEND_API_KEY` empty), say "emails are logged here in
  this environment" rather than triggering a real send.
- End on the CMS → homepage loop (step 11) — it is the strongest closing impression.

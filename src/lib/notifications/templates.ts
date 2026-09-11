/** Minimal, reusable email templates. Each links straight to the portal. */

function layout(html: string): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px;background:#0e7490;color:#ffffff;">
          <strong style="font-size:18px;">TravelOS by Boliflow</strong>
        </td></tr>
        <tr><td style="padding:28px;color:#1f2937;font-size:15px;line-height:1.6;">
          ${html}
        </td></tr>
        <tr><td style="padding:20px;background:#f9fafb;color:#6b7280;font-size:12px;">
          You received this email because you booked a stay with TravelOS by Boliflow.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr><td align="center">
      <a href="${href}" style="background:#0e7490;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;display:inline-block;">${label}</a>
    </td></tr>
  </table>`;
}

export const emailTemplates = {
  statusChanged: (opts: { reference: string; label: string; link: string }) => ({
    subject: `Booking ${opts.reference} — status update`,
    html: layout(
      `<h2 style="margin-top:0;">Your booking status has changed</h2>
       <p>Booking <strong>${opts.reference}</strong> is now: <strong>${opts.label}</strong>.</p>
       ${button(opts.link, "View booking")}`,
    ),
  }),

  customerNewMessage: (opts: { reference: string; senderName: string; link: string }) => ({
    subject: `New message regarding booking ${opts.reference}`,
    html: layout(
      `<h2 style="margin-top:0;">You have a new reply</h2>
       <p>${opts.senderName} replied regarding booking <strong>${opts.reference}</strong>.</p>
       ${button(opts.link, "View message")}`,
    ),
  }),

  attachmentAdded: (opts: { reference: string; filename: string; link: string }) => ({
    subject: `New document for booking ${opts.reference}`,
    html: layout(
      `<h2 style="margin-top:0;">A new document is available</h2>
       <p>A document <strong>${opts.filename}</strong> has been added to booking <strong>${opts.reference}</strong>.</p>
       ${button(opts.link, "View document")}`,
    ),
  }),

  paymentRequest: (opts: { reference: string; link: string }) => ({
    subject: `Payment requested for booking ${opts.reference}`,
    html: layout(
      `<h2 style="margin-top:0;">Payment requested</h2>
       <p>Your booking <strong>${opts.reference}</strong> is ready for payment.</p>
       ${button(opts.link, "View booking")}`,
    ),
  }),

  paymentVerified: (opts: { reference: string; link: string }) => ({
    subject: `Payment verified for booking ${opts.reference}`,
    html: layout(
      `<h2 style="margin-top:0;">Payment verified</h2>
       <p>Your payment for booking <strong>${opts.reference}</strong> has been verified.</p>
       ${button(opts.link, "View booking")}`,
    ),
  }),

  paymentRejected: (opts: { reference: string; link: string }) => ({
    subject: `Please resubmit payment for booking ${opts.reference}`,
    html: layout(
      `<h2 style="margin-top:0;">Payment not verified</h2>
       <p>We could not verify your payment for booking <strong>${opts.reference}</strong>. Please resubmit your proof of payment.</p>
       ${button(opts.link, "Resubmit proof")}`,
    ),
  }),

  agentCustomerMessage: (opts: {
    reference: string;
    customerName: string;
    message: string;
    link: string;
  }) => ({
    subject: `Customer replied on ${opts.reference}`,
    html: layout(
      `<h2 style="margin-top:0;">New customer message</h2>
       <p><strong>${opts.customerName}</strong> replied regarding booking <strong>${opts.reference}</strong>.</p>
       <blockquote style="border-left:4px solid #e5e7eb;margin:12px 0;padding:8px 16px;color:#4b5563;">${opts.message}</blockquote>
       ${button(opts.link, "Open booking")}`,
    ),
  }),

  quoteReady: (opts: {
    reference: string;
    total: string;
    documentUrl: string;
    bookingLink: string;
  }) => ({
    subject: `Your quote ${opts.reference} is ready`,
    html: layout(
      `<h2 style="margin-top:0;">Your travel quote is ready</h2>
       <p>Quote <strong>${opts.reference}</strong> — estimated total <strong>${opts.total}</strong>.</p>
       ${button(opts.documentUrl, "Download quote (PDF)")}
       ${button(opts.bookingLink, "Book this stay")}
       <p style="color:#6b7280;">Payment: a deposit may be required to confirm. We accept bank transfer — details provided on confirmation.</p>`,
    ),
  }),

  supplierUpdateRequest: (opts: { supplier: string; type: string; daysOld: number }) => ({
    subject: `${opts.type} Update Request — ${opts.supplier}`,
    html: layout(
      `<h2 style="margin-top:0;">We need your latest ${opts.type.toLowerCase()} data</h2>
       <p>Dear Reservations Team,</p>
       <p>Our records indicate that the latest ${opts.type.toLowerCase()} data for <strong>${opts.supplier}</strong> is now <strong>${opts.daysOld} days old</strong>.</p>
       <p>Could you please send your latest room availability and rate sheet at your earliest convenience?</p>
       <p><strong>Accepted formats:</strong></p>
       <ul>
         <li>Excel (.xlsx)</li>
         <li>CSV</li>
         <li>Rate sheets</li>
       </ul>
       <p>Thank you for your assistance.</p>
       <p style="color:#6b7280;">Kind regards,<br/>Reservations Team — Thaa Maldives</p>`,
    ),
  }),

  jobFailed: (opts: { jobName: string; jobKey: string; error: string }) => ({
    subject: `Background job failed — ${opts.jobName}`,
    html: layout(
      `<h2 style="margin-top:0;">Scheduled job failed</h2>
       <p>Job <strong>${opts.jobName}</strong> (<code>${opts.jobKey}</code>) failed after its retry attempts.</p>
       <p><strong>Error:</strong></p>
       <pre style="background:#f3f4f6;padding:12px;border-radius:8px;overflow-x:auto;white-space:pre-wrap;">${opts.error}</pre>
       <p>Check the job history for details. The job will be retried on its next scheduled run.</p>`,
    ),
  }),

  supplierPortalAccess: (opts: { supplier: string; link: string }) => ({
    subject: `Your supplier portal — ${opts.supplier}`,
    html: layout(
      `<h2 style="margin-top:0;">Manage your inventory online</h2>
       <p>Dear Reservations Team,</p>
       <p>As one of our valued partners, you can now manage your inventory directly — no more spreadsheets.</p>
       <p>Through your portal you can update:</p>
       <ul>
         <li>Room availability</li>
         <li>Rates</li>
         <li>Blackout dates</li>
         <li>Promotions, packages &amp; allocations</li>
       </ul>
       <p>Changes appear on our site in real time.</p>
       ${button(opts.link, "Open your supplier portal")}
       <p style="color:#6b7280;">Keep this link private — it's your access key.</p>
       <p style="color:#6b7280;">Kind regards,<br/>Reservations Team — Thaa Maldives</p>`,
    ),
  }),

  depositReminder: (opts: { reference: string; deposit: string; link: string }) => ({
    subject: `Deposit reminder — booking ${opts.reference}`,
    html: layout(
      `<h2 style="margin-top:0;">Your deposit is outstanding</h2>
       <p>Booking <strong>${opts.reference}</strong> requires a deposit of <strong>${opts.deposit}</strong> to be confirmed.</p>
       ${button(opts.link, "View booking & pay")}
       <p style="color:#6b7280;">If you have already paid, please disregard this reminder.</p>`,
    ),
  }),

  balanceReminder: (opts: {
    reference: string;
    outstanding: string;
    daysUntilArrival: number;
    link: string;
  }) => ({
    subject: `Balance payment due — booking ${opts.reference}`,
    html: layout(
      `<h2 style="margin-top:0;">Balance payment reminder</h2>
       <p>Booking <strong>${opts.reference}</strong> has an outstanding balance of <strong>${opts.outstanding}</strong>, due before your arrival in <strong>${opts.daysUntilArrival} day${opts.daysUntilArrival === 1 ? "" : "s"}</strong>.</p>
       ${button(opts.link, "View booking & pay")}`,
    ),
  }),

  arrivalSummary: (opts: {
    reference: string;
    property: string;
    room: string;
    checkIn: string;
    checkOut: string;
    link: string;
  }) => ({
    subject: `Your Maldives stay is coming up — ${opts.reference}`,
    html: layout(
      `<h2 style="margin-top:0;">Booking summary — ${opts.reference}</h2>
       <p><strong>${opts.property}</strong> · ${opts.room}</p>
       <p>Check-in: ${opts.checkIn}<br/>Check-out: ${opts.checkOut}</p>
       <p>What to bring: passport, travel insurance, sunscreen. Most resorts are cashless — bring a card.</p>
       ${button(opts.link, "View booking")}`,
    ),
  }),

  arrivalInstructions: (opts: {
    reference: string;
    property: string;
    transfer: string;
    link: string;
  }) => ({
    subject: `Arrival instructions — ${opts.reference}`,
    html: layout(
      `<h2 style="margin-top:0;">Arrival day — ${opts.reference}</h2>
       <p>Your stay at <strong>${opts.property}</strong> begins today.</p>
       <p><strong>Transfer:</strong> ${opts.transfer}</p>
       <p>On arrival at Velana International Airport, our representative will meet you at the arrivals hall. Emergency: +960 771 8890 (24/7).</p>
       ${button(opts.link, "View booking")}`,
    ),
  }),

  supplierEscalation: (opts: {
    supplier: string;
    type: string;
    daysOld: number;
    level: number;
  }) => ({
    subject: `${opts.level === 2 ? "Escalation" : "Reminder"}: ${opts.type} Update — ${opts.supplier}`,
    html: layout(
      `<h2 style="margin-top:0;">${opts.level === 2 ? "Escalation" : "Friendly reminder"}</h2>
       <p>Dear Reservations Team,</p>
       <p>We are still awaiting your latest ${opts.type.toLowerCase()} data for <strong>${opts.supplier}</strong> — now <strong>${opts.daysOld} days old</strong> (${opts.level === 2 ? "second follow-up" : "first follow-up"}).</p>
       <p>Please send your Excel (.xlsx) or CSV file at your earliest convenience so we can keep your inventory live.</p>
       <p style="color:#6b7280;">Kind regards,<br/>Reservations Team — Thaa Maldives</p>`,
    ),
  }),

  dailyReport: (opts: {
    newLeads: number;
    quotes: number;
    confirmed: number;
    revenue: string;
    outstanding: string;
    supplierPending: number;
  }) => ({
    subject: `Daily operations report`,
    html: layout(
      `<h2 style="margin-top:0;">Daily operations report</h2>
       <table style="width:100%;border-collapse:collapse;font-size:14px;">
         ${[
           ["New leads", opts.newLeads],
           ["Quotes issued", opts.quotes],
           ["Bookings confirmed", opts.confirmed],
           ["Revenue collected", opts.revenue],
           ["Outstanding balances", opts.outstanding],
           ["Supplier requests pending", opts.supplierPending],
         ]
           .map(
             ([k, v]) =>
               `<tr><td style="padding:6px 0;color:#6b7280;">${k}</td><td style="padding:6px 0;text-align:right;font-weight:bold;">${v}</td></tr>`,
           )
           .join("")}
       </table>`,
    ),
  }),
};

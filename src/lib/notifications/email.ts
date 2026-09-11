import { Resend } from "resend";

const RESEND_API_KEY = process.env["RESEND_API_KEY"];
const EMAIL_FROM = process.env["EMAIL_FROM"] ?? "TravelOS by Boliflow <bookings@oceanatlas.mv>";

/**
 * Sends an email via Resend. Fails gracefully when no API key is configured
 * (dev mode) so the rest of the notification pipeline still works.
 */
export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  if (!RESEND_API_KEY) {
    // Dev mode: no provider configured — simulate success and return null.
    return null;
  }
  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

import { sendEmail } from "./email";

/**
 * Notification queue abstraction. Currently the worker is synchronous (we
 * send inline when the queue is flushed), but the API is shaped so it can be
 * swapped for a real async worker (e.g. a Nitro task or job queue) later
 * without touching the call sites.
 */

export type QueuedEmail = {
  to: string;
  subject: string;
  html: string;
};

/** Sends one email immediately. The "worker". */
export async function processEmail(email: QueuedEmail): Promise<void> {
  await sendEmail(email);
}

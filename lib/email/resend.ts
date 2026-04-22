import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";
import WelcomeEmail from "@/emails/welcome";
import ReceiptEmail from "@/emails/receipt";
import SubscriptionCancelledEmail from "@/emails/subscription-cancelled";
import config from "@/config";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const from = env.EMAIL_FROM ?? config.email.from;

function guard() {
  if (!resend) {
    throw new Error("Resend is not configured (missing RESEND_API_KEY)");
  }
  return resend;
}

export async function sendWelcomeEmail(opts: { to: string; name: string | null }) {
  return guard().emails.send({
    from,
    to: opts.to,
    subject: `Welcome to ${config.appName}`,
    react: WelcomeEmail({ name: opts.name, appName: config.appName }),
  });
}

export async function sendReceiptEmail(opts: { to: string; amount: number; currency: string }) {
  return guard().emails.send({
    from,
    to: opts.to,
    subject: "Your receipt",
    react: ReceiptEmail({ amount: opts.amount, currency: opts.currency }),
  });
}

export async function sendSubscriptionCancelledEmail(opts: { to: string }) {
  return guard().emails.send({
    from,
    to: opts.to,
    subject: "Your subscription has been cancelled",
    react: SubscriptionCancelledEmail(),
  });
}

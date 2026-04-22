# 07 — Email (Resend + React Email)

**Phase:** 2 · **Depends on:** 01 · **P1**

Replaces Mailgun + hardcoded HTML strings with **Resend** (better DX, cheap, fast) and **React Email** (JSX templates with live preview).

## Goal

- A single `resend` client.
- JSX templates in `emails/` that preview in a dev server.
- Typed send helpers (`sendWelcomeEmail`, `sendReceiptEmail`, …).
- Nodemailer, Mailgun, and `form-data` fully removed.

## Stack

- **[Resend](https://resend.com)** — simple API, great deliverability, $20/mo for 50k emails.
- **[React Email](https://react.email)** — JSX templates, live preview dev server.

## Steps

### 1. Create a Resend account

1. Sign up at https://resend.com.
2. Add + verify your domain (DNS records).
3. Create an API key → `RESEND_API_KEY=re_XXX`.
4. Pick a from address → `EMAIL_FROM="Acme <hello@yourdomain.com>"`.

### 2. Install

```bash
pnpm add resend
pnpm add -D react-email @react-email/components
pnpm remove mailgun.js nodemailer form-data
```

### 3. Resend client + send helpers

```ts
// lib/email/resend.ts
import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";
import WelcomeEmail from "@/emails/welcome";
import ReceiptEmail from "@/emails/receipt";
import SubscriptionCancelledEmail from "@/emails/subscription-cancelled";

if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY required");

const resend = new Resend(env.RESEND_API_KEY);
const from = env.EMAIL_FROM ?? "noreply@example.com";

export async function sendWelcomeEmail({ to, name }: { to: string; name: string }) {
  return resend.emails.send({
    from,
    to,
    subject: "Welcome 👋",
    react: WelcomeEmail({ name }),
  });
}

export async function sendReceiptEmail({ to, amount, currency }: { to: string; amount: number; currency: string }) {
  return resend.emails.send({
    from,
    to,
    subject: "Your receipt",
    react: ReceiptEmail({ amount, currency }),
  });
}

export async function sendSubscriptionCancelledEmail({ to }: { to: string }) {
  return resend.emails.send({
    from,
    to,
    subject: "Your subscription has been cancelled",
    react: SubscriptionCancelledEmail({}),
  });
}
```

### 4. Templates (React Email)

```tsx
// emails/welcome.tsx
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";

export default function WelcomeEmail({ name }: { name: string }) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Acme</Preview>
      <Body style={{ fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", background: "#f6f9fc", padding: "40px 0" }}>
        <Container style={{ background: "#fff", borderRadius: 8, padding: 32, maxWidth: 560, margin: "0 auto" }}>
          <Heading>Welcome{name ? `, ${name}` : ""} 👋</Heading>
          <Section>
            <Text>Thanks for signing up. Here's what you can do next:</Text>
            <Text>• Create your first project</Text>
            <Text>• Invite a teammate</Text>
            <Text>• Chat with the AI assistant</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

```tsx
// emails/receipt.tsx
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

export default function ReceiptEmail({ amount, currency }: { amount: number; currency: string }) {
  const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  return (
    <Html>
      <Head />
      <Preview>Your receipt for {formatted}</Preview>
      <Body style={{ fontFamily: "-apple-system, sans-serif", padding: 32 }}>
        <Container>
          <Heading>Receipt</Heading>
          <Text>You were charged <strong>{formatted}</strong>.</Text>
          <Text>Manage your subscription from the billing portal at any time.</Text>
        </Container>
      </Body>
    </Html>
  );
}
```

```tsx
// emails/subscription-cancelled.tsx
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

export default function SubscriptionCancelledEmail({}: {}) {
  return (
    <Html>
      <Head />
      <Preview>Your subscription was cancelled</Preview>
      <Body style={{ fontFamily: "-apple-system, sans-serif", padding: 32 }}>
        <Container>
          <Heading>We'll miss you</Heading>
          <Text>Your subscription has been cancelled. You'll retain access until the end of the billing period.</Text>
        </Container>
      </Body>
    </Html>
  );
}
```

### 5. Preview dev server

Add to `package.json`:

```json
{
  "scripts": {
    "email:dev": "email dev --dir emails",
    "email:export": "email export --dir emails --out .email-export"
  }
}
```

Run `pnpm email:dev` → opens http://localhost:3000 with every template preview. Hot-reload on edit.

### 6. Delete Mailgun artifacts

```bash
rm -rf lib/email/mailgun.ts
rg "mailgun|nodemailer" --type ts --type tsx   # should return zero after removal
```

Update `config.ts` — delete the `mailgun` block.

### 7. Where emails fire

| Event | Sender |
|-------|--------|
| Clerk `user.created` webhook | `sendWelcomeEmail` |
| Stripe `checkout.session.completed` | `sendReceiptEmail` |
| Stripe `customer.subscription.deleted` | `sendSubscriptionCancelledEmail` |

Each call should be wrapped with `try/catch` + `logger.warn` — email failure must never break the webhook. A better pattern: fire-and-forget via QStash (doc 09) so the webhook responds 200 immediately.

### 8. Batch / transactional segmentation (later)

For campaigns and drip sequences, add **[Resend Audiences](https://resend.com/docs/dashboard/audiences/introduction)** or integrate with Loops.so / Customer.io. Don't build this into the boilerplate — ship it per-project as needed.

## Verification checklist

- [ ] `pnpm email:dev` shows all three templates.
- [ ] `sendWelcomeEmail({ to: "your@email", name: "Test" })` from a tsx script delivers to inbox.
- [ ] `rg "mailgun|nodemailer|form-data"` returns zero.
- [ ] `config.ts` has no `mailgun` section.
- [ ] A Stripe test checkout triggers a receipt email.

## Gotchas

- **DNS propagation.** Domain verification can take up to 48h — test with Resend's default `onboarding@resend.dev` sender first.
- **React Email styles = inline only.** External CSS doesn't carry through to email clients. Use the style prop on every element.
- **Attachment size limit: 40 MB** on Resend. For bigger, send a pre-signed URL instead.
- **Don't block webhook handlers on email.** If email is slow, the webhook retries — leading to duplicate sends. Queue via QStash (doc 09).

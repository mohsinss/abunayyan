# 03 — Authentication (Auth.js v5)

**Phase:** 1 · **Depends on:** 01, 02 · **P0**

Auth.js v5 (the renamed NextAuth) runs entirely in your code and your Postgres. No SaaS account, no dashboard gatekeeping, no domain whitelist. Works identically on `localhost`, `*.vercel.app`, and custom domains.

## Goal

- Google sign-in (extendable to GitHub, Apple, email magic links, credentials).
- Sessions persisted in Postgres via the Drizzle adapter.
- `auth()` helper usable in Server Components, route handlers, and middleware.
- Session augmented with the user's subscription `hasAccess` flag for fast client-side paywall gating.

## Stack

- **`next-auth@beta`** — Auth.js v5.
- **`@auth/drizzle-adapter`** — persists users, accounts, sessions, verification tokens in Postgres.
- **Google provider** — default social login (free, no domain ownership required).

## Steps

### 1. Install

```bash
pnpm add next-auth@beta @auth/drizzle-adapter
```

### 2. Schema

Four tables are required by Auth.js. All four ship in `db/schema/`:

- `users` — id, email, name, image, emailVerified, timestamps
- `accounts` — OAuth provider linkage (one row per provider the user signed in with)
- `sessions` — active session tokens
- `verification_tokens` — email magic-link tokens

Run the migration:

```bash
pnpm db:generate
pnpm db:migrate
```

### 3. Env vars

Add to `.env.local`:

```bash
AUTH_SECRET=...                  # 32+ random bytes, base64
AUTH_GOOGLE_ID=...               # see step 4
AUTH_GOOGLE_SECRET=...
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`AUTH_URL` is auto-detected on Vercel; set it only if you're behind a proxy locally.

### 4. Google OAuth credentials

1. Go to https://console.cloud.google.com/apis/credentials.
2. Select or create a project.
3. **OAuth consent screen** → External → add app name, support email, developer contact.
4. **Credentials → Create Credentials → OAuth 2.0 Client ID → Web application.**
5. **Authorized redirect URIs** — add every URL your app will run at:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-app>.vercel.app/api/auth/callback/google`
   - `https://<your-custom-domain>/api/auth/callback/google` (if any)
6. Copy **Client ID** → `AUTH_GOOGLE_ID`.
7. Copy **Client Secret** → `AUTH_GOOGLE_SECRET`.

### 5. Auth configuration

Already written at `lib/auth.ts`:

- Drizzle adapter pointed at `db`
- `session.strategy: "database"` (invalidation + revocation work out of the box)
- `session` callback exposes `user.id` and `user.hasAccess` on every session read
- Custom sign-in page at `/sign-in`

### 6. Middleware

Already wired at `middleware.ts`. Protects `/dashboard`, `/chat`, `/billing`, `/settings`, `/api/v1/ai/*`, `/api/v1/stripe/(create-checkout|create-portal)`, `/api/v1/projects`. Unauthenticated requests redirect to `/sign-in?callbackUrl=<pathname>`.

### 7. Server-side usage

```ts
import { auth } from "@/lib/auth";

export default async function Page() {
  const session = await auth();
  // session?.user.id, session?.user.hasAccess, session?.user.email, ...
}
```

Or the redirect-or-return helper:

```ts
import { requireUser } from "@/lib/auth/session";

export default async function Page() {
  const user = await requireUser(); // redirects to /sign-in if absent
  // user.id, user.email, user.hasAccess, ...
}
```

### 8. Client-side usage

The app is wrapped in `<SessionProvider>` via `components/providers.tsx`. Use the hook:

```tsx
"use client";
import { useSession, signIn, signOut } from "next-auth/react";

export function Example() {
  const { data: session, status } = useSession();
  if (status === "loading") return null;
  if (!session) return <button onClick={() => signIn("google")}>Sign in</button>;
  return <button onClick={() => signOut()}>Sign out {session.user.email}</button>;
}
```

### 9. Subscription state on the session

The `session` callback in `lib/auth.ts` queries `subscriptions` and attaches `user.hasAccess` to every session read. This powers the client-side paywall without an extra API call:

```tsx
const { data: session } = useSession();
if (!session?.user.hasAccess) return <Paywall />;
```

## Adding more providers

### GitHub

```ts
import GitHub from "next-auth/providers/github";
GitHub({ clientId: process.env.AUTH_GITHUB_ID, clientSecret: process.env.AUTH_GITHUB_SECRET }),
```

Callback URL: `https://<your-domain>/api/auth/callback/github`.

### Email magic links (via Resend)

```ts
import Resend from "next-auth/providers/resend";
Resend({ apiKey: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM }),
```

Requires `RESEND_API_KEY` + `EMAIL_FROM` already set.

### Credentials (email + password)

Possible but not recommended — skip unless you have compliance reasons. Social + magic links cover 99% of cases.

## Verification checklist

- [ ] `pnpm db:migrate` applied the four Auth.js tables.
- [ ] `/sign-in` renders with a "Continue with Google" button.
- [ ] Click → Google consent → redirected back, `users` row inserted.
- [ ] `/dashboard` loads and shows the user's name.
- [ ] `/api/v1/ai/chat` returns 401 without a session, 200 with one.
- [ ] Signing out clears the session cookie and redirects to `/`.

## Gotchas

- **Auth.js v5 is in beta.** API is stable but occasional minor breaking changes in patch releases. Pin the version if this bothers you.
- **Google redirect URI must match EXACTLY.** Trailing slash, `http` vs `https`, port — all matter.
- **Database sessions round-trip per request.** For ultra-high-traffic routes, switch to `session.strategy: "jwt"` (revocation becomes harder; use short expiry).
- **Changing `AUTH_SECRET` invalidates all existing sessions.** Users have to sign in again. Fine for dev, not for prod.
- **Adapter writes `users` row automatically on first sign-in** — no webhook needed (unlike Clerk).

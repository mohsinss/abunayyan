# 12 — Scaffold CLI (`pnpm new-project`)

**Phase:** 3 · **Depends on:** all prior · **P1**

The velocity multiplier. One command turns this boilerplate into a fresh, named, deployable app with secrets scaffolded and integrations wired — in under 5 minutes.

## Goal

Running `pnpm new-project acme` from this repo's directory should:

1. Clone the boilerplate to a new directory `../acme`.
2. Rewrite app-name references (package.json, config.ts, meta tags).
3. Initialize a fresh git repo on a `main` branch.
4. Prompt for required secrets (Clerk, Anthropic, Neon, Stripe, Resend, Sentry, PostHog, Upstash).
5. Write `.env.local`.
6. Offer to run `pnpm install`, `pnpm db:generate`, `pnpm db:migrate`.
7. Offer to create a GitHub repo via `gh` and push.
8. Offer to create a Vercel project via `vercel link`.
9. Print a checklist of next steps.

## Stack

- **Node 22** + **tsx** to run the TS script.
- **[@clack/prompts](https://www.clack.cc/)** — interactive CLI prompts.
- **`execa`** — child-process shelling.
- **`chalk`** — colored output.

## Steps

### 1. Install script deps

```bash
pnpm add -D tsx @clack/prompts execa chalk
```

### 2. The script

```ts
// scripts/new-project.ts
import { intro, outro, text, confirm, password, note, isCancel, cancel, spinner, select } from "@clack/prompts";
import { execa } from "execa";
import chalk from "chalk";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

type Answers = {
  projectName: string;
  projectSlug: string;
  destination: string;
  appUrl: string;
  clerkPk: string;
  clerkSk: string;
  clerkWhSec: string;
  databaseUrl: string;
  databaseUrlUnpooled: string;
  anthropicKey: string;
  stripe?: { sk: string; whsec: string };
  resend?: { key: string; from: string };
  upstash?: { url: string; token: string; qstash: string };
  sentryDsn?: string;
  posthogKey?: string;
  createGithub: boolean;
  linkVercel: boolean;
  installNow: boolean;
};

async function ask(): Promise<Answers> {
  intro(chalk.bold("🚢 new-project — spin up a 2026 AI SaaS"));

  const projectName = await textReq("Project name (display)", "Acme");
  const projectSlug = await textReq("Project slug (kebab-case)", toSlug(projectName));
  const destination = await textReq("Destination directory", path.join(path.dirname(ROOT), projectSlug));
  const appUrl = await textReq("App URL for dev", "http://localhost:3000");

  note("Clerk (auth) — get from https://dashboard.clerk.com");
  const clerkPk = await textReq("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (pk_...)", "");
  const clerkSk = await secretReq("CLERK_SECRET_KEY (sk_...)");
  const clerkWhSec = await secretReq("CLERK_WEBHOOK_SIGNING_SECRET (whsec_...)");

  note("Neon (Postgres) — get from https://neon.tech");
  const databaseUrl = await secretReq("DATABASE_URL (pooled)");
  const databaseUrlUnpooled = await secretReq("DATABASE_URL_UNPOOLED (direct)");

  note("Anthropic — get from https://console.anthropic.com");
  const anthropicKey = await secretReq("ANTHROPIC_API_KEY (sk-ant-...)");

  const withStripe = await boolAsk("Wire Stripe now?", true);
  const stripe = withStripe ? {
    sk: await secretReq("STRIPE_SECRET_KEY (sk_test_...)"),
    whsec: await secretReq("STRIPE_WEBHOOK_SECRET (whsec_...)"),
  } : undefined;

  const withResend = await boolAsk("Wire Resend now?", true);
  const resend = withResend ? {
    key: await secretReq("RESEND_API_KEY (re_...)"),
    from: await textReq("EMAIL_FROM", `${projectName} <hello@${projectSlug}.com>`),
  } : undefined;

  const withUpstash = await boolAsk("Wire Upstash (Redis + QStash)?", true);
  const upstash = withUpstash ? {
    url: await secretReq("UPSTASH_REDIS_REST_URL"),
    token: await secretReq("UPSTASH_REDIS_REST_TOKEN"),
    qstash: await secretReq("QSTASH_TOKEN"),
  } : undefined;

  const withSentry = await boolAsk("Wire Sentry?", true);
  const sentryDsn = withSentry ? await textReq("NEXT_PUBLIC_SENTRY_DSN", "") : undefined;

  const withPostHog = await boolAsk("Wire PostHog?", true);
  const posthogKey = withPostHog ? await textReq("NEXT_PUBLIC_POSTHOG_KEY (phc_...)", "") : undefined;

  const createGithub = await boolAsk("Create GitHub repo (via gh CLI)?", true);
  const linkVercel = await boolAsk("Link Vercel project (via vercel CLI)?", true);
  const installNow = await boolAsk("Run pnpm install + db:migrate now?", true);

  return { projectName, projectSlug, destination, appUrl, clerkPk, clerkSk, clerkWhSec, databaseUrl, databaseUrlUnpooled, anthropicKey, stripe, resend, upstash, sentryDsn, posthogKey, createGithub, linkVercel, installNow };
}

async function run() {
  const a = await ask();
  const s = spinner();

  // 1. Copy repo
  s.start("Copying boilerplate…");
  await execa("rsync", ["-a", "--exclude=.git", "--exclude=node_modules", "--exclude=.next", "--exclude=.env.local", `${ROOT}/`, a.destination]);
  s.stop("Copied.");

  // 2. Rename references
  s.start("Renaming project references…");
  await replaceInFile(path.join(a.destination, "package.json"), /"name": "[^"]+"/, `"name": "${a.projectSlug}"`);
  await replaceInFile(path.join(a.destination, "config.ts"), /appName: "[^"]+"/, `appName: "${a.projectName}"`);
  s.stop("Renamed.");

  // 3. Write .env.local
  s.start("Writing .env.local…");
  const env = [
    `NODE_ENV=development`,
    `NEXT_PUBLIC_APP_URL=${a.appUrl}`,
    `DATABASE_URL=${a.databaseUrl}`,
    `DATABASE_URL_UNPOOLED=${a.databaseUrlUnpooled}`,
    `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${a.clerkPk}`,
    `CLERK_SECRET_KEY=${a.clerkSk}`,
    `CLERK_WEBHOOK_SIGNING_SECRET=${a.clerkWhSec}`,
    `ANTHROPIC_API_KEY=${a.anthropicKey}`,
    a.stripe && `STRIPE_SECRET_KEY=${a.stripe.sk}`,
    a.stripe && `STRIPE_WEBHOOK_SECRET=${a.stripe.whsec}`,
    a.resend && `RESEND_API_KEY=${a.resend.key}`,
    a.resend && `EMAIL_FROM=${a.resend.from}`,
    a.upstash && `UPSTASH_REDIS_REST_URL=${a.upstash.url}`,
    a.upstash && `UPSTASH_REDIS_REST_TOKEN=${a.upstash.token}`,
    a.upstash && `QSTASH_TOKEN=${a.upstash.qstash}`,
    a.sentryDsn && `NEXT_PUBLIC_SENTRY_DSN=${a.sentryDsn}`,
    a.posthogKey && `NEXT_PUBLIC_POSTHOG_KEY=${a.posthogKey}`,
    a.posthogKey && `NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com`,
  ].filter(Boolean).join("\n");
  await fs.writeFile(path.join(a.destination, ".env.local"), env + "\n", "utf8");
  s.stop(".env.local written.");

  // 4. Init git
  s.start("Initializing git…");
  await execa("git", ["init", "-b", "main"], { cwd: a.destination });
  await execa("git", ["add", "."], { cwd: a.destination });
  await execa("git", ["commit", "-m", "chore: initial scaffold from 2026 boilerplate"], { cwd: a.destination });
  s.stop("git initialized.");

  // 5. Install + migrate
  if (a.installNow) {
    s.start("pnpm install…");
    await execa("pnpm", ["install"], { cwd: a.destination, stdio: "inherit" });
    s.stop("Installed.");

    s.start("Running db:migrate…");
    try { await execa("pnpm", ["db:migrate"], { cwd: a.destination, stdio: "inherit" }); s.stop("Migrated."); }
    catch { s.stop("db:migrate failed — run manually after verifying DATABASE_URL."); }
  }

  // 6. GitHub repo
  if (a.createGithub) {
    s.start("Creating GitHub repo via gh…");
    try {
      await execa("gh", ["repo", "create", a.projectSlug, "--private", "--source", ".", "--push"], { cwd: a.destination, stdio: "inherit" });
      s.stop("GitHub repo created and pushed.");
    } catch { s.stop("gh failed — run `gh repo create` manually."); }
  }

  // 7. Vercel link
  if (a.linkVercel) {
    s.start("Linking Vercel project…");
    try {
      await execa("vercel", ["link", "--yes"], { cwd: a.destination, stdio: "inherit" });
      s.stop("Vercel linked.");
    } catch { s.stop("vercel link failed — run manually."); }
  }

  outro(chalk.green(`✅ ${a.projectName} is ready at ${a.destination}`));
  console.log(chalk.dim(`
Next steps:
  cd ${a.destination}
  pnpm dev                      # start the app
  pnpm db:studio                # open DB explorer
  pnpm email:dev                # preview email templates
  ${a.stripe ? "stripe listen --forward-to localhost:3000/api/v1/webhook/stripe" : ""}
  ${a.createGithub ? "# Set GitHub secrets for CI (see docs/setup/11-ci-deployment.md)" : ""}
`));
}

// ------- helpers
async function textReq(label: string, initial = "") {
  const v = await text({ message: label, initialValue: initial, validate: (s) => (!s ? "required" : undefined) });
  if (isCancel(v)) { cancel("Cancelled"); process.exit(0); }
  return v as string;
}
async function secretReq(label: string) {
  const v = await password({ message: label, validate: (s) => (!s ? "required" : undefined) });
  if (isCancel(v)) { cancel("Cancelled"); process.exit(0); }
  return v as string;
}
async function boolAsk(label: string, initial: boolean) {
  const v = await confirm({ message: label, initialValue: initial });
  if (isCancel(v)) { cancel("Cancelled"); process.exit(0); }
  return v as boolean;
}
function toSlug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
async function replaceInFile(file: string, pat: RegExp, repl: string) {
  const buf = await fs.readFile(file, "utf8");
  await fs.writeFile(file, buf.replace(pat, repl), "utf8");
}

run().catch((e) => { console.error(e); process.exit(1); });
```

### 3. Expose as a script

```json
// package.json
{
  "scripts": {
    "new-project": "tsx scripts/new-project.ts"
  }
}
```

### 4. `.env.example` and migration

The script writes `.env.local` directly. `.env.example` stays committed as the documentation of expected vars. Keep them in sync — if you add a var to `lib/env.ts`, add it to both `.env.example` and the script prompt.

### 5. Naming conventions applied by the script

- `package.json`'s `name` → the slug.
- `config.ts`'s `appName` → the display name.
- `config.ts`'s `domainName` → `<slug>.com` (override in prompt if needed).
- `config.ts`'s mailgun / support email section removed in doc 07; replaced by Resend. The script writes `EMAIL_FROM` to `.env.local`.

### 6. Extending: secrets managers

For team workflows, replace `.env.local` writing with:

```ts
// pseudo-code
await execa("doppler", ["setup", "--project", a.projectSlug, "--config", "dev"], { cwd: a.destination });
for (const [k, v] of envPairs) {
  await execa("doppler", ["secrets", "set", k, v]);
}
```

Same for Infisical. Document per-team in `docs/setup/01-environment.md`.

### 7. What the script deliberately does **not** do

- Doesn't provision Neon / Upstash / Clerk projects — those involve paid/OAuth flows and are better done in dashboards once. (Could be added later via each vendor's CLI.)
- Doesn't push branch protection rules — GitHub API permissions vary; use a Terraform module if you want that.
- Doesn't edit marketing copy — that's the engineer's job per project.

## Velocity targets

After full boilerplate is in place:

| Milestone | Time |
|-----------|------|
| `pnpm new-project acme` → working local dev | **5 min** |
| First deploy (Vercel preview) | **+5 min** |
| First feature (AI chat + DB) | **<1 day** |
| Paying user (Stripe live mode + product copy) | **<1 week** |

## Verification checklist

- [ ] `pnpm new-project test-app` completes end-to-end with all defaults.
- [ ] The new project boots on `pnpm dev` without env errors.
- [ ] `.env.local` in the new project has all keys that `lib/env.ts` requires.
- [ ] The new project's `git log` shows exactly one commit ("chore: initial scaffold…").
- [ ] Re-running `pnpm new-project test-app` on an existing directory errors clearly (don't silently overwrite).

## Gotchas

- **`rsync` must exclude `.git`** — otherwise you inherit the boilerplate's git history.
- **Cancel handling** — every prompt must `isCancel` check; `@clack/prompts` returns a symbol for ctrl-c.
- **Path collisions** — if the destination exists and is non-empty, abort with a clear error.
- **Platform**: `rsync` isn't available on plain Windows. Either require WSL or fall back to `fs.cp` for non-Unix platforms.
- **Secrets in process environment**: the script prompts with `password()` — don't log answers.

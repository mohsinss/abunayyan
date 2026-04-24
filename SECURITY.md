# Security Policy

We take the security of this project seriously and appreciate responsible
disclosure. This document describes what we consider in scope, how to report
a vulnerability, and what to expect after you do.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security reports.**

Email **mohsinb.alshammari@gmail.com** with the subject line `[security]` and
include:

- A clear description of the issue and its potential impact.
- Steps to reproduce (a proof-of-concept is welcome but not required).
- Any relevant logs, screenshots, or HTTP traces (redact anything sensitive).
- Your preferred contact and, if applicable, whether you'd like credit in
  the eventual disclosure.

If you prefer encrypted communication, request our PGP public key in the
initial email and we'll send it out of band.

## What to expect

| Stage                    | Target |
|--------------------------|--------|
| Acknowledgement of report| Within **2 business days** |
| Triage decision          | Within **5 business days** |
| Fix for critical issues  | Within **7 calendar days** of triage |
| Fix for high severity    | Within **14 calendar days** of triage |
| Fix for medium / low     | Batched with the next minor release |

We will keep you informed as the fix progresses and coordinate a disclosure
window with you before publishing details.

## Scope

**In scope:**

- The production application at the configured `NEXT_PUBLIC_APP_URL` host.
- The chatbot platform routes under `/api/v1/chatbots/*` and
  `/api/v1/admin/*`.
- Authentication, authorization, session handling, and rate limiting.
- Secrets handling (API keys, session secrets, DB credentials).
- Prompt-injection attacks that cross the trust boundary — e.g. a tool
  being used to exfiltrate another user's data.
- Persistence layer issues (unexpected access to other users' threads or
  messages).

**Out of scope:**

- Social engineering or physical attacks against our team.
- Denial-of-service through volumetric traffic.
- Issues that require a compromised end-user machine or browser extension.
- Clickjacking on pages with no sensitive actions (we ship `X-Frame-Options: DENY` regardless).
- Reports generated solely from automated scanners without a demonstrated
  impact.
- Pre-release / preview deployments (e.g. `*.vercel.app` PR previews).
- Dependency CVEs without a concrete exploitation path through our code.
  (We track these separately via `pnpm audit` in CI.)

## Safe harbor

If you follow this policy and make a good-faith effort to avoid privacy
violations, service disruption, or destruction of data during your
research, we will not pursue legal action and will work with you to
understand and resolve the issue.

## Hardening baseline

For transparency, the platform ships with:

- **CSP** + `X-Frame-Options: DENY` + `Strict-Transport-Security` + other
  security headers configured in `next.config.mjs`.
- **Fail-closed rate limits** on AI and admin endpoints (Redis outage
  rejects, it does not open the floodgates).
- **RBAC** with per-bot `allowedRoles` allow-lists and role rank enforced
  at the page, route, and domain layers.
- **Audit log** for every admin mutation and every chat turn.
- **Sentry PII scrubbing** for API-key patterns in server error reports.
- **Drizzle** parameterized queries (no raw SQL on user input).
- **Server-side Zod** validation at every API boundary.

## Credits

Researchers who report valid vulnerabilities will be credited (with
permission) in the release notes for the fix. If you would rather stay
anonymous, let us know in your report.

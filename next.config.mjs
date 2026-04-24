import { withSentryConfig } from "@sentry/nextjs";

// Note: env validation runs at build time via `@/lib/env` imports in app code.
// If you want explicit config-time validation, install `jiti` and uncomment:
//   import { createJiti } from "jiti";
//   await createJiti(import.meta.url).import("./lib/env");

// Content Security Policy — locked down to self + the third parties we ship
// (PostHog, Sentry, Vercel analytics, Google OAuth avatars, Unsplash dashboard
// images, Neon for websocket DB calls). Revisit `script-src 'unsafe-inline'`
// once the move to nonce-based inline scripts lands.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.posthog.com https://*.sentry.io https://*.vercel-insights.com https://*.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://img.clerk.com https://images.unsplash.com https://*.googleusercontent.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.posthog.com https://*.sentry.io https://*.vercel-insights.com https://*.neon.tech wss://*.neon.tech",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com", pathname: "/**" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  disableLogger: true,
};

export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryBuildOptions)
  : nextConfig;

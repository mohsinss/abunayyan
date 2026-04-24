import { auth } from "@/lib/auth";

const PROTECTED = [
  /^\/dashboard(\/|$)/,
  /^\/chat(\/|$)/,
  /^\/billing(\/|$)/,
  /^\/settings(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/api\/v1\/ai\//,
  /^\/api\/v1\/chatbots\//,
  /^\/api\/v1\/admin\//,
  /^\/api\/v1\/stripe\/(create-checkout|create-portal)/,
  /^\/api\/v1\/projects/,
];

const ADMIN_ONLY = [/^\/admin(\/|$)/, /^\/api\/v1\/admin\//];

export default auth((req) => {
  const path = req.nextUrl.pathname;

  if (PROTECTED.some((re) => re.test(path)) && !req.auth) {
    // API paths want a status code, not a browser redirect — the redirect
    // chain confuses fetch-based callers and hides the real error. Page
    // paths continue to redirect through /sign-in so users land on the
    // login form with their callbackUrl preserved.
    if (path.startsWith("/api/")) {
      return new Response("Unauthorized", { status: 401 });
    }
    const url = new URL("/sign-in", req.nextUrl);
    url.searchParams.set("callbackUrl", path);
    return Response.redirect(url);
  }

  if (ADMIN_ONLY.some((re) => re.test(path))) {
    const role = (req.auth?.user as { role?: string } | undefined)?.role;
    if (role !== "admin" && role !== "owner") {
      if (path.startsWith("/api/")) {
        return new Response("Forbidden", { status: 403 });
      }
      return Response.redirect(new URL("/dashboard?error=forbidden", req.nextUrl));
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

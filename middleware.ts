import { auth } from "@/lib/auth";

const PROTECTED = [
  /^\/dashboard(\/|$)/,
  /^\/chat(\/|$)/,
  /^\/billing(\/|$)/,
  /^\/settings(\/|$)/,
  /^\/api\/v1\/ai\//,
  /^\/api\/v1\/stripe\/(create-checkout|create-portal)/,
  /^\/api\/v1\/projects/,
];

export default auth((req) => {
  const isProtected = PROTECTED.some((re) => re.test(req.nextUrl.pathname));
  if (isProtected && !req.auth) {
    const url = new URL("/sign-in", req.nextUrl);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

// Twitter card image reuses the OpenGraph renderer. Next.js reads route
// segment config (notably `runtime`) by static analysis, which doesn't follow
// re-exports — so `runtime` is declared here as a literal and only the
// component + metadata are re-exported.
export const runtime = "edge";
export { default, alt, size, contentType } from "./opengraph-image";

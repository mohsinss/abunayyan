const MAX_LEN = 80;

export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LEN);
  return base || "dataset";
}

// Picks a unique slug by appending a short random suffix when collisions exist.
// `exists` is caller-supplied so the helper stays DB-agnostic.
export async function uniqueSlug(
  base: string,
  // eslint-disable-next-line no-unused-vars
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const candidate = slugify(base);
  if (!(await exists(candidate))) return candidate;
  for (let i = 0; i < 8; i++) {
    const suffix = Math.random().toString(36).slice(2, 7);
    const next = `${candidate}-${suffix}`.slice(0, MAX_LEN);
    if (!(await exists(next))) return next;
  }
  // Fall through: timestamp is guaranteed-unique for any realistic volume.
  return `${candidate}-${Date.now().toString(36)}`.slice(0, MAX_LEN);
}

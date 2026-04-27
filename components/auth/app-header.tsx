"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/auth/user-menu";
import { BrandedHeader } from "@/components/dashboard/branded-header";
import config from "@/config";

import type { UserRole } from "@/db/schema/users";

type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: UserRole;
};

// Routes that should render the gradient BrandedHeader instead of the
// default white app header. Add new entries here when introducing more
// publicly-shareable dashboards.
const BRANDED_ROUTES: { match: RegExp; shareSlug: string }[] = [
  {
    match: /^\/dashboard\/working-capital-ccc(\/|$)/,
    shareSlug: "working-capital-ccc",
  },
  {
    // The DB-backed twin shares the same gradient header so the two
    // routes feel like sibling views of one brief.
    match: /^\/dashboard\/working-capital-data(\/|$)/,
    shareSlug: "working-capital-data",
  },
];

export function AppHeader({ user }: { user: SessionUser }) {
  const pathname = usePathname() ?? "";
  const branded = BRANDED_ROUTES.find((r) => r.match.test(pathname));

  if (branded) {
    return (
      <BrandedHeader
        shareSlug={branded.shareSlug}
        rightSlot={
          <>
            <div className="text-white">
              <ThemeToggle />
            </div>
            <UserMenu user={user} />
          </>
        }
      />
    );
  }

  return (
    <header className="border-b">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-semibold">
            {config.appName}
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground"
            >
              Dashboard
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}

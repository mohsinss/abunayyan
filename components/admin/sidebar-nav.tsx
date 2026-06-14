"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Bot, ScrollText, Settings, LayoutGrid, Wallet, FileSpreadsheet } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  Icon: typeof LayoutGrid;
  exact?: boolean;
};

const ITEMS: readonly NavItem[] = [
  { href: "/admin", label: "Overview", Icon: LayoutGrid, exact: true },
  { href: "/admin/users", label: "Users", Icon: Users },
  { href: "/admin/chatbots", label: "Chatbots", Icon: Bot },
  { href: "/admin/working-capital", label: "Working Capital", Icon: Wallet },
  { href: "/admin/wc-intelligence", label: "WC Intelligence", Icon: FileSpreadsheet },
  { href: "/admin/audit", label: "Audit", Icon: ScrollText },
  { href: "/admin/settings", label: "Settings", Icon: Settings },
];

export function AdminSidebarNav() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 border-r border-neutral-200 bg-neutral-50 lg:block">
      <div className="sticky top-0 flex h-dvh flex-col overflow-y-auto px-4 py-6">
        <Link href="/admin" className="block px-2">
          <div className="text-xs font-semibold uppercase tracking-[2px] text-neutral-500">
            Abunayyan
          </div>
          <div className="mt-1 text-lg font-semibold text-neutral-900">Admin Console</div>
        </Link>

        <nav className="mt-8 flex flex-col gap-1" aria-label="Admin sections">
          {ITEMS.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                <item.Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6">
          <Link
            href="/dashboard"
            className="block rounded-md px-3 py-2 text-xs text-neutral-500 hover:text-neutral-900"
          >
            ← Back to dashboard
          </Link>
        </div>
      </div>
    </aside>
  );
}

import { requireRole } from "@/lib/auth/rbac";
import { AdminSidebarNav } from "@/components/admin/sidebar-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin");
  return (
    <div className="min-h-dvh bg-white text-neutral-900">
      <div className="flex">
        <AdminSidebarNav />
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}

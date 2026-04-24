import { redirect } from "next/navigation";
import { hasRole } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
import { CreateWizard } from "@/components/dashboard/new/create-wizard";

export const metadata = { title: "Create dataset · Dashboard" };

export default async function DashboardNewPage() {
  const user = await requireUser();
  if (!hasRole(user.role, "admin")) {
    redirect("/dashboard?error=forbidden");
  }
  return (
    <div className="px-6 py-10">
      <header className="mx-auto mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Create a new dataset
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload files and let the AI propose a card config. You can edit everything on the
          next page before it lands in the gallery.
        </p>
      </header>
      <CreateWizard />
    </div>
  );
}

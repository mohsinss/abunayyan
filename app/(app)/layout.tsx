import { requireUser } from "@/lib/auth/session";
import { AppHeader } from "@/components/auth/app-header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        }}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}

import { ThemeToggle } from "@/components/theme-toggle";
import { BrandedHeader } from "@/components/dashboard/branded-header";

export default async function PublicShareLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="flex min-h-dvh flex-col">
      <BrandedHeader
        shareSlug={slug}
        rightSlot={
          <div className="text-white">
            <ThemeToggle />
          </div>
        }
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}

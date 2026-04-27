import Link from "next/link";
import { notFound } from "next/navigation";
import { getSbuById } from "@/lib/db/queries/working-capital";
import { SbuForm } from "./sbu-form";

export const dynamic = "force-dynamic";

export default async function AdminWorkingCapitalSbuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sbu = await getSbuById(id);
  if (!sbu) notFound();

  return (
    <div className="space-y-6">
      <Link href="/admin/working-capital" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Working Capital
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">
          {sbu.name} <span className="font-mono text-base text-neutral-500">({sbu.key})</span>
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Update baseline (FY-2025 actuals) and 12-month operational targets. Numeric fields are
          SAR millions for balance-sheet items, days for DIO/DSO/DPO.
        </p>
      </div>
      <SbuForm sbu={sbu} />
    </div>
  );
}

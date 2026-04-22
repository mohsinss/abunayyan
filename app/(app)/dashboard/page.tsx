import { requireUser } from "@/lib/auth/session";
import { DashboardHeader } from "@/components/dashboard/header";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { CompositeRankingSection } from "./sections/01-composite-ranking";
import { PerformanceTableSection } from "./sections/02-performance-table";
import { QuadrantAnalysisSection } from "./sections/03-quadrant-analysis";
import { DistributionSection } from "./sections/04-distribution";
import { CostMatrixSection } from "./sections/05-cost-matrix";
import { DepartmentsSection } from "./sections/06-departments";
import { StrategicReadoutSection } from "./sections/07-strategic-readout";

export const metadata = { title: "SBU Performance Atlas · FY2026" };

export default async function DashboardPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-[1520px] px-8 py-10 lg:px-12">
      <DashboardHeader />
      <KpiStrip />
      <CompositeRankingSection />
      <PerformanceTableSection />
      <QuadrantAnalysisSection />
      <DistributionSection />
      <CostMatrixSection />
      <DepartmentsSection />
      <StrategicReadoutSection />
    </div>
  );
}

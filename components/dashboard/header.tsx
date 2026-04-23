export function DashboardHeader() {
  return (
    <header className="flex flex-col items-start gap-5 border-b border-atlas-ink pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="font-mono text-[10px] font-medium uppercase tracking-[3px] text-atlas-gold">
          Abunayyan Holding · AI Transformation Office
        </div>
        <h1 className="mt-2 font-serif text-[42px] font-medium leading-none tracking-tight text-atlas-ink md:text-[54px]">
          SBU Performance <em className="italic font-normal text-atlas-gold">Atlas</em>
        </h1>
        <p className="mt-3 max-w-[720px] font-serif text-[15px] italic leading-snug text-atlas-ink-2 md:text-[17px]">
          Fiscal 2026 review of shared-services cost allocation, operational efficiency, and strategic
          business unit ranking — calibrated to the Chairman&apos;s three-point directive on working
          capital, high-value fruit, and SBU prioritization.
        </p>
      </div>
      <div className="font-mono text-[10px] leading-[1.8] tracking-[0.5px] text-atlas-ink-3 md:text-right">
        <span className="inline-block border border-atlas-line-2 bg-atlas-bg-2 px-2 py-[2px] text-[9px] uppercase tracking-[1px] text-atlas-gold">
          Confidential
        </span>
        {/* <div className="mt-2">
          Prepared for <strong className="font-semibold text-atlas-ink">Wesam Muhammad</strong>
        </div>
        <div>Distribution: CFO · Strategy · EPMO</div>
        <div>
          Data: SLA Model v2 ·{" "}
          <strong className="font-semibold text-atlas-ink">30-Mar-2026</strong>
        </div>
        <div>
          Universe:{" "}
          <strong className="font-semibold text-atlas-ink">14 operating + 3 excluded</strong>
        </div> */}
      </div>
    </header>
  );
}

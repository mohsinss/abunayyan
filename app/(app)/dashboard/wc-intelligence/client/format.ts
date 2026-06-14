// Number formatting for the WC Intelligence brief. Values are SAR as
// entered in the workbook — no unit scaling is assumed.

export function fmtN(v: number | null): string {
  if (v === null) return "—";
  const sign = v < 0 ? "−" : "";
  const abs = Math.abs(v);
  return (
    sign +
    abs.toLocaleString(undefined, {
      maximumFractionDigits: abs >= 100 ? 0 : 1,
    })
  );
}

export function fmtD(v: number | null): string {
  if (v === null) return "—";
  return `${Math.round(v).toLocaleString()}d`;
}

export function fmtDelta(v: number | null, unit = ""): string {
  if (v === null) return "";
  if (Math.abs(v) < 0.05) return "flat";
  return `${v > 0 ? "+" : "−"}${fmtN(Math.abs(v))}${unit}`;
}

export function fmtPct(v: number | null): string {
  if (v === null) return "—";
  const sign = v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toFixed(1)}%`;
}

export function monthLabel(m: string): string {
  const [y, mm] = m.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(mm) - 1]} ${y!.slice(2)}`;
}

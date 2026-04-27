// Plain serializable types passed from the server component to the
// client island. Drizzle row types include Date objects; we strip those
// and convert to numbers/strings the client can consume directly.

export type GroupRow = {
  fiscalYear: string;
  groupRevenue: number;
  nwcTargetRelease: number;
  notes: string | null;
};

export type SbuRow = {
  key: string;
  name: string;
  shareText: string;
  posture: string;
  inv: number;
  ar: number;
  ca: number;
  ap: number;
  dio: number;
  dso: number;
  dpo: number;
  tInv: number;
  tAr: number;
  tCa: number;
  tAp: number;
  tDio: number;
  tDso: number;
  tDpo: number;
  notes: string[];
};

export type NarrativeRow = {
  slot: string;
  title: string;
  body: string;
};

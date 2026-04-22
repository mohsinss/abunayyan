export type Tier = "strong" | "healthy" | "watch" | "at-risk" | "critical";

export interface Entity {
  id: string;
  name: string;
  isJV: boolean;
  revenue: number;
  opProfit: number;
  opMargin: number;
  slaCost: number;
  slaToRevenue: number;
  slaToOpProfit: number;
  slaToPL: number;
  opProfitPostSla: number;
  plPostSla: number;
  headcount: number;
  revPerEmployee: number;
  slaPerEmployee: number;
  compositeScore: number;
  tier: Tier;
}

export type DeptClassification =
  | "tier1"
  | "tier2"
  | "tier3"
  | "quickwin"
  | "ceo-named"
  | "wc-lever";

export interface Department {
  id: string;
  name: string;
  budget: number;
  recoveredPct: number;
  absorbed: number;
  shareOfOverhead: number;
  costDriver: string;
  classification: DeptClassification;
}

export interface MatrixCell {
  departmentId: string;
  entityId: string;
  amount: number;
}

export interface StrategyCluster {
  id: "rescue" | "scale" | "watch";
  label: string;
  title: string;
  subtitle: string;
  entityIds: string[];
  stats: Array<{ label: string; value: string }>;
  mandate: string;
}

export interface KpiTile {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  emphasis?: "default" | "warn" | "alert";
}

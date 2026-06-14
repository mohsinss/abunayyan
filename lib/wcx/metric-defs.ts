// Canonical metric catalog for the Abunayyan WC Data Collection workbook.
// Every row label of every matrix sheet is registered here with its exact
// Excel label, unit, and aggregation rule. The parser refuses to invent
// metrics: labels that don't match land in the QA report as unknowns.
//
// Aggregation rules are the accuracy backbone:
//   sum — flows (revenue, COGS, cash) add up across months
//   eop — balances (inventory, AR, AP) take the end-of-period value
//   sop — opening balances take the start-of-period value
//   avg — rates / indices / day-counts average across months
//   none — refuse to aggregate (per-month ratios; recompute instead)

export type WcxAgg = "sum" | "eop" | "sop" | "avg" | "none";

export type WcxMetricDef = {
  key: string;
  sheet: string;
  label: string;
  unit: string;
  agg: WcxAgg;
  isCalc?: boolean;
  synonyms?: string[];
};

export const WCX_SHEETS = {
  pl: "2_Monthly_PL",
  bs: "3_Monthly_BS_WC",
  ar: "4_AR_Aging",
  ap: "5_AP_Aging",
  inv: "6_Inventory_Detail",
  drv: "10_Operational_Drivers",
  cf: "11_Cash_Flow",
  macro: "12_Macro_External",
  budget: "14_Targets_Plan",
} as const;

type Opt = { isCalc?: boolean; synonyms?: string[] };
function m(
  key: string,
  sheet: string,
  label: string,
  unit: string,
  agg: WcxAgg,
  opt?: Opt,
): WcxMetricDef {
  return { key, sheet, label, unit, agg, ...opt };
}

const S = WCX_SHEETS;

// prettier-ignore
export const WCX_METRIC_DEFS: WcxMetricDef[] = [
  // ── Sheet 2: Monthly P&L ──────────────────────────────────────────────
  m("pl.revenue_invoiced", S.pl, "Revenue — Invoiced (SAR)", "SAR", "sum", { synonyms: ["revenue", "sales", "invoiced revenue", "turnover"] }),
  m("pl.revenue_booked", S.pl, "Revenue — Booked / Contracted (SAR)", "SAR", "sum", { synonyms: ["booked revenue", "contracted revenue", "bookings"] }),
  m("pl.revenue_govt", S.pl, "Revenue — Government / Semi-Govt (SAR)", "SAR", "sum", { synonyms: ["government revenue"] }),
  m("pl.revenue_private", S.pl, "Revenue — Private (SAR)", "SAR", "sum", { synonyms: ["private revenue"] }),
  m("pl.revenue_export", S.pl, "Revenue — Export (SAR)", "SAR", "sum", { synonyms: ["export revenue"] }),
  m("pl.cogs_materials", S.pl, "COGS — Materials (SAR)", "SAR", "sum", { synonyms: ["materials cost"] }),
  m("pl.cogs_labor", S.pl, "COGS — Direct Labor (SAR)", "SAR", "sum", { synonyms: ["direct labor", "labour cost"] }),
  m("pl.cogs_overhead", S.pl, "COGS — Direct Overhead (SAR)", "SAR", "sum", { synonyms: ["direct overhead"] }),
  m("pl.cogs_subcontracted", S.pl, "COGS — Subcontracted (SAR)", "SAR", "sum", { synonyms: ["subcontract cost"] }),
  m("pl.cogs_total", S.pl, "COGS — Total (SAR)", "SAR", "sum", { synonyms: ["cogs", "cost of goods sold", "cost of sales"] }),
  m("pl.gross_margin_pct", S.pl, "Gross Margin % (calc)", "%", "none", { isCalc: true, synonyms: ["gross margin", "gm%"] }),
  m("pl.opex_sm", S.pl, "OPEX — S&M (SAR)", "SAR", "sum", { synonyms: ["sales and marketing opex"] }),
  m("pl.opex_ga", S.pl, "OPEX — G&A (SAR)", "SAR", "sum", { synonyms: ["general and admin opex", "g&a"] }),
  m("pl.opex_rd", S.pl, "OPEX — R&D (SAR)", "SAR", "sum", { synonyms: ["r&d opex"] }),
  m("pl.da", S.pl, "D&A (SAR)", "SAR", "sum", { synonyms: ["depreciation", "amortization", "depreciation and amortization"] }),
  m("pl.interest_expense", S.pl, "Interest Expense (SAR)", "SAR", "sum", { synonyms: ["finance cost"] }),
  m("pl.fx_gain_loss", S.pl, "FX Gain/(Loss) (SAR)", "SAR", "sum", { synonyms: ["fx gain", "fx loss", "foreign exchange"] }),
  m("pl.tax_zakat", S.pl, "Tax & Zakat (SAR)", "SAR", "sum", { synonyms: ["zakat", "tax"] }),
  m("pl.net_income", S.pl, "Net Income (SAR)", "SAR", "sum", { synonyms: ["net profit", "profit", "bottom line", "earnings"] }),

  // ── Sheet 3: Monthly Balance Sheet WC items ───────────────────────────
  m("bs.inventory_net", S.bs, "Inventory — Total Net (SAR)", "SAR", "eop", { synonyms: ["inventory", "stock", "net inventory"] }),
  m("bs.trade_receivables", S.bs, "Trade Receivables — Net (SAR)", "SAR", "eop", { synonyms: ["receivables", "ar", "accounts receivable", "trade debtors"] }),
  m("bs.contract_assets", S.bs, "Contract Assets / Unbilled Revenue — Net (SAR)", "SAR", "eop", { synonyms: ["contract assets", "unbilled revenue", "wip receivable"] }),
  m("bs.retention_receivable", S.bs, "Retention Receivable (SAR)", "SAR", "eop", { synonyms: ["retention held by customers"] }),
  m("bs.advances_paid", S.bs, "Advances Paid to Suppliers (SAR)", "SAR", "eop", { synonyms: ["supplier advances", "prepayments to vendors"] }),
  m("bs.trade_payables", S.bs, "Trade Payables (SAR)", "SAR", "eop", { synonyms: ["payables", "ap", "accounts payable", "trade creditors"] }),
  m("bs.accrued_expenses", S.bs, "Accrued Expenses (SAR)", "SAR", "eop", { synonyms: ["accruals"] }),
  m("bs.retention_payable", S.bs, "Retention Payable (SAR)", "SAR", "eop", { synonyms: ["retention owed to vendors"] }),
  m("bs.related_party_payables", S.bs, "Related-Party Payables (SAR)", "SAR", "eop", { synonyms: ["intercompany payables"] }),
  m("bs.advances_received", S.bs, "Advances Received from Customers (SAR)", "SAR", "eop", { synonyms: ["customer advances", "down payments received"] }),
  m("bs.contract_liabilities", S.bs, "Contract Liabilities (SAR)", "SAR", "eop", { synonyms: ["deferred revenue"] }),
  m("bs.nwc_calc", S.bs, "NWC (calc, SAR)", "SAR", "eop", { isCalc: true, synonyms: ["nwc as reported", "net working capital cell"] }),

  // ── Sheet 4: AR Aging ─────────────────────────────────────────────────
  m("ar.bucket_current", S.ar, "Current (not yet due) (SAR)", "SAR", "eop", { synonyms: ["ar current bucket", "receivables not yet due"] }),
  m("ar.bucket_1_30", S.ar, "1-30 days past due (SAR)", "SAR", "eop", { synonyms: ["ar 1-30"] }),
  m("ar.bucket_31_60", S.ar, "31-60 days past due (SAR)", "SAR", "eop", { synonyms: ["ar 31-60"] }),
  m("ar.bucket_61_90", S.ar, "61-90 days past due (SAR)", "SAR", "eop", { synonyms: ["ar 61-90"] }),
  m("ar.bucket_91_180", S.ar, "91-180 days past due (SAR)", "SAR", "eop", { synonyms: ["ar 91-180"] }),
  m("ar.bucket_180_plus", S.ar, "180+ days past due (SAR)", "SAR", "eop", { synonyms: ["ar 180+", "overdue receivables 180"] }),
  m("ar.total_calc", S.ar, "Total AR (calc) (SAR)", "SAR", "eop", { isCalc: true, synonyms: ["total ar", "gross receivables"] }),
  m("ar.provision", S.ar, "Provision for Doubtful Debts (SAR)", "SAR", "eop", { synonyms: ["bad debt provision", "doubtful debts"] }),
  m("ar.net_calc", S.ar, "AR Net of Provision (calc) (SAR)", "SAR", "eop", { isCalc: true, synonyms: ["ar net of provision"] }),
  m("ar.recon_calc", S.ar, "Reconciliation vs Sheet 3 (calc)", "SAR", "none", { isCalc: true }),
  m("ar.disputed", S.ar, "Disputed AR (subset, SAR)", "SAR", "eop", { synonyms: ["disputed receivables"] }),
  m("ar.government", S.ar, "Government Receivables (subset, SAR)", "SAR", "eop", { synonyms: ["government ar"] }),
  m("ar.top5_concentration_pct", S.ar, "Top-5 Customer AR Concentration % (calc)", "%", "none", { isCalc: true, synonyms: ["ar concentration"] }),

  // ── Sheet 5: AP Aging ─────────────────────────────────────────────────
  m("ap.bucket_current", S.ap, "Current (not yet due) (SAR)", "SAR", "eop", { synonyms: ["ap current bucket", "payables not yet due"] }),
  m("ap.bucket_1_30", S.ap, "1-30 days past due (SAR)", "SAR", "eop", { synonyms: ["ap 1-30"] }),
  m("ap.bucket_31_60", S.ap, "31-60 days past due (SAR)", "SAR", "eop", { synonyms: ["ap 31-60"] }),
  m("ap.bucket_61_90", S.ap, "61-90 days past due (SAR)", "SAR", "eop", { synonyms: ["ap 61-90"] }),
  m("ap.bucket_91_180", S.ap, "91-180 days past due (SAR)", "SAR", "eop", { synonyms: ["ap 91-180"] }),
  m("ap.bucket_180_plus", S.ap, "180+ days past due (SAR)", "SAR", "eop", { synonyms: ["ap 180+", "overdue payables 180"] }),
  m("ap.total_calc", S.ap, "Total AP (calc) (SAR)", "SAR", "eop", { isCalc: true, synonyms: ["total ap", "gross payables"] }),
  m("ap.recon_calc", S.ap, "Reconciliation vs Sheet 3 (calc)", "SAR", "none", { isCalc: true }),
  m("ap.strategic_vendor", S.ap, "Strategic / Sole-Source Vendor AP (subset, SAR)", "SAR", "eop", { synonyms: ["strategic vendor payables"] }),
  m("ap.related_party", S.ap, "Related-Party AP (subset, SAR)", "SAR", "eop", { synonyms: ["related party payables aging"] }),
  m("ap.discount_captured", S.ap, "Early Payment Discount Captured (SAR)", "SAR", "sum", { synonyms: ["discounts captured"] }),
  m("ap.discount_forgone", S.ap, "Early Payment Discount Forgone (SAR)", "SAR", "sum", { synonyms: ["discounts forgone", "missed discounts"] }),
  m("ap.terms_agreed_days", S.ap, "Weighted Average Payment Terms — Agreed (days)", "days", "avg", { synonyms: ["agreed payment terms"] }),
  m("ap.terms_actual_days", S.ap, "Weighted Average Payment Terms — Actual (days)", "days", "avg", { synonyms: ["actual payment days"] }),
  m("ap.term_compliance_pct", S.ap, "Payment Term Compliance Rate %", "%", "avg", { synonyms: ["payment compliance"] }),

  // ── Sheet 6: Inventory Detail ─────────────────────────────────────────
  m("inv.raw_materials", S.inv, "Raw Materials (SAR)", "SAR", "eop", { synonyms: ["raw material inventory"] }),
  m("inv.wip", S.inv, "Work-in-Progress (SAR)", "SAR", "eop", { synonyms: ["wip inventory", "work in progress"] }),
  m("inv.finished_goods", S.inv, "Finished Goods (SAR)", "SAR", "eop", { synonyms: ["fg inventory"] }),
  m("inv.spare_parts", S.inv, "Spare Parts (SAR)", "SAR", "eop", { synonyms: ["spares inventory"] }),
  m("inv.goods_in_transit", S.inv, "Goods in Transit (SAR)", "SAR", "eop", { synonyms: ["in-transit inventory"] }),
  m("inv.total_gross_calc", S.inv, "Total Gross Inventory (calc) (SAR)", "SAR", "eop", { isCalc: true, synonyms: ["gross inventory"] }),
  m("inv.aging_0_90", S.inv, "Aging 0-90 days (SAR)", "SAR", "eop", { synonyms: ["inventory 0-90"] }),
  m("inv.aging_91_180", S.inv, "Aging 91-180 days (SAR)", "SAR", "eop", { synonyms: ["inventory 91-180"] }),
  m("inv.aging_181_365", S.inv, "Aging 181-365 days (SAR)", "SAR", "eop", { synonyms: ["inventory 181-365"] }),
  m("inv.aging_365_plus", S.inv, "Aging 365+ days (SAR)", "SAR", "eop", { synonyms: ["inventory over a year", "inventory 365+"] }),
  m("inv.aging_total_calc", S.inv, "Aging Total (calc) (SAR)", "SAR", "eop", { isCalc: true }),
  m("inv.obsolescence_provision", S.inv, "Obsolescence Provision (SAR)", "SAR", "eop", { synonyms: ["obsolete stock provision"] }),
  m("inv.net_calc", S.inv, "Net Inventory (calc) (SAR)", "SAR", "eop", { isCalc: true }),
  m("inv.recon_calc", S.inv, "Reconciliation vs Sheet 3 (calc)", "SAR", "none", { isCalc: true }),
  m("inv.stockouts_count", S.inv, "Stockouts — Count of Incidents", "count", "sum", { synonyms: ["stockouts"] }),
  m("inv.dos_a_class", S.inv, "A-Class SKU Days of Supply (days)", "days", "avg", { synonyms: ["a class days of supply"] }),
  m("inv.dos_b_class", S.inv, "B-Class SKU Days of Supply (days)", "days", "avg", { synonyms: ["b class days of supply"] }),
  m("inv.dos_c_class", S.inv, "C-Class SKU Days of Supply (days)", "days", "avg", { synonyms: ["c class days of supply"] }),
  m("inv.forecast_mape_pct", S.inv, "Forecast Accuracy MAPE %", "%", "avg", { synonyms: ["inventory forecast accuracy"] }),

  // ── Sheet 10: Operational Drivers ─────────────────────────────────────
  m("drv.order_intake", S.drv, "Order Intake (SAR)", "SAR", "sum", { synonyms: ["orders received", "new orders"] }),
  m("drv.order_backlog", S.drv, "Order Backlog End-of-Month (SAR)", "SAR", "eop", { synonyms: ["backlog"] }),
  m("drv.book_to_bill_calc", S.drv, "Book-to-Bill Ratio (calc)", "x", "none", { isCalc: true, synonyms: ["book to bill"] }),
  m("drv.quote_to_cash_days", S.drv, "Quote-to-Cash Cycle Time (days, avg)", "days", "avg", { synonyms: ["quote to cash"] }),
  m("drv.invoice_lag_days", S.drv, "Invoice Issuance Lag (days, avg from job complete)", "days", "avg", { synonyms: ["invoicing lag"] }),
  m("drv.dispute_count", S.drv, "Dispute Volume (count)", "count", "sum", { synonyms: ["disputes"] }),
  m("drv.credit_notes", S.drv, "Credit Notes Issued (SAR)", "SAR", "sum", { synonyms: ["credit notes"] }),
  m("drv.cei_pct", S.drv, "Collection Effectiveness Index (CEI %)", "%", "avg", { synonyms: ["cei", "collection effectiveness"] }),
  m("drv.new_customers", S.drv, "New Customers Acquired (count)", "count", "sum", { synonyms: ["customer acquisition"] }),
  m("drv.customer_churn", S.drv, "Customer Churn (count)", "count", "sum", { synonyms: ["churned customers"] }),
  m("drv.po_to_payment_days", S.drv, "PO-to-Payment Cycle Time (days, avg)", "days", "avg", { synonyms: ["po to payment"] }),
  m("drv.discount_capture_pct", S.drv, "Early Payment Discount Capture Rate (%)", "%", "avg", { synonyms: ["discount capture"] }),
  m("drv.term_compliance_pct", S.drv, "Payment Term Compliance Rate (%)", "%", "avg", { synonyms: ["term compliance driver"] }),
  m("drv.vendor_lead_days", S.drv, "Avg Vendor Lead Time (days)", "days", "avg", { synonyms: ["vendor lead time"] }),
  m("drv.vendor_stockouts", S.drv, "Stockout Incidents from Vendor Delay (count)", "count", "sum", { synonyms: ["vendor delay stockouts"] }),
  m("drv.stock_turn", S.drv, "Stock Turn Annualized (×)", "x", "avg", { synonyms: ["inventory turns", "stock turn"] }),
  m("drv.dos_a_days", S.drv, "Days of Supply A-Class SKUs (days)", "days", "avg"),
  m("drv.dos_b_days", S.drv, "Days of Supply B-Class SKUs (days)", "days", "avg"),
  m("drv.dos_c_days", S.drv, "Days of Supply C-Class SKUs (days)", "days", "avg"),
  m("drv.forecast_mape_pct", S.drv, "Forecast Accuracy MAPE (%)", "%", "avg"),
  m("drv.slow_moving_provisions", S.drv, "Slow-Moving Inventory Provisions (SAR)", "SAR", "eop", { synonyms: ["slow moving provisions"] }),
  m("drv.flag_collection_campaign", S.drv, "Collection Campaign Active? (1/0)", "flag", "sum", { synonyms: ["collection campaign"] }),
  m("drv.flag_terms_renegotiation", S.drv, "Payment Terms Renegotiation? (1/0)", "flag", "sum", { synonyms: ["terms renegotiation"] }),
  m("drv.flag_inventory_writeoff", S.drv, "Inventory Write-Off Event? (1/0)", "flag", "sum", { synonyms: ["inventory write-off"] }),
  m("drv.flag_milestone_bill", S.drv, "Major Project Milestone Bill? (1/0)", "flag", "sum", { synonyms: ["milestone billing"] }),
  m("drv.flag_cash_squeeze", S.drv, "Period of Cash Squeeze (Group-Level)? (1/0)", "flag", "sum", { synonyms: ["cash squeeze"] }),

  // ── Sheet 11: Direct Cash Flow ────────────────────────────────────────
  m("cf.collections", S.cf, "Cash Collected from Customers (SAR)", "SAR", "sum", { synonyms: ["collections", "cash collected"] }),
  m("cf.supplier_payments", S.cf, "Cash Paid to Suppliers (SAR)", "SAR", "sum", { synonyms: ["supplier payments"] }),
  m("cf.payroll", S.cf, "Cash Paid for Salaries & Wages (SAR)", "SAR", "sum", { synonyms: ["payroll", "salaries"] }),
  m("cf.opex", S.cf, "Cash Paid for OPEX (SAR)", "SAR", "sum", { synonyms: ["opex cash"] }),
  m("cf.tax_zakat", S.cf, "Cash Paid for Tax & Zakat (SAR)", "SAR", "sum", { synonyms: ["tax paid", "zakat paid"] }),
  m("cf.interest", S.cf, "Cash Paid for Interest (SAR)", "SAR", "sum", { synonyms: ["interest paid"] }),
  m("cf.other_operating", S.cf, "Other Operating CF (SAR)", "SAR", "sum", { synonyms: ["other operating cash flow"] }),
  m("cf.ocf_calc", S.cf, "Operating Cash Flow (calc) (SAR)", "SAR", "sum", { isCalc: true, synonyms: ["ocf", "operating cash flow"] }),
  m("cf.capex_maintenance", S.cf, "Capex — Maintenance (SAR)", "SAR", "sum", { synonyms: ["maintenance capex"] }),
  m("cf.capex_growth", S.cf, "Capex — Growth (SAR)", "SAR", "sum", { synonyms: ["growth capex"] }),
  m("cf.disposals", S.cf, "Disposals (SAR)", "SAR", "sum", { synonyms: ["asset disposals"] }),
  m("cf.icf_calc", S.cf, "Investing Cash Flow (calc) (SAR)", "SAR", "sum", { isCalc: true, synonyms: ["icf", "investing cash flow"] }),
  m("cf.fcf_calc", S.cf, "Free Cash Flow (calc) (SAR)", "SAR", "sum", { isCalc: true, synonyms: ["fcf", "free cash flow"] }),
  m("cf.debt_drawn", S.cf, "Debt Drawn (SAR)", "SAR", "sum", { synonyms: ["new borrowings"] }),
  m("cf.debt_repaid", S.cf, "Debt Repaid (SAR)", "SAR", "sum", { synonyms: ["debt repayment"] }),
  m("cf.intersbu_received", S.cf, "Inter-SBU Funding Received (SAR)", "SAR", "sum", { synonyms: ["intercompany funding received"] }),
  m("cf.intersbu_paid", S.cf, "Inter-SBU Funding Paid (SAR)", "SAR", "sum", { synonyms: ["intercompany funding paid"] }),
  m("cf.dividends_to_group", S.cf, "Dividends Paid to Group (SAR)", "SAR", "sum", { synonyms: ["dividends"] }),
  m("cf.net_change_calc", S.cf, "Net Change in Cash (calc) (SAR)", "SAR", "sum", { isCalc: true, synonyms: ["net cash change"] }),
  m("cf.opening_cash", S.cf, "Opening Cash Balance (SAR)", "SAR", "sop", { synonyms: ["opening cash"] }),
  m("cf.closing_cash", S.cf, "Closing Cash Balance (SAR)", "SAR", "eop", { synonyms: ["closing cash", "cash balance", "cash position"] }),
  m("cf.drawn_debt", S.cf, "Drawn Debt End-of-Month (SAR)", "SAR", "eop", { synonyms: ["drawn debt", "outstanding debt"] }),
  m("cf.available_facility", S.cf, "Available Debt Facility (SAR)", "SAR", "eop", { synonyms: ["undrawn facility", "available facility", "headroom"] }),

  // ── Sheet 12: Macro & External (GROUP level) ──────────────────────────
  m("macro.working_days", S.macro, "Working Days in Month", "days", "sum"),
  m("macro.ramadan_days", S.macro, "Ramadan Days in Month", "days", "sum", { synonyms: ["ramadan"] }),
  m("macro.flag_hajj", S.macro, "Hajj Period Active? (1/0)", "flag", "sum", { synonyms: ["hajj"] }),
  m("macro.flag_national_day", S.macro, "Saudi National Day Effect Month? (1/0)", "flag", "sum"),
  m("macro.flag_govt_yearend", S.macro, "Govt Fiscal Year-End Pressure (Q4)? (1/0)", "flag", "sum"),
  m("macro.fx_usd", S.macro, "SAR/USD Avg Rate", "rate", "avg", { synonyms: ["usd rate", "dollar rate"] }),
  m("macro.fx_eur", S.macro, "SAR/EUR Avg Rate", "rate", "avg", { synonyms: ["euro rate"] }),
  m("macro.fx_cny", S.macro, "SAR/CNY Avg Rate", "rate", "avg", { synonyms: ["yuan rate"] }),
  m("macro.saibor_3m_pct", S.macro, "3M SAIBOR Avg %", "%", "avg", { synonyms: ["saibor 3m"] }),
  m("macro.saibor_12m_pct", S.macro, "12M SAIBOR Avg %", "%", "avg", { synonyms: ["saibor 12m"] }),
  m("macro.steel_price", S.macro, "Steel Price Index (SAR/ton, avg)", "index", "avg", { synonyms: ["steel price"] }),
  m("macro.copper_price", S.macro, "Copper Price Index (SAR/ton, avg)", "index", "avg", { synonyms: ["copper price"] }),
  m("macro.polymer_price", S.macro, "Polymer Price Index (SAR/ton, avg)", "index", "avg", { synonyms: ["polymer price"] }),
  m("macro.brent_price", S.macro, "Brent Crude Price (USD/bbl, avg)", "USD", "avg", { synonyms: ["brent", "oil price"] }),
  m("macro.henry_hub", S.macro, "Henry Hub Gas (USD/MMBtu, avg)", "USD", "avg", { synonyms: ["gas price"] }),
  m("macro.construction_pmi", S.macro, "Saudi Construction PMI", "index", "avg", { synonyms: ["construction pmi"] }),
  m("macro.manufacturing_pmi", S.macro, "Saudi Manufacturing PMI", "index", "avg", { synonyms: ["manufacturing pmi"] }),
  m("macro.flag_water_tariff", S.macro, "Water Tariff Reset Event? (1/0)", "flag", "sum"),
  m("macro.flag_power_auction", S.macro, "Power Capacity Auction Active? (1/0)", "flag", "sum"),
  m("macro.awards_swpc", S.macro, "SWPC Awards (count)", "count", "sum", { synonyms: ["swpc awards"] }),
  m("macro.awards_nwc", S.macro, "NWC Awards (count)", "count", "sum", { synonyms: ["nwc awards"] }),
  m("macro.awards_sec", S.macro, "SEC Awards (count)", "count", "sum", { synonyms: ["sec awards"] }),
  m("macro.awards_aramco", S.macro, "Aramco Awards (count)", "count", "sum", { synonyms: ["aramco awards"] }),
  m("macro.awards_maaden", S.macro, "Ma'aden Awards (count)", "count", "sum", { synonyms: ["maaden awards"] }),
  m("macro.awards_neom", S.macro, "NEOM Awards (count)", "count", "sum", { synonyms: ["neom awards"] }),
  m("macro.awards_diriyah", S.macro, "Diriyah Awards (count)", "count", "sum", { synonyms: ["diriyah awards"] }),
  m("macro.awards_red_sea", S.macro, "Red Sea Awards (count)", "count", "sum", { synonyms: ["red sea awards"] }),
  m("macro.awards_qiddiya", S.macro, "Qiddiya Awards (count)", "count", "sum", { synonyms: ["qiddiya awards"] }),
  m("macro.awards_other", S.macro, "Other Mega-Project Awards (count)", "count", "sum", { synonyms: ["other awards"] }),

  // ── Sheet 14: FY-26 monthly budget block ──────────────────────────────
  m("budget.revenue", S.budget, "Revenue (SAR)", "SAR", "sum", { synonyms: ["budget revenue", "budgeted revenue"] }),
  m("budget.cogs", S.budget, "COGS (SAR)", "SAR", "sum", { synonyms: ["budget cogs"] }),
  m("budget.inventory_eop", S.budget, "Inventory EOP (SAR)", "SAR", "eop", { synonyms: ["budget inventory"] }),
  m("budget.ar_eop", S.budget, "AR EOP (SAR)", "SAR", "eop", { synonyms: ["budget ar"] }),
  m("budget.ap_eop", S.budget, "AP EOP (SAR)", "SAR", "eop", { synonyms: ["budget ap"] }),
  m("budget.ocf", S.budget, "Operating CF (SAR)", "SAR", "sum", { synonyms: ["budget operating cash flow"] }),
  m("budget.capex", S.budget, "Capex (SAR)", "SAR", "sum", { synonyms: ["budget capex"] }),
];

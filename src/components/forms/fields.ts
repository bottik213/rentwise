import type { PropertyInputs } from "@/lib/finance/types";

export type NumericKey = {
  [K in keyof PropertyInputs]-?: PropertyInputs[K] extends number ? K : never;
}[keyof PropertyInputs];

export interface FieldDef {
  key: NumericKey;
  label: string;
  /** money: user types dollars, engine gets cents. rate: user types %, engine gets a fraction. */
  kind: "money" | "rate" | "years";
  suffix?: string;
  help: string;
  min: number;
  max: number;
  /** Show the assumption-source picker. */
  source?: true;
}

export const FIELDS: Record<Exclude<NumericKey, "closingCostValue">, FieldDef> = {
  purchasePrice: { key: "purchasePrice", label: "Purchase price", kind: "money", help: "Asking or expected price.", min: 1000, max: 100_000_000, source: true },
  monthlyRent: { key: "monthlyRent", label: "Scheduled rent", kind: "money", suffix: "/mo", help: "Full monthly rent, before vacancy.", min: 0, max: 1_000_000, source: true },
  otherMonthlyIncome: { key: "otherMonthlyIncome", label: "Other income", kind: "money", suffix: "/mo", help: "Parking, laundry, pet fees. Security deposits are not income.", min: 0, max: 1_000_000 },
  downPaymentPct: { key: "downPaymentPct", label: "Down payment", kind: "rate", suffix: "% of price", help: "Share of the price paid in cash at purchase.", min: 0, max: 100 },
  annualInterestRate: { key: "annualInterestRate", label: "Interest rate", kind: "rate", suffix: "%/yr", help: "Annual mortgage rate, fixed for the full term.", min: 0, max: 30, source: true },
  loanTermYears: { key: "loanTermYears", label: "Loan term", kind: "years", suffix: "years", help: "Fully amortizing term.", min: 1, max: 40 },
  initialRepairs: { key: "initialRepairs", label: "Initial repairs", kind: "money", help: "Work needed before the first tenant.", min: 0, max: 10_000_000, source: true },
  initialReserve: { key: "initialReserve", label: "Cash reserve", kind: "money", help: "Cash set aside at purchase. Counts as invested, never as an expense.", min: 0, max: 10_000_000 },
  annualPropertyTax: { key: "annualPropertyTax", label: "Property tax", kind: "money", suffix: "/yr", help: "Check the county record; it often resets after a sale.", min: 0, max: 10_000_000, source: true },
  annualInsurance: { key: "annualInsurance", label: "Insurance", kind: "money", suffix: "/yr", help: "Landlord (dwelling) policy, not homeowner's.", min: 0, max: 10_000_000, source: true },
  monthlyHoa: { key: "monthlyHoa", label: "HOA", kind: "money", suffix: "/mo", help: "Association dues, if any.", min: 0, max: 1_000_000, source: true },
  monthlyUtilities: { key: "monthlyUtilities", label: "Utilities you pay", kind: "money", suffix: "/mo", help: "Only what the landlord pays (often water, trash).", min: 0, max: 1_000_000, source: true },
  otherMonthlyFixed: { key: "otherMonthlyFixed", label: "Other fixed costs", kind: "money", suffix: "/mo", help: "Lawn, snow, software, licensing.", min: 0, max: 1_000_000 },
  vacancyPct: { key: "vacancyPct", label: "Vacancy", kind: "rate", suffix: "% of rent", help: "5% ≈ 2.5 weeks empty a year.", min: 0, max: 100, source: true },
  maintenancePct: { key: "maintenancePct", label: "Maintenance", kind: "rate", suffix: "% of rent", help: "Routine repairs and upkeep.", min: 0, max: 100, source: true },
  managementPct: { key: "managementPct", label: "Management", kind: "rate", suffix: "% of collected rent", help: "Property manager fee; 0% if you self-manage.", min: 0, max: 100, source: true },
  capexPct: { key: "capexPct", label: "CapEx reserve", kind: "rate", suffix: "% of rent", help: "Saved for roof, HVAC, water heater. Planned, not spent.", min: 0, max: 100, source: true },
};

export const GROUPS: { title: string; keys: (keyof typeof FIELDS)[] }[] = [
  { title: "Property", keys: ["purchasePrice", "monthlyRent", "otherMonthlyIncome"] },
  { title: "Financing", keys: ["downPaymentPct", "annualInterestRate", "loanTermYears"] },
  { title: "Acquisition", keys: ["initialRepairs", "initialReserve"] },
  { title: "Recurring costs", keys: ["annualPropertyTax", "annualInsurance", "monthlyHoa", "monthlyUtilities", "otherMonthlyFixed"] },
  { title: "Variable costs", keys: ["vacancyPct", "maintenancePct", "managementPct", "capexPct"] },
];

/** Illustrative starting assumptions for a new property. Labeled as assumptions in the UI. */
export const NEW_PROPERTY_DEFAULTS: Partial<PropertyInputs> = {
  otherMonthlyIncome: 0,
  allCash: false,
  downPaymentPct: 0.25,
  annualInterestRate: 0.07,
  loanTermYears: 30,
  closingCostMode: "percent",
  closingCostValue: 0.03,
  initialRepairs: 0,
  initialReserve: 0,
  monthlyHoa: 0,
  monthlyUtilities: 0,
  otherMonthlyFixed: 0,
  vacancyPct: 0.05,
  maintenancePct: 0.08,
  managementPct: 0.08,
  capexPct: 0.05,
};

export const toDisplay = (kind: FieldDef["kind"], v: number): string =>
  kind === "money" ? String(v / 100) : kind === "rate" ? String(Number((v * 100).toFixed(4))) : String(v);

export const toEngine = (kind: FieldDef["kind"], v: number): number =>
  kind === "money" ? Math.round(v * 100) : kind === "rate" ? v / 100 : v;

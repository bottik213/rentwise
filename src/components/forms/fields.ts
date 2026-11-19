import type { PropertyInputs } from "@/lib/finance/types";
import type { Dict } from "@/i18n/en";

export type NumericKey = {
  [K in keyof PropertyInputs]-?: PropertyInputs[K] extends number ? K : never;
}[keyof PropertyInputs];
export type FieldKey = Exclude<NumericKey, "closingCostValue">;

export interface FieldDef {
  key: NumericKey;
  label: string;
  /** money: user types tenge, engine gets tiyn. rate: user types %, engine gets a fraction. number: as typed. */
  kind: "money" | "rate" | "years" | "number";
  suffix?: string;
  help: string;
  min: number;
  max: number;
  /** Show the assumption-source picker. */
  source?: true;
}

type Shape = Omit<FieldDef, "label" | "help" | "suffix">;
/** The numbers behind each field; the words come from the dictionary (`fieldDef`). */
export const FIELDS: Record<FieldKey, Shape> = {
  purchasePrice: { key: "purchasePrice", kind: "money", min: 1000, max: 100_000_000, source: true },
  monthlyRent: { key: "monthlyRent", kind: "money", min: 0, max: 1_000_000, source: true },
  otherMonthlyIncome: { key: "otherMonthlyIncome", kind: "money", min: 0, max: 1_000_000 },
  downPaymentPct: { key: "downPaymentPct", kind: "rate", min: 0, max: 100 },
  annualInterestRate: { key: "annualInterestRate", kind: "rate", min: 0, max: 30, source: true },
  loanTermYears: { key: "loanTermYears", kind: "years", min: 1, max: 40 },
  initialRepairs: { key: "initialRepairs", kind: "money", min: 0, max: 10_000_000, source: true },
  initialReserve: { key: "initialReserve", kind: "money", min: 0, max: 10_000_000 },
  annualPropertyTax: { key: "annualPropertyTax", kind: "money", min: 0, max: 10_000_000, source: true },
  annualInsurance: { key: "annualInsurance", kind: "money", min: 0, max: 10_000_000, source: true },
  monthlyHoa: { key: "monthlyHoa", kind: "money", min: 0, max: 1_000_000, source: true },
  monthlyUtilities: { key: "monthlyUtilities", kind: "money", min: 0, max: 1_000_000, source: true },
  otherMonthlyFixed: { key: "otherMonthlyFixed", kind: "money", min: 0, max: 1_000_000 },
  vacancyPct: { key: "vacancyPct", kind: "rate", min: 0, max: 100, source: true },
  maintenancePct: { key: "maintenancePct", kind: "rate", min: 0, max: 100, source: true },
  managementPct: { key: "managementPct", kind: "rate", min: 0, max: 100, source: true },
  capexPct: { key: "capexPct", kind: "rate", min: 0, max: 100, source: true },
};

export const fieldDef = (t: Dict, k: FieldKey): FieldDef => ({ ...FIELDS[k], ...t.fields[k] });

/** Closing costs sit in Property right after the price; the form inserts that field itself (it has a % / ₸ switch). */
export const GROUPS: { id: keyof Dict["groups"]; keys: FieldKey[] }[] = [
  { id: "property", keys: ["purchasePrice", "initialRepairs"] },
  { id: "income", keys: ["monthlyRent", "otherMonthlyIncome", "vacancyPct"] },
  { id: "loan", keys: ["downPaymentPct", "annualInterestRate", "loanTermYears"] },
  { id: "operating", keys: ["annualPropertyTax", "annualInsurance", "monthlyHoa", "monthlyUtilities", "otherMonthlyFixed", "maintenancePct", "managementPct"] },
  { id: "reserves", keys: ["capexPct", "initialReserve"] },
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

/** The closing-cost field definition depends on its % / ₸ mode. */
export const closingDef = (t: Dict, pct: boolean): Pick<FieldDef, "label" | "kind" | "suffix" | "help" | "min" | "max"> =>
  pct ? { ...t.fields.closingPct, kind: "rate", min: 0, max: 20 } : { ...t.fields.closingAmount, kind: "money", min: 0, max: 10_000_000 };

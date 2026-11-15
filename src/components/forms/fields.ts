import type { PropertyInputs } from "@/lib/finance/types";

export type NumericKey = {
  [K in keyof PropertyInputs]-?: PropertyInputs[K] extends number ? K : never;
}[keyof PropertyInputs];

export interface FieldDef {
  key: NumericKey;
  label: string;
  /** money: user types dollars, engine gets cents. rate: user types %, engine gets a fraction. number: as typed. */
  kind: "money" | "rate" | "years" | "number";
  suffix?: string;
  help: string;
  min: number;
  max: number;
  /** Show the assumption-source picker. */
  source?: true;
}

export const FIELDS: Record<Exclude<NumericKey, "closingCostValue">, FieldDef> = {
  purchasePrice: { key: "purchasePrice", label: "Purchase price", kind: "money", help: "The price you expect to pay. Start with the asking price.", min: 1000, max: 100_000_000, source: true },
  monthlyRent: { key: "monthlyRent", label: "Scheduled rent", kind: "money", suffix: "/mo", help: "Full monthly rent before any empty months. Compare 3 to 5 similar rentals nearby.", min: 0, max: 1_000_000, source: true },
  otherMonthlyIncome: { key: "otherMonthlyIncome", label: "Other income", kind: "money", suffix: "/mo", help: "Parking, laundry or pet fees. Security deposits are not income.", min: 0, max: 1_000_000 },
  downPaymentPct: { key: "downPaymentPct", label: "Down payment", kind: "rate", suffix: "% of price", help: "Share of the price you pay in cash. Investment loans usually need 20 to 25%.", min: 0, max: 100 },
  annualInterestRate: { key: "annualInterestRate", label: "Interest rate", kind: "rate", suffix: "%/yr", help: "Yearly mortgage rate, fixed for the whole loan. A lender quote beats a guess.", min: 0, max: 30, source: true },
  loanTermYears: { key: "loanTermYears", label: "Loan term", kind: "years", suffix: "years", help: "Years to pay off the loan. 30 is the most common.", min: 1, max: 40 },
  initialRepairs: { key: "initialRepairs", label: "Initial repairs", kind: "money", help: "Work needed before the first tenant moves in.", min: 0, max: 10_000_000, source: true },
  initialReserve: { key: "initialReserve", label: "Cash reserve", kind: "money", help: "Cash set aside at purchase. It counts as money invested, never as an expense.", min: 0, max: 10_000_000 },
  annualPropertyTax: { key: "annualPropertyTax", label: "Property tax", kind: "money", suffix: "/yr", help: "Check the county record. It often goes up after a sale.", min: 0, max: 10_000_000, source: true },
  annualInsurance: { key: "annualInsurance", label: "Insurance", kind: "money", suffix: "/yr", help: "A landlord (dwelling) policy, not a homeowner policy. Ask an agent for a quote.", min: 0, max: 10_000_000, source: true },
  monthlyHoa: { key: "monthlyHoa", label: "HOA", kind: "money", suffix: "/mo", help: "Association dues, if there are any.", min: 0, max: 1_000_000, source: true },
  monthlyUtilities: { key: "monthlyUtilities", label: "Utilities you pay", kind: "money", suffix: "/mo", help: "Only the bills you pay as the landlord, often water and trash.", min: 0, max: 1_000_000, source: true },
  otherMonthlyFixed: { key: "otherMonthlyFixed", label: "Other fixed costs", kind: "money", suffix: "/mo", help: "Lawn care, snow removal, software or a rental license.", min: 0, max: 1_000_000 },
  vacancyPct: { key: "vacancyPct", label: "Vacancy", kind: "rate", suffix: "% of rent", help: "Rent lost while a unit sits empty. Many investors assume 5 to 8%. 5% is about 2.5 weeks a year.", min: 0, max: 100, source: true },
  maintenancePct: { key: "maintenancePct", label: "Maintenance", kind: "rate", suffix: "% of rent", help: "Routine repairs and upkeep. 5 to 10% of rent is a common range.", min: 0, max: 100, source: true },
  managementPct: { key: "managementPct", label: "Management", kind: "rate", suffix: "% collected", help: "A property manager usually charges 8 to 10% of rent collected. Use 0% if you manage it yourself.", min: 0, max: 100, source: true },
  capexPct: { key: "capexPct", label: "CapEx reserve", kind: "rate", suffix: "% of rent", help: "Money set aside for big future repairs like a roof or HVAC. Planned, not spent. 5 to 10% of rent is common.", min: 0, max: 100, source: true },
};

/** Closing costs sit in Property right after the price; the form inserts that field itself (it has a % / $ switch). */
export const GROUPS: { title: string; sub: string; keys: (keyof typeof FIELDS)[] }[] = [
  { title: "Property", sub: "What you are buying and what it costs upfront.", keys: ["purchasePrice", "initialRepairs"] },
  { title: "Income", sub: "What the property brings in each month.", keys: ["monthlyRent", "otherMonthlyIncome", "vacancyPct"] },
  { title: "Loan", sub: "Skip this if you are paying cash.", keys: ["downPaymentPct", "annualInterestRate", "loanTermYears"] },
  { title: "Operating costs", sub: "The bills that keep the property running.", keys: ["annualPropertyTax", "annualInsurance", "monthlyHoa", "monthlyUtilities", "otherMonthlyFixed", "maintenancePct", "managementPct"] },
  { title: "Reserves", sub: "Money you set aside, counted separately from costs.", keys: ["capexPct", "initialReserve"] },
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

/** The closing-cost field definition depends on its % / $ mode. */
export const closingDef = (pct: boolean): Pick<FieldDef, "label" | "kind" | "suffix" | "help" | "min" | "max"> =>
  pct
    ? { label: "Closing costs", kind: "rate", suffix: "% of price", help: "Lender, title and escrow fees. Usually 2 to 5% of the price.", min: 0, max: 20 }
    : { label: "Closing costs", kind: "money", help: "Lender, title and escrow fees.", min: 0, max: 10_000_000 };

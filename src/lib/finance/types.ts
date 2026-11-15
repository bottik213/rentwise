/** Integer US cents. All money in the engine is cents; UI converts at the boundary. */
export type Cents = number;
/** Fraction: 0.05 = 5%. */
export type Rate = number;

export type AssumptionSource = "estimate" | "listing" | "bill" | "quote" | "document";

export interface PropertyInputs {
  nickname?: string;
  purchasePrice: Cents;
  monthlyRent: Cents;
  otherMonthlyIncome: Cents;

  allCash: boolean;
  downPaymentPct: Rate;
  annualInterestRate: Rate;
  loanTermYears: number;

  closingCostMode: "amount" | "percent";
  /** Cents when mode = "amount", Rate of purchase price when mode = "percent". */
  closingCostValue: number;
  initialRepairs: Cents;
  initialReserve: Cents;

  annualPropertyTax: Cents;
  annualInsurance: Cents;
  monthlyHoa: Cents;
  monthlyUtilities: Cents;
  otherMonthlyFixed: Cents;

  vacancyPct: Rate;
  maintenancePct: Rate;
  managementPct: Rate;
  capexPct: Rate;

  sources?: Partial<Record<keyof PropertyInputs, AssumptionSource>>;
  /** Multi-year assumptions (F1). Absent → DEFAULT_PROJECTION. */
  projection?: ProjectionAssumptions;
}

/** Illustrative multi-year assumptions, not predictions. Growth applies from year 2. */
export interface ProjectionAssumptions {
  holdYears: number;
  rentGrowth: Rate;
  expenseGrowth: Rate;
  valueGrowth: Rate;
  sellingCostPct: Rate;
}

/** Monthly figures unless named otherwise. */
export interface Underwriting {
  loanAmount: Cents;
  downPayment: Cents;
  closingCosts: Cents;
  cashInvested: Cents;

  grossScheduledRent: Cents;
  effectiveRent: Cents;
  otherIncome: Cents;
  totalIncome: Cents;

  propertyTax: Cents;
  insurance: Cents;
  hoa: Cents;
  utilities: Cents;
  otherFixed: Cents;
  maintenance: Cents;
  management: Cents;
  operatingExpenses: Cents;

  noi: Cents;
  monthlyPI: Cents;
  cashFlowBeforeCapex: Cents;
  capexReserve: Cents;
  reserveAdjustedCashFlow: Cents;

  /** Annual NOI / price; null when price is 0. */
  capRate: Rate | null;
  /** Annual reserve-adjusted CF / cash invested; null when cash invested ≤ 0. */
  cashOnCash: Rate | null;
  /** Rent where reserve-adjusted CF = 0; null when no rent can break even. */
  breakEvenRent: Cents | null;
}

/** Deltas applied on top of the base inputs. Pts = absolute rate change. */
export interface ScenarioAdjustments {
  rentChangePct: Rate;
  vacancyPts: Rate;
  maintenancePts: Rate;
  capexPts: Rate;
  fixedCostChangePct: Rate;
  /** Growth deltas for the projection, in points. Absent → the default for that scenario. */
  rentGrowthPts?: Rate;
  expenseGrowthPts?: Rate;
  valueGrowthPts?: Rate;
}

export type ScenarioName = "conservative" | "base" | "optimistic";

export interface OfferConstraints {
  minMonthlyCashFlow?: Cents;
  minCashOnCash?: Rate;
  maxUpfrontCash?: Cents;
  /** Annual NOI / price. */
  minCapRate?: Rate;
  /** NOI / P&I; a property with no mortgage payment always passes. */
  minDscr?: number;
  /** IRR over the projection's hold period (F1), before income tax. */
  minIrr?: Rate;
  mustPassConservative?: boolean;
}

export type ConstraintKey = "minMonthlyCashFlow" | "minCashOnCash" | "maxUpfrontCash" | "minCapRate" | "minDscr" | "minIrr";
export const CONSTRAINT_KEYS: ConstraintKey[] = ["minMonthlyCashFlow", "minCashOnCash", "maxUpfrontCash", "minCapRate", "minDscr", "minIrr"];

export type OfferCeilingResult =
  | {
      status: "feasible";
      price: Cents;
      deltaFromAsking: Cents;
      /** Constraints that fail one search step above the ceiling. Empty when the search bound was hit. */
      limitingConstraints: ConstraintKey[];
      limitingScenario: ScenarioName | null;
      hitSearchBound: boolean;
      metrics: Underwriting;
      conservativeMetrics: Underwriting | null;
      /** Set only with an IRR target: a coarse scan saw IRR pass, fail and pass again as price fell. */
      irrNonMonotonic?: boolean;
    }
  | {
      status: "infeasible";
      failingConstraints: ConstraintKey[];
      failingScenario: ScenarioName;
      /** Set only with an IRR target: no price on the coarse scan met every target (a narrow window could be missed). */
      scanned?: boolean;
    }
  | { status: "no-constraints" };

export const ACTUAL_CATEGORIES = [
  "rentReceived",
  "otherIncome",
  "propertyTax",
  "insurance",
  "utilities",
  "hoa",
  "repairsMaintenance",
  "management",
  "otherOperating",
  "mortgagePI",
] as const;
export type ActualCategory = (typeof ACTUAL_CATEGORIES)[number];

/** One month of actuals. CapEx is tracked separately and never enters cash flow before CapEx. */
export type ActualMonth = { month: string } & Record<ActualCategory, Cents> & { capex: Cents };

export interface VarianceContributor {
  category: ActualCategory;
  forecast: Cents;
  actual: Cents;
  /** Effect on cash flow: positive = better than forecast. */
  impact: Cents;
}

export interface VarianceReport {
  months: number;
  forecastRent: Cents;
  actualRent: Cents;
  forecastOperatingCosts: Cents;
  actualOperatingCosts: Cents;
  forecastCashFlowBeforeCapex: Cents;
  actualCashFlowBeforeCapex: Cents;
  /** actual − forecast cash flow before CapEx; equals the sum of contributor impacts exactly. */
  totalVariance: Cents;
  contributors: VarianceContributor[];
  plannedCapexReserve: Cents;
  actualCapex: Cents;
}

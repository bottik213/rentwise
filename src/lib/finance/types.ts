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
}

export type ScenarioName = "conservative" | "base" | "optimistic";

export interface OfferConstraints {
  minMonthlyCashFlow?: Cents;
  minCashOnCash?: Rate;
  maxUpfrontCash?: Cents;
  mustPassConservative?: boolean;
}

export type ConstraintKey = "minMonthlyCashFlow" | "minCashOnCash" | "maxUpfrontCash";

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
    }
  | { status: "infeasible"; failingConstraints: ConstraintKey[]; failingScenario: ScenarioName }
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

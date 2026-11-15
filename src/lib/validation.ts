import { z } from "zod";
import { ACTUAL_CATEGORIES, type ActualMonth, type PropertyInputs } from "./finance/types";

const MAX_CENTS = 10_000_000_000; // $100M
const cents = z.number().int().min(0).max(MAX_CENTS);
const rate = z.number().min(0).max(1);
const source = z.enum(["estimate", "listing", "bill", "quote", "document"]);
const growth = z.number().min(-0.2).max(0.2);

export const ProjectionSchema = z.object({
  holdYears: z.number().int().min(1).max(30),
  rentGrowth: growth,
  expenseGrowth: growth,
  valueGrowth: growth,
  sellingCostPct: z.number().min(0).max(0.2),
});

/** Engine-unit schema (cents, fractions). Guards everything read back from localStorage. */
export const PropertyInputsSchema = z.object({
  nickname: z.string().max(60).optional(),
  purchasePrice: cents,
  monthlyRent: cents,
  otherMonthlyIncome: cents,
  allCash: z.boolean(),
  downPaymentPct: rate,
  annualInterestRate: z.number().min(0).max(0.3),
  loanTermYears: z.number().int().min(1).max(40),
  closingCostMode: z.enum(["amount", "percent"]),
  closingCostValue: z.number().finite().min(0).max(MAX_CENTS),
  initialRepairs: cents,
  initialReserve: cents,
  annualPropertyTax: cents,
  annualInsurance: cents,
  monthlyHoa: cents,
  monthlyUtilities: cents,
  otherMonthlyFixed: cents,
  vacancyPct: rate,
  maintenancePct: rate,
  managementPct: rate,
  capexPct: rate,
  sources: z.record(z.string(), source).optional(),
  projection: ProjectionSchema.optional(),
}).refine((p) => p.closingCostMode === "amount" || p.closingCostValue <= 0.2, {
  message: "Closing costs above 20% of price are not supported",
  path: ["closingCostValue"],
}) as unknown as z.ZodType<PropertyInputs>;

export const ActualMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  capex: cents,
  ...Object.fromEntries(ACTUAL_CATEGORIES.map((k) => [k, cents])),
}) as unknown as z.ZodType<ActualMonth>;

const scenario = z.object({
  rentChangePct: z.number().min(-1).max(1),
  vacancyPts: z.number().min(-1).max(1),
  maintenancePts: z.number().min(-1).max(1),
  capexPts: z.number().min(-1).max(1),
  fixedCostChangePct: z.number().min(-1).max(5),
  rentGrowthPts: growth.optional(),
  expenseGrowthPts: growth.optional(),
  valueGrowthPts: growth.optional(),
});

export const StoredStateSchema = z.object({
  v: z.literal(1),
  property: PropertyInputsSchema.nullable(),
  isExample: z.boolean(),
  // Snapshot taken at "Mark as owned": the forecast actuals are compared against never changes with later edits.
  plan: z.object({ inputs: PropertyInputsSchema, lockedAt: z.string() }).nullable(),
  scenarios: z.object({ conservative: scenario, base: scenario, optimistic: scenario }),
  constraints: z.object({
    minMonthlyCashFlow: z.number().int().optional(),
    minCashOnCash: z.number().min(-1).max(1).optional(),
    maxUpfrontCash: cents.optional(),
    minCapRate: z.number().min(0).max(1).optional(),
    minDscr: z.number().min(0).max(100).optional(),
    minIrr: z.number().min(-1).max(5).optional(),
    mustPassConservative: z.boolean().optional(),
  }),
  actuals: z.array(ActualMonthSchema).max(600),
});

/** Parse a user-typed number: "$250,000" → 250000. Empty or junk → null. */
export function parseNumber(raw: string): number | null {
  const s = raw.replace(/[$,%\s]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

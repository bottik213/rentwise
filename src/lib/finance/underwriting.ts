import type { PropertyInputs, Underwriting } from "./types";
import { assertFinite, roundCents } from "./money";
import { monthlyPayment } from "./mortgage";

/**
 * Full monthly underwriting. Each line item is rounded to cents once, and every total is an
 * integer sum of those items, so totals always reconcile exactly with their parts.
 */
export function underwrite(i: PropertyInputs): Underwriting {
  assertFinite(i, "underwrite");
  const price = i.purchasePrice;

  const downPayment = i.allCash ? price : roundCents(price * i.downPaymentPct);
  const loanAmount = price - downPayment;
  const closingCosts = i.closingCostMode === "percent" ? roundCents(price * i.closingCostValue) : i.closingCostValue;
  const cashInvested = downPayment + closingCosts + i.initialRepairs + i.initialReserve;

  const grossScheduledRent = i.monthlyRent;
  const effectiveRent = roundCents(grossScheduledRent * (1 - i.vacancyPct));
  const otherIncome = i.otherMonthlyIncome;
  const totalIncome = effectiveRent + otherIncome;

  const propertyTax = roundCents(i.annualPropertyTax / 12);
  const insurance = roundCents(i.annualInsurance / 12);
  const hoa = i.monthlyHoa;
  const utilities = i.monthlyUtilities;
  const otherFixed = i.otherMonthlyFixed;
  const fixed = propertyTax + insurance + hoa + utilities + otherFixed;
  const maintenance = roundCents(grossScheduledRent * i.maintenancePct);
  const management = roundCents(effectiveRent * i.managementPct);
  const operatingExpenses = fixed + maintenance + management;

  const noi = totalIncome - operatingExpenses;
  const monthlyPI = i.allCash ? 0 : monthlyPayment(loanAmount, i.annualInterestRate, i.loanTermYears);
  const cashFlowBeforeCapex = noi - monthlyPI;
  const capexReserve = roundCents(grossScheduledRent * i.capexPct);
  const reserveAdjustedCashFlow = cashFlowBeforeCapex - capexReserve;

  // Reserve-adjusted CF is linear in rent: CF(R) = R·k − (fixed + P&I − other income).
  const k = (1 - i.vacancyPct) * (1 - i.managementPct) - i.maintenancePct - i.capexPct;
  const mustCover = fixed + monthlyPI - otherIncome;
  const breakEvenRent = mustCover <= 0 ? 0 : k <= 0 ? null : Math.ceil(mustCover / k - 1e-9);

  return {
    loanAmount, downPayment, closingCosts, cashInvested,
    grossScheduledRent, effectiveRent, otherIncome, totalIncome,
    propertyTax, insurance, hoa, utilities, otherFixed, maintenance, management, operatingExpenses,
    noi, monthlyPI, cashFlowBeforeCapex, capexReserve, reserveAdjustedCashFlow,
    capRate: price > 0 ? (12 * noi) / price : null,
    cashOnCash: cashInvested > 0 ? (12 * reserveAdjustedCashFlow) / cashInvested : null,
    breakEvenRent,
  };
}

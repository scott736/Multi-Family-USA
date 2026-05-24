/**
 * Shared finance helpers for calculator components.
 */

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const fmtUSD = (v: number) => usd0.format(isFinite(v) ? v : 0);
export const fmtUSD2 = (v: number) => usd2.format(isFinite(v) ? v : 0);

export const fmtPct = (v: number, decimals = 2) =>
  `${(isFinite(v) ? v : 0).toFixed(decimals)}%`;

export const fmtDSCR = (v: number) => (isFinite(v) ? v.toFixed(3) : "—");

export function parseNum(v: string): number {
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Monthly P&I payment for a fully-amortizing loan. */
export function monthlyPI(
  principal: number,
  annualRatePct: number,
  termMonths: number,
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / termMonths;
  const pow = Math.pow(1 + r, termMonths);
  return (principal * (r * pow)) / (pow - 1);
}

/** Remaining loan balance after `monthsElapsed` on a fully-amortizing loan. */
export function remainingBalance(
  principal: number,
  annualRatePct: number,
  termMonths: number,
  monthsElapsed: number,
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  if (monthsElapsed >= termMonths) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal * (1 - monthsElapsed / termMonths);
  const pow = Math.pow(1 + r, termMonths);
  const powE = Math.pow(1 + r, monthsElapsed);
  return (principal * (pow - powE)) / (pow - 1);
}

/** Given a target monthly payment, back-solve the supported loan amount. */
export function solveLoanFromPayment(
  monthlyPayment: number,
  annualRatePct: number,
  termMonths: number,
): number {
  if (monthlyPayment <= 0 || termMonths <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return monthlyPayment * termMonths;
  const pow = Math.pow(1 + r, termMonths);
  return (monthlyPayment * (pow - 1)) / (r * pow);
}

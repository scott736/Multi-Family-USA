"use client";

import { Clock, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtPct, fmtUSD, monthlyPI, remainingBalance } from "@/lib/finance";

const piYears = (p: number, r: number, y: number) => monthlyPI(p, r, y * 12);
const balanceAfter = (p: number, r: number, y: number, m: number) =>
  remainingBalance(p, r, y * 12, m);

const HORIZONS = [3, 6, 12, 24];

interface RefiTimingOptimizerProps {
  lang?: "en" | "es";
}

export default function RefiTimingOptimizer({ lang = "en" }: RefiTimingOptimizerProps = {}) {
  const isEs = lang === "es";
  // Current loan
  const [currBal, setCurrBal] = useState(380000);
  const [currRate, setCurrRate] = useState(8.25);
  const [currPI, setCurrPI] = useState(2926);
  const [seasoningElapsed, setSeasoningElapsed] = useState(18);
  const [remainingTerm, setRemainingTerm] = useState(28.5); // years

  // PPP — assume 5/4/3/2/1 by default, with current month into the schedule
  const [pppYear1, setPppYear1] = useState(5);
  const [pppYear2, setPppYear2] = useState(4);
  const [pppYear3, setPppYear3] = useState(3);
  const [pppYear4, setPppYear4] = useState(2);
  const [pppYear5, setPppYear5] = useState(1);

  // Property value + appreciation
  const [currentValue, setCurrentValue] = useState(500000);
  const [appreciation, setAppreciation] = useState(3.5);
  const [maxCashOutLtv, setMaxCashOutLtv] = useState(75);

  // Projected refi rates
  const [rate3, setRate3] = useState(7.75);
  const [rate6, setRate6] = useState(7.5);
  const [rate12, setRate12] = useState(7.0);
  const [rate24, setRate24] = useState(6.5);

  // Refi cost
  const [refiClosingPct, setRefiClosingPct] = useState(2.5);

  const pppSchedule = [pppYear1, pppYear2, pppYear3, pppYear4, pppYear5, 0];

  const projections = useMemo(() => {
    return HORIZONS.map((h, idx) => {
      const rate = [rate3, rate6, rate12, rate24][idx];
      const futureMonthsElapsed = seasoningElapsed + h;
      const futureYear = Math.ceil(futureMonthsElapsed / 12);
      const pppRate = pppSchedule[futureYear - 1] ?? 0;
      // Remaining balance at that horizon (from original amortization — approximate using remaining term)
      const balAtH = balanceAfter(currBal, currRate, remainingTerm, h);
      const pppCost = (balAtH * pppRate) / 100;
      const futureValue = currentValue * Math.pow(1 + appreciation / 100, h / 12);
      const maxNewLoan = (futureValue * maxCashOutLtv) / 100;
      const newPI = piYears(maxNewLoan, rate, 30);
      const monthlySavings = currPI - newPI;
      const closing = (maxNewLoan * refiClosingPct) / 100;
      const totalRefiCost = pppCost + closing;
      const breakEvenMonths = monthlySavings > 0 ? totalRefiCost / monthlySavings : Infinity;
      // cash-out = max loan - current balance - refi costs
      const cashOut = maxNewLoan - balAtH - closing - pppCost;
      // 5-yr ROI: savings over 60 months minus total refi costs
      const savings5yr = monthlySavings * 60;
      const netROI = savings5yr - totalRefiCost + cashOut; // with cash-out proceeds counted as recovered capital

      return {
        horizon: h,
        rate,
        balAtH,
        pppRate,
        pppCost,
        futureValue,
        maxNewLoan,
        newPI,
        monthlySavings,
        closing,
        totalRefiCost,
        breakEvenMonths,
        cashOut,
        savings5yr,
        netROI,
      };
    });
  }, [
    currBal,
    currRate,
    currPI,
    seasoningElapsed,
    remainingTerm,
    pppYear1,
    pppYear2,
    pppYear3,
    pppYear4,
    pppYear5,
    currentValue,
    appreciation,
    maxCashOutLtv,
    rate3,
    rate6,
    rate12,
    rate24,
    refiClosingPct,
  ]);

  const winner = useMemo(() => {
    let best = projections[0];
    for (const p of projections) if (p.netROI > best.netROI) best = p;
    return best;
  }, [projections]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEs ? "Optimizador del momento del refinanciamiento DSCR" : "DSCR Refinance Timing Optimizer"}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {isEs
            ? "Dado tu préstamo actual, tu calendario de PPP y las tasas proyectadas, encuentra el momento óptimo del refinanciamiento — con cálculos de punto de equilibrio y ROI."
            : "Given your current loan, your PPP schedule, and projected rates, find the optimal refi window — with break-even and ROI math."}
        </p>
      </CardHeader>
      <CardContent>
        {/* Inputs */}
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold">{isEs ? "Préstamo actual" : "Current loan"}</p>
            <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 md:grid-cols-3">
              <div>
                <Label htmlFor="currBal">{isEs ? "Saldo actual" : "Current balance"}</Label>
                <Input
                  id="currBal"
                  type="number"
                  value={currBal}
                  onChange={(e) => setCurrBal(+e.target.value || 0)}
                />
              </div>
              <div>
                <Label htmlFor="currRate">{isEs ? "Tasa actual (%)" : "Current rate (%)"}</Label>
                <Input
                  id="currRate"
                  type="number"
                  step="0.01"
                  value={currRate}
                  onChange={(e) => setCurrRate(+e.target.value || 0)}
                />
              </div>
              <div>
                <Label htmlFor="currPI">{isEs ? "Principal e intereses mensual actual" : "Current monthly P&I"}</Label>
                <Input
                  id="currPI"
                  type="number"
                  value={currPI}
                  onChange={(e) => setCurrPI(+e.target.value || 0)}
                />
              </div>
              <div>
                <Label htmlFor="seasoningElapsed">{isEs ? "Meses transcurridos en el préstamo (sazón)" : "Months into loan (seasoning)"}</Label>
                <Input
                  id="seasoningElapsed"
                  type="number"
                  value={seasoningElapsed}
                  onChange={(e) => setSeasoningElapsed(+e.target.value || 0)}
                />
              </div>
              <div>
                <Label htmlFor="remainingTerm">{isEs ? "Plazo restante (años)" : "Remaining term (years)"}</Label>
                <Input
                  id="remainingTerm"
                  type="number"
                  step="0.5"
                  value={remainingTerm}
                  onChange={(e) => setRemainingTerm(+e.target.value || 0)}
                />
              </div>
              <div>
                <Label htmlFor="refiClosingPct">{isEs ? "Costos de cierre del refi (% del nuevo préstamo)" : "Refi closing costs (% of new loan)"}</Label>
                <Input
                  id="refiClosingPct"
                  type="number"
                  step="0.1"
                  value={refiClosingPct}
                  onChange={(e) => setRefiClosingPct(+e.target.value || 0)}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">{isEs ? "Calendario de PPP (% del saldo restante)" : "PPP schedule (% of remaining balance)"}</p>
            <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 md:grid-cols-5">
              <div>
                <Label htmlFor="pppYear1">{isEs ? "Año 1" : "Year 1"}</Label>
                <Input
                  id="pppYear1"
                  type="number"
                  step="0.1"
                  value={pppYear1}
                  onChange={(e) => setPppYear1(+e.target.value || 0)}
                />
              </div>
              <div>
                <Label htmlFor="pppYear2">{isEs ? "Año 2" : "Year 2"}</Label>
                <Input
                  id="pppYear2"
                  type="number"
                  step="0.1"
                  value={pppYear2}
                  onChange={(e) => setPppYear2(+e.target.value || 0)}
                />
              </div>
              <div>
                <Label htmlFor="pppYear3">{isEs ? "Año 3" : "Year 3"}</Label>
                <Input
                  id="pppYear3"
                  type="number"
                  step="0.1"
                  value={pppYear3}
                  onChange={(e) => setPppYear3(+e.target.value || 0)}
                />
              </div>
              <div>
                <Label htmlFor="pppYear4">{isEs ? "Año 4" : "Year 4"}</Label>
                <Input
                  id="pppYear4"
                  type="number"
                  step="0.1"
                  value={pppYear4}
                  onChange={(e) => setPppYear4(+e.target.value || 0)}
                />
              </div>
              <div>
                <Label htmlFor="pppYear5">{isEs ? "Año 5" : "Year 5"}</Label>
                <Input
                  id="pppYear5"
                  type="number"
                  step="0.1"
                  value={pppYear5}
                  onChange={(e) => setPppYear5(+e.target.value || 0)}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">{isEs ? "Valor de la propiedad + apreciación" : "Property value + appreciation"}</p>
            <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 md:grid-cols-3">
              <div>
                <Label htmlFor="currentValue">{isEs ? "Valor de tasación actual" : "Current appraised value"}</Label>
                <Input
                  id="currentValue"
                  type="number"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(+e.target.value || 0)}
                />
              </div>
              <div>
                <Label htmlFor="appreciation">{isEs ? "Apreciación (%/año)" : "Appreciation (%/yr)"}</Label>
                <Input
                  id="appreciation"
                  type="number"
                  step="0.1"
                  value={appreciation}
                  onChange={(e) => setAppreciation(+e.target.value || 0)}
                />
              </div>
              <div>
                <Label htmlFor="maxCashOutLtv">{isEs ? "LTV máximo del cash-out (%)" : "Max cash-out LTV (%)"}</Label>
                <Input
                  id="maxCashOutLtv"
                  type="number"
                  value={maxCashOutLtv}
                  onChange={(e) => setMaxCashOutLtv(+e.target.value || 0)}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">{isEs ? "Tasa proyectada del refi en cada horizonte" : "Projected refi rate at horizon"}</p>
            <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 md:grid-cols-4">
              <div>
                <Label htmlFor="rate3">{isEs ? "3 meses (%)" : "3 months (%)"}</Label>
                <Input
                  id="rate3"
                  type="number"
                  step="0.01"
                  value={rate3}
                  onChange={(e) => setRate3(+e.target.value || 0)}
                />
              </div>
              <div>
                <Label htmlFor="rate6">{isEs ? "6 meses (%)" : "6 months (%)"}</Label>
                <Input
                  id="rate6"
                  type="number"
                  step="0.01"
                  value={rate6}
                  onChange={(e) => setRate6(+e.target.value || 0)}
                />
              </div>
              <div>
                <Label htmlFor="rate12">{isEs ? "12 meses (%)" : "12 months (%)"}</Label>
                <Input
                  id="rate12"
                  type="number"
                  step="0.01"
                  value={rate12}
                  onChange={(e) => setRate12(+e.target.value || 0)}
                />
              </div>
              <div>
                <Label htmlFor="rate24">{isEs ? "24 meses (%)" : "24 months (%)"}</Label>
                <Input
                  id="rate24"
                  type="number"
                  step="0.01"
                  value={rate24}
                  onChange={(e) => setRate24(+e.target.value || 0)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="mt-6 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="px-3 py-2 text-left">{isEs ? "Horizonte del refi" : "Refi horizon"}</th>
                <th className="px-3 py-2 text-right">{isEs ? "Saldo entonces" : "Balance then"}</th>
                <th className="px-3 py-2 text-right">{isEs ? "Costo de PPP" : "PPP cost"}</th>
                <th className="px-3 py-2 text-right">{isEs ? "Nueva tasa" : "New rate"}</th>
                <th className="px-3 py-2 text-right">{isEs ? "Valor futuro" : "Future value"}</th>
                <th className="px-3 py-2 text-right">{isEs ? "Cash-out" : "Cash-out"}</th>
                <th className="px-3 py-2 text-right">{isEs ? "Ahorros mensuales" : "Monthly savings"}</th>
                <th className="px-3 py-2 text-right">{isEs ? "Punto de equilibrio" : "Break-even"}</th>
                <th className="px-3 py-2 text-right">{isEs ? "ROI neto a 5 años" : "5-yr net ROI"}</th>
              </tr>
            </thead>
            <tbody>
              {projections.map((p) => (
                <tr
                  key={p.horizon}
                  className={cn(
                    "border-t",
                    p === winner && "bg-success/10 font-semibold",
                  )}
                >
                  <td className="px-3 py-2">{p.horizon} {isEs ? "meses" : "months"}</td>
                  <td className="px-3 py-2 text-right">{fmtUSD(p.balAtH)}</td>
                  <td className="px-3 py-2 text-right">{fmtUSD(p.pppCost)}</td>
                  <td className="px-3 py-2 text-right">{fmtPct(p.rate)}</td>
                  <td className="px-3 py-2 text-right">{fmtUSD(p.futureValue)}</td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right",
                      p.cashOut > 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {fmtUSD(p.cashOut)}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right",
                      p.monthlySavings > 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {fmtUSD(p.monthlySavings)}{isEs ? "/mes" : "/mo"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isFinite(p.breakEvenMonths)
                      ? `${p.breakEvenMonths.toFixed(1)} ${isEs ? "meses" : "mo"}`
                      : (isEs ? "Nunca" : "Never")}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right",
                      p.netROI > 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {fmtUSD(p.netROI)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recommendation */}
        <Card className="mt-6 border-accent/40 bg-accent/5">
          <CardContent className="flex flex-col items-start gap-4 pt-6 md:flex-row md:items-center">
            <Clock className="size-10 shrink-0 text-accent" />
            <div className="flex-1">
              <p className="text-xs uppercase text-muted-foreground">{isEs ? "Momento óptimo del refinanciamiento" : "Recommended refi window"}</p>
              <p className="text-2xl font-bold">{isEs ? `Espera ${winner.horizon} meses` : `Wait ${winner.horizon} months`}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isEs ? (
                  <>
                    Refinanciar en el mes {winner.horizon} produce{" "}
                    <strong className="text-foreground">{fmtUSD(winner.netROI)}</strong> de ROI neto a 5 años — {winner.monthlySavings >= 0 ? "ahorrando" : "costando"}{" "}
                    {fmtUSD(Math.abs(winner.monthlySavings))}/mes y generando{" "}
                    {fmtUSD(Math.max(0, winner.cashOut))} en ingresos por cash-out después de{" "}
                    {fmtUSD(winner.pppCost)} de PPP y {fmtUSD(winner.closing)} en costos de cierre.
                  </>
                ) : (
                  <>
                    Refinancing at month {winner.horizon} yields{" "}
                    <strong className="text-foreground">{fmtUSD(winner.netROI)}</strong> in net 5-year
                    ROI — {winner.monthlySavings >= 0 ? "saving" : "costing"}{" "}
                    {fmtUSD(Math.abs(winner.monthlySavings))}/mo and generating{" "}
                    {fmtUSD(Math.max(0, winner.cashOut))} in cash-out proceeds after{" "}
                    {fmtUSD(winner.pppCost)} PPP and {fmtUSD(winner.closing)} closing costs.
                  </>
                )}
              </p>
            </div>
            <Button variant="cta" asChild>
              <a href={isEs ? "/es/get-matched?source=refinance-timing-optimizer" : "/get-matched?source=refinance-timing-optimizer"}>{isEs ? "Cotizar refinanciamiento" : "Get refi quotes"}</a>
            </Button>
          </CardContent>
        </Card>

        <p className="mt-3 text-xs text-muted-foreground">
          {isEs
            ? "Solo proyecciones. Los términos reales del refinanciamiento dependen de tasas futuras y de la suscripción específica de la propiedad."
            : "Projections only. Actual refi terms depend on future rates and property-specific underwriting."}
        </p>
      </CardContent>
    </Card>
  );
}

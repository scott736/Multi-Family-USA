"use client";

import { ArrowRight, CheckCircle2, Info, RotateCcw, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtUSD, fmtUSD2, monthlyPI, parseNum } from "@/lib/finance";

const piYears = (p: number, r: number, y: number) => monthlyPI(p, r, y * 12);

interface Fields {
  loanAmount: string;
  rateWithout: string;
  rateWith: string;
  costPerPoint: string;
  numPoints: string;
  holdingYears: string;
  term: string;
}

const DEFAULTS: Fields = {
  loanAmount: "350000",
  rateWithout: "7.25",
  rateWith: "6.875",
  costPerPoint: "1",
  numPoints: "1",
  holdingYears: "7",
  term: "30",
};

interface PointsBuydownCalculatorProps {
  lang?: "en" | "es";
}

export default function PointsBuydownCalculator({ lang = "en" }: PointsBuydownCalculatorProps = {}) {
  const isEs = lang === "es";
  const [f, setF] = useState<Fields>(DEFAULTS);

  const loan = parseNum(f.loanAmount);
  const rateWithout = parseNum(f.rateWithout);
  const rateWith = parseNum(f.rateWith);
  const costPerPoint = parseNum(f.costPerPoint);
  const numPoints = parseNum(f.numPoints);
  const holdingYears = parseNum(f.holdingYears);
  const term = parseNum(f.term) || 30;

  const results = useMemo(() => {
    if (loan <= 0 || rateWithout <= 0 || rateWith <= 0) return null;

    const upfrontCost = loan * (costPerPoint / 100) * numPoints;
    const paymentWithout = piYears(loan, rateWithout, term);
    const paymentWith = piYears(loan, rateWith, term);
    const monthlySavings = paymentWithout - paymentWith;

    if (monthlySavings <= 0) return { upfrontCost, paymentWithout, paymentWith, monthlySavings: 0, breakEvenMonths: Infinity, totalSavings: 0, netBenefit: -upfrontCost };

    const breakEvenMonths = upfrontCost / monthlySavings;
    const totalSavings = monthlySavings * holdingYears * 12;
    const netBenefit = totalSavings - upfrontCost;

    return { upfrontCost, paymentWithout, paymentWith, monthlySavings, breakEvenMonths, totalSavings, netBenefit };
  }, [loan, rateWithout, rateWith, costPerPoint, numPoints, holdingYears, term]);

  function update<K extends keyof Fields>(k: K, v: string) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  function reset() {
    setF(DEFAULTS);
  }

  const verdict = results
    ? results.netBenefit > 0
      ? { label: isEs ? "La reducción de tasa vale la pena" : "Buydown pays off", color: "text-success", bg: "bg-success/10", ring: "ring-success/40" }
      : { label: isEs ? "No vale la pena con este plazo de retención" : "Not worth it at this hold period", color: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/40" }
    : null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-accent/50 via-accent/20 to-primary/20 p-[1.5px] shadow-lg">
        <div className="rounded-2xl bg-card">
          <div className="grid gap-0 lg:grid-cols-5">
            {/* Inputs */}
            <div className="lg:col-span-3 p-5 md:p-7 border-b lg:border-b-0 lg:border-r border-border">
              <p className="text-xs font-bold uppercase tracking-wider text-accent">{isEs ? "Puntos y reducción de tasa" : "Points & Buydown"}</p>
              <h2 className="text-xl md:text-2xl font-bold text-foreground mt-0.5 mb-5">{isEs ? "Ingresa tu escenario" : "Enter your scenario"}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="loanAmount" label={isEs ? "Monto del préstamo" : "Loan amount"} prefix="$" value={f.loanAmount} onChange={(v) => update("loanAmount", v)} hint={isEs ? "Capital prestado" : "Principal borrowed"} />
                <Field id="term" label={isEs ? "Plazo del préstamo (años)" : "Loan term (years)"} value={f.term} onChange={(v) => update("term", v)} hint={isEs ? "Generalmente 30" : "Typically 30"} />
                <Field id="rateWithout" label={isEs ? "Tasa sin puntos %" : "Rate without points %"} value={f.rateWithout} onChange={(v) => update("rateWithout", v)} hint={isEs ? "Tasa par del prestamista" : "Par rate from lender"} suffix="%" />
                <Field id="rateWith" label={isEs ? "Tasa con reducción de tasa %" : "Rate with buydown %"} value={f.rateWith} onChange={(v) => update("rateWith", v)} hint={isEs ? "Tasa después de comprar puntos" : "Rate after buying points"} suffix="%" />
                <Field id="numPoints" label={isEs ? "Número de puntos" : "Number of points"} value={f.numPoints} onChange={(v) => update("numPoints", v)} hint={isEs ? "ej. 1, 1.5, 2" : "e.g. 1, 1.5, 2"} />
                <Field id="costPerPoint" label={isEs ? "Costo por punto %" : "Cost per point %"} value={f.costPerPoint} onChange={(v) => update("costPerPoint", v)} hint={isEs ? "Por defecto 1% del préstamo" : "Default 1% of loan"} suffix="%" />
                <Field id="holdingYears" label={isEs ? "Plazo de retención (años)" : "Holding period (years)"} value={f.holdingYears} onChange={(v) => update("holdingYears", v)} hint={isEs ? "Cuánto tiempo planeas mantener el préstamo" : "How long you plan to keep the loan"} />
              </div>
              <div className="mt-6">
                <Button variant="outline" size="sm" onClick={reset}>
                  <RotateCcw className="size-3.5" /> {isEs ? "Restablecer" : "Reset"}
                </Button>
              </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-2 p-5 md:p-7 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isEs ? "Resultados" : "Results"}</p>

              {results && verdict ? (
                <>
                  <div className={cn("rounded-xl p-4 ring-2", verdict.ring, verdict.bg)}>
                    <div className={cn("text-lg font-bold", verdict.color)}>{verdict.label}</div>
                    {isFinite(results.breakEvenMonths) ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {isEs ? "Punto de equilibrio en " : "Break-even in "}<strong>{Math.ceil(results.breakEvenMonths)} {isEs ? "meses" : "months"}</strong> ({(results.breakEvenMonths / 12).toFixed(1)} {isEs ? "años" : "yrs"})
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">{isEs ? "Sin ahorros en el pago — verifica tus tasas." : "No payment savings — check your rates."}</p>
                    )}
                  </div>

                  <dl className="space-y-2 text-sm">
                    <Row label={isEs ? "Costo inicial" : "Upfront cost"} value={fmtUSD(results.upfrontCost)} bold />
                    <Row label={isEs ? "Pago sin puntos" : "Payment without points"} value={fmtUSD2(results.paymentWithout)} />
                    <Row label={isEs ? "Pago con puntos" : "Payment with points"} value={fmtUSD2(results.paymentWith)} />
                    <Row label={isEs ? "Ahorro mensual en el pago" : "Monthly payment savings"} value={fmtUSD2(results.monthlySavings)} accent="good" />
                    <Row
                      label={isEs ? `Ahorros totales en ${holdingYears} años` : `Total savings over ${holdingYears} yrs`}
                      value={fmtUSD(results.totalSavings)}
                      accent="good"
                    />
                    <Row
                      label={isEs ? `Beneficio neto en ${holdingYears} años` : `Net benefit over ${holdingYears} yrs`}
                      value={fmtUSD(results.netBenefit)}
                      accent={results.netBenefit >= 0 ? "good" : "bad"}
                      bold
                    />
                  </dl>
                </>
              ) : (
                <div className="rounded-xl bg-muted/40 ring-2 ring-border p-5 text-sm text-muted-foreground">
                  {isEs ? "Ingresa los detalles de tu préstamo para ver el análisis de la reducción de tasa." : "Enter your loan details to see the buydown analysis."}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border bg-secondary/40 rounded-b-2xl p-5 md:p-7">
            <div className="flex items-start gap-3">
              <Info className="size-5 shrink-0 text-accent mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isEs
                  ? "Una reducción de tasa (buydown) intercambia efectivo inicial por una tasa más baja. El punto de equilibrio es el momento en que los ahorros mensuales acumulados igualan el costo inicial. Si vendes o refinancias antes del punto de equilibrio, pierdes dinero en la reducción de tasa."
                  : "A rate buydown trades upfront cash for a lower rate. The break-even is the point where accumulated monthly savings equal the upfront cost. If you sell or refinance before break-even, you lose money on the buydown."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <CtaBanner source="points-buydown-calculator" lang={lang} />
    </div>
  );
}

function Field({
  id, label, value, onChange, hint, prefix, suffix,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void; hint?: string; prefix?: string; suffix?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-foreground">{label}</Label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{prefix}</span>}
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className={cn("tabular-nums", prefix && "pl-7", suffix && "pr-8")}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{suffix}</span>}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Row({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: "good" | "bad" }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums", bold && "font-bold text-foreground", accent === "good" && "text-success font-semibold", accent === "bad" && "text-destructive font-semibold")}>
        {value}
      </dd>
    </div>
  );
}

function CtaBanner({ source, lang = "en" }: { source: string; lang?: "en" | "es" }) {
  const isEs = lang === "es";
  return (
    <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 p-6 md:p-8 text-primary-foreground">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-xl md:text-2xl font-bold">{isEs ? "Recibe cotizaciones de prestamistas con tu tasa exacta" : "Get lender quotes with your exact rate"}</h3>
          <p className="mt-1 text-sm opacity-80">{isEs ? "Cotizamos con más de 1,000 prestamistas DSCR. Top 3 ofertas en una hora hábil. Sin consulta de crédito." : "We shop 1,000+ DSCR lenders. Top 3 offers in one business hour. No credit pull."}</p>
        </div>
        <Button asChild variant="cta" size="lg" className="shrink-0">
          <a href={isEs ? `/es/get-matched?source=${source}` : `/get-matched?source=${source}`}>{isEs ? "Ver mis ofertas" : "Get my matches"} <ArrowRight className="size-4" /></a>
        </Button>
      </div>
    </div>
  );
}

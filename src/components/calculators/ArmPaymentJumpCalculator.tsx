"use client";

import { AlertTriangle, ArrowRight, Info, RotateCcw, Shield } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtUSD, fmtUSD2, monthlyPI, parseNum, remainingBalance } from "@/lib/finance";

interface Fields {
  loanAmount: string;
  startRate: string;
  fixedPeriodYears: string;
  sofrRate: string;
  margin: string;
  initialCap: string;
  periodicCap: string;
  lifetimeCap: string;
  termYears: string;
  rent: string;
  tax: string;
  insurance: string;
  hoa: string;
}

const DEFAULTS: Fields = {
  loanAmount: "350000",
  startRate: "6.75",
  fixedPeriodYears: "5",
  sofrRate: "4.5",
  margin: "2.75",
  initialCap: "2",
  periodicCap: "2",
  lifetimeCap: "5",
  termYears: "30",
  rent: "2800",
  tax: "300",
  insurance: "130",
  hoa: "0",
};

interface ArmPaymentJumpCalculatorProps {
  lang?: "en" | "es";
}

export default function ArmPaymentJumpCalculator({ lang = "en" }: ArmPaymentJumpCalculatorProps = {}) {
  const isEs = lang === "es";
  const [f, setF] = useState<Fields>(DEFAULTS);

  const loan = parseNum(f.loanAmount);
  const startRate = parseNum(f.startRate);
  const fixedYears = parseNum(f.fixedPeriodYears);
  const sofr = parseNum(f.sofrRate);
  const margin = parseNum(f.margin);
  const initialCap = parseNum(f.initialCap);
  const periodicCap = parseNum(f.periodicCap);
  const lifetimeCap = parseNum(f.lifetimeCap);
  const termYears = parseNum(f.termYears) || 30;
  const rent = parseNum(f.rent);
  const tax = parseNum(f.tax);
  const ins = parseNum(f.insurance);
  const hoa = parseNum(f.hoa);

  const results = useMemo(() => {
    if (loan <= 0 || startRate <= 0) return null;

    const termMonths = termYears * 12;
    const fixedMonths = fixedYears * 12;

    // Initial payment during fixed period
    const initialPayment = monthlyPI(loan, startRate, termMonths);

    // Balance at first adjustment
    const balAtAdjust = remainingBalance(loan, startRate, termMonths, fixedMonths);
    const remainingMonths = termMonths - fixedMonths;

    // Fully-indexed rate at first adjustment
    const fullyIndexed = sofr + margin;

    // True first-adjustment rate: fully-indexed rate constrained by initial cap (floor and ceiling)
    const trueFirstAdjRate = Math.max(Math.min(fullyIndexed, startRate + initialCap), startRate - initialCap);
    // Worst case: rate at first adjustment capped by initial cap, then subsequent by periodic, lifetime by lifetime
    const worstAdjRate = Math.min(startRate + lifetimeCap, startRate + initialCap);

    const firstAdjPayment = monthlyPI(balAtAdjust, trueFirstAdjRate, remainingMonths);
    const worstCasePayment = monthlyPI(balAtAdjust, worstAdjRate, remainingMonths);

    const otherPITIA = tax + ins + hoa;

    const dscrInitial = rent > 0 && (initialPayment + otherPITIA) > 0
      ? rent / (initialPayment + otherPITIA)
      : 0;

    const dscrFirstAdj = rent > 0 && (firstAdjPayment + otherPITIA) > 0
      ? rent / (firstAdjPayment + otherPITIA)
      : 0;

    const dscrWorstCase = rent > 0 && (worstCasePayment + otherPITIA) > 0
      ? rent / (worstCasePayment + otherPITIA)
      : 0;

    const paymentJump = firstAdjPayment - initialPayment;
    const worstJump = worstCasePayment - initialPayment;

    return {
      initialPayment,
      balAtAdjust,
      fullyIndexed,
      trueFirstAdjRate,
      worstAdjRate,
      firstAdjPayment,
      worstCasePayment,
      paymentJump,
      worstJump,
      dscrInitial,
      dscrFirstAdj,
      dscrWorstCase,
    };
  }, [loan, startRate, fixedYears, sofr, margin, initialCap, periodicCap, lifetimeCap, termYears, rent, tax, ins, hoa]);

  function update<K extends keyof Fields>(k: K, v: string) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  function riskLevel() {
    if (!results) return null;
    if (results.dscrWorstCase >= 1.0) return { label: isEs ? "Riesgo manejable" : "Manageable risk", color: "text-success", bg: "bg-success/10", ring: "ring-success/40", icon: <Shield className="size-4" /> };
    if (results.dscrWorstCase >= 0.75) return { label: isEs ? "Riesgo moderado — el DSCR cae en el peor caso" : "Moderate risk — DSCR drops at worst case", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/40", icon: <AlertTriangle className="size-4" /> };
    return { label: isEs ? "Alto riesgo — DSCR del peor caso por debajo de 0.75" : "High risk — worst-case DSCR below 0.75", color: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/40", icon: <AlertTriangle className="size-4" /> };
  }

  const risk = riskLevel();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-accent/50 via-accent/20 to-primary/20 p-[1.5px] shadow-lg">
        <div className="rounded-2xl bg-card">
          <div className="grid gap-0 lg:grid-cols-5">
            {/* Inputs */}
            <div className="lg:col-span-3 p-5 md:p-7 border-b lg:border-b-0 lg:border-r border-border">
              <p className="text-xs font-bold uppercase tracking-wider text-accent">{isEs ? "Datos del ARM" : "ARM inputs"}</p>
              <h2 className="text-xl md:text-2xl font-bold text-foreground mt-0.5 mb-5">{isEs ? "Ingresa los detalles de tu ARM" : "Enter your ARM details"}</h2>

              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{isEs ? "Estructura del préstamo" : "Loan structure"}</p>
              <div className="grid gap-4 sm:grid-cols-2 mb-5">
                <Field id="loanAmount" label={isEs ? "Monto del préstamo" : "Loan amount"} prefix="$" value={f.loanAmount} onChange={(v) => update("loanAmount", v)} />
                <Field id="termYears" label={isEs ? "Plazo del préstamo (años)" : "Loan term (years)"} value={f.termYears} onChange={(v) => update("termYears", v)} />
                <Field id="startRate" label={isEs ? "Tasa fija inicial %" : "Starting fixed rate %"} suffix="%" value={f.startRate} onChange={(v) => update("startRate", v)} hint={isEs ? "Tasa durante el período fijo inicial" : "Rate during initial fixed period"} />
                <Field id="fixedPeriodYears" label={isEs ? "Período fijo (años)" : "Fixed period (years)"} value={f.fixedPeriodYears} onChange={(v) => update("fixedPeriodYears", v)} hint={isEs ? "ej. 5 para un ARM 5/1" : "e.g. 5 for a 5/1 ARM"} />
              </div>

              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{isEs ? "Índice y topes" : "Index & caps"}</p>
              <div className="grid gap-4 sm:grid-cols-2 mb-5">
                <Field id="sofrRate" label={isEs ? "Tasa del índice SOFR %" : "SOFR index rate %"} suffix="%" value={f.sofrRate} onChange={(v) => update("sofrRate", v)} hint={isEs ? "SOFR actual a 30 días" : "Current 30-day SOFR"} />
                <Field id="margin" label={isEs ? "Margen del prestamista %" : "Lender margin %"} suffix="%" value={f.margin} onChange={(v) => update("margin", v)} hint={isEs ? "Típico: 2.5–3.0%" : "Typical: 2.5–3.0%"} />
                <Field id="initialCap" label={isEs ? "Tope inicial %" : "Initial cap %"} suffix="%" value={f.initialCap} onChange={(v) => update("initialCap", v)} hint={isEs ? "Cambio máximo de tasa en el primer ajuste" : "Max rate change at first adjustment"} />
                <Field id="periodicCap" label={isEs ? "Tope periódico %" : "Periodic cap %"} suffix="%" value={f.periodicCap} onChange={(v) => update("periodicCap", v)} hint={isEs ? "Cambio máximo por cada ajuste posterior" : "Max change per subsequent adjustment"} />
                <Field id="lifetimeCap" label={isEs ? "Tope de por vida %" : "Lifetime cap %"} suffix="%" value={f.lifetimeCap} onChange={(v) => update("lifetimeCap", v)} hint={isEs ? "Aumento total máximo sobre la tasa inicial" : "Max total increase over start rate"} />
              </div>

              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{isEs ? "Datos para DSCR (opcional)" : "DSCR inputs (optional)"}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="rent" label={isEs ? "Renta mensual" : "Monthly rent"} prefix="$" value={f.rent} onChange={(v) => update("rent", v)} />
                <Field id="tax" label={isEs ? "Impuesto mensual" : "Monthly tax"} prefix="$" value={f.tax} onChange={(v) => update("tax", v)} />
                <Field id="insurance" label={isEs ? "Seguro mensual" : "Monthly insurance"} prefix="$" value={f.insurance} onChange={(v) => update("insurance", v)} />
                <Field id="hoa" label={isEs ? "HOA mensual" : "Monthly HOA"} prefix="$" value={f.hoa} onChange={(v) => update("hoa", v)} />
              </div>

              <div className="mt-6">
                <Button variant="outline" size="sm" onClick={() => setF(DEFAULTS)}>
                  <RotateCcw className="size-3.5" /> {isEs ? "Restablecer" : "Reset"}
                </Button>
              </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-2 p-5 md:p-7 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isEs ? "Análisis del pago" : "Payment analysis"}</p>

              {results && risk ? (
                <>
                  <div className={cn("rounded-xl p-4 ring-2", risk.ring, risk.bg)}>
                    <div className={cn("flex items-center gap-2 font-bold", risk.color)}>
                      {risk.icon}
                      {risk.label}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isEs ? "Tasa totalmente indexada en el primer ajuste: " : "Fully-indexed rate at first adjustment: "}<strong>{results.trueFirstAdjRate.toFixed(3)}%</strong> (SOFR {sofr}% + {isEs ? "margen" : "margin"} {margin}%)
                    </p>
                  </div>

                  <dl className="space-y-2 text-sm">
                    <Row label={isEs ? "Principal e intereses inicial (período fijo)" : "Initial P&I (fixed period)"} value={fmtUSD2(results.initialPayment)} bold />
                    <Row label={isEs ? "Principal e intereses en el primer ajuste" : "P&I at first adjustment"} value={fmtUSD2(results.firstAdjPayment)} />
                    <Row label={isEs ? "Incremento de pago en el primer ajuste" : "Payment jump at first adj."} value={fmtUSD2(results.paymentJump)} accent={results.paymentJump > 200 ? "bad" : "good"} />
                    <Row label={isEs ? "Tasa de ajuste en el peor caso" : "Worst-case adj. rate"} value={`${results.worstAdjRate.toFixed(3)}%`} />
                    <Row label={isEs ? "Pago de principal e intereses en el peor caso" : "Worst-case P&I payment"} value={fmtUSD2(results.worstCasePayment)} bold />
                    <Row label={isEs ? "Incremento de pago en el peor caso" : "Worst-case payment jump"} value={fmtUSD2(results.worstJump)} accent={results.worstJump > 400 ? "bad" : "good"} />
                  </dl>

                  {results.dscrInitial > 0 && (
                    <>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground pt-2">{isEs ? "Comparación de DSCR" : "DSCR comparison"}</p>
                      <dl className="space-y-2 text-sm">
                        <Row label={isEs ? "DSCR a la tasa inicial" : "DSCR at initial rate"} value={results.dscrInitial.toFixed(2)} accent={results.dscrInitial >= 1.0 ? "good" : "bad"} bold />
                        <Row label={isEs ? "DSCR en el primer ajuste" : "DSCR at first adjustment"} value={results.dscrFirstAdj.toFixed(2)} accent={results.dscrFirstAdj >= 1.0 ? "good" : "bad"} />
                        <Row label={isEs ? "DSCR en el peor caso" : "DSCR at worst case"} value={results.dscrWorstCase.toFixed(2)} accent={results.dscrWorstCase >= 1.0 ? "good" : "bad"} />
                      </dl>
                    </>
                  )}
                </>
              ) : (
                <div className="rounded-xl bg-muted/40 ring-2 ring-border p-5 text-sm text-muted-foreground">
                  {isEs ? "Ingresa los detalles del préstamo para analizar el riesgo del pago." : "Enter loan details to analyze payment risk."}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border bg-secondary/40 rounded-b-2xl p-5 md:p-7">
            <div className="flex items-start gap-3">
              <Info className="size-5 shrink-0 text-accent mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isEs
                  ? "Los topes del ARM limitan cuánto puede aumentar tu tasa. El tope inicial controla el primer ajuste; el tope periódico aplica a cada ajuste posterior; el tope de por vida es el aumento total máximo desde tu tasa inicial. El escenario del peor caso asume que el tope inicial se alcanza en el primer ajuste."
                  : "ARM caps limit how much your rate can increase. The initial cap controls the first adjustment; the periodic cap applies each subsequent adjustment; the lifetime cap is the maximum total increase from your starting rate. Worst-case scenario assumes the initial cap is hit at the first adjustment."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 p-6 md:p-8 text-primary-foreground">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">{isEs ? "Compara cotizaciones de ARM vs tasa fija" : "Compare ARM vs fixed rate quotes"}</h3>
            <p className="mt-1 text-sm opacity-80">{isEs ? "Cotizamos con más de 1,000 prestamistas DSCR. Top 3 ofertas en una hora hábil. Sin consulta de crédito." : "We shop 1,000+ DSCR lenders. Top 3 offers in one business hour. No credit pull."}</p>
          </div>
          <Button asChild variant="cta" size="lg" className="shrink-0">
            <a href={isEs ? "/es/get-matched?source=arm-payment-jump-calculator" : "/get-matched?source=arm-payment-jump-calculator"}>{isEs ? "Comparar tasas" : "Compare rates"} <ArrowRight className="size-4" /></a>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ id, label, value, onChange, hint, prefix, suffix }: {
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

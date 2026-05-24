"use client";

import { ArrowRight, Info, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtUSD, fmtUSD2, monthlyPI, parseNum } from "@/lib/finance";

const piYears = (p: number, r: number, y: number) => monthlyPI(p, r, y * 12);

function totalInterest(principal: number, annualRate: number, termYears: number): number {
  const pmt = piYears(principal, annualRate, termYears);
  return pmt * termYears * 12 - principal;
}

function totalInterestMonths(principal: number, annualRate: number, termYears: number, months: number): number {
  const pmt = piYears(principal, annualRate, termYears);
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (months <= 0 || principal <= 0) return 0;
  const m = Math.min(months, n);
  // balance after m payments
  let bal = principal;
  if (r === 0) {
    bal = principal - (principal / n) * m;
  } else {
    bal = (principal * (Math.pow(1 + r, n) - Math.pow(1 + r, m))) / (Math.pow(1 + r, n) - 1);
  }
  return pmt * m - (principal - bal);
}

interface Fields {
  loanAmount: string;
  rate: string;
  term: string;
  ioPeriod: string;
  rent: string;
  tax: string;
  insurance: string;
  hoa: string;
}

const DEFAULTS: Fields = {
  loanAmount: "350000",
  rate: "7.25",
  term: "30",
  ioPeriod: "10",
  rent: "2800",
  tax: "300",
  insurance: "130",
  hoa: "0",
};

interface IoVsAmortizingCalculatorProps {
  lang?: "en" | "es";
}

export default function IoVsAmortizingCalculator({ lang = "en" }: IoVsAmortizingCalculatorProps = {}) {
  const isEs = lang === "es";
  const [f, setF] = useState<Fields>(DEFAULTS);

  const loan = parseNum(f.loanAmount);
  const rate = parseNum(f.rate);
  const term = parseNum(f.term) || 30;
  const ioPeriod = parseNum(f.ioPeriod);
  const rent = parseNum(f.rent);
  const tax = parseNum(f.tax);
  const ins = parseNum(f.insurance);
  const hoa = parseNum(f.hoa);

  const results = useMemo(() => {
    if (loan <= 0 || rate <= 0) return null;

    const ioPayment = loan * (rate / 100 / 12);
    const amortPayment = piYears(loan, rate, term);
    const diff = amortPayment - ioPayment;

    // Interest over various periods
    const ioInterest5yr = ioPayment * 60; // all interest
    const amortInterest5yr = totalInterestMonths(loan, rate, term, 60);
    const ioInterest10yr = ioPayment * Math.min(120, ioPeriod * 12) +
      // if IO period < 10yr, remaining months amortize post-IO
      (ioPeriod < 10 ? totalInterestMonths(loan, rate, term - ioPeriod, (10 - ioPeriod) * 12) : 0);
    const amortInterest10yr = totalInterestMonths(loan, rate, term, 120);
    const ioTotalInterest = ioPayment * ioPeriod * 12 + totalInterest(loan, rate, term - ioPeriod);
    const amortTotalInterest = totalInterest(loan, rate, term);

    const otherPITIA = tax + ins + hoa;

    const dscrIO = rent > 0 && (ioPayment + otherPITIA) > 0 ? rent / (ioPayment + otherPITIA) : 0;
    const dscrAmort = rent > 0 && (amortPayment + otherPITIA) > 0 ? rent / (amortPayment + otherPITIA) : 0;

    return {
      ioPayment,
      amortPayment,
      diff,
      ioInterest5yr,
      amortInterest5yr,
      ioInterest10yr,
      amortInterest10yr,
      ioTotalInterest,
      amortTotalInterest,
      dscrIO,
      dscrAmort,
    };
  }, [loan, rate, term, ioPeriod, rent, tax, ins, hoa]);

  function update<K extends keyof Fields>(k: K, v: string) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-accent/50 via-accent/20 to-primary/20 p-[1.5px] shadow-lg">
        <div className="rounded-2xl bg-card">
          <div className="grid gap-0 lg:grid-cols-5">
            {/* Inputs */}
            <div className="lg:col-span-3 p-5 md:p-7 border-b lg:border-b-0 lg:border-r border-border">
              <p className="text-xs font-bold uppercase tracking-wider text-accent">{isEs ? "Solo-interés (IO) vs amortizable" : "I/O vs amortizing"}</p>
              <h2 className="text-xl md:text-2xl font-bold text-foreground mt-0.5 mb-5">{isEs ? "Ingresa los datos del préstamo" : "Enter loan details"}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="loanAmount" label={isEs ? "Monto del préstamo" : "Loan amount"} prefix="$" value={f.loanAmount} onChange={(v) => update("loanAmount", v)} />
                <Field id="rate" label={isEs ? "Tasa de interés %" : "Interest rate %"} suffix="%" value={f.rate} onChange={(v) => update("rate", v)} />
                <Field id="term" label={isEs ? "Plazo del préstamo (años)" : "Loan term (years)"} value={f.term} onChange={(v) => update("term", v)} hint={isEs ? "Plazo amortizable completo" : "Full amortizing term"} />
                <Field id="ioPeriod" label={isEs ? "Periodo IO (años)" : "I/O period (years)"} value={f.ioPeriod} onChange={(v) => update("ioPeriod", v)} hint={isEs ? "Por defecto 10 años" : "Default 10 years"} />
                <Field id="rent" label={isEs ? "Renta mensual (opcional)" : "Monthly rent (optional)"} prefix="$" value={f.rent} onChange={(v) => update("rent", v)} hint={isEs ? "Para comparar DSCR" : "For DSCR comparison"} />
                <Field id="tax" label={isEs ? "Impuesto predial mensual" : "Monthly tax"} prefix="$" value={f.tax} onChange={(v) => update("tax", v)} />
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
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isEs ? "Comparación" : "Comparison"}</p>

              {results ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-accent/10 ring-2 ring-accent/30 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-accent">{isEs ? "Solo-interés (IO)" : "Interest-only"}</p>
                      <p className="text-2xl font-bold tabular-nums text-foreground mt-1">{fmtUSD2(results.ioPayment)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{isEs ? "por mes" : "per month"}</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 ring-2 ring-border p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{isEs ? "Amortizable" : "Amortizing"}</p>
                      <p className="text-2xl font-bold tabular-nums text-foreground mt-1">{fmtUSD2(results.amortPayment)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{isEs ? "por mes" : "per month"}</p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-secondary/60 p-3 text-center">
                    <p className="text-xs text-muted-foreground">{isEs ? <>El IO te ahorra <span className="font-bold text-success">{fmtUSD2(results.diff)}/mes</span> durante el periodo IO</> : <>I/O saves <span className="font-bold text-success">{fmtUSD2(results.diff)}/mo</span> during the I/O period</>}</p>
                  </div>

                  <dl className="space-y-2 text-sm">
                    <Row label={isEs ? "Intereses totales 5 años (IO)" : "Total interest over 5 yrs (I/O)"} value={fmtUSD(results.ioInterest5yr)} />
                    <Row label={isEs ? "Intereses totales 5 años (amort.)" : "Total interest over 5 yrs (amort)"} value={fmtUSD(results.amortInterest5yr)} />
                    <Row label={isEs ? "Intereses totales 10 años (IO)" : "Total interest over 10 yrs (I/O)"} value={fmtUSD(results.ioInterest10yr)} />
                    <Row label={isEs ? "Intereses totales 10 años (amort.)" : "Total interest over 10 yrs (amort)"} value={fmtUSD(results.amortInterest10yr)} />
                    <Row label={isEs ? `Intereses totales ${term} años (IO + amort.)` : `Total interest full ${term}-yr (I/O + amort)`} value={fmtUSD(results.ioTotalInterest)} />
                    <Row label={isEs ? `Intereses totales ${term} años (solo amort.)` : `Total interest full ${term}-yr (amort only)`} value={fmtUSD(results.amortTotalInterest)} />
                  </dl>

                  {results.dscrIO > 0 && (
                    <>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground pt-2">{isEs ? "Mejora del DSCR" : "DSCR boost"}</p>
                      <dl className="space-y-2 text-sm">
                        <Row label={isEs ? "DSCR con pago IO" : "DSCR with I/O payment"} value={results.dscrIO.toFixed(2)} accent={results.dscrIO >= 1.0 ? "good" : "bad"} bold />
                        <Row label={isEs ? "DSCR con amortizable" : "DSCR with amortizing"} value={results.dscrAmort.toFixed(2)} accent={results.dscrAmort >= 1.0 ? "good" : "bad"} bold />
                        <Row label={isEs ? "Mejora del DSCR por IO" : "DSCR boost from I/O"} value={`+${(results.dscrIO - results.dscrAmort).toFixed(2)}`} accent="good" />
                      </dl>
                    </>
                  )}
                </>
              ) : (
                <div className="rounded-xl bg-muted/40 ring-2 ring-border p-5 text-sm text-muted-foreground">
                  {isEs ? "Ingresa los datos del préstamo para comparar IO vs amortizable." : "Enter loan details to compare I/O vs amortizing."}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border bg-secondary/40 rounded-b-2xl p-5 md:p-7">
            <div className="flex items-start gap-3">
              <Info className="size-5 shrink-0 text-accent mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isEs
                  ? "El solo-interés baja tu pago mensual durante el periodo IO — pero no construyes capital y tu pago sube cuando el préstamo pasa a amortización completa. El IO mejora el DSCR pero aumenta el interés total pagado a lo largo de la vida del préstamo."
                  : "Interest-only lowers your monthly payment during the I/O period — but you build no equity and your payment jumps when the loan converts to full amortization. I/O boosts DSCR but increases total lifetime interest paid."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 p-6 md:p-8 text-primary-foreground">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">{isEs ? "Encuentra prestamistas DSCR con IO" : "Find I/O DSCR lenders"}</h3>
            <p className="mt-1 text-sm opacity-80">{isEs ? "No todos los prestamistas DSCR ofrecen solo-interés. Te conectamos con los que sí. Sin consulta de crédito." : "Not all DSCR lenders offer interest-only. We'll match you with those that do. No credit pull."}</p>
          </div>
          <Button asChild variant="cta" size="lg" className="shrink-0">
            <a href={isEs ? "/es/get-matched?source=io-vs-amortizing-calculator" : "/get-matched?source=io-vs-amortizing-calculator"}>{isEs ? "Cotizar solo-interés" : "Get I/O quotes"} <ArrowRight className="size-4" /></a>
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

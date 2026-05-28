"use client";

import { ArrowRight, Copy, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import {
  type DscrComparisonRow,
  MaxLoanCalculatorComparison,
  MaxLoanCalculatorResultsPanel,
} from "@/components/calculators/MaxLoanCalculatorResults";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { monthlyPI, parseNum, solveLoanFromPayment } from "@/lib/finance";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const piYears = (p: number, r: number, y: number) => monthlyPI(p, r, y * 12);
const maxLoanFromPI = (pi: number, r: number, y: number) =>
  solveLoanFromPayment(pi, r, y * 12);

/* -------------------------------------------------------------------------- */
/*  Types & defaults                                                           */
/* -------------------------------------------------------------------------- */

interface Fields {
  rent: string;
  tax: string;
  ins: string;
  hoa: string;
  flood: string;
  rate: string;
  term: "30" | "15";
  targetDscr: "0.75" | "1.0" | "1.25";
}

const DEFAULTS: Fields = {
  rent: "2800",
  tax: "320",
  ins: "110",
  hoa: "0",
  flood: "0",
  rate: "7.25",
  term: "30",
  targetDscr: "1.0",
};

function getInitialFields(): Fields {
  if (typeof window === "undefined") return DEFAULTS;
  const p = new URLSearchParams(window.location.search);
  const next = { ...DEFAULTS };
  (Object.keys(DEFAULTS) as (keyof Fields)[]).forEach((k) => {
    const v = p.get(k);
    if (v != null) (next[k] as string) = v;
  });
  return next;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

interface MaxLoanCalculatorProps {
  lang?: "en" | "es";
}

export default function MaxLoanCalculator({ lang = "en" }: MaxLoanCalculatorProps = {}) {
  const isEs = lang === "es";
  const [f, setF] = useState<Fields>(() => getInitialFields());
  const [copied, setCopied] = useState(false);

  const rent = parseNum(f.rent);
  const tax = parseNum(f.tax);
  const ins = parseNum(f.ins);
  const hoa = parseNum(f.hoa);
  const flood = parseNum(f.flood);
  const rate = parseNum(f.rate);
  const term = parseInt(f.term, 10);
  const targetDscr = parseFloat(f.targetDscr);

  const fixedCosts = tax + ins + hoa + flood; // monthly non-P&I costs

  const results = useMemo(() => {
    if (rent <= 0 || rate <= 0) return null;

    // Max monthly P&I to stay at or above targetDscr
    // rent / (pi + fixedCosts) >= targetDscr
    // pi <= rent / targetDscr - fixedCosts
    const maxPI = rent / targetDscr - fixedCosts;

    if (maxPI <= 0) return { maxPI: 0, maxLoan: 0, pp75: 0, pp80: 0, warn: true };

    const maxLoan = maxLoanFromPI(maxPI, rate, term);

    // Purchase price back-calc at LTV
    const pp75 = maxLoan / 0.75;
    const pp80 = maxLoan / 0.80;

    // Sanity-check: verify the computed loan payment matches
    const checkPI = piYears(maxLoan, rate, term);
    const checkDscr = rent / (checkPI + fixedCosts);

    return {
      maxPI,
      maxLoan,
      pp75,
      pp80,
      checkDscr,
      warn: rent < 500 || rent > 30000,
    };
  }, [rent, rate, term, targetDscr, fixedCosts]);

  const comparisonRows = useMemo<DscrComparisonRow[]>(
    () =>
      (["0.75", "1.0", "1.25"] as const).map((dscrTarget) => {
        const dscrTargetNum = parseFloat(dscrTarget);
        const maxPI = rent / dscrTargetNum - fixedCosts;
        const maxLoan = maxPI > 0 ? maxLoanFromPI(maxPI, rate, term) : 0;
        return { dscr: dscrTarget, maxPI, maxLoan };
      }),
    [fixedCosts, rate, rent, term],
  );

  function update<K extends keyof Fields>(k: K, v: Fields[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  function reset() {
    setF(DEFAULTS);
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }

  function copyLink() {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams();
    (Object.keys(f) as (keyof Fields)[]).forEach((k) => p.set(k, String(f[k])));
    const url = `${window.location.origin}${window.location.pathname}?${p.toString()}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-accent/50 via-accent/20 to-primary/20 p-[1.5px] shadow-lg">
        <div className="rounded-2xl bg-card">
          <div className="grid gap-0 lg:grid-cols-5">
            {/* Inputs */}
            <div className="lg:col-span-3 p-5 md:p-7 border-b lg:border-b-0 lg:border-r border-border">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wider text-accent">
                  {isEs ? "Datos del préstamo" : "Loan inputs"}
                </p>
                <h2 className="text-xl md:text-2xl font-bold text-foreground mt-0.5">
                  {isEs ? "¿Cuál es el préstamo máximo?" : "What's the max loan?"}
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <MoneyField
                  id="rent"
                  label={isEs ? "Renta mensual bruta" : "Monthly gross rent"}
                  value={f.rent}
                  onChange={(v) => update("rent", v)}
                  hint={isEs ? "Renta de mercado o contrato vigente" : "Market rent or in-place lease"}
                />
                <MoneyField
                  id="tax"
                  label={isEs ? "Impuesto predial mensual" : "Monthly property tax"}
                  value={f.tax}
                  onChange={(v) => update("tax", v)}
                  hint={isEs ? "Impuesto anual ÷ 12" : "Annual tax ÷ 12"}
                />
                <MoneyField
                  id="ins"
                  label={isEs ? "Seguro mensual" : "Monthly insurance"}
                  value={f.ins}
                  onChange={(v) => update("ins", v)}
                  hint={isEs ? "Prima de riesgo ÷ 12" : "Hazard premium ÷ 12"}
                />
                <MoneyField
                  id="hoa"
                  label={isEs ? "HOA mensual" : "Monthly HOA"}
                  value={f.hoa}
                  onChange={(v) => update("hoa", v)}
                  hint={isEs ? "Opcional" : "Optional"}
                />
                <MoneyField
                  id="flood"
                  label={isEs ? "Inundación / otros $/mes" : "Flood / other $/mo"}
                  value={f.flood}
                  onChange={(v) => update("flood", v)}
                  hint={isEs ? "Opcional" : "Optional"}
                />
                <div className="grid gap-1.5">
                  <Label htmlFor="rate" className="text-xs font-medium text-foreground">
                    {isEs ? "Tasa de interés %" : "Interest rate %"}
                  </Label>
                  <div className="relative">
                    <Input
                      id="rate"
                      inputMode="decimal"
                      autoComplete="off"
                      className="pr-7 tabular-nums"
                      value={f.rate}
                      onChange={(e) => update("rate", e.target.value.replace(/[^0-9.]/g, ""))}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                </div>
              </div>

              {/* Term + DSCR target */}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-foreground">{isEs ? "Plazo del préstamo" : "Loan term"}</Label>
                  <div className="flex gap-2">
                    {(["30", "15"] as const).map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => update("term", t)}
                        className={cn(
                          "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition",
                          f.term === t
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border text-muted-foreground hover:border-accent/60"
                        )}
                      >
                        {t} {isEs ? "años" : "yr"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-foreground">{isEs ? "DSCR objetivo" : "Target DSCR"}</Label>
                  <div className="flex gap-2">
                    {(["0.75", "1.0", "1.25"] as const).map((d) => (
                      <button
                        type="button"
                        key={d}
                        onClick={() => update("targetDscr", d)}
                        className={cn(
                          "flex-1 rounded-md border px-2 py-2 text-sm font-medium transition",
                          f.targetDscr === d
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border text-muted-foreground hover:border-accent/60"
                        )}
                      >
                        {d}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={reset}>
                  <RotateCcw className="size-3.5" />
                  {isEs ? "Restablecer" : "Reset"}
                </Button>
                <Button variant="ghost" size="sm" onClick={copyLink}>
                  <Copy className="size-3.5" />
                  {copied ? (isEs ? "¡Copiado!" : "Copied!") : (isEs ? "Copiar enlace para compartir" : "Copy shareable link")}
                </Button>
              </div>
            </div>

            <MaxLoanCalculatorResultsPanel
              isEs={isEs}
              results={results}
              fixedCosts={fixedCosts}
              rate={f.rate}
              term={f.term}
              targetDscr={f.targetDscr}
            />
          </div>
        </div>
      </div>

      <MaxLoanCalculatorComparison
        isEs={isEs}
        selectedTargetDscr={f.targetDscr}
        showComparison={Boolean(results && results.maxLoan > 0)}
        rows={comparisonRows}
      />

      {/* CTA */}
      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 p-6 md:p-8 text-primary-foreground">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">{isEs ? "¿Listo para encontrar tu préstamo?" : "Ready to find your loan?"}</h3>
            <p className="mt-1 text-sm opacity-80">
              {isEs
                ? "Cotizamos con más de 1,000 prestamistas DSCR y te entregamos tus 3 mejores ofertas — usualmente dentro de una hora hábil. Sin consulta de crédito."
                : "We shop 1,000+ multifamily lenders and return your top 3 offers — usually within one business hour. No credit pull."}
            </p>
          </div>
          <Button asChild variant="cta" size="lg" className="shrink-0">
            <a href={isEs ? "/deal-review?source=max-loan-calculator" : "/deal-review?source=max-loan-calculator"}>
              {isEs ? "Ver mis ofertas" : "Get my matches"}
              <ArrowRight className="size-4" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Subcomponents                                                             */
/* -------------------------------------------------------------------------- */

function MoneyField({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className="pl-7 tabular-nums"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        />
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

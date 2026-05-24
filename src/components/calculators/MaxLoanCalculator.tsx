"use client";

import { ArrowRight, Copy, Info, RotateCcw, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtUSD, monthlyPI, parseNum, solveLoanFromPayment } from "@/lib/finance";

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

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

interface MaxLoanCalculatorProps {
  lang?: "en" | "es";
}

export default function MaxLoanCalculator({ lang = "en" }: MaxLoanCalculatorProps = {}) {
  const isEs = lang === "es";
  const [f, setF] = useState<Fields>(DEFAULTS);
  const [copied, setCopied] = useState(false);

  // Hydrate from URL params
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const next = { ...DEFAULTS };
    let touched = false;
    (Object.keys(DEFAULTS) as (keyof Fields)[]).forEach((k) => {
      const v = p.get(k);
      if (v != null) {
        touched = true;
        (next[k] as string) = v;
      }
    });
    if (touched) setF(next);
  }, []);

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
  }, [rent, tax, ins, hoa, flood, rate, term, targetDscr]);

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

            {/* Results */}
            <div className="lg:col-span-2 p-5 md:p-7 flex flex-col gap-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isEs ? "Resultados del préstamo máximo" : "Max loan results"}
              </p>

              {results && results.maxLoan > 0 ? (
                <>
                  <div className="rounded-xl bg-accent/10 ring-2 ring-accent/30 p-5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-bold">{isEs ? "Monto máximo del préstamo" : "Max loan amount"}</p>
                    <div className="text-5xl font-bold text-accent tabular-nums mt-1">
                      {fmtUSD(results.maxLoan)}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {isEs ? `Al ${f.rate}% / ${f.term} años · mantiene DSCR ≥ ${f.targetDscr}x` : `At ${f.rate}% / ${f.term}-yr · keeps DSCR ≥ ${f.targetDscr}x`}
                    </p>
                  </div>

                  <dl className="space-y-2 text-sm">
                    <ResultRow label={isEs ? "Principal e intereses máximo mensual" : "Max monthly P&I"} value={fmtUSD(results.maxPI)} />
                    <ResultRow label={isEs ? "Costos fijos mensuales (impuesto + seguro + HOA)" : "Monthly fixed costs (tax + ins + HOA)"} value={fmtUSD(fixedCosts)} />
                    <ResultRow label={isEs ? "Compra máxima @ 75% LTV" : "Max purchase @ 75% LTV"} value={fmtUSD(results.pp75)} bold />
                    <ResultRow label={isEs ? "Compra máxima @ 80% LTV" : "Max purchase @ 80% LTV"} value={fmtUSD(results.pp80)} bold />
                  </dl>

                  {results.warn && (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                      {isEs ? (
                        <>
                          <strong>Verifica tu valor de renta</strong> — el valor ingresado parece estar fuera del rango típico. Verifica y vuelve a calcular.
                        </>
                      ) : (
                        <>
                          <strong>Double-check your rent input</strong> — the value entered seems outside a typical range. Verify and re-run.
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl bg-muted/40 ring-2 ring-border p-5 text-center">
                  <p className="text-muted-foreground text-sm">
                    {results && results.maxPI <= 0
                      ? (isEs
                          ? "Los costos fijos exceden la renta a este DSCR objetivo — no hay margen para principal e intereses. Reduce los costos fijos o usa un DSCR objetivo más bajo."
                          : "Fixed costs exceed rent at this DSCR target — no P&I room left. Lower fixed costs or use a lower DSCR target.")
                      : (isEs
                          ? "Ingresa renta, costos fijos y tasa para calcular tu préstamo máximo."
                          : "Enter rent, fixed costs, and rate to calculate your max loan.")}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Info footer */}
          <div className="border-t border-border bg-secondary/40 rounded-b-2xl p-5 md:p-7">
            <div className="flex items-start gap-3">
              <Info className="size-5 shrink-0 text-accent mt-0.5" />
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">{isEs ? "Cómo funciona" : "How this works"}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {isEs
                    ? "Resolvemos para el principal e intereses mensual máximo de modo que renta ÷ (P&I + costos fijos) ≥ tu DSCR objetivo, y luego calculamos el monto del préstamo usando amortización estándar. Los rangos de precio de compra asumen 75% y 80% LTV al cierre. Ajusta el DSCR objetivo para modelar diferentes requisitos de prestamistas."
                    : "We solve for the maximum monthly P&I such that rent ÷ (P&I + fixed costs) ≥ your target DSCR, then back-calculate the loan amount using standard amortization. The purchase price ranges assume 75% and 80% LTV at closing. Adjust the target DSCR to model different lender requirements."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Try adjusting */}
      {results && results.maxLoan > 0 && (
        <div className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/5 to-transparent p-5 md:p-7">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="size-4 text-accent" />
            <h3 className="text-lg font-bold text-foreground">{isEs ? "Comparación de DSCR objetivo" : "DSCR target comparison"}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4">{isEs ? "DSCR objetivo" : "Target DSCR"}</th>
                  <th className="py-2 pr-4">{isEs ? "P&I máximo / mes" : "Max P&I / mo"}</th>
                  <th className="py-2 pr-4">{isEs ? "Préstamo máximo" : "Max loan"}</th>
                  <th className="py-2">{isEs ? "Precio máximo @ 75%" : "Max price @ 75%"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(["0.75", "1.0", "1.25"] as const).map((d) => {
                  const td = parseFloat(d);
                  const mpi = rent / td - fixedCosts;
                  const ml = mpi > 0 ? maxLoanFromPI(mpi, rate, term) : 0;
                  return (
                    <tr key={d} className={cn(f.targetDscr === d && "bg-accent/10")}>
                      <td className="py-2.5 pr-4 font-semibold">{d}x</td>
                      <td className="py-2.5 pr-4 tabular-nums">{mpi > 0 ? fmtUSD(mpi) : "—"}</td>
                      <td className="py-2.5 pr-4 tabular-nums">{ml > 0 ? fmtUSD(ml) : "—"}</td>
                      <td className="py-2.5 tabular-nums">{ml > 0 ? fmtUSD(ml / 0.75) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

function ResultRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums", bold && "font-bold text-foreground")}>{value}</dd>
    </div>
  );
}

"use client";

import { AlertTriangle, ArrowRight, Copy, Info, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtUSD, parseNum } from "@/lib/finance";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function ltvTier(ltv: number, isEs: boolean) {
  if (ltv <= 0) return { label: "—", color: "text-muted-foreground", bg: "bg-muted/40", ring: "ring-border" };
  if (ltv <= 65) return { label: isEs ? "≤65% — conservador" : "≤65% — conservative", color: "text-success", bg: "bg-success/10", ring: "ring-success/40" };
  if (ltv <= 75) return { label: isEs ? "65–75% — refinanciamiento DSCR estándar con retiro" : "65–75% — standard DSCR cash-out", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10", ring: "ring-yellow-500/40" };
  if (ltv <= 80) return { label: isEs ? "75–80% — agresivo" : "75–80% — aggressive", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/40" };
  return { label: isEs ? ">80% — restringido (la mayoría de prestamistas)" : ">80% — restricted (most lenders)", color: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/40" };
}

/* -------------------------------------------------------------------------- */
/*  Types & defaults                                                           */
/* -------------------------------------------------------------------------- */

interface Fields {
  propValue: string;
  currentBalance: string;
  targetLtv: string;
  closingPct: string;
  ppp: string;
}

const DEFAULTS: Fields = {
  propValue: "400000",
  currentBalance: "220000",
  targetLtv: "75",
  closingPct: "2.5",
  ppp: "0",
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

interface CashOutRefiCalculatorProps {
  lang?: "en" | "es";
}

export default function CashOutRefiCalculator({ lang = "en" }: CashOutRefiCalculatorProps = {}) {
  const isEs = lang === "es";
  const [f, setF] = useState<Fields>(DEFAULTS);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const next = { ...DEFAULTS };
    let touched = false;
    (Object.keys(DEFAULTS) as (keyof Fields)[]).forEach((k) => {
      const v = p.get(k);
      if (v != null) { touched = true; (next[k] as string) = v; }
    });
    if (touched) setF(next);
  }, []);

  const v = useMemo(() => {
    const propValue = parseNum(f.propValue);
    const currentBalance = parseNum(f.currentBalance);
    const targetLtv = Math.min(parseNum(f.targetLtv), 75); // cap at 75% per spec
    const closingPct = parseNum(f.closingPct);
    const ppp = parseNum(f.ppp);

    const newLoan = propValue * targetLtv / 100;
    const closingCosts = newLoan * closingPct / 100;
    const grossProceeds = newLoan - currentBalance;
    const netToBorrower = grossProceeds - closingCosts - ppp;
    const effectiveLtv = propValue > 0 ? (newLoan / propValue) * 100 : 0;
    const equityRemaining = propValue - newLoan;

    return {
      propValue, currentBalance, newLoan, closingCosts, ppp,
      grossProceeds, netToBorrower, effectiveLtv, equityRemaining,
      cappedLtv: targetLtv,
    };
  }, [f]);

  const t = ltvTier(v.effectiveLtv, isEs);

  function update(k: keyof Fields, val: string) {
    setF((prev) => ({ ...prev, [k]: val }));
  }

  function reset() {
    setF(DEFAULTS);
    if (typeof window !== "undefined") window.history.replaceState({}, "", window.location.pathname);
  }

  function copyLink() {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams();
    (Object.keys(f) as (keyof Fields)[]).forEach((k) => p.set(k, f[k]));
    navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?${p}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const ltvInputWarnOver75 = parseNum(f.targetLtv) > 75;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-accent/50 via-accent/20 to-primary/20 p-[1.5px] shadow-lg">
        <div className="rounded-2xl bg-card">
          <div className="grid gap-0 lg:grid-cols-5">
            {/* Inputs */}
            <div className="lg:col-span-3 p-5 md:p-7 border-b lg:border-b-0 lg:border-r border-border">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wider text-accent">{isEs ? "Refinanciamiento con retiro de efectivo" : "Cash-Out Refi"}</p>
                <h2 className="text-xl md:text-2xl font-bold text-foreground mt-0.5">{isEs ? "¿Cuánto puedes retirar?" : "How much can you pull out?"}</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <MoneyField id="propValue" label={isEs ? "Valor actual de la propiedad" : "Current property value"} value={f.propValue} onChange={(v) => update("propValue", v)} hint={isEs ? "Valor estimado de avalúo" : "Estimated appraisal value"} />
                <MoneyField id="currentBalance" label={isEs ? "Saldo actual del préstamo" : "Current loan balance"} value={f.currentBalance} onChange={(v) => update("currentBalance", v)} />
                <div className="grid gap-1.5">
                  <Label htmlFor="targetLtv" className="text-xs font-medium text-foreground">{isEs ? "LTV objetivo % (máx 75%)" : "Target LTV % (max 75%)"}</Label>
                  <div className="relative">
                    <Input id="targetLtv" inputMode="decimal" autoComplete="off" className="pr-7 tabular-nums" value={f.targetLtv}
                      onChange={(e) => update("targetLtv", e.target.value.replace(/[^0-9.]/g, ""))} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                  {ltvInputWarnOver75 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">{isEs ? "La mayoría de prestamistas DSCR limitan el retiro de efectivo al 75% LTV — limitado para el cálculo." : "Most DSCR lenders cap cash-out at 75% LTV — capped for calculation."}</p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="closingPct" className="text-xs font-medium text-foreground">{isEs ? "Costos de cierre % (por defecto 2.5%)" : "Closing costs % (default 2.5%)"}</Label>
                  <div className="relative">
                    <Input id="closingPct" inputMode="decimal" autoComplete="off" className="pr-7 tabular-nums" value={f.closingPct}
                      onChange={(e) => update("closingPct", e.target.value.replace(/[^0-9.]/g, ""))} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                </div>
                <MoneyField id="ppp" label={isEs ? "Penalidad por prepago $" : "Prepayment penalty $"} value={f.ppp} onChange={(v) => update("ppp", v)} hint={isEs ? "Opcional — revisa tu pagaré" : "Optional — check your note"} />
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={reset}>
                  <RotateCcw className="size-3.5" /> {isEs ? "Restablecer" : "Reset"}
                </Button>
                <Button variant="ghost" size="sm" onClick={copyLink}>
                  <Copy className="size-3.5" /> {copied ? (isEs ? "¡Copiado!" : "Copied!") : (isEs ? "Copiar enlace para compartir" : "Copy shareable link")}
                </Button>
              </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-2 p-5 md:p-7 flex flex-col gap-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isEs ? "Resultados" : "Results"}</p>

              {v.propValue > 0 ? (
                <>
                  {/* Net to borrower highlight */}
                  <div className={cn("rounded-xl p-5 ring-2 transition", v.netToBorrower >= 0 ? "ring-accent/40 bg-accent/10" : "ring-destructive/40 bg-destructive/10")}>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isEs ? "Neto al prestatario" : "Net to borrower"}</p>
                    <div className={cn("text-5xl font-bold tabular-nums mt-1", v.netToBorrower >= 0 ? "text-accent" : "text-destructive")}>
                      {fmtUSD(v.netToBorrower)}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{isEs ? "Después del pago, costos de cierre" : "After payoff, closing costs"}{v.ppp > 0 ? (isEs ? ", y penalidad por prepago" : ", and PPP") : ""}</p>
                  </div>

                  {/* LTV badge */}
                  <div className={cn("rounded-lg p-3 ring-1 transition text-sm", t.ring, t.bg)}>
                    <span className={cn("font-semibold", t.color)}>{isEs ? "LTV efectivo" : "Effective LTV"}: {v.effectiveLtv.toFixed(1)}%</span>
                    <span className="ml-2 text-muted-foreground">— {t.label.split("—")[1]?.trim()}</span>
                  </div>

                  <dl className="space-y-1.5 text-sm">
                    <ResultRow label={isEs ? "Nuevo monto del préstamo" : "New loan amount"} value={fmtUSD(v.newLoan)} bold />
                    <ResultRow label={isEs ? "Menos pago del saldo actual" : "Less current balance payoff"} value={`(${fmtUSD(v.currentBalance)})`} accent="bad" />
                    <ResultRow label={isEs ? "Producto bruto" : "Gross proceeds"} value={fmtUSD(v.grossProceeds)} bold={v.grossProceeds >= 0} accent={v.grossProceeds >= 0 ? "good" : "bad"} />
                    <ResultRow label={isEs ? "Menos costos de cierre" : "Less closing costs"} value={`(${fmtUSD(v.closingCosts)})`} accent="bad" />
                    {v.ppp > 0 && <ResultRow label={isEs ? "Menos penalidad por prepago" : "Less prepayment penalty"} value={`(${fmtUSD(v.ppp)})`} accent="bad" />}
                    <ResultRow label={isEs ? "Neto al prestatario" : "Net to borrower"} value={fmtUSD(v.netToBorrower)} bold accent={v.netToBorrower >= 0 ? "good" : "bad"} />
                    <ResultRow label={isEs ? "Capital restante después del refi" : "Equity remaining post-refi"} value={fmtUSD(v.equityRemaining)} />
                  </dl>
                </>
              ) : (
                <div className="rounded-xl bg-muted/40 ring-2 ring-border p-5 text-center">
                  <p className="text-muted-foreground text-sm">{isEs ? "Ingresa el valor de la propiedad y el saldo del préstamo para calcular el producto del retiro de efectivo." : "Enter your property value and loan balance to calculate cash-out proceeds."}</p>
                </div>
              )}
            </div>
          </div>

          {/* DSCR warning footer */}
          <div className="border-t border-border bg-amber-500/5 rounded-b-2xl p-5 md:p-7">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 shrink-0 text-amber-500 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-foreground">{isEs ? "Verifica el flujo de caja después del refi" : "Verify cash flow after refi"}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {isEs ? (
                    <>Un nuevo monto de préstamo más alto significa un pago mensual de principal e intereses más alto — lo que reduce directamente tu DSCR. <a href="/es/tools/dscr-calculator" className="text-primary font-medium hover:underline">Usa la calculadora de DSCR</a> con los nuevos datos del préstamo para confirmar que la propiedad sigue calificando antes de proceder.</>
                  ) : (
                    <>A higher new loan amount means a higher monthly P&I — which directly reduces your DSCR. <a href="/tools/dscr-calculator" className="text-primary font-medium hover:underline">Run the DSCR Calculator</a> with the new loan details to confirm the property still qualifies before proceeding.</>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-border bg-card p-5 md:p-7">
        <div className="flex items-start gap-3">
          <Info className="size-5 shrink-0 text-accent mt-0.5" />
          <div>
            <h3 className="text-base font-bold text-foreground mb-2">{isEs ? "Por qué 75% es el tope estándar de DSCR para retiro de efectivo" : "Why 75% is the standard DSCR cash-out cap"}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isEs
                ? "La mayoría de prestamistas DSCR limitan el refinanciamiento con retiro de efectivo al 75% LTV — más estricto que el 80% disponible en refis de tasa y plazo. Esto protege la posición de garantía del prestamista cuando se está extrayendo capital. Algunos programas llegan al 80% para expedientes con DSCR alto (1.25+) y crédito sólido (740+). El tope del 75% es la suposición de trabajo de esta calculadora."
                : "Most DSCR lenders limit cash-out refinances to 75% LTV — tighter than the 80% available on rate-and-term refis. This protects the lender's collateral position when equity is being extracted. A handful of programs go to 80% for high-DSCR files (1.25+) with strong credit (740+). The 75% cap is the working assumption for this calculator."}
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 p-6 md:p-8 text-primary-foreground">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">{isEs ? "Cotiza tu refinanciamiento con retiro de efectivo" : "Get cash-out refi quotes"}</h3>
            <p className="mt-1 text-sm opacity-80">{isEs ? "Comparamos más de 1,000 prestamistas DSCR — las 3 mejores ofertas en una hora. Sin consulta de crédito." : "We shop 1,000+ DSCR lenders — top 3 offers in one hour. No credit pull."}</p>
          </div>
          <Button asChild variant="cta" size="lg" className="shrink-0">
            <a href={isEs ? "/es/get-matched?source=cash-out-refi-calculator" : "/get-matched?source=cash-out-refi-calculator"}>{isEs ? "Ver mis ofertas" : "Get my matches"} <ArrowRight className="size-4" /></a>
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Subcomponents                                                             */
/* -------------------------------------------------------------------------- */

function MoneyField({ id, label, value, onChange, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-foreground">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
        <Input id={id} inputMode="decimal" autoComplete="off" className="pl-7 tabular-nums" value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))} />
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ResultRow({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: "good" | "bad" }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums text-sm", bold && "font-bold text-foreground", accent === "good" && "text-success font-semibold", accent === "bad" && "text-destructive font-semibold")}>
        {value}
      </dd>
    </div>
  );
}

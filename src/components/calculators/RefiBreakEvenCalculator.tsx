"use client";

import { ArrowRight, Info, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtUSD, fmtUSD2, parseNum } from "@/lib/finance";

interface Fields {
  currentPI: string;
  newPI: string;
  closingCosts: string;
  pppCost: string;
}

interface RefiBreakEvenCalculatorProps {
  lang?: "en" | "es";
}

const DEFAULTS: Fields = {
  currentPI: "2180",
  newPI: "1920",
  closingCosts: "6500",
  pppCost: "0",
};

export default function RefiBreakEvenCalculator({ lang = "en" }: RefiBreakEvenCalculatorProps = {}) {
  const isEs = lang === "es";
  const [f, setF] = useState<Fields>(DEFAULTS);

  const currentPI = parseNum(f.currentPI);
  const newPI = parseNum(f.newPI);
  const closingCosts = parseNum(f.closingCosts);
  const pppCost = parseNum(f.pppCost);

  const results = useMemo(() => {
    if (currentPI <= 0 || newPI <= 0) return null;

    const monthlySavings = currentPI - newPI;
    const totalUpfront = closingCosts + pppCost;

    if (monthlySavings <= 0) {
      return {
        monthlySavings: 0,
        totalUpfront,
        breakEvenMonths: Infinity,
        net5yr: -totalUpfront,
        net10yr: -totalUpfront,
        verdict: "no-savings" as const,
      };
    }

    const breakEvenMonths = totalUpfront / monthlySavings;
    const net5yr = monthlySavings * 60 - totalUpfront;
    const net10yr = monthlySavings * 120 - totalUpfront;

    return { monthlySavings, totalUpfront, breakEvenMonths, net5yr, net10yr, verdict: "ok" as const };
  }, [currentPI, newPI, closingCosts, pppCost]);

  function update<K extends keyof Fields>(k: K, v: string) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  const verdictDisplay = results
    ? results.verdict === "no-savings"
      ? { label: isEs ? "El nuevo pago no es menor" : "New payment is not lower", color: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/40" }
      : results.breakEvenMonths <= 24
      ? { label: isEs ? "Caso de refinanciamiento sólido" : "Strong refi case", color: "text-success", bg: "bg-success/10", ring: "ring-success/40" }
      : results.breakEvenMonths <= 48
      ? { label: isEs ? "Razonable — revisa tu período de tenencia" : "Reasonable — check your hold period", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10", ring: "ring-yellow-500/40" }
      : { label: isEs ? "Recuperación lenta — procede con cuidado" : "Long payback — proceed carefully", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/40" }
    : null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-accent/50 via-accent/20 to-primary/20 p-[1.5px] shadow-lg">
        <div className="rounded-2xl bg-card">
          <div className="grid gap-0 lg:grid-cols-5">
            <div className="lg:col-span-3 p-5 md:p-7 border-b lg:border-b-0 lg:border-r border-border">
              <p className="text-xs font-bold uppercase tracking-wider text-accent">{isEs ? "Datos del refinanciamiento" : "Refinance inputs"}</p>
              <h2 className="text-xl md:text-2xl font-bold text-foreground mt-0.5 mb-5">{isEs ? "Ingresa tu escenario de refinanciamiento" : "Enter your refi scenario"}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="currentPI" label={isEs ? "Pago P&I actual" : "Current P&I payment"} prefix="$" value={f.currentPI} onChange={(v) => update("currentPI", v)} hint={isEs ? "Capital + interés mensual de hoy" : "Today's monthly principal + interest"} />
                <Field id="newPI" label={isEs ? "Nuevo pago P&I" : "New P&I payment"} prefix="$" value={f.newPI} onChange={(v) => update("newPI", v)} hint={isEs ? "Después del refinanciamiento" : "After refinance"} />
                <Field id="closingCosts" label={isEs ? "Costos de cierre" : "Closing costs"} prefix="$" value={f.closingCosts} onChange={(v) => update("closingCosts", v)} hint={isEs ? "Cargos del prestamista, título, avalúo, etc." : "Lender fees, title, appraisal, etc."} />
                <Field id="pppCost" label={isEs ? "Penalización por pago anticipado (opcional)" : "Prepayment penalty (optional)"} prefix="$" value={f.pppCost} onChange={(v) => update("pppCost", v)} hint={isEs ? "Deja 0 si no hay PPP en el préstamo actual" : "Leave 0 if no PPP on current loan"} />
              </div>
              <div className="mt-6">
                <Button variant="outline" size="sm" onClick={() => setF(DEFAULTS)}>
                  <RotateCcw className="size-3.5" /> {isEs ? "Restablecer" : "Reset"}
                </Button>
              </div>
            </div>

            <div className="lg:col-span-2 p-5 md:p-7 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isEs ? "Análisis de punto de equilibrio" : "Break-even analysis"}</p>

              {results && verdictDisplay ? (
                <>
                  <div className={cn("rounded-xl p-4 ring-2", verdictDisplay.ring, verdictDisplay.bg)}>
                    <div className={cn("text-lg font-bold", verdictDisplay.color)}>{verdictDisplay.label}</div>
                    {isFinite(results.breakEvenMonths) && results.monthlySavings > 0 && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {isEs ? "Punto de equilibrio en " : "Break-even in "}<strong>{Math.ceil(results.breakEvenMonths)} {isEs ? "meses" : "months"}</strong> ({(results.breakEvenMonths / 12).toFixed(1)} {isEs ? "años" : "years"})
                      </p>
                    )}
                  </div>

                  <dl className="space-y-2 text-sm">
                    <Row label={isEs ? "Ahorro mensual del pago" : "Monthly payment savings"} value={fmtUSD2(results.monthlySavings)} accent={results.monthlySavings > 0 ? "good" : "bad"} />
                    <Row label={isEs ? "Costo inicial total" : "Total upfront cost"} value={fmtUSD(results.totalUpfront)} bold />
                    <Row label={isEs ? "Ahorro neto en 5 años" : "Net savings over 5 years"} value={fmtUSD(results.net5yr)} accent={results.net5yr >= 0 ? "good" : "bad"} />
                    <Row label={isEs ? "Ahorro neto en 10 años" : "Net savings over 10 years"} value={fmtUSD(results.net10yr)} accent={results.net10yr >= 0 ? "good" : "bad"} bold />
                  </dl>
                </>
              ) : (
                <div className="rounded-xl bg-muted/40 ring-2 ring-border p-5 text-sm text-muted-foreground">
                  {isEs ? "Ingresa los pagos actual y nuevo para ver tu punto de equilibrio." : "Enter current and new payments to see your break-even."}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border bg-secondary/40 rounded-b-2xl p-5 md:p-7">
            <div className="flex items-start gap-3">
              <Info className="size-5 shrink-0 text-accent mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isEs
                  ? "El punto de equilibrio es donde los ahorros mensuales acumulados igualan tus costos iniciales (costos de cierre + cualquier penalización por pago anticipado). Si vendes o refinancias de nuevo antes del punto de equilibrio, el refinanciamiento te costó dinero neto."
                  : "The break-even point is where cumulative monthly savings equal your upfront costs (closing costs + any prepayment penalty). If you sell or refinance again before break-even, the refi cost you money net."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 p-6 md:p-8 text-primary-foreground">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">{isEs ? "Cotiza tu tasa de refinanciamiento ahora" : "Shop your refi rate now"}</h3>
            <p className="mt-1 text-sm opacity-80">{isEs ? "Comparamos más de 1,000 prestamistas DSCR y te devolvemos tus 3 mejores ofertas de refinanciamiento en una hora. Sin consulta de crédito." : "We shop 1,000+ DSCR lenders and return your top 3 refi offers in one hour. No credit pull."}</p>
          </div>
          <Button asChild variant="cta" size="lg" className="shrink-0">
            <a href={isEs ? "/es/get-matched?source=refi-break-even-calculator" : "/get-matched?source=refi-break-even-calculator"}>{isEs ? "Cotizar refinanciamiento" : "Get refi quotes"} <ArrowRight className="size-4" /></a>
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

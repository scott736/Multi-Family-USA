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

function onePercTier(actual: number, required: number, isEs: boolean) {
  if (required <= 0) return { label: isEs ? "Ingresa un precio de compra" : "Enter a purchase price", color: "text-muted-foreground", bg: "bg-muted/40", ring: "ring-border" };
  const ratio = actual > 0 ? actual / required : 0;
  if (actual <= 0) return { label: isEs ? "Ingresa la renta actual para ver cómo te comparas" : "Enter current rent to see how you compare", color: "text-muted-foreground", bg: "bg-muted/40", ring: "ring-border" };
  if (ratio >= 1) return { label: isEs ? "Aprueba la regla del 1%" : "Passes 1% rule", color: "text-success", bg: "bg-success/10", ring: "ring-success/40" };
  if (ratio >= 0.8) return { label: isEs ? "Cerca — dentro del 20% del objetivo" : "Close — within 20% of target", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/40" };
  return { label: isEs ? "No aprueba la regla del 1% — haz un análisis completo" : "Fails 1% rule — run full analysis", color: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/40" };
}

/* -------------------------------------------------------------------------- */
/*  Types & defaults                                                           */
/* -------------------------------------------------------------------------- */

interface Fields {
  price: string;
  rent: string;
  pitia: string;
}

interface OnePercentRuleCalculatorProps {
  lang?: "en" | "es";
}

const DEFAULTS: Fields = {
  price: "200000",
  rent: "1850",
  pitia: "1150",
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function OnePercentRuleCalculator({ lang = "en" }: OnePercentRuleCalculatorProps = {}) {
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
    const price = parseNum(f.price);
    const rent = parseNum(f.rent);
    const pitia = parseNum(f.pitia);

    // 1% rule
    const required1Pct = price * 0.01;
    const actual1PctRatio = required1Pct > 0 ? (rent / required1Pct) * 100 : 0;

    // 50% rule — estimated annual expenses = 50% of gross rent
    const annualGross = rent * 12;
    const estimated50PctExpenses = annualGross * 0.5;
    const annualNOI50 = annualGross - estimated50PctExpenses;
    const annualPITIA = pitia * 12;
    const annualCashFlow50 = annualNOI50 - annualPITIA;
    const monthlyCashFlow50 = annualCashFlow50 / 12;

    // What price would make 1% work at this rent
    const priceFor1Pct = rent > 0 ? rent / 0.01 : 0;
    const priceDelta = priceFor1Pct - price;

    return {
      price, rent, pitia,
      required1Pct, actual1PctRatio,
      annualGross, estimated50PctExpenses, annualNOI50,
      annualPITIA, annualCashFlow50, monthlyCashFlow50,
      priceFor1Pct, priceDelta,
    };
  }, [f]);

  const t = onePercTier(v.rent, v.required1Pct, isEs);

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

  return (
    <div className="space-y-6">
      {/* Screener caveat banner */}
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3">
        <AlertTriangle className="size-5 shrink-0 text-amber-500 mt-0.5" />
        <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
          <strong>{isEs ? "Solo filtro — no sustituye un análisis completo." : "Screener only — not a substitute for full analysis."}</strong> {isEs
            ? "La regla del 1% y la regla del 50% son filtros rápidos para descartar tratos, no para aprobarlos. Siempre haz un cálculo completo de DSCR, NOI y retorno sobre efectivo invertido antes de hacer una oferta."
            : "The 1% and 50% rules are quick filters used to eliminate deals, not to approve them. Always follow with a full DSCR, NOI, and cash-on-cash calculation before making an offer."}
        </p>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-accent/50 via-accent/20 to-primary/20 p-[1.5px] shadow-lg">
        <div className="rounded-2xl bg-card">
          <div className="grid gap-0 lg:grid-cols-5">
            {/* Inputs */}
            <div className="lg:col-span-3 p-5 md:p-7 border-b lg:border-b-0 lg:border-r border-border">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wider text-accent">{isEs ? "Filtro de tratos" : "Deal screener"}</p>
                <h2 className="text-xl md:text-2xl font-bold text-foreground mt-0.5">{isEs ? "Regla del 1% y del 50%" : "1% & 50% rule"}</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <MoneyField id="price" label={isEs ? "Precio de compra" : "Purchase price"} value={f.price} onChange={(v) => update("price", v)} />
                <MoneyField id="rent" label={isEs ? "Renta mensual bruta" : "Monthly gross rent"} value={f.rent} onChange={(v) => update("rent", v)} hint={isEs ? "Opcional — ve dónde estás" : "Optional — see where you stand"} />
                <MoneyField id="pitia" label={isEs ? "PITIA estimado $/mes" : "Estimated PITIA $/mo"} value={f.pitia} onChange={(v) => update("pitia", v)} hint={isEs ? "Opcional — para flujo de efectivo de la regla del 50%" : "Optional — for 50% rule cash flow"} />
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
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isEs ? "Resultados del filtro" : "Screener results"}</p>

              {/* 1% rule */}
              <div className={cn("rounded-xl p-5 ring-2 transition", t.ring, t.bg)}>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isEs ? "Regla del 1%: renta requerida" : "1% rule: rent needed"}</p>
                <div className="text-5xl font-bold tabular-nums mt-1 text-foreground">
                  {v.required1Pct > 0 ? fmtUSD(v.required1Pct) : "—"}
                </div>
                {v.rent > 0 && (
                  <p className={cn("mt-2 text-sm font-semibold", t.color)}>{t.label}</p>
                )}
                {v.rent > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isEs ? "Tu renta: " : "Your rent: "}{fmtUSD(v.rent)} ({v.actual1PctRatio > 0 ? `${v.actual1PctRatio.toFixed(0)}% ${isEs ? "del objetivo" : "of target"}` : "—"})
                  </p>
                )}
              </div>

              {/* 50% rule breakdown */}
              {v.rent > 0 && (
                <dl className="space-y-1.5 text-sm">
                  <dt className="pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{isEs ? "Estimación regla del 50%" : "50% rule estimate"}</dt>
                  <ResultRow label={isEs ? "Renta anual bruta" : "Gross annual rent"} value={fmtUSD(v.annualGross)} />
                  <ResultRow label={isEs ? "Gastos estimados (50%)" : "Estimated expenses (50%)"} value={`(${fmtUSD(v.estimated50PctExpenses)})`} accent="bad" />
                  <ResultRow label={isEs ? "Estimación de NOI" : "NOI estimate"} value={fmtUSD(v.annualNOI50)} bold />
                  {v.pitia > 0 && (
                    <>
                      <ResultRow label={isEs ? "Menos PITIA anual" : "Less annual PITIA"} value={`(${fmtUSD(v.annualPITIA)})`} accent="bad" />
                      <ResultRow label={isEs ? "Flujo de efectivo anual est." : "Est. annual cash flow"} value={fmtUSD(v.annualCashFlow50)} bold accent={v.annualCashFlow50 >= 0 ? "good" : "bad"} />
                      <ResultRow label={isEs ? "Flujo de efectivo mensual est." : "Est. monthly cash flow"} value={fmtUSD(v.monthlyCashFlow50)} accent={v.monthlyCashFlow50 >= 0 ? "good" : "bad"} />
                    </>
                  )}
                </dl>
              )}

              {/* What price makes 1% work */}
              {v.rent > 0 && v.priceDelta < 0 && (
                <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs">
                  <p className="font-semibold text-foreground mb-1">{isEs ? `Para aprobar la regla del 1% con ${fmtUSD(v.rent)}/mes de renta` : `To pass 1% rule at ${fmtUSD(v.rent)}/mo rent`}</p>
                  <p className="text-muted-foreground">{isEs ? "Precio máximo de compra: " : "Max purchase price: "}<strong className="text-foreground">{fmtUSD(v.priceFor1Pct)}</strong> — {isEs ? `son ${fmtUSD(Math.abs(v.priceDelta))} menos del precio pedido.` : `that's ${fmtUSD(Math.abs(v.priceDelta))} less than asking.`}</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border bg-secondary/40 rounded-b-2xl p-5 md:p-7">
            <div className="flex items-start gap-3">
              <Info className="size-5 shrink-0 text-accent mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong className="text-foreground">{isEs ? "Regla del 1%:" : "1% rule:"}</strong> {isEs ? "renta mensual ≥ 1% del precio de compra ($200K → necesitas $2,000/mes)." : "monthly rent ≥ 1% of purchase price ($200K → need $2,000/mo)."} <strong className="text-foreground">{isEs ? "Regla del 50%:" : "50% rule:"}</strong> {isEs ? "asume que ~50% de la renta bruta va a gastos operativos (sin incluir hipoteca). Estos son filtros — las propiedades reales requieren suscripción completa." : "assume ~50% of gross rent goes to operating expenses (excluding mortgage). These are filters — real properties require full underwriting."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Next steps */}
      <div className="rounded-xl border border-border bg-card p-5 md:p-7">
        <h3 className="text-base font-bold text-foreground mb-3">{isEs ? "Si el trato pasa el filtro — ve más a fondo" : "If the deal passes the screen — go deeper"}</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <a href={isEs ? "/es/tools/dscr-calculator" : "/tools/dscr-calculator"} className="text-primary font-medium hover:underline">{isEs ? "Calculadora DSCR" : "DSCR Calculator"}</a> — {isEs ? "calcula la cobertura exacta del servicio de la deuda usando P&I, impuestos, seguro y HOA reales" : "compute exact debt service coverage using real P&I, tax, insurance, and HOA"}
          </li>
          <li>
            <a href={isEs ? "/es/tools/cap-rate-noi-calculator" : "/tools/cap-rate-noi-calculator"} className="text-primary font-medium hover:underline">{isEs ? "Calculadora de Cap Rate y NOI" : "Cap Rate & NOI Calculator"}</a> — {isEs ? "desglose completo de gastos, no solo 50%" : "full expense breakdown, not just 50%"}
          </li>
          <li>
            <a href={isEs ? "/es/tools/cash-on-cash-calculator" : "/tools/cash-on-cash-calculator"} className="text-primary font-medium hover:underline">{isEs ? "Calculadora de retorno sobre efectivo invertido" : "Cash-on-Cash Calculator"}</a> — {isEs ? "mide el retorno apalancado sobre tu efectivo realmente invertido" : "measure the levered return on your actual cash invested"}
          </li>
        </ul>
      </div>

      {/* CTA */}
      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 p-6 md:p-8 text-primary-foreground">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">{isEs ? "¿El trato pasa el filtro?" : "Deal passes the screen?"}</h3>
            <p className="mt-1 text-sm opacity-80">{isEs ? "Conéctate con prestamistas DSCR — las 3 mejores ofertas en una hora. Sin consulta de crédito." : "Get matched with DSCR lenders — top 3 offers in one hour. No credit pull."}</p>
          </div>
          <Button asChild variant="cta" size="lg" className="shrink-0">
            <a href={isEs ? "/es/get-matched?source=one-percent-rule-calculator" : "/get-matched?source=one-percent-rule-calculator"}>{isEs ? "Ver mis ofertas" : "Get my matches"} <ArrowRight className="size-4" /></a>
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

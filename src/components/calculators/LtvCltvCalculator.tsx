"use client";

import { ArrowRight, Copy, Info, RotateCcw } from "lucide-react";
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
  if (ltv <= 0) return { label: isEs ? "Ingresa los valores arriba" : "Enter values above", color: "text-muted-foreground", bg: "bg-muted/40", ring: "ring-border", detail: "" };
  if (ltv <= 65) return {
    label: isEs ? "Conservador" : "Conservative",
    color: "text-success",
    bg: "bg-success/10",
    ring: "ring-success/40",
    detail: isEs
      ? "≤65% LTV — colchón de capital sólido. Califica para el grupo más amplio de prestamistas DSCR y los mejores precios."
      : "≤65% LTV — strong equity cushion. Qualifies for the widest DSCR lender pool and best pricing.",
  };
  if (ltv <= 75) return {
    label: isEs ? "DSCR estándar" : "Standard DSCR",
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-500/10",
    ring: "ring-yellow-500/40",
    detail: isEs
      ? "65–75% — rango convencional de financiamiento DSCR. La mayoría de los programas de compra y refi caben aquí."
      : "65–75% — mainstream DSCR lending range. Most purchase and refi programs fit here.",
  };
  if (ltv <= 80) return {
    label: isEs ? "Agresivo" : "Aggressive",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/40",
    detail: isEs
      ? "75–80% — disponible en préstamos de compra para expedientes con buen crédito y DSCR 1.00+. El refi con retiro de efectivo se limita normalmente al 75%."
      : "75–80% — available on purchase loans for strong-credit, 1.00+ DSCR files. Cash-out typically capped at 75%.",
  };
  return {
    label: isEs ? "Restringido" : "Restricted",
    color: "text-destructive",
    bg: "bg-destructive/10",
    ring: "ring-destructive/40",
    detail: isEs
      ? ">80% — la mayoría de los prestamistas DSCR no llegan aquí. Considera un enganche más alto o un producto de portafolio convencional."
      : ">80% — most DSCR lenders don't lend here. Consider a higher down payment or a conventional portfolio product.",
  };
}

/* -------------------------------------------------------------------------- */
/*  Types & defaults                                                           */
/* -------------------------------------------------------------------------- */

interface Fields {
  propValue: string;
  first: string;
  second: string;
  third: string;
}

const DEFAULTS: Fields = {
  propValue: "400000",
  first: "280000",
  second: "0",
  third: "0",
};

interface LtvCltvCalculatorProps {
  lang?: "en" | "es";
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function LtvCltvCalculator({ lang = "en" }: LtvCltvCalculatorProps = {}) {
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
    const first = parseNum(f.first);
    const second = parseNum(f.second);
    const third = parseNum(f.third);

    const ltv = propValue > 0 ? (first / propValue) * 100 : 0;
    const cltv = propValue > 0 ? ((first + second + third) / propValue) * 100 : 0;
    const equity = propValue - first - second - third;
    const equityPct = propValue > 0 ? (equity / propValue) * 100 : 0;

    return { propValue, first, second, third, ltv, cltv, equity, equityPct };
  }, [f]);

  const primaryTier = ltvTier(v.ltv, isEs);
  const cltvTier = ltvTier(v.cltv, isEs);

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

  const hasCltv = v.second > 0 || v.third > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-accent/50 via-accent/20 to-primary/20 p-[1.5px] shadow-lg">
        <div className="rounded-2xl bg-card">
          <div className="grid gap-0 lg:grid-cols-5">
            {/* Inputs */}
            <div className="lg:col-span-3 p-5 md:p-7 border-b lg:border-b-0 lg:border-r border-border">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wider text-accent">LTV / CLTV</p>
                <h2 className="text-xl md:text-2xl font-bold text-foreground mt-0.5">{isEs ? "Calcula tu préstamo a valor" : "Calculate your loan-to-value"}</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <MoneyField id="propValue" label={isEs ? "Valor de la propiedad" : "Property value"} value={f.propValue} onChange={(v) => update("propValue", v)} hint={isEs ? "Valor de tasación o de mercado actual" : "Current appraised or market value"} />
                <MoneyField id="first" label={isEs ? "Saldo de la primera hipoteca" : "First mortgage balance"} value={f.first} onChange={(v) => update("first", v)} />
                <MoneyField id="second" label={isEs ? "Segunda hipoteca / HELOC" : "Second mortgage / HELOC"} value={f.second} onChange={(v) => update("second", v)} hint={isEs ? "Opcional" : "Optional"} />
                <MoneyField id="third" label={isEs ? "Tercer gravamen" : "Third lien"} value={f.third} onChange={(v) => update("third", v)} hint={isEs ? "Opcional — raro para DSCR" : "Optional — rare for DSCR"} />
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

              {/* LTV */}
              <div className={cn("rounded-xl p-5 ring-2 transition", primaryTier.ring, primaryTier.bg)}>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isEs ? "LTV (solo primer gravamen)" : "LTV (first lien only)"}</p>
                <div className={cn("text-5xl font-bold tabular-nums mt-1", primaryTier.color)}>
                  {v.propValue > 0 ? `${v.ltv.toFixed(1)}%` : "—"}
                </div>
                <p className={cn("mt-2 text-sm font-semibold", primaryTier.color)}>{primaryTier.label}</p>
                {primaryTier.detail && <p className="mt-1 text-xs text-muted-foreground">{primaryTier.detail}</p>}
              </div>

              {/* CLTV (only if relevant) */}
              {hasCltv && (
                <div className={cn("rounded-xl p-4 ring-2 transition", cltvTier.ring, cltvTier.bg)}>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isEs ? "CLTV (todos los gravámenes)" : "CLTV (all liens)"}</p>
                  <div className={cn("text-4xl font-bold tabular-nums mt-1", cltvTier.color)}>
                    {`${v.cltv.toFixed(1)}%`}
                  </div>
                  <p className={cn("mt-1 text-sm font-semibold", cltvTier.color)}>{cltvTier.label}</p>
                </div>
              )}

              {/* Summary table */}
              <dl className="space-y-1.5 text-sm">
                <ResultRow label={isEs ? "Valor de la propiedad" : "Property value"} value={fmtUSD(v.propValue)} />
                <ResultRow label={isEs ? "Primera hipoteca" : "First mortgage"} value={fmtUSD(v.first)} />
                {v.second > 0 && <ResultRow label={isEs ? "Segunda / HELOC" : "Second / HELOC"} value={fmtUSD(v.second)} />}
                {v.third > 0 && <ResultRow label={isEs ? "Tercer gravamen" : "Third lien"} value={fmtUSD(v.third)} />}
                <ResultRow label={isEs ? "Deuda total" : "Total debt"} value={fmtUSD(v.first + v.second + v.third)} bold />
                <ResultRow label={isEs ? "Capital" : "Equity"} value={fmtUSD(v.equity)} bold accent={v.equity >= 0 ? "good" : "bad"} />
                <ResultRow label={isEs ? "Capital %" : "Equity %"} value={`${v.equityPct.toFixed(1)}%`} />
              </dl>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border bg-secondary/40 rounded-b-2xl p-5 md:p-7">
            <div className="flex items-start gap-3">
              <Info className="size-5 shrink-0 text-accent mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isEs ? (
                  <>
                    <strong className="text-foreground">LTV</strong> = primera hipoteca ÷ valor de la propiedad. <strong className="text-foreground">CLTV</strong> = todos los gravámenes ÷ valor de la propiedad. A los prestamistas DSCR les importa más el LTV (su posición de primer gravamen). El CLTV importa si le pides a un prestamista que se subordine o si existe otro gravamen sobre la propiedad.
                  </>
                ) : (
                  <>
                    <strong className="text-foreground">LTV</strong> = first mortgage ÷ property value. <strong className="text-foreground">CLTV</strong> = all liens ÷ property value. DSCR lenders care most about LTV (their first-lien position). CLTV matters if you're asking a lender to subordinate or if another lien exists on the property.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tier reference */}
      <div className="rounded-xl border border-border bg-card p-5 md:p-7">
        <h3 className="text-lg font-bold text-foreground mb-4">{isEs ? "Niveles de LTV de prestamistas DSCR" : "DSCR lender LTV tiers"}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">{isEs ? "Rango de LTV" : "LTV range"}</th>
                <th className="py-2 pr-4">{isEs ? "Nivel" : "Tier"}</th>
                <th className="py-2">{isEs ? "Contexto del prestamista DSCR" : "DSCR lender context"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(isEs
                ? [
                    { range: "≤ 65%", tier: "Conservador", ctx: "Mejor precio, mayor grupo de prestamistas, no se requiere DSCR sólido" },
                    { range: "65–75%", tier: "Estándar", ctx: "Compra y refi DSCR convencionales; la mayoría de los programas califican" },
                    { range: "75–80%", tier: "Agresivo", ctx: "Solo compra para DSCR 1.00+; el cash-out se limita normalmente al 75%" },
                    { range: "> 80%", tier: "Restringido", ctx: "Opciones DSCR muy limitadas; considera financiamiento convencional o de portafolio" },
                  ]
                : [
                    { range: "≤ 65%", tier: "Conservative", ctx: "Best pricing, widest lender pool, strong DSCR not required" },
                    { range: "65–75%", tier: "Standard", ctx: "Mainstream DSCR purchase & refi; most programs qualify" },
                    { range: "75–80%", tier: "Aggressive", ctx: "Purchase only for 1.00+ DSCR; cash-out typically capped at 75%" },
                    { range: "> 80%", tier: "Restricted", ctx: "Very limited DSCR options; consider conventional or portfolio lending" },
                  ]
              ).map((row) => (
                <tr key={row.range}>
                  <td className="py-2.5 pr-4 font-semibold tabular-nums">{row.range}</td>
                  <td className="py-2.5 pr-4">{row.tier}</td>
                  <td className="py-2.5 text-muted-foreground">{row.ctx}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 p-6 md:p-8 text-primary-foreground">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">{isEs ? "Encuentra el programa LTV correcto" : "Find the right LTV program"}</h3>
            <p className="mt-1 text-sm opacity-80">{isEs ? "Comparamos 1,000+ prestamistas DSCR — las 3 mejores ofertas en una hora. Sin consulta de crédito." : "We shop 1,000+ DSCR lenders — top 3 offers in one hour. No credit pull."}</p>
          </div>
          <Button asChild variant="cta" size="lg" className="shrink-0">
            <a href={isEs ? "/es/get-matched?source=ltv-cltv-calculator" : "/get-matched?source=ltv-cltv-calculator"}>{isEs ? "Ver mis ofertas" : "Get my matches"} <ArrowRight className="size-4" /></a>
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

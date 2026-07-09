"use client";

import { ArrowRight, Copy, Info, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import EmailAnalysisCapture from "@/components/forms/EmailAnalysisCapture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildDealReviewUrl } from "@/lib/deal-review-url";
import { fmtUSD, parseNum } from "@/lib/finance";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function cocTier(coc: number, isEs: boolean, hasInputs: boolean) {
  if (!hasInputs) return {
    label: isEs ? "Ingresa tus números" : "Enter your numbers",
    color: "text-muted-foreground", bg: "bg-muted/40", ring: "ring-border",
    detail: isEs ? "Completa el formulario para ver el cash-on-cash." : "Fill in the form to see cash-on-cash."
  };
  if (coc < 5) return {
    label: isEs ? "Menor a 5% — débil" : "Below 5% — weak",
    color: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/40",
    detail: isEs ? "Los retornos por debajo del 5% a menudo no justifican la falta de liquidez del bien raíz. Considera renegociar el precio o los gastos." : "Returns below 5% often don't justify the illiquidity of real estate. Consider renegotiating price or expenses."
  };
  if (coc < 8) return {
    label: isEs ? "5–8% — aceptable" : "5–8% — acceptable",
    color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/40",
    detail: isEs ? "Sólido para mercados enfocados en apreciación. El flujo de caja es modesto pero el trato funciona. Busca potencial a través del crecimiento de la renta." : "Solid for appreciation-focused markets. Cash flow is modest but deal pencils. Look for upside through rent growth."
  };
  if (coc < 12) return {
    label: isEs ? "8–12% — fuerte" : "8–12% — strong",
    color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10", ring: "ring-yellow-500/40",
    detail: isEs ? "Cash-on-cash fuerte. El trato supera la mayoría de las alternativas pasivas. Busca escalar." : "Strong cash-on-cash. Deal beats most passive alternatives. Look to scale."
  };
  return {
    label: isEs ? "12%+ — excelente" : "12%+ — excellent",
    color: "text-success", bg: "bg-success/10", ring: "ring-success/40",
    detail: isEs ? "Retornos excelentes. Verifica tus suposiciones de gastos — 12%+ es alcanzable pero confirma vacancia, capex y administración." : "Excellent returns. Double-check your expense assumptions — 12%+ is achievable but verify vacancy, capex, and management."
  };
}

/* -------------------------------------------------------------------------- */
/*  Types & defaults                                                           */
/* -------------------------------------------------------------------------- */

interface Fields {
  price: string;
  downPct: string;
  closing: string;
  rehab: string;
  grossRentAnnual: string;
  vacancy: string;
  pitiaMonthly: string;
  opexPct: string;
}

const DEFAULTS: Fields = {
  price: "250000",
  downPct: "25",
  closing: "5000",
  rehab: "0",
  grossRentAnnual: "30000",
  vacancy: "5",
  pitiaMonthly: "1500",
  opexPct: "15",
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

interface CashOnCashCalculatorProps {
  lang?: "en" | "es";
}

export default function CashOnCashCalculator({ lang = "en" }: CashOnCashCalculatorProps = {}) {
  const isEs = lang === "es";
  const [f, setF] = useState<Fields>(() => getInitialFields());
  const [copied, setCopied] = useState(false);

  const v = useMemo(() => {
    const price = parseNum(f.price);
    const downAmt = price * parseNum(f.downPct) / 100;
    const closing = parseNum(f.closing);
    const rehab = parseNum(f.rehab);
    const totalCashIn = downAmt + closing + rehab;

    const grossRent = parseNum(f.grossRentAnnual);
    const vacancyAmt = grossRent * parseNum(f.vacancy) / 100;
    const egi = grossRent - vacancyAmt;
    const opexAmt = egi * parseNum(f.opexPct) / 100;
    const noi = egi - opexAmt;
    const annualPITIA = parseNum(f.pitiaMonthly) * 12;
    const annualCashFlow = noi - annualPITIA;
    const coc = totalCashIn > 0 ? (annualCashFlow / totalCashIn) * 100 : 0;

    return {
      downAmt, closing, rehab, totalCashIn,
      grossRent, vacancyAmt, egi, opexAmt, noi,
      annualPITIA, annualCashFlow, coc,
    };
  }, [f]);

  const t = cocTier(v.coc, isEs, v.totalCashIn > 0);

  const dealReviewUrl = useMemo(() => {
    const price = parseNum(f.price);
    const loanAmount = price > 0 ? Math.round(price * (1 - parseNum(f.downPct) / 100)) : undefined;
    return buildDealReviewUrl(
      {
        source: "cash-on-cash-calculator",
        purchasePrice: price > 0 ? Math.round(price) : undefined,
        loanAmount,
        annualNoi: v.noi > 0 ? Math.round(v.noi) : undefined,
        purpose: "acquisition",
        occupancy: 100 - parseNum(f.vacancy),
      },
      isEs,
    );
  }, [f.downPct, f.price, f.vacancy, isEs, v.noi]);

  const analysisSummary = useMemo(() => {
    if (v.totalCashIn <= 0) return undefined;
    return {
      "Cash-on-cash": `${v.coc.toFixed(2)}%`,
      Rating: t.label,
      "Total cash in": fmtUSD(v.totalCashIn),
      "Net annual cash flow": fmtUSD(v.annualCashFlow),
      "Purchase price": fmtUSD(parseNum(f.price)),
      "Down payment": `${f.downPct}%`,
    };
  }, [f.downPct, f.price, t.label, v.annualCashFlow, v.coc, v.totalCashIn]);

  const sourcePage = isEs ? "/es/tools/cash-on-cash-calculator" : "/tools/cash-on-cash-calculator";

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
      <div className="rounded-2xl bg-gradient-to-br from-accent/50 via-accent/20 to-primary/20 p-[1.5px] shadow-lg">
        <div className="rounded-2xl bg-card">
          <div className="grid gap-0 lg:grid-cols-5">
            {/* Inputs */}
            <div className="lg:col-span-3 p-5 md:p-7 border-b lg:border-b-0 lg:border-r border-border">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wider text-accent">Cash-on-Cash</p>
                <h2 className="text-xl md:text-2xl font-bold text-foreground mt-0.5">{isEs ? "Ingresa tu trato" : "Enter your deal"}</h2>
              </div>

              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">{isEs ? "Efectivo invertido" : "Cash invested"}</p>
              <div className="grid gap-4 sm:grid-cols-2 mb-5">
                <MoneyField id="price" label={isEs ? "Precio de compra" : "Purchase price"} value={f.price} onChange={(v) => update("price", v)} />
                <PctField id="downPct" label={isEs ? "Enganche %" : "Down payment %"} value={f.downPct} onChange={(v) => update("downPct", v)} hint={isEs ? "Mín. DSCR: 20–25%" : "DSCR min: 20–25%"} />
                <MoneyField id="closing" label={isEs ? "Costos de cierre $" : "Closing costs $"} value={f.closing} onChange={(v) => update("closing", v)} hint={isEs ? "Típico: 2–3%" : "Typical: 2–3%"} />
                <MoneyField id="rehab" label={isEs ? "Remodelación / reparaciones $" : "Rehab / repairs $"} value={f.rehab} onChange={(v) => update("rehab", v)} hint={isEs ? "Opcional" : "Optional"} />
              </div>

              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">{isEs ? "Ingresos y gastos" : "Income & expenses"}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <MoneyField id="grossRentAnnual" label={isEs ? "Renta bruta anual" : "Gross annual rent"} value={f.grossRentAnnual} onChange={(v) => update("grossRentAnnual", v)} />
                <PctField id="vacancy" label={isEs ? "Vacancia %" : "Vacancy %"} value={f.vacancy} onChange={(v) => update("vacancy", v)} hint={isEs ? "Típico: 5–8%" : "Typical: 5–8%"} />
                <MoneyField id="pitiaMonthly" label={isEs ? "PITIA $/mes" : "PITIA $/mo"} value={f.pitiaMonthly} onChange={(v) => update("pitiaMonthly", v)} hint={isEs ? "Principal e intereses + impuesto + seguro + HOA" : "P&I + tax + ins + HOA"} />
                <PctField id="opexPct" label={isEs ? "Otros gastos % del EGI" : "Other opex % of EGI"} value={f.opexPct} onChange={(v) => update("opexPct", v)} hint={isEs ? "Administración, mantenimiento, capex" : "Mgmt, maintenance, capex"} />
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

              <div className={cn("rounded-xl p-5 ring-2 transition", t.ring, t.bg)}>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isEs ? "Retorno Cash-on-Cash" : "Cash-on-Cash Return"}</p>
                <div className={cn("text-5xl font-bold tabular-nums mt-1", t.color)}>
                  {v.totalCashIn > 0 ? `${v.coc.toFixed(2)}%` : "—"}
                </div>
                <p className={cn("mt-2 text-sm font-semibold", t.color)}>{t.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t.detail}</p>
              </div>

              <dl className="space-y-1.5 text-sm">
                <SectionHeader label={isEs ? "Efectivo invertido" : "Cash invested"} />
                <ResultRow label={isEs ? "Enganche" : "Down payment"} value={fmtUSD(v.downAmt)} />
                <ResultRow label={isEs ? "Costos de cierre" : "Closing costs"} value={fmtUSD(v.closing)} />
                {v.rehab > 0 && <ResultRow label={isEs ? "Remodelación" : "Rehab"} value={fmtUSD(v.rehab)} />}
                <ResultRow label={isEs ? "Efectivo total invertido" : "Total cash in"} value={fmtUSD(v.totalCashIn)} bold />

                <SectionHeader label={isEs ? "Flujo de caja anual" : "Annual cash flow"} />
                <ResultRow label={isEs ? "Renta bruta" : "Gross rent"} value={fmtUSD(v.grossRent)} />
                <ResultRow label={isEs ? "Menos vacancia" : "Less vacancy"} value={`(${fmtUSD(v.vacancyAmt)})`} accent="bad" />
                <ResultRow label={isEs ? "Menos otros gastos" : "Less other opex"} value={`(${fmtUSD(v.opexAmt)})`} accent="bad" />
                <ResultRow label={isEs ? "Menos PITIA anual" : "Less annual PITIA"} value={`(${fmtUSD(v.annualPITIA)})`} accent="bad" />
                <ResultRow label={isEs ? "Flujo de caja anual neto" : "Net annual cash flow"} value={fmtUSD(v.annualCashFlow)} bold accent={v.annualCashFlow >= 0 ? "good" : "bad"} />
                <ResultRow label={isEs ? "Flujo de caja mensual" : "Monthly cash flow"} value={fmtUSD(v.annualCashFlow / 12)} accent={v.annualCashFlow >= 0 ? "good" : "bad"} />
              </dl>
            </div>
          </div>

          <div className="border-t border-border bg-secondary/40 rounded-b-2xl p-5 md:p-7">
            <div className="flex items-start gap-3">
              <Info className="size-5 shrink-0 text-accent mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isEs ? (
                  <><strong className="text-foreground">Cash-on-Cash = Flujo de caja anual neto ÷ Efectivo total invertido.</strong> A diferencia de la tasa de capitalización, el CoC considera el financiamiento. Mide lo que tus dólares reales de bolsillo ganan cada año — la métrica de retorno del inversionista.</>
                ) : (
                  <><strong className="text-foreground">Cash-on-Cash = Annual Net Cash Flow ÷ Total Cash Invested.</strong> Unlike cap rate, CoC accounts for financing. It measures what your actual out-of-pocket dollars earn each year — the investor's return metric.</>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tier table */}
      <div className="rounded-xl border border-border bg-card p-5 md:p-7">
        <h3 className="text-lg font-bold text-foreground mb-4">{isEs ? "Niveles de retorno cash-on-cash" : "Cash-on-cash return tiers"}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">{isEs ? "Rango CoC" : "CoC range"}</th>
                <th className="py-2 pr-4">{isEs ? "Calificación" : "Rating"}</th>
                <th className="py-2">{isEs ? "Contexto" : "Context"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(isEs ? [
                { range: "< 5%", rating: "Débil", ctx: "No justifica la falta de liquidez; existen mejores opciones pasivas" },
                { range: "5–8%", rating: "Aceptable", ctx: "Funciona en mercados de apreciación; flujo de caja modesto" },
                { range: "8–12%", rating: "Fuerte", ctx: "Supera la mayoría de alternativas pasivas; buen territorio DSCR" },
                { range: "12%+", rating: "Excelente", ctx: "Verifica suposiciones; alcanzable en mercados con buen flujo de caja" },
              ] : [
                { range: "< 5%", rating: "Weak", ctx: "Doesn't justify illiquidity; better passive options exist" },
                { range: "5–8%", rating: "Acceptable", ctx: "Works in appreciation markets; modest cash flow" },
                { range: "8–12%", rating: "Strong", ctx: "Beats most passive alternatives; good DSCR territory" },
                { range: "12%+", rating: "Excellent", ctx: "Verify assumptions; achievable in strong cash-flow markets" },
              ]).map((row) => (
                <tr key={row.range}>
                  <td className="py-2.5 pr-4 font-semibold tabular-nums">{row.range}</td>
                  <td className="py-2.5 pr-4">{row.rating}</td>
                  <td className="py-2.5 text-muted-foreground">{row.ctx}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {analysisSummary && (
        <EmailAnalysisCapture
          analysisType="Cash-on-cash"
          analysisSummary={analysisSummary}
          lang={isEs ? "es" : "en"}
          sourcePage={sourcePage}
        />
      )}

      {/* CTA */}
      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 p-6 md:p-8 text-primary-foreground">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">{isEs ? "¿Quiere una lectura de encaje?" : "Want a lender-fit read?"}</h3>
            <p className="mt-1 text-sm opacity-80">{isEs ? "Revisión gratuita de suscripción — respuesta usual en una hora hábil. Sin consulta de crédito." : "Free underwriting review — usually within one business hour. No credit pull."}</p>
          </div>
          <Button asChild variant="cta" size="lg" className="shrink-0">
            <a href={dealReviewUrl}>{isEs ? "Solicitar revisión gratuita" : "Get free deal review"} <ArrowRight className="size-4" /></a>
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

function PctField({ id, label, value, onChange, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-foreground">{label}</Label>
      <div className="relative">
        <Input id={id} inputMode="decimal" autoComplete="off" className="pr-7 tabular-nums" value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))} />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return <dt className="pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</dt>;
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

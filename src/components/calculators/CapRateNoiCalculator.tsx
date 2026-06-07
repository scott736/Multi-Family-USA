"use client";

import { ArrowRight, Copy, Info, RotateCcw, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildDealReviewUrl } from "@/lib/deal-review-url";
import { fmtUSD, parseNum } from "@/lib/finance";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function capRateTier(cr: number, isEs: boolean) {
  if (cr <= 0) return { label: isEs ? "Ingresa tus números" : "Enter your numbers", color: "text-muted-foreground", bg: "bg-muted/40", ring: "ring-border" };
  if (cr < 3) return { label: isEs ? "Menos del 3% — muy comprimido" : "Below 3% — very compressed", color: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/40" };
  if (cr < 5) return { label: isEs ? "3–5% — mercado gateway / apuesta a apreciación" : "3–5% — gateway / appreciation play", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/40" };
  if (cr < 7) return { label: isEs ? "5–7% — flujo de caja balanceado" : "5–7% — balanced cash flow", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10", ring: "ring-yellow-500/40" };
  if (cr < 9) return { label: isEs ? "7–9% — flujo de caja sólido" : "7–9% — strong cash flow", color: "text-success", bg: "bg-success/10", ring: "ring-success/40" };
  return { label: isEs ? "9%+ — alto rendimiento (verifica supuestos)" : "9%+ — high yield (verify assumptions)", color: "text-success", bg: "bg-success/10", ring: "ring-success/40" };
}

/* -------------------------------------------------------------------------- */
/*  Types & defaults                                                           */
/* -------------------------------------------------------------------------- */

interface Fields {
  price: string;
  grossRent: string;
  vacancy: string;
  mgmt: string;
  taxAnnual: string;
  insAnnual: string;
  hoa: string;
  maintenance: string;
  capex: string;
  utilities: string;
}

const DEFAULTS: Fields = {
  price: "300000",
  grossRent: "36000",
  vacancy: "5",
  mgmt: "8",
  taxAnnual: "3600",
  insAnnual: "1200",
  hoa: "0",
  maintenance: "5",
  capex: "5",
  utilities: "0",
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

interface CapRateNoiCalculatorProps {
  lang?: "en" | "es";
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function CapRateNoiCalculator({ lang = "en" }: CapRateNoiCalculatorProps = {}) {
  const isEs = lang === "es";
  const [f, setF] = useState<Fields>(() => getInitialFields());
  const [copied, setCopied] = useState(false);

  const v = useMemo(() => {
    const price = parseNum(f.price);
    const grossRent = parseNum(f.grossRent);
    const vacancyPct = parseNum(f.vacancy) / 100;
    const mgmtPct = parseNum(f.mgmt) / 100;
    const taxAnnual = parseNum(f.taxAnnual);
    const insAnnual = parseNum(f.insAnnual);
    const hoaMonthly = parseNum(f.hoa);
    const maintPct = parseNum(f.maintenance) / 100;
    const capexPct = parseNum(f.capex) / 100;
    const utilities = parseNum(f.utilities);

    const egi = grossRent * (1 - vacancyPct);
    const vacancyLoss = grossRent * vacancyPct;
    const mgmtAmt = egi * mgmtPct;
    const hoaAnnual = hoaMonthly * 12;
    const maintAmt = grossRent * maintPct;
    const capexAmt = grossRent * capexPct;

    const opex = taxAnnual + insAnnual + hoaAnnual + mgmtAmt + maintAmt + capexAmt + utilities;
    const noi = egi - opex;
    const capRate = price > 0 ? (noi / price) * 100 : 0;

    return {
      price, grossRent, egi, vacancyLoss, mgmtAmt,
      taxAnnual, insAnnual, hoaAnnual, maintAmt, capexAmt, utilities,
      opex, noi, capRate,
    };
  }, [f]);

  function update<K extends keyof Fields>(k: K, val: string) {
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

  const t = capRateTier(v.capRate, isEs);

  const dealReviewUrl = useMemo(
    () =>
      buildDealReviewUrl(
        {
          source: "cap-rate-noi-calculator",
          purchasePrice: v.price > 0 ? Math.round(v.price) : undefined,
          annualNoi: v.noi > 0 ? Math.round(v.noi) : undefined,
          purpose: "acquisition",
          occupancy: 100 - parseNum(f.vacancy),
        },
        isEs,
      ),
    [f.vacancy, isEs, v.noi, v.price],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-accent/50 via-accent/20 to-primary/20 p-[1.5px] shadow-lg">
        <div className="rounded-2xl bg-card">
          <div className="grid gap-0 lg:grid-cols-5">
            {/* Inputs */}
            <div className="lg:col-span-3 p-5 md:p-7 border-b lg:border-b-0 lg:border-r border-border">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wider text-accent">{isEs ? "NOI y Cap Rate" : "NOI & Cap Rate"}</p>
                <h2 className="text-xl md:text-2xl font-bold text-foreground mt-0.5">{isEs ? "Ingresa tu propiedad" : "Enter your property"}</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <MoneyField id="price" label={isEs ? "Precio de compra" : "Purchase price"} value={f.price} onChange={(v) => update("price", v)} />
                <MoneyField id="grossRent" label={isEs ? "Renta bruta anual" : "Gross annual rent"} value={f.grossRent} onChange={(v) => update("grossRent", v)} hint={isEs ? "Todas las unidades, 12 meses" : "All units, 12 months"} />
                <PctField id="vacancy" label={isEs ? "Tasa de vacancia %" : "Vacancy rate %"} value={f.vacancy} onChange={(v) => update("vacancy", v)} hint={isEs ? "Típico: 5–8%" : "Typical: 5–8%"} />
                <PctField id="mgmt" label={isEs ? "Administración %" : "Property mgmt %"} value={f.mgmt} onChange={(v) => update("mgmt", v)} hint={isEs ? "% del EGI" : "% of EGI"} />
                <MoneyField id="taxAnnual" label={isEs ? "Impuesto predial $/año" : "Property tax $/yr"} value={f.taxAnnual} onChange={(v) => update("taxAnnual", v)} />
                <MoneyField id="insAnnual" label={isEs ? "Seguro $/año" : "Insurance $/yr"} value={f.insAnnual} onChange={(v) => update("insAnnual", v)} />
                <MoneyField id="hoa" label={isEs ? "HOA $/mes" : "HOA $/mo"} value={f.hoa} onChange={(v) => update("hoa", v)} hint={isEs ? "Opcional" : "Optional"} />
                <PctField id="maintenance" label={isEs ? "Mantenimiento %" : "Maintenance %"} value={f.maintenance} onChange={(v) => update("maintenance", v)} hint={isEs ? "% de la renta bruta" : "% of gross rent"} />
                <PctField id="capex" label={isEs ? "Reserva CapEx %" : "CapEx reserve %"} value={f.capex} onChange={(v) => update("capex", v)} hint={isEs ? "% de la renta bruta" : "% of gross rent"} />
                <MoneyField id="utilities" label={isEs ? "Servicios / otros $/año" : "Utilities / other $/yr"} value={f.utilities} onChange={(v) => update("utilities", v)} hint={isEs ? "Opcional" : "Optional"} />
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

              {/* Cap rate badge */}
              <div className={cn("rounded-xl p-5 ring-2 transition", t.ring, t.bg)}>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cap Rate</p>
                <div className={cn("text-5xl font-bold tabular-nums mt-1", t.color)}>
                  {v.capRate > 0 ? `${v.capRate.toFixed(2)}%` : "—"}
                </div>
                <p className={cn("mt-2 text-sm font-semibold", t.color)}>{t.label}</p>
              </div>

              {/* Income waterfall */}
              <dl className="space-y-1.5 text-sm">
                <SectionHeader label={isEs ? "Ingresos" : "Income"} />
                <ResultRow label={isEs ? "Ingreso bruto programado" : "Gross scheduled income"} value={fmtUSD(v.grossRent)} />
                <ResultRow label={isEs ? "Menos pérdida por vacancia" : "Less vacancy loss"} value={`(${fmtUSD(v.vacancyLoss)})`} accent="bad" />
                <ResultRow label={isEs ? "Ingreso bruto efectivo" : "Effective gross income"} value={fmtUSD(v.egi)} bold />
                <SectionHeader label={isEs ? "Gastos operativos" : "Operating expenses"} />
                <ResultRow label={isEs ? "Impuesto predial" : "Property tax"} value={fmtUSD(v.taxAnnual)} />
                <ResultRow label={isEs ? "Seguro" : "Insurance"} value={fmtUSD(v.insAnnual)} />
                {v.hoaAnnual > 0 && <ResultRow label={isEs ? "HOA (anual)" : "HOA (annual)"} value={fmtUSD(v.hoaAnnual)} />}
                <ResultRow label={isEs ? "Administración" : "Management"} value={fmtUSD(v.mgmtAmt)} />
                <ResultRow label={isEs ? "Mantenimiento" : "Maintenance"} value={fmtUSD(v.maintAmt)} />
                <ResultRow label={isEs ? "Reserva CapEx" : "CapEx reserve"} value={fmtUSD(v.capexAmt)} />
                {v.utilities > 0 && <ResultRow label={isEs ? "Servicios / otros" : "Utilities / other"} value={fmtUSD(v.utilities)} />}
                <ResultRow label={isEs ? "Total de gastos operativos" : "Total operating expenses"} value={fmtUSD(v.opex)} bold />
                <SectionHeader label={isEs ? "Ingreso operativo neto" : "Net operating income"} />
                <ResultRow
                  label="NOI"
                  value={fmtUSD(v.noi)}
                  bold
                  accent={v.noi >= 0 ? "good" : "bad"}
                />
                <ResultRow
                  label="Cap Rate"
                  value={v.capRate > 0 ? `${v.capRate.toFixed(2)}%` : "—"}
                  bold
                  accent={v.capRate >= 5 ? "good" : v.capRate > 0 ? undefined : undefined}
                />
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
                    <strong className="text-foreground">Cap Rate = NOI ÷ Precio de compra.</strong> El NOI excluye los pagos hipotecarios — es una métrica a nivel de propiedad, independiente del financiamiento. Úsalo para comparar propiedades en igualdad de condiciones; usa el cash-on-cash para evaluar rendimientos apalancados.
                  </>
                ) : (
                  <>
                    <strong className="text-foreground">Cap Rate = NOI ÷ Purchase Price.</strong> NOI excludes mortgage payments — it is a property-level metric, independent of financing. Use it to compare properties on equal footing; use cash-on-cash to evaluate levered returns.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Benchmark table */}
      <div className="rounded-xl border border-border bg-card p-5 md:p-7">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="size-4 text-accent" />
          <h3 className="text-lg font-bold text-foreground">{isEs ? "Referencias de cap rate por tipo de mercado" : "Cap rate benchmarks by market type"}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">{isEs ? "Rango de cap rate" : "Cap rate range"}</th>
                <th className="py-2 pr-4">{isEs ? "Tipo de mercado" : "Market type"}</th>
                <th className="py-2">{isEs ? "Perfil del inversionista" : "Investor profile"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(isEs
                ? [
                    { range: "3–4%", market: "Ciudades gateway (NYC, LA, SF)", profile: "Impulsado por apreciación; precio de entrada alto" },
                    { range: "4–6%", market: "Metrópolis primarias (Atlanta, Phoenix, Denver)", profile: "Balanceado — apreciación + flujo de caja moderado" },
                    { range: "6–8%", market: "Mercados secundarios / terciarios (Cleveland, Memphis)", profile: "Enfocado en flujo de caja; menor apreciación" },
                    { range: "8%+", market: "Mercados rurales o de alta vacancia", profile: "Alto rendimiento — verifica vacancia y supuestos de salida" },
                  ]
                : [
                    { range: "3–4%", market: "Gateway cities (NYC, LA, SF)", profile: "Appreciation-driven; high entry price" },
                    { range: "4–6%", market: "Primary metros (Atlanta, Phoenix, Denver)", profile: "Balanced — appreciation + moderate cash flow" },
                    { range: "6–8%", market: "Secondary / tertiary markets (Cleveland, Memphis)", profile: "Cash-flow-focused; lower appreciation" },
                    { range: "8%+", market: "Rural or high-vacancy markets", profile: "High yield — verify vacancy and exit assumptions" },
                  ]
              ).map((row) => (
                <tr key={row.range} className={cn(v.capRate >= parseFloat(row.range.split("–")[0]) && v.capRate < parseFloat(row.range.split("–")[1] ?? "999") && "bg-accent/10")}>
                  <td className="py-2.5 pr-4 font-semibold">{row.range}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{row.market}</td>
                  <td className="py-2.5 text-muted-foreground">{row.profile}</td>
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
            <h3 className="text-xl md:text-2xl font-bold">{isEs ? "¿Quiere una lectura de encaje real?" : "Want a real lender-fit read?"}</h3>
            <p className="mt-1 text-sm opacity-80">
              {isEs
                ? "Envíe sus números para una revisión gratuita de suscripción — usualmente en una hora hábil. Sin consulta de crédito."
                : "Submit your numbers for a free underwriting review — usually within one business hour. No credit pull."}
            </p>
          </div>
          <Button asChild variant="cta" size="lg" className="shrink-0">
            <a href={dealReviewUrl}>
              {isEs ? "Solicitar revisión gratuita" : "Get free deal review"} <ArrowRight className="size-4" />
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
  return (
    <dt className="pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</dt>
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

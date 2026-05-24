"use client";

import { ArrowRight, Copy, DollarSign, Home, Info, RotateCcw, TrendingUp, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtUSD, monthlyPI, parseNum } from "@/lib/finance";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const piYears = (p: number, r: number, y: number) => monthlyPI(p, r, y * 12);

/* -------------------------------------------------------------------------- */
/*  Types & defaults                                                           */
/* -------------------------------------------------------------------------- */

interface Fields {
  purchase: string;
  rehab: string;
  holdingMonths: string;
  holdingMonthly: string;
  closingIn: string;
  arv: string;
  refiLtv: string;
  refiClosingPct: string;
  refiRate: string;
}

const DEFAULTS: Fields = {
  purchase: "180000",
  rehab: "50000",
  holdingMonths: "4",
  holdingMonthly: "1800",
  closingIn: "4000",
  arv: "300000",
  refiLtv: "75",
  refiClosingPct: "2.5",
  refiRate: "7.25",
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

interface RehabArvCalculatorProps {
  lang?: "en" | "es";
}

export default function RehabArvCalculator({ lang = "en" }: RehabArvCalculatorProps = {}) {
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
    const purchase = parseNum(f.purchase);
    const rehab = parseNum(f.rehab);
    const holdingCosts = parseNum(f.holdingMonths) * parseNum(f.holdingMonthly);
    const closingIn = parseNum(f.closingIn);
    const arv = parseNum(f.arv);
    const refiLtv = parseNum(f.refiLtv) / 100;
    const refiClosingPct = parseNum(f.refiClosingPct) / 100;
    const refiRate = parseNum(f.refiRate);

    const allIn = purchase + rehab + holdingCosts + closingIn;
    const refiLoan = arv * refiLtv;
    const refiClosing = refiLoan * refiClosingPct;
    const cashRecycled = refiLoan - allIn - refiClosing;
    const cashLeftIn = allIn - (refiLoan - refiClosing);
    const equityCaptured = arv - refiLoan;
    const monthlyPIPayment = piYears(refiLoan, refiRate, 30);
    const spreadPct = arv > 0 ? ((arv - allIn) / allIn) * 100 : 0;

    return {
      purchase, rehab, holdingCosts, closingIn, allIn,
      arv, refiLoan, refiClosing, cashRecycled, cashLeftIn, equityCaptured,
      monthlyPIPayment, spreadPct,
    };
  }, [f]);

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

  const isGoodDeal = v.cashRecycled >= 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-accent/50 via-accent/20 to-primary/20 p-[1.5px] shadow-lg">
        <div className="rounded-2xl bg-card">
          <div className="grid gap-0 lg:grid-cols-5">
            {/* Inputs */}
            <div className="lg:col-span-3 p-5 md:p-7 border-b lg:border-b-0 lg:border-r border-border">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wider text-accent">{isEs ? "Remodelación / ARV" : "Rehab / ARV"}</p>
                <h2 className="text-xl md:text-2xl font-bold text-foreground mt-0.5">{isEs ? "Modela tu operación BRRRR" : "Model your BRRRR deal"}</h2>
              </div>

              {/* Phase 1: Acquisition */}
              <div className="flex items-center gap-2 mb-3">
                <Home className="size-4 text-accent" />
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isEs ? "Adquisición" : "Acquisition"}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 mb-5">
                <MoneyField id="purchase" label={isEs ? "Precio de compra" : "Purchase price"} value={f.purchase} onChange={(v) => update("purchase", v)} />
                <MoneyField id="closingIn" label={isEs ? "Costos de cierre de entrada" : "Closing costs in"} value={f.closingIn} onChange={(v) => update("closingIn", v)} hint={isEs ? "Honorarios del prestamista, título, etc." : "Lender fees, title, etc."} />
              </div>

              {/* Phase 2: Rehab */}
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="size-4 text-accent" />
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isEs ? "Remodelación y retención" : "Rehab & holding"}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 mb-5">
                <MoneyField id="rehab" label={isEs ? "Presupuesto de remodelación" : "Rehab budget"} value={f.rehab} onChange={(v) => update("rehab", v)} />
                <MoneyField id="holdingMonthly" label={isEs ? "Costos de retención $/mes" : "Holding costs $/mo"} value={f.holdingMonthly} onChange={(v) => update("holdingMonthly", v)} hint={isEs ? "Intereses de hard money + impuesto + seguro + servicios" : "HM int + tax + ins + util"} />
                <div className="grid gap-1.5">
                  <Label htmlFor="holdingMonths" className="text-xs font-medium text-foreground">{isEs ? "Período de retención (meses)" : "Holding period (months)"}</Label>
                  <Input id="holdingMonths" inputMode="decimal" autoComplete="off" className="tabular-nums" value={f.holdingMonths}
                    onChange={(e) => update("holdingMonths", e.target.value.replace(/[^0-9.]/g, ""))} />
                </div>
              </div>

              {/* Phase 3: Refi */}
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="size-4 text-accent" />
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isEs ? "Refinanciamiento DSCR" : "DSCR refi"}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <MoneyField id="arv" label={isEs ? "Valor después de la remodelación (ARV)" : "After-repair value (ARV)"} value={f.arv} onChange={(v) => update("arv", v)} hint={isEs ? "Valor del tasador después de la remodelación" : "Appraiser's post-rehab value"} />
                <div className="grid gap-1.5">
                  <Label htmlFor="refiLtv" className="text-xs font-medium text-foreground">{isEs ? "LTV del refinanciamiento %" : "Refi LTV %"}</Label>
                  <div className="relative">
                    <Input id="refiLtv" inputMode="decimal" autoComplete="off" className="pr-7 tabular-nums" value={f.refiLtv}
                      onChange={(e) => update("refiLtv", e.target.value.replace(/[^0-9.]/g, ""))} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{isEs ? "DSCR típico: 70–75%" : "DSCR typical: 70–75%"}</p>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="refiRate" className="text-xs font-medium text-foreground">{isEs ? "Tasa del refinanciamiento %" : "Refi rate %"}</Label>
                  <div className="relative">
                    <Input id="refiRate" inputMode="decimal" autoComplete="off" className="pr-7 tabular-nums" value={f.refiRate}
                      onChange={(e) => update("refiRate", e.target.value.replace(/[^0-9.]/g, ""))} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="refiClosingPct" className="text-xs font-medium text-foreground">{isEs ? "Costos de cierre del refinanciamiento %" : "Refi closing costs %"}</Label>
                  <div className="relative">
                    <Input id="refiClosingPct" inputMode="decimal" autoComplete="off" className="pr-7 tabular-nums" value={f.refiClosingPct}
                      onChange={(e) => update("refiClosingPct", e.target.value.replace(/[^0-9.]/g, ""))} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                </div>
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
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isEs ? "Resumen de la operación" : "Deal summary"}</p>

              {/* Cash recycled highlight */}
              <div className={cn("rounded-xl p-5 ring-2 transition", isGoodDeal ? "ring-success/40 bg-success/10" : "ring-amber-500/40 bg-amber-500/10")}>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isEs ? "Capital recuperado" : "Cash recycled"}</p>
                <div className={cn("text-5xl font-bold tabular-nums mt-1", isGoodDeal ? "text-success" : "text-amber-600 dark:text-amber-400")}>
                  {fmtUSD(v.cashRecycled)}
                </div>
                <p className={cn("mt-2 text-xs", isGoodDeal ? "text-success" : "text-amber-600 dark:text-amber-400")}>
                  {isGoodDeal
                    ? (isEs ? "Capital recuperado por completo — dinero fuera" : "Full capital recycled — money out")
                    : (isEs ? "Capital no recuperado por completo — dinero atrapado en la operación" : "Capital not fully recovered — money left in deal")}
                </p>
              </div>

              <dl className="space-y-1.5 text-sm">
                <SectionHeader label={isEs ? "Costo total" : "All-in cost"} />
                <ResultRow label={isEs ? "Precio de compra" : "Purchase price"} value={fmtUSD(v.purchase)} />
                <ResultRow label={isEs ? "Presupuesto de remodelación" : "Rehab budget"} value={fmtUSD(v.rehab)} />
                <ResultRow label={isEs ? "Costos de retención" : "Holding costs"} value={fmtUSD(v.holdingCosts)} />
                <ResultRow label={isEs ? "Costos de cierre de entrada" : "Closing costs in"} value={fmtUSD(v.closingIn)} />
                <ResultRow label={isEs ? "Total de capital invertido" : "Total cash in"} value={fmtUSD(v.allIn)} bold />

                <SectionHeader label={isEs ? "Refinanciamiento DSCR" : "DSCR refi"} />
                <ResultRow label="ARV" value={fmtUSD(v.arv)} />
                <ResultRow label={isEs ? `Préstamo del refinanciamiento (${f.refiLtv}% LTV)` : `Refi loan (${f.refiLtv}% LTV)`} value={fmtUSD(v.refiLoan)} />
                <ResultRow label={isEs ? "Costos de cierre del refinanciamiento" : "Refi closing costs"} value={`(${fmtUSD(v.refiClosing)})`} accent="bad" />
                <ResultRow label={isEs ? "Nuevo principal e intereses /mes (30 años)" : "New P&I /mo (30 yr)"} value={fmtUSD(v.monthlyPIPayment)} />

                <SectionHeader label={isEs ? "Posición de capital" : "Capital position"} />
                <ResultRow label={isEs ? "Capital recuperado (neto del refi − inversión total)" : "Cash recycled (refi net − all-in)"} value={fmtUSD(v.cashRecycled)} bold accent={isGoodDeal ? "good" : undefined} />
                <ResultRow label={isEs ? "Capital atrapado en la operación" : "Cash left in deal"} value={fmtUSD(Math.max(0, v.cashLeftIn))} />
                <ResultRow label={isEs ? "Plusvalía capturada (ARV − refi)" : "Equity captured (ARV − refi)"} value={fmtUSD(v.equityCaptured)} bold accent="good" />
                <ResultRow label={isEs ? "Margen del ARV %" : "ARV spread %"} value={`${v.spreadPct.toFixed(1)}%`} />
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
                    <strong className="text-foreground">Capital recuperado</strong> = ingresos netos del refinanciamiento menos el capital total invertido. Un número positivo significa que el refi devolvió más que tu inversión total — el escenario de "rendimiento infinito" del BRRRR. Un número negativo significa que aún tienes plusvalía atrapada en la operación. Ambos pueden ser resultados ganadores; depende de tus objetivos.
                  </>
                ) : (
                  <>
                    <strong className="text-foreground">Cash recycled</strong> = net refi proceeds minus total cash in. A positive number means the refi returned more than your total investment — the BRRRR "infinite return" scenario. A negative number means you still have equity tied up in the deal. Both can be winning outcomes; it depends on your goals.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tip panel */}
      <div className="rounded-xl border border-border bg-card p-5 md:p-7">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="size-4 text-accent" />
          <h3 className="text-lg font-bold text-foreground">{isEs ? "Después del refi — verifica el DSCR" : "After the refi — verify DSCR"}</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {isEs ? (
            <>
              El nuevo préstamo de refinanciamiento DSCR crea una obligación mensual permanente de principal e intereses. Antes de cerrar, ingresa el nuevo monto del préstamo, la tasa, los impuestos y el seguro en la <a href="/es/tools/dscr-calculator" className="text-primary font-medium hover:underline">Calculadora de DSCR</a> para confirmar que los ingresos por renta estabilizados cubren el nuevo pago al DSCR requerido por el prestamista.
            </>
          ) : (
            <>
              The new DSCR refi loan creates a permanent monthly P&I obligation. Before closing, plug your new loan amount, rate, taxes, and insurance into the <a href="/tools/dscr-calculator" className="text-primary font-medium hover:underline">DSCR Calculator</a> to confirm the stabilized rental income covers the new payment at the lender's required DSCR.
            </>
          )}
        </p>
      </div>

      {/* CTA */}
      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 p-6 md:p-8 text-primary-foreground">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">{isEs ? "Encuentra tu prestamista de refinanciamiento DSCR" : "Find your DSCR refi lender"}</h3>
            <p className="mt-1 text-sm opacity-80">{isEs ? "Cotizamos con más de 1,000 prestamistas DSCR — top 3 ofertas en una hora. Sin consulta de crédito." : "We shop 1,000+ DSCR lenders — top 3 offers in one hour. No credit pull."}</p>
          </div>
          <Button asChild variant="cta" size="lg" className="shrink-0">
            <a href={isEs ? "/es/get-matched?source=rehab-arv-calculator" : "/get-matched?source=rehab-arv-calculator"}>{isEs ? "Ver mis ofertas" : "Get my matches"} <ArrowRight className="size-4" /></a>
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

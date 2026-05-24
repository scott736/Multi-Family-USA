"use client";

import { ArrowRight, CheckCircle2, Info, RotateCcw, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtUSD, fmtUSD2, monthlyPI, parseNum } from "@/lib/finance";

const piYears = (p: number, r: number, y: number) => monthlyPI(p, r, y * 12);

interface Fields {
  purchasePrice: string;
  downPct: string;
  rate: string;
  term: string;
  taxPct: string;
  insPct: string;
  hoa: string;
}

const DEFAULTS: Fields = {
  purchasePrice: "350000",
  downPct: "25",
  rate: "7.25",
  term: "30",
  taxPct: "1.1",
  insPct: "0.55",
  hoa: "0",
};

const DSCR_TARGETS = [
  { label: "1.00 DSCR", multiplier: 1.0, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/40" },
  { label: "1.10 DSCR", multiplier: 1.1, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10", ring: "ring-yellow-500/40" },
  { label: "1.25 DSCR", multiplier: 1.25, color: "text-success", bg: "bg-success/10", ring: "ring-success/40" },
];

interface RentToPitiaCalculatorProps {
  lang?: "en" | "es";
}

export default function RentToPitiaCalculator({
  lang = "en",
}: RentToPitiaCalculatorProps = {}) {
  const isEs = lang === "es";
  const [f, setF] = useState<Fields>(DEFAULTS);

  const price = parseNum(f.purchasePrice);
  const downPct = parseNum(f.downPct);
  const rate = parseNum(f.rate);
  const term = parseNum(f.term) || 30;
  const taxPct = parseNum(f.taxPct);
  const insPct = parseNum(f.insPct);
  const hoa = parseNum(f.hoa);

  const results = useMemo(() => {
    if (price <= 0 || rate <= 0) return null;

    const loanAmount = price * (1 - downPct / 100);
    const pi = piYears(loanAmount, rate, term);
    const tax = (price * taxPct) / 100 / 12;
    const ins = (price * insPct) / 100 / 12;
    const pitia = pi + tax + ins + hoa;

    const targets = DSCR_TARGETS.map((t) => ({
      ...t,
      requiredRent: pitia * t.multiplier,
    }));

    return { loanAmount, pi, tax, ins, pitia, targets };
  }, [price, downPct, rate, term, taxPct, insPct, hoa]);

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
              <p className="text-xs font-bold uppercase tracking-wider text-accent">
                {isEs ? "Calificador de renta" : "Rent qualifier"}
              </p>
              <h2 className="text-xl md:text-2xl font-bold text-foreground mt-0.5 mb-5">
                {isEs ? "Ingresa los datos de compra" : "Enter purchase details"}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="purchasePrice"
                  label={isEs ? "Precio de compra" : "Purchase price"}
                  prefix="$"
                  value={f.purchasePrice}
                  onChange={(v) => update("purchasePrice", v)}
                />
                <Field
                  id="downPct"
                  label={isEs ? "Enganche %" : "Down payment %"}
                  suffix="%"
                  value={f.downPct}
                  onChange={(v) => update("downPct", v)}
                  hint={isEs ? "DSCR típico: 20–25%" : "Typical DSCR: 20–25%"}
                />
                <Field
                  id="rate"
                  label={isEs ? "Tasa de interés %" : "Interest rate %"}
                  suffix="%"
                  value={f.rate}
                  onChange={(v) => update("rate", v)}
                />
                <Field
                  id="term"
                  label={isEs ? "Plazo del préstamo (años)" : "Loan term (years)"}
                  value={f.term}
                  onChange={(v) => update("term", v)}
                />
                <Field
                  id="taxPct"
                  label={isEs ? "Tasa de impuesto a la propiedad %/año" : "Property tax rate %/yr"}
                  suffix="%"
                  value={f.taxPct}
                  onChange={(v) => update("taxPct", v)}
                  hint={isEs ? "Del precio de compra anualmente" : "Of purchase price annually"}
                />
                <Field
                  id="insPct"
                  label={isEs ? "Tasa de seguro %/año" : "Insurance rate %/yr"}
                  suffix="%"
                  value={f.insPct}
                  onChange={(v) => update("insPct", v)}
                  hint={isEs ? "Del precio de compra anualmente" : "Of purchase price annually"}
                />
                <Field
                  id="hoa"
                  label={isEs ? "HOA mensual" : "Monthly HOA"}
                  prefix="$"
                  value={f.hoa}
                  onChange={(v) => update("hoa", v)}
                />
              </div>
              <div className="mt-6">
                <Button variant="outline" size="sm" onClick={() => setF(DEFAULTS)}>
                  <RotateCcw className="size-3.5" /> {isEs ? "Restablecer" : "Reset"}
                </Button>
              </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-2 p-5 md:p-7 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isEs ? "Renta mensual requerida" : "Required monthly rent"}
              </p>

              {results ? (
                <>
                  <dl className="space-y-2 text-sm mb-4">
                    <Row label={isEs ? "Monto del préstamo" : "Loan amount"} value={fmtUSD(results.loanAmount)} />
                    <Row label="P&I" value={fmtUSD2(results.pi)} />
                    <Row label={isEs ? "Impuestos (est.)" : "Tax (est.)"} value={fmtUSD2(results.tax)} />
                    <Row label={isEs ? "Seguro (est.)" : "Insurance (est.)"} value={fmtUSD2(results.ins)} />
                    <Row label="HOA" value={fmtUSD(hoa)} />
                    <Row label={isEs ? "PITIA mensual" : "Monthly PITIA"} value={fmtUSD2(results.pitia)} bold />
                  </dl>

                  <div className="space-y-3">
                    {results.targets.map((t) => (
                      <div key={t.label} className={cn("rounded-xl p-4 ring-2", t.ring, t.bg)}>
                        <div className="flex items-center justify-between">
                          <span className={cn("text-sm font-bold", t.color)}>{t.label}</span>
                          <span className={cn("text-xl font-bold tabular-nums", t.color)}>
                            {fmtUSD(t.requiredRent)}{isEs ? "/mes" : "/mo"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-xl bg-muted/40 ring-2 ring-border p-5 text-sm text-muted-foreground">
                  {isEs ? "Ingresa los datos de compra para ver la renta requerida." : "Enter purchase details to see required rent."}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border bg-secondary/40 rounded-b-2xl p-5 md:p-7">
            <div className="flex items-start gap-3">
              <Info className="size-5 shrink-0 text-accent mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isEs
                  ? "Esta es una verificación rápida — comprueba que la renta del mercado cumpla con tu DSCR objetivo antes de analizar la operación completa. Las tasas de impuestos y seguro usan los porcentajes que ingresaste como estimaciones."
                  : "This is a quick screener — check that market rent meets your target DSCR before running a full deal. Tax and insurance rates use your entered percentages as estimates."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 p-6 md:p-8 text-primary-foreground">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">
              {isEs ? "¿Califica esta operación? Encuentra ofertas" : "Does this deal qualify? Get matched"}
            </h3>
            <p className="mt-1 text-sm opacity-80">
              {isEs
                ? "Comparamos 1,000+ prestamistas DSCR. Las 3 mejores ofertas en una hora. Sin verificación de crédito."
                : "We shop 1,000+ DSCR lenders. Top 3 offers in one hour. No credit pull."}
            </p>
          </div>
          <Button asChild variant="cta" size="lg" className="shrink-0">
            <a href={isEs ? "/es/get-matched?source=rent-to-pitia-calculator" : "/get-matched?source=rent-to-pitia-calculator"}>
              {isEs ? "Ver mis ofertas" : "Get my matches"} <ArrowRight className="size-4" />
            </a>
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

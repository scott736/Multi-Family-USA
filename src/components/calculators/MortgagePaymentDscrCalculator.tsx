"use client";

import { ArrowRight, Info, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtUSD, fmtUSD2, monthlyPI, parseNum } from "@/lib/finance";

const piYears = (p: number, r: number, y: number) => monthlyPI(p, r, y * 12);

type InputMode = "loan" | "purchase";

interface Fields {
  inputMode: InputMode;
  loanAmount: string;
  purchasePrice: string;
  downPct: string;
  rate: string;
  term: string;
  tax: string;
  insurance: string;
  hoa: string;
  rent: string;
}

const DEFAULTS: Fields = {
  inputMode: "loan",
  loanAmount: "300000",
  purchasePrice: "400000",
  downPct: "25",
  rate: "7.25",
  term: "30",
  tax: "300",
  insurance: "120",
  hoa: "0",
  rent: "2800",
};

interface MortgagePaymentDscrCalculatorProps {
  lang?: "en" | "es";
}

export default function MortgagePaymentDscrCalculator({ lang = "en" }: MortgagePaymentDscrCalculatorProps = {}) {
  const isEs = lang === "es";
  const [f, setF] = useState<Fields>(DEFAULTS);

  const purchasePrice = parseNum(f.purchasePrice);
  const downPct = parseNum(f.downPct);
  const loanFromPurchase = purchasePrice * (1 - downPct / 100);
  const loan = f.inputMode === "purchase" ? loanFromPurchase : parseNum(f.loanAmount);

  const rate = parseNum(f.rate);
  const term = parseNum(f.term) || 30;
  const tax = parseNum(f.tax);
  const ins = parseNum(f.insurance);
  const hoa = parseNum(f.hoa);
  const rent = parseNum(f.rent);

  const results = useMemo(() => {
    if (loan <= 0 || rate <= 0) return null;

    const pi = piYears(loan, rate, term);
    const pitia = pi + tax + ins + hoa;
    const dscr = rent > 0 && pitia > 0 ? rent / pitia : 0;
    const cashFlow = rent > 0 ? rent - pitia : 0;

    return { pi, pitia, dscr, cashFlow };
  }, [loan, rate, term, tax, ins, hoa, rent]);

  function update<K extends keyof Fields>(k: K, v: Fields[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  function dscrColor(dscr: number) {
    if (dscr >= 1.25) return { text: "text-success", ring: "ring-success/40", bg: "bg-success/10" };
    if (dscr >= 1.0) return { text: "text-yellow-600 dark:text-yellow-400", ring: "ring-yellow-500/40", bg: "bg-yellow-500/10" };
    if (dscr >= 0.75) return { text: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/40", bg: "bg-amber-500/10" };
    if (dscr > 0) return { text: "text-destructive", ring: "ring-destructive/40", bg: "bg-destructive/10" };
    return { text: "text-muted-foreground", ring: "ring-border", bg: "bg-muted/40" };
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-accent/50 via-accent/20 to-primary/20 p-[1.5px] shadow-lg">
        <div className="rounded-2xl bg-card">
          <div className="grid gap-0 lg:grid-cols-5">
            {/* Inputs */}
            <div className="lg:col-span-3 p-5 md:p-7 border-b lg:border-b-0 lg:border-r border-border">
              <p className="text-xs font-bold uppercase tracking-wider text-accent">{isEs ? "Calculadora de pago" : "Payment calculator"}</p>
              <h2 className="text-xl md:text-2xl font-bold text-foreground mt-0.5 mb-4">{isEs ? "Ingresa tu operación" : "Enter your deal"}</h2>

              {/* Mode toggle */}
              <div className="flex gap-2 mb-5">
                <button
                  onClick={() => update("inputMode", "loan")}
                  className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition", f.inputMode === "loan" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
                >
                  {isEs ? "Monto del préstamo" : "Loan amount"}
                </button>
                <button
                  onClick={() => update("inputMode", "purchase")}
                  className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition", f.inputMode === "purchase" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
                >
                  {isEs ? "Precio de compra + enganche %" : "Purchase price + down %"}
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {f.inputMode === "loan" ? (
                  <Field id="loanAmount" label={isEs ? "Monto del préstamo" : "Loan amount"} prefix="$" value={f.loanAmount} onChange={(v) => update("loanAmount", v)} />
                ) : (
                  <>
                    <Field id="purchasePrice" label={isEs ? "Precio de compra" : "Purchase price"} prefix="$" value={f.purchasePrice} onChange={(v) => update("purchasePrice", v)} />
                    <Field id="downPct" label={isEs ? "Enganche %" : "Down payment %"} suffix="%" value={f.downPct} onChange={(v) => update("downPct", v)} hint={isEs ? `Préstamo: ${fmtUSD(loanFromPurchase)}` : `Loan: ${fmtUSD(loanFromPurchase)}`} />
                  </>
                )}
                <Field id="rate" label={isEs ? "Tasa de interés %" : "Interest rate %"} suffix="%" value={f.rate} onChange={(v) => update("rate", v)} />
                <Field id="term" label={isEs ? "Plazo del préstamo (años)" : "Loan term (years)"} value={f.term} onChange={(v) => update("term", v)} />
                <Field id="tax" label={isEs ? "Impuesto predial mensual" : "Monthly property tax"} prefix="$" value={f.tax} onChange={(v) => update("tax", v)} hint={isEs ? "Anual ÷ 12" : "Annual ÷ 12"} />
                <Field id="insurance" label={isEs ? "Seguro mensual" : "Monthly insurance"} prefix="$" value={f.insurance} onChange={(v) => update("insurance", v)} />
                <Field id="hoa" label={isEs ? "HOA mensual" : "Monthly HOA"} prefix="$" value={f.hoa} onChange={(v) => update("hoa", v)} />
                <Field id="rent" label={isEs ? "Renta mensual (opcional)" : "Monthly rent (optional)"} prefix="$" value={f.rent} onChange={(v) => update("rent", v)} hint={isEs ? "Habilita el cálculo de DSCR" : "Enables DSCR calculation"} />
              </div>

              <div className="mt-6">
                <Button variant="outline" size="sm" onClick={() => setF(DEFAULTS)}>
                  <RotateCcw className="size-3.5" /> {isEs ? "Restablecer" : "Reset"}
                </Button>
              </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-2 p-5 md:p-7 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isEs ? "Tu pago" : "Your payment"}</p>

              {results ? (
                <>
                  <div className="rounded-xl bg-accent/10 ring-2 ring-accent/30 p-4 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-accent">{isEs ? "PITIA mensual" : "Monthly PITIA"}</p>
                    <p className="text-4xl font-bold tabular-nums text-foreground mt-1">{fmtUSD2(results.pitia)}</p>
                  </div>

                  <dl className="space-y-2 text-sm">
                    <Row label={isEs ? "Monto del préstamo" : "Loan amount"} value={fmtUSD(loan)} />
                    <Row label={isEs ? "Principal e intereses" : "Principal + interest"} value={fmtUSD2(results.pi)} bold />
                    <Row label={isEs ? "Impuesto predial" : "Property tax"} value={fmtUSD(tax)} />
                    <Row label={isEs ? "Seguro" : "Insurance"} value={fmtUSD(ins)} />
                    <Row label="HOA" value={fmtUSD(hoa)} />
                    <Row label={isEs ? "PITIA total" : "Total PITIA"} value={fmtUSD2(results.pitia)} bold />
                  </dl>

                  {rent > 0 && (
                    <>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground pt-2">DSCR</p>
                      {(() => {
                        const c = dscrColor(results.dscr);
                        return (
                          <div className={cn("rounded-xl p-4 ring-2", c.ring, c.bg)}>
                            <div className={cn("text-4xl font-bold tabular-nums", c.text)}>
                              {results.dscr > 0 ? results.dscr.toFixed(2) : "—"}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {isEs ? "Flujo de caja mensual: " : "Monthly cash flow: "}<span className={results.cashFlow >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>{fmtUSD2(results.cashFlow)}</span>
                            </p>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </>
              ) : (
                <div className="rounded-xl bg-muted/40 ring-2 ring-border p-5 text-sm text-muted-foreground">
                  {isEs ? "Ingresa los detalles del préstamo para calcular tu pago." : "Enter loan details to calculate your payment."}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border bg-secondary/40 rounded-b-2xl p-5 md:p-7">
            <div className="flex items-start gap-3">
              <Info className="size-5 shrink-0 text-accent mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isEs
                  ? "PITIA = Principal + Intereses + Impuestos + Seguro + Cuotas de asociación. Este es el número que los prestamistas DSCR usan para calcular tu razón de cobertura del servicio de la deuda."
                  : "PITIA = Principal + Interest + Taxes + Insurance + Association dues. This is the number DSCR lenders use to calculate your debt service coverage ratio."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 p-6 md:p-8 text-primary-foreground">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">{isEs ? "Conéctate con prestamistas DSCR" : "Get matched with DSCR lenders"}</h3>
            <p className="mt-1 text-sm opacity-80">{isEs ? "Cotizamos con más de 1,000 prestamistas DSCR. Top 3 ofertas en una hora. Sin consulta de crédito." : "We shop 1,000+ DSCR lenders. Top 3 offers in one hour. No credit pull."}</p>
          </div>
          <Button asChild variant="cta" size="lg" className="shrink-0">
            <a href={isEs ? "/es/get-matched?source=mortgage-payment-dscr-calculator" : "/get-matched?source=mortgage-payment-dscr-calculator"}>{isEs ? "Ver mis ofertas" : "Get my matches"} <ArrowRight className="size-4" /></a>
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

"use client";

import { AlertTriangle, ArrowRight, Info, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtUSD, parseNum } from "@/lib/finance";

// State transfer tax data (buyer rate as % of sale/loan amount)
// "none" = no transfer tax state
const STATE_TRANSFER_TAX: Record<string, { name: string; rate: number; note?: string; noteEs?: string }> = {
  AL: { name: "Alabama", rate: 0, note: "No transfer tax", noteEs: "Sin impuesto de transferencia" },
  AK: { name: "Alaska", rate: 0, note: "No transfer tax", noteEs: "Sin impuesto de transferencia" },
  AZ: { name: "Arizona", rate: 0, note: "No transfer tax", noteEs: "Sin impuesto de transferencia" },
  AR: { name: "Arkansas", rate: 0.33, note: "0.33% buyer", noteEs: "0.33% comprador" },
  CA: { name: "California", rate: 0.11, note: "~0.11% county + city varies", noteEs: "~0.11% condado + ciudad varía" },
  CO: { name: "Colorado", rate: 0.01, note: "0.01% deed tax", noteEs: "0.01% impuesto de escritura" },
  CT: { name: "Connecticut", rate: 0.75, note: "0.75% buyer", noteEs: "0.75% comprador" },
  DE: { name: "Delaware", rate: 2.5, note: "2.5% split buyer/seller", noteEs: "2.5% dividido comprador/vendedor" },
  DC: { name: "District of Columbia", rate: 1.1, note: "1.1% buyer", noteEs: "1.1% comprador" },
  FL: { name: "Florida", rate: 0.7, note: "0.7% (Dade Co. 1.05%)", noteEs: "0.7% (Condado de Dade 1.05%)" },
  GA: { name: "Georgia", rate: 0.1, note: "0.1% intangible tax", noteEs: "0.1% impuesto intangible" },
  HI: { name: "Hawaii", rate: 0.1, note: "0.1% buyer", noteEs: "0.1% comprador" },
  ID: { name: "Idaho", rate: 0, note: "No transfer tax", noteEs: "Sin impuesto de transferencia" },
  IL: { name: "Illinois", rate: 0.05, note: "0.05% (seller typically pays)", noteEs: "0.05% (normalmente paga el vendedor)" },
  IN: { name: "Indiana", rate: 0, note: "No transfer tax", noteEs: "Sin impuesto de transferencia" },
  IA: { name: "Iowa", rate: 0.16, note: "0.16% buyer", noteEs: "0.16% comprador" },
  KS: { name: "Kansas", rate: 0, note: "No transfer tax", noteEs: "Sin impuesto de transferencia" },
  KY: { name: "Kentucky", rate: 0.1, note: "0.1% buyer", noteEs: "0.1% comprador" },
  LA: { name: "Louisiana", rate: 0, note: "No transfer tax", noteEs: "Sin impuesto de transferencia" },
  ME: { name: "Maine", rate: 0.44, note: "0.44% buyer", noteEs: "0.44% comprador" },
  MD: { name: "Maryland", rate: 0.5, note: "0.5% buyer", noteEs: "0.5% comprador" },
  MA: { name: "Massachusetts", rate: 0.456, note: "0.456% buyer", noteEs: "0.456% comprador" },
  MI: { name: "Michigan", rate: 0.75, note: "0.75% buyer", noteEs: "0.75% comprador" },
  MN: { name: "Minnesota", rate: 0.33, note: "0.33% buyer", noteEs: "0.33% comprador" },
  MS: { name: "Mississippi", rate: 0, note: "No transfer tax", noteEs: "Sin impuesto de transferencia" },
  MO: { name: "Missouri", rate: 0, note: "No transfer tax", noteEs: "Sin impuesto de transferencia" },
  MT: { name: "Montana", rate: 0, note: "No transfer tax", noteEs: "Sin impuesto de transferencia" },
  NE: { name: "Nebraska", rate: 0.225, note: "0.225% buyer", noteEs: "0.225% comprador" },
  NV: { name: "Nevada", rate: 0.19, note: "~0.19% transfer tax", noteEs: "~0.19% impuesto de transferencia" },
  NH: { name: "New Hampshire", rate: 0.75, note: "0.75% buyer", noteEs: "0.75% comprador" },
  NJ: { name: "New Jersey", rate: 0.8, note: "0.8% buyer (realty transfer)", noteEs: "0.8% comprador (transferencia inmobiliaria)" },
  NM: { name: "New Mexico", rate: 0, note: "No transfer tax", noteEs: "Sin impuesto de transferencia" },
  NY: { name: "New York", rate: 0.4, note: "0.4% + NYC mansion tax on $1M+", noteEs: "0.4% + impuesto de mansión en NYC sobre $1M+" },
  NC: { name: "North Carolina", rate: 0.2, note: "0.2% buyer", noteEs: "0.2% comprador" },
  ND: { name: "North Dakota", rate: 0, note: "No transfer tax", noteEs: "Sin impuesto de transferencia" },
  OH: { name: "Ohio", rate: 0.1, note: "0.1% conveyance fee", noteEs: "0.1% cargo de traspaso" },
  OK: { name: "Oklahoma", rate: 0.075, note: "0.075% buyer", noteEs: "0.075% comprador" },
  OR: { name: "Oregon", rate: 0, note: "No transfer tax", noteEs: "Sin impuesto de transferencia" },
  PA: { name: "Pennsylvania", rate: 1.0, note: "1% buyer (+ 1% seller)", noteEs: "1% comprador (+ 1% vendedor)" },
  RI: { name: "Rhode Island", rate: 0.46, note: "0.46% buyer", noteEs: "0.46% comprador" },
  SC: { name: "South Carolina", rate: 0.185, note: "0.185% buyer", noteEs: "0.185% comprador" },
  SD: { name: "South Dakota", rate: 0, note: "No transfer tax", noteEs: "Sin impuesto de transferencia" },
  TN: { name: "Tennessee", rate: 0.0037, note: "Minimal deed tax", noteEs: "Impuesto de escritura mínimo" },
  TX: { name: "Texas", rate: 0, note: "No transfer tax", noteEs: "Sin impuesto de transferencia" },
  UT: { name: "Utah", rate: 0, note: "No transfer tax", noteEs: "Sin impuesto de transferencia" },
  VT: { name: "Vermont", rate: 0.5, note: "0.5% buyer", noteEs: "0.5% comprador" },
  VA: { name: "Virginia", rate: 0.25, note: "0.25% buyer", noteEs: "0.25% comprador" },
  WA: { name: "Washington", rate: 1.1, note: "1.1% on $500K–$1.5M", noteEs: "1.1% en $500K–$1.5M" },
  WV: { name: "West Virginia", rate: 0.11, note: "0.11% buyer", noteEs: "0.11% comprador" },
  WI: { name: "Wisconsin", rate: 0.3, note: "0.3% buyer", noteEs: "0.3% comprador" },
  WY: { name: "Wyoming", rate: 0, note: "No transfer tax", noteEs: "Sin impuesto de transferencia" },
};

interface Fields {
  loanAmount: string;
  state: string;
  transactionType: "purchase" | "refinance";
}

interface ClosingCostCalculatorProps {
  lang?: "en" | "es";
}

const DEFAULTS: Fields = {
  loanAmount: "350000",
  state: "TX",
  transactionType: "purchase",
};

const SORTED_STATES = Object.entries(STATE_TRANSFER_TAX).sort((a, b) => a[1].name.localeCompare(b[1].name));

// Title insurance baseline per $100K of loan (rough national averages)
function titleInsurance(loanAmount: number): number {
  // Rough lender's title policy: ~0.5% on first $200K, 0.4% thereafter
  if (loanAmount <= 0) return 0;
  const base = Math.min(loanAmount, 200000) * 0.005;
  const remainder = Math.max(0, loanAmount - 200000) * 0.004;
  return Math.round(base + remainder);
}

export default function ClosingCostCalculator({ lang = "en" }: ClosingCostCalculatorProps = {}) {
  const isEs = lang === "es";
  const [f, setF] = useState<Fields>(DEFAULTS);

  const loan = parseNum(f.loanAmount);
  const isRefi = f.transactionType === "refinance";

  const results = useMemo(() => {
    if (loan <= 0 || !f.state) return null;

    const stateData = STATE_TRANSFER_TAX[f.state];
    if (!stateData) return null;

    // Lender fees
    const origination = loan * 0.01;
    const processing = 695;
    const underwriting = 995;
    const lenderTotal = origination + processing + underwriting;

    // Third-party
    const appraisal = 675;
    const creditReport = 75;
    const titleFee = titleInsurance(loan);
    const recording = 175;
    const escrowFee = Math.round(loan * 0.001 + 300); // rough escrow/settlement
    const thirdPartyTotal = appraisal + creditReport + titleFee + recording + escrowFee;

    // Transfer tax — only on purchase
    const transferTaxAmt = isRefi ? 0 : loan * (stateData.rate / 100);

    const grandTotal = lenderTotal + thirdPartyTotal + transferTaxAmt;

    const noteText = isEs ? (stateData.noteEs ?? stateData.note ?? "") : (stateData.note ?? "");
    const noTaxLabel = isEs ? "Sin impuesto de transferencia en este estado" : "No transfer tax in this state";

    const items = [
      { category: isEs ? "Cargos del prestamista" : "Lender fees", label: isEs ? "Originación (1%)" : "Origination (1%)", amount: origination },
      { category: isEs ? "Cargos del prestamista" : "Lender fees", label: isEs ? "Cargo de procesamiento" : "Processing fee", amount: processing },
      { category: isEs ? "Cargos del prestamista" : "Lender fees", label: isEs ? "Cargo de suscripción" : "Underwriting fee", amount: underwriting },
      { category: isEs ? "Terceros" : "Third-party", label: isEs ? "Avalúo" : "Appraisal", amount: appraisal },
      { category: isEs ? "Terceros" : "Third-party", label: isEs ? "Reporte de crédito" : "Credit report", amount: creditReport },
      { category: isEs ? "Terceros" : "Third-party", label: isEs ? "Seguro de título del prestamista" : "Lender's title insurance", amount: titleFee },
      { category: isEs ? "Terceros" : "Third-party", label: isEs ? "Aranceles de registro" : "Recording fee", amount: recording },
      { category: isEs ? "Terceros" : "Third-party", label: isEs ? "Plica/liquidación" : "Escrow/settlement", amount: escrowFee },
      ...(transferTaxAmt > 0
        ? [{ category: isEs ? "Impuesto de transferencia" : "Transfer tax", label: noteText, amount: transferTaxAmt }]
        : [{ category: isEs ? "Impuesto de transferencia" : "Transfer tax", label: noTaxLabel, amount: 0 }]),
    ];

    return { items, lenderTotal, thirdPartyTotal, transferTaxAmt, grandTotal, stateName: stateData.name };
  }, [loan, f.state, isRefi, isEs]);

  function update<K extends keyof Fields>(k: K, v: Fields[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  const txTypeLabel = f.transactionType === "purchase"
    ? (isEs ? "compra" : "purchase")
    : (isEs ? "refinanciamiento" : "refinance");

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-accent/50 via-accent/20 to-primary/20 p-[1.5px] shadow-lg">
        <div className="rounded-2xl bg-card">
          <div className="grid gap-0 lg:grid-cols-5">
            {/* Inputs */}
            <div className="lg:col-span-2 p-5 md:p-7 border-b lg:border-b-0 lg:border-r border-border">
              <p className="text-xs font-bold uppercase tracking-wider text-accent">{isEs ? "Estimador de costos de cierre" : "Closing cost estimator"}</p>
              <h2 className="text-xl md:text-2xl font-bold text-foreground mt-0.5 mb-5">{isEs ? "Ingresa los detalles del trato" : "Enter deal details"}</h2>
              <div className="grid gap-4">
                <Field id="loanAmount" label={isEs ? "Monto del préstamo" : "Loan amount"} prefix="$" value={f.loanAmount} onChange={(v) => update("loanAmount", v)} />

                <div className="grid gap-1.5">
                  <Label htmlFor="state" className="text-xs font-medium text-foreground">{isEs ? "Estado" : "State"}</Label>
                  <select
                    id="state"
                    value={f.state}
                    onChange={(e) => update("state", e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {SORTED_STATES.map(([abbr, { name }]) => (
                      <option key={abbr} value={abbr}>{name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="transactionType" className="text-xs font-medium text-foreground">{isEs ? "Tipo de transacción" : "Transaction type"}</Label>
                  <select
                    id="transactionType"
                    value={f.transactionType}
                    onChange={(e) => update("transactionType", e.target.value as "purchase" | "refinance")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="purchase">{isEs ? "Compra" : "Purchase"}</option>
                    <option value="refinance">{isEs ? "Refinanciamiento" : "Refinance"}</option>
                  </select>
                </div>
              </div>

              <div className="mt-6">
                <Button variant="outline" size="sm" onClick={() => setF(DEFAULTS)}>
                  <RotateCcw className="size-3.5" /> {isEs ? "Restablecer" : "Reset"}
                </Button>
              </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-3 p-5 md:p-7 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isEs ? "Estimación detallada" : "Itemized estimate"}</p>

              {results ? (
                <>
                  <div className="rounded-xl bg-accent/10 ring-2 ring-accent/30 p-4 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-accent">{isEs ? "Costos de cierre totales estimados" : "Estimated total closing costs"}</p>
                    <p className="text-4xl font-bold tabular-nums text-foreground mt-1">{fmtUSD(results.grandTotal)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{results.stateName} · {txTypeLabel}</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                          <th className="py-2 pr-4">{isEs ? "Categoría" : "Category"}</th>
                          <th className="py-2 pr-4">{isEs ? "Concepto" : "Item"}</th>
                          <th className="py-2 text-right">{isEs ? "Monto" : "Amount"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {results.items.map((item, i) => (
                          <tr key={i} className={item.amount === 0 ? "opacity-50" : ""}>
                            <td className="py-2 pr-4 text-xs text-muted-foreground">{item.category}</td>
                            <td className="py-2 pr-4 text-xs">{item.label}</td>
                            <td className="py-2 text-right tabular-nums font-medium">{item.amount > 0 ? fmtUSD(item.amount) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-border">
                        <tr>
                          <td className="py-2 pr-4 text-xs font-bold">{isEs ? "Total del prestamista" : "Lender total"}</td>
                          <td></td>
                          <td className="py-2 text-right tabular-nums font-bold">{fmtUSD(results.lenderTotal)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 pr-4 text-xs font-bold">{isEs ? "Total de terceros" : "Third-party total"}</td>
                          <td></td>
                          <td className="py-2 text-right tabular-nums font-bold">{fmtUSD(results.thirdPartyTotal)}</td>
                        </tr>
                        {results.transferTaxAmt > 0 && (
                          <tr>
                            <td className="py-2 pr-4 text-xs font-bold">{isEs ? "Impuesto de transferencia" : "Transfer tax"}</td>
                            <td></td>
                            <td className="py-2 text-right tabular-nums font-bold">{fmtUSD(results.transferTaxAmt)}</td>
                          </tr>
                        )}
                        <tr className="bg-accent/5">
                          <td className="py-2 pr-4 text-sm font-bold text-foreground">{isEs ? "Total general" : "Grand total"}</td>
                          <td></td>
                          <td className="py-2 text-right tabular-nums text-lg font-bold text-foreground">{fmtUSD(results.grandTotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              ) : (
                <div className="rounded-xl bg-muted/40 ring-2 ring-border p-5 text-sm text-muted-foreground">
                  {isEs ? "Ingresa los datos del préstamo para ver los costos de cierre detallados." : "Enter loan details to see itemized closing costs."}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border bg-secondary/40 rounded-b-2xl p-5 md:p-7">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 shrink-0 text-amber-500 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong>{isEs ? "Solo estimaciones." : "Estimates only."}</strong> {isEs
                  ? "Los costos de cierre reales varían según el prestamista, la compañía de título, el condado y la estructura del trato. Las tasas de impuestos de transferencia varían por municipalidad. Esta herramienta usa cifras estatales aproximadas. Siempre revisa tu Estimación de Préstamo (Loan Estimate) para los costos exactos."
                  : "Actual closing costs vary by lender, title company, county, and deal structure. Transfer tax rates vary by municipality. This tool uses approximate statewide figures. Always review your Loan Estimate for exact costs."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 p-6 md:p-8 text-primary-foreground">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">{isEs ? "Recibe una Estimación de Préstamo real de los prestamistas" : "Get a real Loan Estimate from lenders"}</h3>
            <p className="mt-1 text-sm opacity-80">{isEs ? "Comparamos más de 1,000 prestamistas DSCR. Las 3 mejores ofertas con costos exactos en una hora. Sin consulta de crédito." : "We shop 1,000+ DSCR lenders. Top 3 offers with exact costs in one hour. No credit pull."}</p>
          </div>
          <Button asChild variant="cta" size="lg" className="shrink-0">
            <a href={isEs ? "/es/get-matched?source=closing-cost-estimator" : "/get-matched?source=closing-cost-estimator"}>{isEs ? "Obtener cotizaciones" : "Get quotes"} <ArrowRight className="size-4" /></a>
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

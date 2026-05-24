"use client";

import { AlertTriangle, ArrowRight, Info, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtUSD, fmtUSD2, parseNum } from "@/lib/finance";

// Effective property tax rates by state (approximate 2026 rates, as % of value)
const STATE_TAX_RATES: Record<string, { name: string; rate: number }> = {
  AL: { name: "Alabama", rate: 0.41 },
  AK: { name: "Alaska", rate: 1.22 },
  AZ: { name: "Arizona", rate: 0.66 },
  AR: { name: "Arkansas", rate: 0.68 },
  CA: { name: "California", rate: 0.75 },
  CO: { name: "Colorado", rate: 0.51 },
  CT: { name: "Connecticut", rate: 2.15 },
  DE: { name: "Delaware", rate: 0.58 },
  DC: { name: "District of Columbia", rate: 0.56 },
  FL: { name: "Florida", rate: 0.91 },
  GA: { name: "Georgia", rate: 0.92 },
  HI: { name: "Hawaii", rate: 0.27 },
  ID: { name: "Idaho", rate: 0.67 },
  IL: { name: "Illinois", rate: 2.27 },
  IN: { name: "Indiana", rate: 0.86 },
  IA: { name: "Iowa", rate: 1.57 },
  KS: { name: "Kansas", rate: 1.41 },
  KY: { name: "Kentucky", rate: 0.86 },
  LA: { name: "Louisiana", rate: 0.55 },
  ME: { name: "Maine", rate: 1.24 },
  MD: { name: "Maryland", rate: 1.07 },
  MA: { name: "Massachusetts", rate: 1.20 },
  MI: { name: "Michigan", rate: 1.44 },
  MN: { name: "Minnesota", rate: 1.12 },
  MS: { name: "Mississippi", rate: 0.79 },
  MO: { name: "Missouri", rate: 0.97 },
  MT: { name: "Montana", rate: 0.84 },
  NE: { name: "Nebraska", rate: 1.73 },
  NV: { name: "Nevada", rate: 0.60 },
  NH: { name: "New Hampshire", rate: 2.09 },
  NJ: { name: "New Jersey", rate: 2.49 },
  NM: { name: "New Mexico", rate: 0.80 },
  NY: { name: "New York", rate: 1.73 },
  NC: { name: "North Carolina", rate: 0.84 },
  ND: { name: "North Dakota", rate: 0.98 },
  OH: { name: "Ohio", rate: 1.59 },
  OK: { name: "Oklahoma", rate: 0.90 },
  OR: { name: "Oregon", rate: 1.00 },
  PA: { name: "Pennsylvania", rate: 1.58 },
  RI: { name: "Rhode Island", rate: 1.63 },
  SC: { name: "South Carolina", rate: 0.57 },
  SD: { name: "South Dakota", rate: 1.24 },
  TN: { name: "Tennessee", rate: 0.67 },
  TX: { name: "Texas", rate: 1.80 },
  UT: { name: "Utah", rate: 0.63 },
  VT: { name: "Vermont", rate: 1.90 },
  VA: { name: "Virginia", rate: 0.82 },
  WA: { name: "Washington", rate: 0.94 },
  WV: { name: "West Virginia", rate: 0.59 },
  WI: { name: "Wisconsin", rate: 1.85 },
  WY: { name: "Wyoming", rate: 0.61 },
};

// Insurance tiers: high-risk states
const HIGH_RISK_STATES = new Set(["FL", "LA", "TX", "CA", "MS", "AL", "SC", "GA", "NC", "OK"]);
const MID_RISK_STATES = new Set(["CO", "MN", "KS", "NE", "SD", "ND", "AR", "TN", "MO", "IL", "IN", "OH", "MI", "WI", "VA", "MD", "NY", "MA", "CT", "RI", "NH", "ME", "VT", "NJ", "PA", "DE", "DC"]);
// Everything else is low risk

function insRate(state: string): number {
  if (HIGH_RISK_STATES.has(state)) return 0.85;
  if (MID_RISK_STATES.has(state)) return 0.55;
  return 0.35;
}

function insRateLabel(state: string, isEs: boolean): string {
  if (HIGH_RISK_STATES.has(state)) return isEs ? "Riesgo alto (0.85%)" : "High risk (0.85%)";
  if (MID_RISK_STATES.has(state)) return isEs ? "Riesgo medio (0.55%)" : "Mid risk (0.55%)";
  return isEs ? "Riesgo bajo (0.35%)" : "Low risk (0.35%)";
}

// Property type insurance multipliers
const TYPE_MULTIPLIERS: Record<string, { label: string; labelEs: string; taxMult: number; insMult: number }> = {
  sfr: { label: "Single-family (SFR)", labelEs: "Vivienda unifamiliar (SFR)", taxMult: 1.0, insMult: 1.0 },
  multi: { label: "2–4 Unit multifamily", labelEs: "Multifamiliar de 2–4 unidades", taxMult: 1.05, insMult: 1.15 },
  condo: { label: "Condo (HO-6)", labelEs: "Condominio (HO-6)", taxMult: 0.85, insMult: 0.60 },
  str: { label: "Short-term rental (STR)", labelEs: "Renta a corto plazo (STR)", taxMult: 1.0, insMult: 1.35 },
};

interface Fields {
  propertyValue: string;
  state: string;
  propertyType: string;
}

const DEFAULTS: Fields = {
  propertyValue: "350000",
  state: "TX",
  propertyType: "sfr",
};

const SORTED_STATES = Object.entries(STATE_TAX_RATES).sort((a, b) => a[1].name.localeCompare(b[1].name));

interface PropertyTaxInsuranceCalculatorProps {
  lang?: "en" | "es";
}

export default function PropertyTaxInsuranceCalculator({ lang = "en" }: PropertyTaxInsuranceCalculatorProps = {}) {
  const isEs = lang === "es";
  const [f, setF] = useState<Fields>(DEFAULTS);

  const value = parseNum(f.propertyValue);

  const results = useMemo(() => {
    if (value <= 0 || !f.state || !f.propertyType) return null;

    const stateData = STATE_TAX_RATES[f.state];
    const typeData = TYPE_MULTIPLIERS[f.propertyType];
    if (!stateData || !typeData) return null;

    const baseTaxRate = stateData.rate / 100;
    const baseInsRate = insRate(f.state) / 100;

    const annualTax = value * baseTaxRate * typeData.taxMult;
    const annualIns = value * baseInsRate * typeData.insMult;

    const monthlyTax = annualTax / 12;
    const monthlyIns = annualIns / 12;

    return {
      annualTax,
      annualIns,
      monthlyTax,
      monthlyIns,
      taxRate: stateData.rate,
      insRateLabel: insRateLabel(f.state, isEs),
      insRatePct: (insRate(f.state) * typeData.insMult).toFixed(2),
      stateName: stateData.name,
    };
  }, [value, f.state, f.propertyType, isEs]);

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
              <p className="text-xs font-bold uppercase tracking-wider text-accent">{isEs ? "Estimador de impuestos y seguro" : "Tax & insurance estimator"}</p>
              <h2 className="text-xl md:text-2xl font-bold text-foreground mt-0.5 mb-5">{isEs ? "Ingresa los datos de la propiedad" : "Enter property details"}</h2>
              <div className="grid gap-4">
                <Field id="propertyValue" label={isEs ? "Valor de la propiedad" : "Property value"} prefix="$" value={f.propertyValue} onChange={(v) => update("propertyValue", v)} hint={isEs ? "Precio de compra o valor estimado de mercado" : "Purchase price or estimated market value"} />

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
                  <Label htmlFor="propertyType" className="text-xs font-medium text-foreground">{isEs ? "Tipo de propiedad" : "Property type"}</Label>
                  <select
                    id="propertyType"
                    value={f.propertyType}
                    onChange={(e) => update("propertyType", e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {Object.entries(TYPE_MULTIPLIERS).map(([key, { label, labelEs }]) => (
                      <option key={key} value={key}>{isEs ? labelEs : label}</option>
                    ))}
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
            <div className="lg:col-span-2 p-5 md:p-7 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isEs ? "Estimaciones" : "Estimates"}</p>

              {results ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-accent/10 ring-2 ring-accent/30 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-accent">{isEs ? "Impuesto mensual" : "Monthly Tax"}</p>
                      <p className="text-2xl font-bold tabular-nums text-foreground mt-1">{fmtUSD(results.monthlyTax)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{fmtUSD(results.annualTax)}{isEs ? "/año" : "/yr"}</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 ring-2 ring-border p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{isEs ? "Seguro mensual" : "Monthly Ins."}</p>
                      <p className="text-2xl font-bold tabular-nums text-foreground mt-1">{fmtUSD(results.monthlyIns)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{fmtUSD(results.annualIns)}{isEs ? "/año" : "/yr"}</p>
                    </div>
                  </div>

                  <dl className="space-y-2 text-sm">
                    <Row label={isEs ? "Estado" : "State"} value={results.stateName} />
                    <Row label={isEs ? "Tasa de impuesto efectiva" : "Effective tax rate"} value={`${results.taxRate}%`} />
                    <Row label={isEs ? "Nivel de riesgo del seguro" : "Insurance risk tier"} value={results.insRateLabel} />
                    <Row label={isEs ? "Tasa de seguro aplicada" : "Applied ins. rate"} value={`${results.insRatePct}${isEs ? "% del valor/año" : "% of value/yr"}`} />
                    <Row label={isEs ? "Total mensual (impuesto + seguro)" : "Combined monthly (tax + ins)"} value={fmtUSD2(results.monthlyTax + results.monthlyIns)} bold />
                    <Row label={isEs ? "Total anual" : "Combined annual"} value={fmtUSD(results.annualTax + results.annualIns)} bold />
                  </dl>
                </>
              ) : (
                <div className="rounded-xl bg-muted/40 ring-2 ring-border p-5 text-sm text-muted-foreground">
                  {isEs ? "Ingresa los datos de la propiedad para ver las estimaciones." : "Enter property details to see estimates."}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border bg-secondary/40 rounded-b-2xl p-5 md:p-7">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 shrink-0 text-amber-500 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isEs ? (
                  <><strong>Solo estimaciones.</strong> Las cifras de impuestos usan tasas estatales efectivas y variarán significativamente por condado, municipio y valor tasado. Las cifras de seguro usan niveles de riesgo regionales amplios. Siempre obtén las cuentas de impuestos reales y cotizaciones de seguro antes de la suscripción. Estas estimaciones no sustituyen el consejo profesional.</>
                ) : (
                  <><strong>Estimates only.</strong> Tax figures use statewide effective rates and will vary significantly by county, municipality, and assessed value. Insurance figures use broad regional risk tiers. Always obtain actual tax bills and insurance quotes before underwriting. These estimates are not a substitute for professional advice.</>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 p-6 md:p-8 text-primary-foreground">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">{isEs ? "Conecta esto a tu DSCR" : "Plug these into your DSCR"}</h3>
            <p className="mt-1 text-sm opacity-80">{isEs ? "Comparamos más de 1,000 prestamistas DSCR. Las 3 mejores ofertas en una hora. Sin consulta de crédito." : "We shop 1,000+ DSCR lenders. Top 3 offers in one hour. No credit pull."}</p>
          </div>
          <Button asChild variant="cta" size="lg" className="shrink-0">
            <a href={isEs ? "/es/get-matched?source=property-tax-insurance-estimator" : "/get-matched?source=property-tax-insurance-estimator"}>{isEs ? "Ver mis ofertas" : "Get my matches"} <ArrowRight className="size-4" /></a>
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

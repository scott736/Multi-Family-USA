"use client";

import { Check, Home, Plane, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtDSCR, fmtUSD } from "@/lib/finance";

interface StrDscrAnalyzerProps {
  lang?: "en" | "es";
}

export default function StrDscrAnalyzer({ lang = "en" }: StrDscrAnalyzerProps = {}) {
  const isEs = lang === "es";
  // STR revenue inputs
  const [adr, setAdr] = useState(235);
  const [occupancy, setOccupancy] = useState(68);
  const [highSeasonAdr, setHighSeasonAdr] = useState(340);
  const [lowSeasonAdr, setLowSeasonAdr] = useState(165);
  const [highSeasonPct, setHighSeasonPct] = useState(40); // % of year in high season

  // Expenses
  const [lodgingTaxPct, setLodgingTaxPct] = useState(12); // % of revenue
  const [cleaningPassThrough, setCleaningPassThrough] = useState(true);
  const [cleaningPerStay, setCleaningPerStay] = useState(125);
  const [avgStayNights, setAvgStayNights] = useState(3.5);
  const [pmPct, setPmPct] = useState(18);
  const [suppliesMonthly, setSuppliesMonthly] = useState(180);
  const [insuranceMonthly, setInsuranceMonthly] = useState(225);
  const [hoaMonthly, setHoaMonthly] = useState(0);
  const [piMonthly, setPiMonthly] = useState(3100);
  const [propTaxMonthly, setPropTaxMonthly] = useState(450);

  // LTR fallback
  const [ltrRent, setLtrRent] = useState(2650);

  const results = useMemo(() => {
    // Simple blended ADR (using seasonal split) and the flat ADR approach — use blended as the base
    const blendedAdr = (highSeasonAdr * highSeasonPct + lowSeasonAdr * (100 - highSeasonPct)) / 100;
    // Use the blended or overall ADR — preferring blended if seasonality was modified
    const workingAdr = adr; // allow user to override

    const annualRevenue = workingAdr * 365 * (occupancy / 100);
    const monthlyRevenue = annualRevenue / 12;

    // Cleaning cost: if pass-through, doesn't hit owner P&L (guest pays)
    const nightsOccupiedAnnual = 365 * (occupancy / 100);
    const stays = nightsOccupiedAnnual / Math.max(1, avgStayNights);
    const cleaningCostAnnual = cleaningPassThrough ? 0 : stays * cleaningPerStay;

    const lodgingTax = annualRevenue * (lodgingTaxPct / 100);
    const pmFee = annualRevenue * (pmPct / 100);
    const supplies = suppliesMonthly * 12;
    const insurance = insuranceMonthly * 12;
    const hoa = hoaMonthly * 12;
    const propTax = propTaxMonthly * 12;

    // Operating expenses (owner side), before debt service
    const opex = lodgingTax + pmFee + supplies + insurance + hoa + cleaningCostAnnual;
    const noi = annualRevenue - opex - propTax;
    const monthlyNet = noi / 12;

    const pi = piMonthly;
    const pitia = pi + propTaxMonthly + insuranceMonthly + hoaMonthly;

    // DSCR under STR = gross monthly revenue / PITIA (most STR DSCR lenders use this)
    const dscrNoHaircut = monthlyRevenue / pitia;
    const dscr20 = (monthlyRevenue * 0.8) / pitia;
    const dscr30 = (monthlyRevenue * 0.7) / pitia;

    // LTR fallback DSCR
    const dscrLTR = ltrRent / pitia;

    // Cash flow estimates (after debt service)
    const annualCashFlow = noi - pi * 12;
    const monthlyCashFlow = annualCashFlow / 12;

    return {
      blendedAdr,
      workingAdr,
      annualRevenue,
      monthlyRevenue,
      nightsOccupiedAnnual,
      stays,
      lodgingTax,
      pmFee,
      supplies,
      insurance,
      hoa,
      propTax,
      cleaningCostAnnual,
      opex,
      noi,
      monthlyNet,
      pi,
      pitia,
      dscrNoHaircut,
      dscr20,
      dscr30,
      dscrLTR,
      annualCashFlow,
      monthlyCashFlow,
    };
  }, [
    adr,
    occupancy,
    highSeasonAdr,
    lowSeasonAdr,
    highSeasonPct,
    lodgingTaxPct,
    cleaningPassThrough,
    cleaningPerStay,
    avgStayNights,
    pmPct,
    suppliesMonthly,
    insuranceMonthly,
    hoaMonthly,
    piMonthly,
    propTaxMonthly,
    ltrRent,
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEs ? "Analizador de ingresos STR + DSCR" : "STR Income + DSCR Analyzer"}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {isEs
            ? "Modela los ingresos del alquiler de corto plazo (STR) con descuentos del prestamista, luego revisa tu DSCR en escenarios STR y LTR — la mayoría de los prestamistas DSCR para STR requieren ambos."
            : "Model short-term rental revenue with lender haircuts, then see your DSCR under STR and LTR scenarios — most STR DSCR lenders require both."}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* INPUTS */}
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold">{isEs ? "Supuestos de ingresos" : "Revenue assumptions"}</p>
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="adr">{isEs ? "Tarifa por noche promedio (ADR)" : "Avg daily rate (ADR)"}</Label>
                  <Input
                    id="adr"
                    type="number"
                    value={adr}
                    onChange={(e) => setAdr(+e.target.value || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="occupancy">{isEs ? "Ocupación (%)" : "Occupancy (%)"}</Label>
                  <Input
                    id="occupancy"
                    type="number"
                    value={occupancy}
                    onChange={(e) => setOccupancy(+e.target.value || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="highSeasonAdr">{isEs ? "ADR temporada alta" : "High-season ADR"}</Label>
                  <Input
                    id="highSeasonAdr"
                    type="number"
                    value={highSeasonAdr}
                    onChange={(e) => setHighSeasonAdr(+e.target.value || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="lowSeasonAdr">{isEs ? "ADR temporada baja" : "Low-season ADR"}</Label>
                  <Input
                    id="lowSeasonAdr"
                    type="number"
                    value={lowSeasonAdr}
                    onChange={(e) => setLowSeasonAdr(+e.target.value || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="highSeasonPct">{isEs ? "Proporción temporada alta (%)" : "High-season share (%)"}</Label>
                  <Input
                    id="highSeasonPct"
                    type="number"
                    value={highSeasonPct}
                    onChange={(e) => setHighSeasonPct(+e.target.value || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="avgStayNights">{isEs ? "Estancia promedio (noches)" : "Avg stay (nights)"}</Label>
                  <Input
                    id="avgStayNights"
                    type="number"
                    step="0.1"
                    value={avgStayNights}
                    onChange={(e) => setAvgStayNights(+e.target.value || 0)}
                  />
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {isEs ? "ADR estimado mezclado por estacionalidad: " : "Seasonal-blended ADR estimate: "}{fmtUSD(results.blendedAdr)}{isEs ? " — actualiza el ADR plano si quieres usar este." : " — update the flat ADR if you want to use this."}
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">{isEs ? "Costos operativos" : "Operating costs"}</p>
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="lodgingTaxPct">{isEs ? "Impuesto de hospedaje/ventas (%)" : "Lodging / sales tax (%)"}</Label>
                  <Input
                    id="lodgingTaxPct"
                    type="number"
                    value={lodgingTaxPct}
                    onChange={(e) => setLodgingTaxPct(+e.target.value || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="pmPct">{isEs ? "Administrador de la propiedad (%)" : "Property manager (%)"}</Label>
                  <Input
                    id="pmPct"
                    type="number"
                    value={pmPct}
                    onChange={(e) => setPmPct(+e.target.value || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="cleaningPerStay">{isEs ? "Cargo de limpieza por estancia" : "Cleaning fee per stay"}</Label>
                  <Input
                    id="cleaningPerStay"
                    type="number"
                    value={cleaningPerStay}
                    onChange={(e) => setCleaningPerStay(+e.target.value || 0)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="passThrough"
                    type="checkbox"
                    checked={cleaningPassThrough}
                    onChange={(e) => setCleaningPassThrough(e.target.checked)}
                    className="size-4 rounded border"
                  />
                  <Label htmlFor="passThrough">{isEs ? "Limpieza cobrada al huésped" : "Cleaning passed to guest"}</Label>
                </div>
                <div>
                  <Label htmlFor="suppliesMonthly">{isEs ? "Suministros/consumibles (mes)" : "Supplies / consumables (mo)"}</Label>
                  <Input
                    id="suppliesMonthly"
                    type="number"
                    value={suppliesMonthly}
                    onChange={(e) => setSuppliesMonthly(+e.target.value || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="insuranceMonthly">{isEs ? "Seguro (mes)" : "Insurance (mo)"}</Label>
                  <Input
                    id="insuranceMonthly"
                    type="number"
                    value={insuranceMonthly}
                    onChange={(e) => setInsuranceMonthly(+e.target.value || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="hoaMonthly">{isEs ? "HOA (mes)" : "HOA (mo)"}</Label>
                  <Input
                    id="hoaMonthly"
                    type="number"
                    value={hoaMonthly}
                    onChange={(e) => setHoaMonthly(+e.target.value || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="propTaxMonthly">{isEs ? "Impuesto predial (mes)" : "Property tax (mo)"}</Label>
                  <Input
                    id="propTaxMonthly"
                    type="number"
                    value={propTaxMonthly}
                    onChange={(e) => setPropTaxMonthly(+e.target.value || 0)}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">{isEs ? "Préstamo" : "Loan"}</p>
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="piMonthly">{isEs ? "P&I mensual" : "Monthly P&I"}</Label>
                  <Input
                    id="piMonthly"
                    type="number"
                    value={piMonthly}
                    onChange={(e) => setPiMonthly(+e.target.value || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="ltrRent">{isEs ? "Renta LTR de respaldo (mes)" : "LTR fallback rent (mo)"}</Label>
                  <Input
                    id="ltrRent"
                    type="number"
                    value={ltrRent}
                    onChange={(e) => setLtrRent(+e.target.value || 0)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RESULTS - dual column */}
          <div className="space-y-4">
            <div className="rounded-lg border bg-accent/5 p-4">
              <p className="text-xs uppercase text-muted-foreground">{isEs ? "Cifras destacadas" : "Headline numbers"}</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">{isEs ? "Ingresos brutos anuales" : "Annual gross revenue"}</p>
                  <p className="text-xl font-bold">{fmtUSD(results.annualRevenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isEs ? "Bruto mensual" : "Monthly gross"}</p>
                  <p className="text-xl font-bold">{fmtUSD(results.monthlyRevenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isEs ? "NOI (anual)" : "NOI (annual)"}</p>
                  <p className="text-xl font-bold">{fmtUSD(results.noi)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isEs ? "Flujo de efectivo mensual" : "Monthly cash flow"}</p>
                  <p
                    className={cn(
                      "text-xl font-bold",
                      results.monthlyCashFlow >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {fmtUSD(results.monthlyCashFlow)}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">PITIA</p>
                  <p className="text-lg font-semibold">{fmtUSD(results.pitia)}{isEs ? "/mes" : "/mo"}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* STR column */}
              <div className="rounded-lg border p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Plane className="size-4 text-accent" />
                  <p className="text-sm font-semibold">{isEs ? "DSCR de STR" : "STR DSCR"}</p>
                </div>
                <DscrRow label={isEs ? "0% de descuento" : "0% haircut"} dscr={results.dscrNoHaircut} />
                <DscrRow label={isEs ? "20% de descuento (estándar)" : "20% haircut (standard)"} dscr={results.dscr20} highlight />
                <DscrRow label={isEs ? "30% de descuento (conservador)" : "30% haircut (conservative)"} dscr={results.dscr30} />
              </div>

              {/* LTR column */}
              <div className="rounded-lg border p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Home className="size-4 text-primary" />
                  <p className="text-sm font-semibold">{isEs ? "DSCR LTR de respaldo" : "LTR fallback DSCR"}</p>
                </div>
                <DscrRow label={isEs ? "LTR a la renta declarada" : "LTR at stated rent"} dscr={results.dscrLTR} highlight />
                <p className="mt-2 text-xs text-muted-foreground">
                  {isEs
                    ? "La mayoría de los prestamistas DSCR para STR requieren un cronograma LTR de 12 meses que muestre que la propiedad califica con rentas LTR si el historial de STR es escaso o existe riesgo regulatorio."
                    : "Most STR DSCR lenders require a 12-month LTR schedule showing the property qualifies at LTR rents if STR history is thin or regulatory risk exists."}
                </p>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-xs uppercase text-muted-foreground">
                {isEs ? "Calificación vs mínimos comunes (con 20% de descuento aplicado)" : "Qualification vs common minimums (20% haircut applied)"}
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <QualBadge ok={results.dscr20 >= 1.2} label={isEs ? "Nivel premium 1.20" : "1.20 premium tier"} />
                <QualBadge ok={results.dscr20 >= 1.0} label={isEs ? "Nivel estándar 1.00" : "1.00 standard tier"} />
                <QualBadge ok={results.dscr20 >= 0.75} label={isEs ? "Nivel ampliado 0.75" : "0.75 expanded tier"} />
              </div>
            </div>
          </div>
        </div>

        {/* Expense breakdown */}
        <div className="mt-6 rounded-lg border p-4">
          <p className="mb-3 text-sm font-semibold">{isEs ? "Desglose anual de gastos" : "Annual expense breakdown"}</p>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <div className="flex justify-between">
              <span>{isEs ? "Impuesto de hospedaje" : "Lodging tax"}</span>
              <span>{fmtUSD(results.lodgingTax)}</span>
            </div>
            <div className="flex justify-between">
              <span>{isEs ? "Cargo del administrador" : "PM fee"}</span>
              <span>{fmtUSD(results.pmFee)}</span>
            </div>
            <div className="flex justify-between">
              <span>{isEs ? "Suministros" : "Supplies"}</span>
              <span>{fmtUSD(results.supplies)}</span>
            </div>
            <div className="flex justify-between">
              <span>{isEs ? "Seguro" : "Insurance"}</span>
              <span>{fmtUSD(results.insurance)}</span>
            </div>
            <div className="flex justify-between">
              <span>HOA</span>
              <span>{fmtUSD(results.hoa)}</span>
            </div>
            <div className="flex justify-between">
              <span>{isEs ? "Impuesto predial" : "Property tax"}</span>
              <span>{fmtUSD(results.propTax)}</span>
            </div>
            <div className="flex justify-between">
              <span>{isEs ? "Limpieza (propietario)" : "Cleaning (owner)"}</span>
              <span>{fmtUSD(results.cleaningCostAnnual)}</span>
            </div>
            <div className="flex justify-between font-semibold sm:col-span-3 sm:border-t sm:pt-2">
              <span>{isEs ? "Total gastos operativos + impuesto" : "Total opex + tax"}</span>
              <span>{fmtUSD(results.opex + results.propTax)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {isEs ? "Solo estimaciones. La calificación de ingresos STR varía según el prestamista y la ubicación de la propiedad." : "Estimates only. STR income qualification varies by lender and property location."}
          </p>
          <Button variant="cta" asChild>
            <a href={isEs ? "/es/get-matched?source=str-dscr-analyzer" : "/get-matched?source=str-dscr-analyzer"}>{isEs ? "Cotizar DSCR para STR" : "Get STR DSCR quotes"}</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DscrRow({ label, dscr, highlight }: { label: string; dscr: number; highlight?: boolean }) {
  const color =
    dscr >= 1.2 ? "text-success" : dscr >= 1 ? "" : "text-destructive";
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b py-1.5 text-sm last:border-b-0",
        highlight && "font-semibold",
      )}
    >
      <span>{label}</span>
      <span className={cn("font-mono", color)}>{fmtDSCR(dscr)}</span>
    </div>
  );
}

function QualBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border p-2 text-xs",
        ok ? "border-success/40 bg-success/10 text-success" : "border-destructive/30 bg-destructive/5 text-destructive",
      )}
    >
      {ok ? <Check className="size-4" /> : <X className="size-4" />}
      <span>{label}</span>
    </div>
  );
}

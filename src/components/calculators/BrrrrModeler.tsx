"use client";

import { Check, ChevronRight, DollarSign, Home, TrendingUp, Wrench, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtDSCR, fmtPct, fmtUSD, monthlyPI } from "@/lib/finance";

interface BrrrrModelerProps {
  lang?: "en" | "es";
}

export default function BrrrrModeler({ lang = "en" }: BrrrrModelerProps = {}) {
  const isEs = lang === "es";

  const STEPS = [
    { key: "buy", label: isEs ? "Compra" : "Buy", icon: Home },
    { key: "rehab", label: isEs ? "Remodela" : "Rehab", icon: Wrench },
    { key: "rent", label: isEs ? "Renta" : "Rent", icon: DollarSign },
    { key: "refi", label: isEs ? "Refinancia" : "Refi", icon: TrendingUp },
  ] as const;

  const [step, setStep] = useState<(typeof STEPS)[number]["key"]>("buy");

  // BUY
  const [purchase, setPurchase] = useState(180000);
  const [hmRate, setHmRate] = useState(11);
  const [hmOrig, setHmOrig] = useState(2);
  const [hmTerm, setHmTerm] = useState(12);
  const [downPct, setDownPct] = useState(15);
  const [buyClosing, setBuyClosing] = useState(4000);

  // REHAB
  const [rehabBudget, setRehabBudget] = useState(50000);
  const [rehabMonths, setRehabMonths] = useState(4);
  const [holdingMonthly, setHoldingMonthly] = useState(2200); // HM int + tax + ins

  // RENT
  const [arv, setArv] = useState(300000);
  const [monthlyRent, setMonthlyRent] = useState(2400);
  const [vacancy, setVacancy] = useState(5);
  const [mgmt, setMgmt] = useState(8);
  const [opex, setOpex] = useState(8);
  const [taxIns, setTaxIns] = useState(4800); // annual

  // REFI
  const [seasoning, setSeasoning] = useState(6);
  const [refiLtv, setRefiLtv] = useState(75);
  const [refiRate, setRefiRate] = useState(7.25);
  const [refiClosingPct, setRefiClosingPct] = useState(2.5);

  const results = useMemo(() => {
    const downAmount = (purchase * downPct) / 100;
    const hmLoan = purchase - downAmount;
    const hmOrigFee = (hmLoan * hmOrig) / 100;
    const totalCashAtPurchase = downAmount + hmOrigFee + buyClosing;
    const rehabHolding = holdingMonthly * rehabMonths;
    const totalCashIn = totalCashAtPurchase + rehabBudget + rehabHolding;

    const hmPayoff = hmLoan; // interest-only assumption common for HM
    const refiLoanAmount = (arv * refiLtv) / 100;
    const refiClosingCosts = (refiLoanAmount * refiClosingPct) / 100;
    const refiProceeds = refiLoanAmount - hmPayoff - refiClosingCosts;
    const cashLeftIn = totalCashIn - refiProceeds;
    const capitalRecycled = Math.min(refiProceeds, totalCashIn);

    const newPI = monthlyPI(refiLoanAmount, refiRate, 30 * 12);
    const monthlyTaxIns = taxIns / 12;
    const pitia = newPI + monthlyTaxIns;
    const grossRent = monthlyRent;
    const effRent = grossRent * (1 - vacancy / 100);
    const mgmtCost = effRent * (mgmt / 100);
    const opexCost = effRent * (opex / 100);
    const noi = effRent * 12 - (mgmtCost + opexCost) * 12 - taxIns;
    const cashFlow = effRent - mgmtCost - opexCost - pitia;
    const dscrGross = grossRent / pitia;
    const dscrNet = effRent / pitia;

    const qualifies12 = dscrGross >= 1.2;
    const qualifies10 = dscrGross >= 1.0;
    const qualifies075 = dscrGross >= 0.75;

    // ROI metrics
    const annualCF = cashFlow * 12;
    const cashOnCash = cashLeftIn > 0 ? (annualCF / cashLeftIn) * 100 : Infinity;
    const equity = arv - refiLoanAmount;
    const totalReturnYr1 = annualCF + equity - (cashLeftIn > 0 ? cashLeftIn : 0);

    // Timeline
    const totalTimelineMonths = Math.max(seasoning, rehabMonths);
    return {
      downAmount,
      hmLoan,
      hmOrigFee,
      buyClosing,
      totalCashAtPurchase,
      rehabHolding,
      totalCashIn,
      hmPayoff,
      refiLoanAmount,
      refiClosingCosts,
      refiProceeds,
      cashLeftIn,
      capitalRecycled,
      newPI,
      monthlyTaxIns,
      pitia,
      effRent,
      mgmtCost,
      opexCost,
      cashFlow,
      annualCF,
      dscrGross,
      dscrNet,
      noi,
      qualifies12,
      qualifies10,
      qualifies075,
      cashOnCash,
      equity,
      totalReturnYr1,
      totalTimelineMonths,
    };
  }, [
    purchase,
    hmRate,
    hmOrig,
    hmTerm,
    downPct,
    buyClosing,
    rehabBudget,
    rehabMonths,
    holdingMonthly,
    arv,
    monthlyRent,
    vacancy,
    mgmt,
    opex,
    taxIns,
    seasoning,
    refiLtv,
    refiRate,
    refiClosingPct,
  ]);

  // Multi-property projection
  const cadenceMonths = Math.max(1, results.totalTimelineMonths);
  const propertiesInTwoYears = Math.floor(24 / cadenceMonths) + 1;
  const propertiesInFiveYears = Math.floor(60 / cadenceMonths) + 1;

  const currentIdx = STEPS.findIndex((s) => s.key === step);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEs ? "Modelador de Estrategia BRRRR" : "BRRRR Strategy Modeler"}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {isEs
            ? "Modela cada fase de una operación Comprar–Remodelar–Rentar–Refinanciar–Repetir y descubre si tu capital se recicla, califica para DSCR y escala."
            : "Model every phase of a Buy–Rehab–Rent–Refinance–Repeat deal and see whether your capital recycles, qualifies for DSCR, and scales."}
        </p>
      </CardHeader>
      <CardContent>
        {/* Stepper */}
        <div className="mb-6 flex items-center justify-between overflow-x-auto rounded-lg border bg-muted/30 p-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = step === s.key;
            const done = currentIdx > i;
            return (
              <button
                key={s.key}
                onClick={() => setStep(s.key)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active && "bg-accent text-accent-foreground",
                  !active && done && "text-success",
                  !active && !done && "text-muted-foreground hover:bg-secondary",
                )}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">
                  {i + 1}. {s.label}
                </span>
                <span className="sm:hidden">{s.label}</span>
                {i < STEPS.length - 1 && <ChevronRight className="size-3 opacity-40" />}
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            {step === "buy" && (
              <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="purchase">{isEs ? "Precio de compra" : "Purchase price"}</Label>
                  <Input id="purchase" type="number" value={purchase} onChange={(e) => setPurchase(+e.target.value || 0)} />
                </div>
                <div>
                  <Label htmlFor="downPct">{isEs ? "Enganche (%)" : "Down payment (%)"}</Label>
                  <Input id="downPct" type="number" value={downPct} onChange={(e) => setDownPct(+e.target.value || 0)} />
                </div>
                <div>
                  <Label htmlFor="hmRate">{isEs ? "Tasa de hard money (% APR)" : "Hard money rate (% APR)"}</Label>
                  <Input id="hmRate" type="number" step="0.1" value={hmRate} onChange={(e) => setHmRate(+e.target.value || 0)} />
                </div>
                <div>
                  <Label htmlFor="hmOrig">{isEs ? "Originación de hard money (%)" : "Hard money origination (%)"}</Label>
                  <Input id="hmOrig" type="number" step="0.1" value={hmOrig} onChange={(e) => setHmOrig(+e.target.value || 0)} />
                </div>
                <div>
                  <Label htmlFor="hmTerm">{isEs ? "Plazo HM (meses)" : "HM term (months)"}</Label>
                  <Input id="hmTerm" type="number" value={hmTerm} onChange={(e) => setHmTerm(+e.target.value || 0)} />
                </div>
                <div>
                  <Label htmlFor="buyClosing">{isEs ? "Costos de cierre de compra" : "Purchase closing costs"}</Label>
                  <Input id="buyClosing" type="number" value={buyClosing} onChange={(e) => setBuyClosing(+e.target.value || 0)} />
                </div>
              </div>
            )}

            {step === "rehab" && (
              <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="rehabBudget">{isEs ? "Presupuesto de remodelación" : "Rehab budget"}</Label>
                  <Input id="rehabBudget" type="number" value={rehabBudget} onChange={(e) => setRehabBudget(+e.target.value || 0)} />
                </div>
                <div>
                  <Label htmlFor="rehabMonths">{isEs ? "Plazo de remodelación (meses)" : "Rehab timeline (months)"}</Label>
                  <Input id="rehabMonths" type="number" value={rehabMonths} onChange={(e) => setRehabMonths(+e.target.value || 0)} />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="holdingMonthly">{isEs ? "Costo mensual de retención (interés HM + impuesto + seguro)" : "Monthly holding cost (HM interest + tax + ins)"}</Label>
                  <Input
                    id="holdingMonthly"
                    type="number"
                    value={holdingMonthly}
                    onChange={(e) => setHoldingMonthly(+e.target.value || 0)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isEs ? "Sugerido: " : "Suggested: "}{fmtUSD((results.hmLoan * hmRate) / 100 / 12 + taxIns / 12 + 150)}{isEs ? "/mes" : "/mo"}
                  </p>
                </div>
              </div>
            )}

            {step === "rent" && (
              <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="arv">{isEs ? "Valor Después de Reparaciones (ARV)" : "After-repair value (ARV)"}</Label>
                  <Input id="arv" type="number" value={arv} onChange={(e) => setArv(+e.target.value || 0)} />
                </div>
                <div>
                  <Label htmlFor="monthlyRent">{isEs ? "Renta mensual" : "Monthly rent"}</Label>
                  <Input id="monthlyRent" type="number" value={monthlyRent} onChange={(e) => setMonthlyRent(+e.target.value || 0)} />
                </div>
                <div>
                  <Label htmlFor="vacancy">{isEs ? "Vacancia (%)" : "Vacancy (%)"}</Label>
                  <Input id="vacancy" type="number" value={vacancy} onChange={(e) => setVacancy(+e.target.value || 0)} />
                </div>
                <div>
                  <Label htmlFor="mgmt">{isEs ? "Administración (%)" : "Management (%)"}</Label>
                  <Input id="mgmt" type="number" value={mgmt} onChange={(e) => setMgmt(+e.target.value || 0)} />
                </div>
                <div>
                  <Label htmlFor="opex">{isEs ? "Gastos operativos (%)" : "Operating expenses (%)"}</Label>
                  <Input id="opex" type="number" value={opex} onChange={(e) => setOpex(+e.target.value || 0)} />
                </div>
                <div>
                  <Label htmlFor="taxIns">{isEs ? "Impuesto predial + seguro (anual)" : "Property tax + insurance (annual)"}</Label>
                  <Input id="taxIns" type="number" value={taxIns} onChange={(e) => setTaxIns(+e.target.value || 0)} />
                </div>
              </div>
            )}

            {step === "refi" && (
              <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="seasoning">{isEs ? "Maduración DSCR (meses)" : "DSCR seasoning (months)"}</Label>
                  <Input id="seasoning" type="number" value={seasoning} onChange={(e) => setSeasoning(+e.target.value || 0)} />
                </div>
                <div>
                  <Label htmlFor="refiLtv">{isEs ? "LTV objetivo del refi (%)" : "Refi LTV target (%)"}</Label>
                  <Input id="refiLtv" type="number" value={refiLtv} onChange={(e) => setRefiLtv(+e.target.value || 0)} />
                </div>
                <div>
                  <Label htmlFor="refiRate">{isEs ? "Tasa del refi DSCR (%)" : "DSCR refi rate (%)"}</Label>
                  <Input
                    id="refiRate"
                    type="number"
                    step="0.01"
                    value={refiRate}
                    onChange={(e) => setRefiRate(+e.target.value || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="refiClosingPct">{isEs ? "Costos de cierre del refi (% del préstamo)" : "Refi closing costs (% of loan)"}</Label>
                  <Input
                    id="refiClosingPct"
                    type="number"
                    step="0.1"
                    value={refiClosingPct}
                    onChange={(e) => setRefiClosingPct(+e.target.value || 0)}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button
                variant="outline"
                disabled={currentIdx === 0}
                onClick={() => setStep(STEPS[Math.max(0, currentIdx - 1)].key)}
              >
                {isEs ? "Atrás" : "Back"}
              </Button>
              <Button
                variant={currentIdx === STEPS.length - 1 ? "success" : "default"}
                onClick={() =>
                  setStep(STEPS[Math.min(STEPS.length - 1, currentIdx + 1)].key)
                }
              >
                {currentIdx === STEPS.length - 1
                  ? (isEs ? "Ver resultados" : "View results")
                  : (isEs ? "Siguiente" : "Next")}
              </Button>
            </div>
          </div>

          {/* Results sidebar */}
          <div className="space-y-3 lg:col-span-2">
            <Card className="bg-secondary/30">
              <CardContent className="pt-5">
                <p className="text-xs uppercase text-muted-foreground">{isEs ? "Capital total invertido" : "Total cash in"}</p>
                <p className="text-2xl font-bold">{fmtUSD(results.totalCashIn)}</p>
                <p className="text-xs text-muted-foreground">
                  {isEs ? "Enganche + originación + cierre + remodelación + retención" : "Down + orig + closing + rehab + holding"}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-secondary/30">
              <CardContent className="pt-5">
                <p className="text-xs uppercase text-muted-foreground">{isEs ? "Producto del refi (neto)" : "Refi proceeds (net)"}</p>
                <p className="text-2xl font-bold">{fmtUSD(results.refiProceeds)}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtPct(refiLtv)} × ARV − {isEs ? "pago de HM − cierre" : "HM payoff − closing"}
                </p>
              </CardContent>
            </Card>
            <Card
              className={cn(
                results.cashLeftIn <= 0
                  ? "border-success bg-success/10"
                  : "border-accent/50 bg-accent/5",
              )}
            >
              <CardContent className="pt-5">
                <p className="text-xs uppercase text-muted-foreground">
                  {results.cashLeftIn <= 0
                    ? (isEs ? "Capital totalmente reciclado" : "Capital fully recycled")
                    : (isEs ? "Capital atrapado" : "Cash left in")}
                </p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    results.cashLeftIn <= 0 ? "text-success" : "text-accent",
                  )}
                >
                  {fmtUSD(Math.abs(results.cashLeftIn))}
                </p>
                <p className="text-xs text-muted-foreground">
                  {results.cashLeftIn <= 0
                    ? (isEs ? "El refi devuelve todo el capital invertido." : "Refi returns all invested capital.")
                    : (isEs ? "Capital adicional más allá del producto del refi." : "Additional equity beyond refi proceeds.")}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Dashboard */}
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs uppercase text-muted-foreground">{isEs ? "DSCR al refi" : "DSCR at refi"}</p>
              <p className="text-2xl font-bold">{fmtDSCR(results.dscrGross)}</p>
              <p className="text-xs text-muted-foreground">{isEs ? "Renta bruta / PITIA" : "Gross rent / PITIA"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs uppercase text-muted-foreground">{isEs ? "Flujo de caja mensual" : "Monthly cash flow"}</p>
              <p
                className={cn(
                  "text-2xl font-bold",
                  results.cashFlow >= 0 ? "text-success" : "text-destructive",
                )}
              >
                {fmtUSD(results.cashFlow)}
              </p>
              <p className="text-xs text-muted-foreground">
                {isEs ? "Neto de vacancia, admin, opex, PITIA" : "Net of vacancy, mgmt, opex, PITIA"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs uppercase text-muted-foreground">{isEs ? "Cash-on-cash año 1" : "Cash-on-cash yr 1"}</p>
              <p className="text-2xl font-bold">
                {results.cashLeftIn > 0 ? fmtPct(results.cashOnCash) : (isEs ? "Infinito" : "Infinite")}
              </p>
              <p className="text-xs text-muted-foreground">{isEs ? "CF anual / capital atrapado" : "Annual CF / cash left in"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs uppercase text-muted-foreground">{isEs ? "Capital capturado" : "Equity captured"}</p>
              <p className="text-2xl font-bold">{fmtUSD(results.equity)}</p>
              <p className="text-xs text-muted-foreground">{isEs ? "ARV − nuevo préstamo" : "ARV − new loan"}</p>
            </CardContent>
          </Card>
        </div>

        {/* DSCR qualification */}
        <div className="mt-6 rounded-lg border p-5">
          <h3 className="mb-3 font-semibold">{isEs ? "Calificación con prestamistas DSCR" : "DSCR lender qualification"}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <QualRow label={isEs ? "Nivel premium (DSCR 1.20+)" : "Premium tier (DSCR 1.20+)"} ok={results.qualifies12} />
            <QualRow label={isEs ? "Nivel estándar (DSCR 1.00+)" : "Standard tier (DSCR 1.00+)"} ok={results.qualifies10} />
            <QualRow label={isEs ? "Nivel ampliado (DSCR 0.75+)" : "Expanded tier (DSCR 0.75+)"} ok={results.qualifies075} />
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-6 rounded-lg border p-5">
          <h3 className="mb-3 font-semibold">{isEs ? "Línea de tiempo de la operación" : "Deal timeline"}</h3>
          <Timeline
            isEs={isEs}
            rehabMonths={rehabMonths}
            seasoning={seasoning}
            totalCashAtPurchase={results.totalCashAtPurchase}
            rehabBudget={rehabBudget}
            rehabHolding={results.rehabHolding}
            refiProceeds={results.refiProceeds}
          />
        </div>

        {/* Scaling */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card className="border-accent/40">
            <CardContent className="pt-5">
              <p className="text-xs uppercase text-muted-foreground">{isEs ? "Portafolio proyectado" : "Projected portfolio"}</p>
              <p className="mt-1 text-lg">
                {isEs ? (
                  <>Si repites esta cadencia cada{" "}<strong>{cadenceMonths} meses</strong>:</>
                ) : (
                  <>If you repeat this cadence every{" "}<strong>{cadenceMonths} months</strong>:</>
                )}
              </p>
              <ul className="mt-3 space-y-1 text-sm">
                <li>
                  {isEs ? "Después de 2 años: " : "After 2 years: "}<strong>{propertiesInTwoYears} {isEs ? "propiedades" : "properties"}</strong>
                </li>
                <li>
                  {isEs ? "Después de 5 años: " : "After 5 years: "}<strong>{propertiesInFiveYears} {isEs ? "propiedades" : "properties"}</strong>
                </li>
                <li>
                  {isEs ? "Flujo de caja anual a 5 años: " : "Annual cash flow at 5 years: "}
                  <strong>{fmtUSD(results.annualCF * propertiesInFiveYears)}</strong>
                </li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs uppercase text-muted-foreground">{isEs ? "Velocidad del capital" : "Capital velocity"}</p>
              <p className="mt-1 text-sm">
                {results.cashLeftIn <= 0
                  ? (isEs
                      ? "Cada operación devuelve el 100% del capital invertido. Esto es un BRRRR de retorno infinito."
                      : "Each deal returns 100% of invested capital. This is an infinite-return BRRRR.")
                  : (isEs
                      ? `Cada operación deja ${fmtUSD(results.cashLeftIn)} en la propiedad. Necesitarás capital nuevo para cada repetición.`
                      : `Each deal leaves ${fmtUSD(results.cashLeftIn)} in the property. You'll need fresh capital for each repeat.`)}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {isEs ? "Capital reciclado por operación: " : "Capital recycled per deal: "}{fmtUSD(results.capitalRecycled)}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {isEs
              ? "Solo estimaciones. La suscripción DSCR real varía según el prestamista."
              : "Estimates only. Actual DSCR underwriting varies by lender."}
          </p>
          <Button variant="cta" asChild>
            <a href={isEs ? "/es/get-matched?source=brrrr-modeler" : "/get-matched?source=brrrr-modeler"}>
              {isEs ? "Cotizar refinanciamiento DSCR para esta operación" : "Get DSCR refi quotes for this deal"}
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function QualRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border p-3 text-sm",
        ok ? "border-success/40 bg-success/10" : "border-destructive/30 bg-destructive/5",
      )}
    >
      {ok ? (
        <Check className="size-5 shrink-0 text-success" />
      ) : (
        <X className="size-5 shrink-0 text-destructive" />
      )}
      <span className={cn("font-medium", ok ? "text-success" : "text-destructive")}>{label}</span>
    </div>
  );
}

function Timeline({
  isEs,
  rehabMonths,
  seasoning,
  totalCashAtPurchase,
  rehabBudget,
  rehabHolding,
  refiProceeds,
}: {
  isEs: boolean;
  rehabMonths: number;
  seasoning: number;
  totalCashAtPurchase: number;
  rehabBudget: number;
  rehabHolding: number;
  refiProceeds: number;
}) {
  const total = Math.max(rehabMonths + seasoning, seasoning, 6);
  const points = [
    { m: 0, label: isEs ? "Cierre" : "Close", amount: -totalCashAtPurchase, color: "bg-destructive" },
    { m: 1, label: isEs ? "Inicio de remodelación" : "Rehab start", amount: -rehabBudget, color: "bg-destructive" },
    {
      m: rehabMonths,
      label: isEs ? "Remodelación lista" : "Rehab done",
      amount: -rehabHolding,
      color: "bg-destructive",
    },
    { m: seasoning, label: isEs ? "Refi elegible" : "Refi eligible", amount: 0, color: "bg-accent" },
    { m: seasoning + 1, label: isEs ? "Refi cierra" : "Refi closes", amount: refiProceeds, color: "bg-success" },
  ];
  return (
    <div className="relative">
      <div className="relative h-1 rounded-full bg-border">
        <div
          className="absolute h-1 rounded-full bg-accent/50"
          style={{ left: 0, width: `${Math.min(100, (rehabMonths / total) * 100)}%` }}
        />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-5">
        {points.map((p, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className={cn("mt-1 size-2 shrink-0 rounded-full", p.color)} />
            <div>
              <p className="text-xs text-muted-foreground">{isEs ? "Mes" : "Month"} {p.m}</p>
              <p className="text-sm font-medium">{p.label}</p>
              <p
                className={cn(
                  "text-xs font-semibold",
                  p.amount > 0 ? "text-success" : p.amount < 0 ? "text-destructive" : "",
                )}
              >
                {p.amount !== 0 ? fmtUSD(p.amount) : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

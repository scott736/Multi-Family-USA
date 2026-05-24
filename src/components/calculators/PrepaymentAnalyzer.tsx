"use client";

import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtUSD, monthlyPI, remainingBalance } from "@/lib/finance";

const monthlyPayment = (p: number, r: number, y: number) => monthlyPI(p, r, y * 12);
const balanceAfterMonths = (p: number, r: number, y: number, m: number) =>
  remainingBalance(p, r, y * 12, m);

type StructureKey =
  | "54321"
  | "321"
  | "hard3"
  | "hard5"
  | "custom";

interface PrepaymentAnalyzerProps {
  lang?: "en" | "es";
}

const STRUCTURES_EN: Record<StructureKey, { label: string; schedule: number[] }> = {
  "54321": { label: "5/4/3/2/1 step-down", schedule: [5, 4, 3, 2, 1, 0] },
  "321": { label: "3/2/1 step-down", schedule: [3, 2, 1, 0, 0, 0] },
  hard3: { label: "Hard 3-year (3% flat)", schedule: [3, 3, 3, 0, 0, 0] },
  hard5: { label: "Hard 5-year (5% flat)", schedule: [5, 5, 5, 5, 5, 0] },
  custom: { label: "Custom (enter rates)", schedule: [3, 3, 2, 1, 0, 0] },
};

const STRUCTURES_ES: Record<StructureKey, { label: string; schedule: number[] }> = {
  "54321": { label: "Escalonada 5/4/3/2/1", schedule: [5, 4, 3, 2, 1, 0] },
  "321": { label: "Escalonada 3/2/1", schedule: [3, 2, 1, 0, 0, 0] },
  hard3: { label: "Rígida 3 años (3% fija)", schedule: [3, 3, 3, 0, 0, 0] },
  hard5: { label: "Rígida 5 años (5% fija)", schedule: [5, 5, 5, 5, 5, 0] },
  custom: { label: "Personalizada (ingresar tasas)", schedule: [3, 3, 2, 1, 0, 0] },
};

function totalInterestPaid(principal: number, annualRate: number, termYears: number, m: number) {
  const pmt = monthlyPayment(principal, annualRate, termYears);
  const bal = balanceAfterMonths(principal, annualRate, termYears, m);
  return pmt * m - (principal - bal);
}

export default function PrepaymentAnalyzer({ lang = "en" }: PrepaymentAnalyzerProps = {}) {
  const isEs = lang === "es";
  const STRUCTURES = isEs ? STRUCTURES_ES : STRUCTURES_EN;

  const [loan, setLoan] = useState(400000);
  const [rate, setRate] = useState(7.25);
  const [term, setTerm] = useState(30);
  const [structure, setStructure] = useState<StructureKey>("54321");
  const [custom, setCustom] = useState<number[]>([3, 3, 2, 1, 0, 0]);
  const [exitYear, setExitYear] = useState(4);
  const [tab, setTab] = useState<"ppp" | "compare">("ppp");
  const [altRate, setAltRate] = useState(7.75);

  const schedule = structure === "custom" ? custom : STRUCTURES[structure].schedule;

  const tableRows = useMemo(() => {
    const rows = [];
    for (let y = 1; y <= 10; y++) {
      const months = y * 12;
      const bal = balanceAfterMonths(loan, rate, term, months);
      const pppRate = schedule[y - 1] ?? 0;
      const pppCost = (bal * pppRate) / 100;
      rows.push({ year: y, balance: bal, pppRate, pppCost });
    }
    return rows;
  }, [loan, rate, term, schedule]);

  const scenario = useMemo(() => {
    const months = exitYear * 12;
    const balA = balanceAfterMonths(loan, rate, term, months);
    const intA = totalInterestPaid(loan, rate, term, months);
    const pppRateA = schedule[exitYear - 1] ?? 0;
    const pppA = (balA * pppRateA) / 100;
    const totalA = intA + pppA; // cost of capital over holding period

    const balB = balanceAfterMonths(loan, altRate, term, months);
    const intB = totalInterestPaid(loan, altRate, term, months);
    const totalB = intB;

    const delta = totalB - totalA;
    return { balA, intA, pppA, totalA, balB, intB, totalB, delta };
  }, [loan, rate, altRate, term, schedule, exitYear]);

  const breakEven = useMemo(() => {
    // At what exit month does scenario A (PPP + lower rate) beat scenario B (no PPP + higher rate)?
    for (let m = 1; m <= term * 12; m++) {
      const balA = balanceAfterMonths(loan, rate, term, m);
      const intA = totalInterestPaid(loan, rate, term, m);
      const yIdx = Math.min(Math.ceil(m / 12), schedule.length) - 1;
      const pppRateA = schedule[yIdx] ?? 0;
      const pppA = (balA * pppRateA) / 100;
      const totalA = intA + pppA;

      const intB = totalInterestPaid(loan, altRate, term, m);
      const totalB = intB;

      if (totalA < totalB) {
        return { month: m, years: m / 12 };
      }
    }
    return null;
  }, [loan, rate, altRate, term, schedule]);

  const curvePoints = useMemo(() => {
    const months = term * 12;
    const step = Math.max(1, Math.floor(months / 60));
    const A: { m: number; cost: number }[] = [];
    const B: { m: number; cost: number }[] = [];
    for (let m = step; m <= months; m += step) {
      const balA = balanceAfterMonths(loan, rate, term, m);
      const intA = totalInterestPaid(loan, rate, term, m);
      const yIdx = Math.min(Math.ceil(m / 12), schedule.length) - 1;
      const pppRateA = schedule[yIdx] ?? 0;
      const pppA = (balA * pppRateA) / 100;
      A.push({ m, cost: intA + pppA });

      const intB = totalInterestPaid(loan, altRate, term, m);
      B.push({ m, cost: intB });
    }
    return { A, B };
  }, [loan, rate, altRate, term, schedule]);

  // Chart sizing
  const W = 560;
  const H = 220;
  const padL = 50;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const maxCost = Math.max(
    ...curvePoints.A.map((p) => p.cost),
    ...curvePoints.B.map((p) => p.cost),
    1,
  );
  const maxM = term * 12;
  const x = (m: number) => padL + ((W - padL - padR) * m) / maxM;
  const y = (c: number) => padT + (H - padT - padB) * (1 - c / maxCost);

  const pathA = curvePoints.A
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.m).toFixed(1)},${y(p.cost).toFixed(1)}`)
    .join(" ");
  const pathB = curvePoints.B
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.m).toFixed(1)},${y(p.cost).toFixed(1)}`)
    .join(" ");

  const winner = scenario.totalA < scenario.totalB ? "A" : "B";

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>{isEs ? "Calculadora de penalización por pago anticipado DSCR" : "DSCR Prepayment Penalty Calculator"}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {isEs
            ? "Modela el costo de la PPP en cualquier año de salida y compara un préstamo con tasa más baja + PPP vs un préstamo sin PPP con prima de tasa."
            : "Model PPP cost at any exit year and compare a lower-rate + PPP loan vs a no-PPP loan with a rate premium."}
        </p>
      </CardHeader>
      <CardContent>
        <div className="w-full">
          <div
            role="tablist"
            aria-label={isEs ? "Modo de análisis" : "Analysis mode"}
            className="mb-4 grid w-full grid-cols-2 gap-1 rounded-md bg-muted p-1 md:w-auto md:inline-flex"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "ppp"}
              onClick={() => setTab("ppp")}
              className={cn(
                "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                tab === "ppp"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {isEs ? "Calculadora de costo PPP" : "PPP cost calculator"}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "compare"}
              onClick={() => setTab("compare")}
              className={cn(
                "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                tab === "compare"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {isEs ? "Con PPP vs sin PPP" : "With-PPP vs No-PPP"}
            </button>
          </div>

          {/* Shared inputs */}
          <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 md:grid-cols-4">
            <div>
              <Label htmlFor="loan">{isEs ? "Monto del préstamo" : "Loan amount"}</Label>
              <Input
                id="loan"
                type="number"
                value={loan}
                onChange={(e) => setLoan(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label htmlFor="rate">{isEs ? "Tasa de interés (%)" : "Interest rate (%)"}</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label htmlFor="term">{isEs ? "Plazo (años)" : "Term (years)"}</Label>
              <Input
                id="term"
                type="number"
                value={term}
                onChange={(e) => setTerm(Number(e.target.value) || 30)}
              />
            </div>
            <div>
              <Label htmlFor="structure">{isEs ? "Estructura PPP" : "PPP structure"}</Label>
              <select
                id="structure"
                value={structure}
                onChange={(e) => setStructure(e.target.value as StructureKey)}
                className="flex h-11 w-full rounded border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              >
                {Object.entries(STRUCTURES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {structure === "custom" && (
            <div className="mt-4 grid gap-3 rounded-lg border bg-muted/30 p-4 md:grid-cols-6">
              {custom.map((v, i) => (
                <div key={i}>
                  <Label htmlFor={`customYear${i + 1}`}>{isEs ? `Año ${i + 1} (%)` : `Year ${i + 1} (%)`}</Label>
                  <Input
                    id={`customYear${i + 1}`}
                    type="number"
                    step="0.1"
                    value={v}
                    onChange={(e) => {
                      const next = [...custom];
                      next[i] = Number(e.target.value) || 0;
                      setCustom(next);
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          <div role="tabpanel" hidden={tab !== "ppp"} className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="bg-secondary/30">
                <CardContent className="pt-6">
                  <p className="text-xs uppercase text-muted-foreground">{isEs ? "P&I mensual" : "Monthly P&I"}</p>
                  <p className="text-2xl font-bold">
                    {fmtUSD(monthlyPayment(loan, rate, term))}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-secondary/30">
                <CardContent className="pt-6">
                  <p className="text-xs uppercase text-muted-foreground">
                    {isEs ? `Saldo al final del año ${exitYear}` : `Balance at end of year ${exitYear}`}
                  </p>
                  <p className="text-2xl font-bold">
                    {fmtUSD(balanceAfterMonths(loan, rate, term, exitYear * 12))}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-accent/10 border-accent/40">
                <CardContent className="pt-6">
                  <p className="text-xs uppercase text-muted-foreground">
                    {isEs ? `Costo de PPP si sales en el año ${exitYear}` : `PPP cost if exiting in year ${exitYear}`}
                  </p>
                  <p className="text-2xl font-bold text-accent">
                    {fmtUSD(scenario.pppA)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isEs ? `@ ${schedule[exitYear - 1] ?? 0}% del saldo restante` : `@ ${schedule[exitYear - 1] ?? 0}% of remaining balance`}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div>
              <Label>{isEs ? `Año de salida: ${exitYear}` : `Exit year: ${exitYear}`}</Label>
              <input
                type="range"
                min={1}
                max={Math.min(term, 10)}
                value={exitYear}
                onChange={(e) => setExitYear(Number(e.target.value))}
                className="mt-2 w-full"
              />
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-secondary">
                  <tr>
                    <th className="px-3 py-2 text-left">{isEs ? "Año de salida" : "Exit year"}</th>
                    <th className="px-3 py-2 text-right">{isEs ? "Saldo restante" : "Remaining balance"}</th>
                    <th className="px-3 py-2 text-right">{isEs ? "Tasa PPP" : "PPP rate"}</th>
                    <th className="px-3 py-2 text-right">{isEs ? "Costo PPP" : "PPP cost"}</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r) => (
                    <tr
                      key={r.year}
                      className={cn(
                        "border-t",
                        r.year === exitYear && "bg-accent/10 font-semibold",
                      )}
                    >
                      <td className="px-3 py-2">{isEs ? `Año ${r.year}` : `Year ${r.year}`}</td>
                      <td className="px-3 py-2 text-right">{fmtUSD(r.balance)}</td>
                      <td className="px-3 py-2 text-right">{r.pppRate}%</td>
                      <td className="px-3 py-2 text-right">{fmtUSD(r.pppCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div role="tabpanel" hidden={tab !== "compare"} className="mt-6 space-y-6">
            <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 md:grid-cols-2">
              <div>
                <Label htmlFor="altRate">{isEs ? "Tasa alternativa sin PPP (%)" : "Alternative no-PPP rate (%)"}</Label>
                <Input
                  id="altRate"
                  type="number"
                  step="0.01"
                  value={altRate}
                  onChange={(e) => setAltRate(Number(e.target.value) || 0)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {isEs ? "La tasa que obtendrías si eligieras un préstamo sin penalización por pago anticipado." : "The rate you\u2019d get if you chose a loan without a prepayment penalty."}
                </p>
              </div>
              <div>
                <Label>{isEs ? `Año de salida: ${exitYear}` : `Exit year: ${exitYear}`}</Label>
                <input
                  type="range"
                  min={1}
                  max={Math.min(term, 10)}
                  value={exitYear}
                  onChange={(e) => setExitYear(Number(e.target.value))}
                  className="mt-2 w-full"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className={cn(winner === "A" && "border-success ring-2 ring-success/30")}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {isEs ? `Escenario A — ${rate}% con PPP` : `Scenario A — ${rate}% w/ PPP`}
                    {winner === "A" && (
                      <span className="rounded bg-success/20 px-2 py-0.5 text-xs text-success">
                        {isEs ? "ganador" : "winner"}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>{isEs ? `Interés pagado (años 1-${exitYear})` : `Interest paid (yrs 1-${exitYear})`}</span>
                    <span>{fmtUSD(scenario.intA)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{isEs ? "PPP a la salida" : "PPP at exit"}</span>
                    <span>{fmtUSD(scenario.pppA)}</span>
                  </div>
                  <div className="mt-2 flex justify-between border-t pt-2 font-bold">
                    <span>{isEs ? "Costo total del capital" : "Total cost of capital"}</span>
                    <span>{fmtUSD(scenario.totalA)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{isEs ? "+ capital devuelto a la salida" : "+ principal returned at exit"}</span>
                    <span>{fmtUSD(scenario.balA)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(winner === "B" && "border-success ring-2 ring-success/30")}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {isEs ? `Escenario B — ${altRate}% sin PPP` : `Scenario B — ${altRate}% no PPP`}
                    {winner === "B" && (
                      <span className="rounded bg-success/20 px-2 py-0.5 text-xs text-success">
                        {isEs ? "ganador" : "winner"}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>{isEs ? `Interés pagado (años 1-${exitYear})` : `Interest paid (yrs 1-${exitYear})`}</span>
                    <span>{fmtUSD(scenario.intB)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{isEs ? "PPP a la salida" : "PPP at exit"}</span>
                    <span>$0</span>
                  </div>
                  <div className="mt-2 flex justify-between border-t pt-2 font-bold">
                    <span>{isEs ? "Costo total del capital" : "Total cost of capital"}</span>
                    <span>{fmtUSD(scenario.totalB)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{isEs ? "+ capital devuelto a la salida" : "+ principal returned at exit"}</span>
                    <span>{fmtUSD(scenario.balB)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-accent/40 bg-accent/5">
              <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  {winner === "A" ? (
                    <TrendingDown className="size-8 text-success" />
                  ) : (
                    <TrendingUp className="size-8 text-destructive" />
                  )}
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      {isEs ? `Ahorros al elegir ${winner === "A" ? "Escenario A" : "Escenario B"}` : `Savings by choosing ${winner === "A" ? "Scenario A" : "Scenario B"}`}
                    </p>
                    <p className="text-2xl font-bold">{fmtUSD(Math.abs(scenario.delta))}</p>
                  </div>
                </div>
                <div className="text-sm">
                  {breakEven ? (
                    <span>
                      <strong>{isEs ? "Punto de equilibrio:" : "Break-even:"}</strong> {isEs ? "el Escenario A supera al Escenario B después del mes " : "Scenario A beats Scenario B after month "}
                      {breakEven.month} ({breakEven.years.toFixed(1)} {isEs ? "años" : "years"}).
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <AlertTriangle className="size-4" />
                      {isEs ? "El Escenario A nunca supera al B con este diferencial de tasa." : "Scenario A never beats B at this rate spread."}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="rounded-lg border bg-card p-4">
              <p className="mb-2 text-sm font-semibold">{isEs ? "Curva de costo acumulado" : "Cumulative cost curve"}</p>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={isEs ? "Gráfico de costo acumulado" : "Cumulative cost chart"}>
                {/* Grid */}
                {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                  <line
                    key={t}
                    x1={padL}
                    x2={W - padR}
                    y1={padT + (H - padT - padB) * t}
                    y2={padT + (H - padT - padB) * t}
                    stroke="currentColor"
                    className="text-border"
                    strokeDasharray="2 2"
                  />
                ))}
                {/* Axes labels */}
                <text x={padL} y={H - 8} className="fill-muted-foreground text-[10px]">
                  {isEs ? "A1" : "Y1"}
                </text>
                <text x={W - padR - 16} y={H - 8} className="fill-muted-foreground text-[10px]">
                  {isEs ? `A${term}` : `Y${term}`}
                </text>
                <text x={4} y={padT + 8} className="fill-muted-foreground text-[10px]">
                  {fmtUSD(maxCost)}
                </text>
                <text x={4} y={H - padB} className="fill-muted-foreground text-[10px]">
                  $0
                </text>
                {/* Exit marker */}
                <line
                  x1={x(exitYear * 12)}
                  x2={x(exitYear * 12)}
                  y1={padT}
                  y2={H - padB}
                  stroke="currentColor"
                  className="text-accent"
                  strokeDasharray="3 3"
                />
                <path d={pathA} fill="none" stroke="#0ea5e9" strokeWidth={2.5} />
                <path d={pathB} fill="none" stroke="#f59e0b" strokeWidth={2.5} />
              </svg>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block size-3 rounded bg-[#0ea5e9]" /> {isEs ? "Escenario A (con PPP)" : "Scenario A (with PPP)"}
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block size-3 rounded bg-[#f59e0b]" /> {isEs ? "Escenario B (sin PPP)" : "Scenario B (no PPP)"}
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-3 w-0.5 bg-accent" /> {isEs ? "Año de salida seleccionado" : "Selected exit year"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {isEs ? "Solo estimaciones. Los términos reales de PPP varían según el prestamista. Confirma con tu pagaré." : "Estimates only. Actual PPP language varies by lender. Confirm with your note."}
          </p>
          <Button variant="cta" asChild>
            <a href={isEs ? "/es/get-matched?source=prepayment-penalty-analyzer" : "/get-matched?source=prepayment-penalty-analyzer"}>
              {isEs ? "Cotizar con prestamistas según tu PPP preferida" : "Get lender quotes with your preferred PPP"}
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

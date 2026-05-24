"use client";

import { AlertTriangle, Check, Plus, Trash2, TrendingDown, TrendingUp, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fmtDSCR, fmtPct, fmtUSD } from "@/lib/finance";

interface Property {
  id: number;
  label: string;
  value: number;
  rent: number;
  pitia: number;
  balance: number;
  pi: number;
}

const newProperty = (id: number, label: string): Property => ({
  id,
  label,
  value: 300000,
  rent: 2400,
  pitia: 1900,
  balance: 200000,
  pi: 1400,
});

const SEED_EN: Property[] = [
  { id: 1, label: "Property 1 — Kansas City SFR", value: 225000, rent: 1875, pitia: 1420, balance: 160000, pi: 1080 },
  { id: 2, label: "Property 2 — Atlanta duplex", value: 340000, rent: 2900, pitia: 2050, balance: 240000, pi: 1510 },
  { id: 3, label: "Property 3 — Tampa SFR", value: 395000, rent: 2700, pitia: 2300, balance: 280000, pi: 1820 },
];

const SEED_ES: Property[] = [
  { id: 1, label: "Propiedad 1 — SFR Kansas City", value: 225000, rent: 1875, pitia: 1420, balance: 160000, pi: 1080 },
  { id: 2, label: "Propiedad 2 — Dúplex Atlanta", value: 340000, rent: 2900, pitia: 2050, balance: 240000, pi: 1510 },
  { id: 3, label: "Propiedad 3 — SFR Tampa", value: 395000, rent: 2700, pitia: 2300, balance: 280000, pi: 1820 },
];

interface PortfolioAnalyzerProps {
  lang?: "en" | "es";
}

export default function PortfolioAnalyzer({ lang = "en" }: PortfolioAnalyzerProps = {}) {
  const isEs = lang === "es";
  const [rows, setRows] = useState<Property[]>(isEs ? SEED_ES : SEED_EN);
  const [blanketRate, setBlanketRate] = useState(7.85);

  const update = (id: number, patch: Partial<Property>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const remove = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));

  const add = () =>
    setRows((rs) => [...rs, newProperty((rs.at(-1)?.id ?? 0) + 1, isEs ? `Propiedad ${rs.length + 1}` : `Property ${rs.length + 1}`)]);

  const derived = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        dscr: r.pitia > 0 ? r.rent / r.pitia : 0,
        ltv: r.value > 0 ? (r.balance / r.value) * 100 : 0,
      })),
    [rows],
  );

  const agg = useMemo(() => {
    const totalValue = rows.reduce((s, r) => s + r.value, 0);
    const totalRent = rows.reduce((s, r) => s + r.rent, 0);
    const totalPitia = rows.reduce((s, r) => s + r.pitia, 0);
    const totalBalance = rows.reduce((s, r) => s + r.balance, 0);
    const totalPI = rows.reduce((s, r) => s + r.pi, 0);
    const blended = totalPitia > 0 ? totalRent / totalPitia : 0;
    const aggLtv = totalValue > 0 ? (totalBalance / totalValue) * 100 : 0;

    const sorted = [...derived].sort((a, b) => a.dscr - b.dscr);
    const weakest = sorted[0];
    const strongest = sorted.at(-1);
    const refiEligible = derived.filter((d) => d.dscr >= 1.0);

    // Blanket loan scenario estimate:
    // typical LTV cap 70-75%, min blended DSCR 1.20
    const blanketLtvCap = 70;
    const blanketMax = totalValue * (blanketLtvCap / 100);
    const blanketQualifies = blended >= 1.2 && rows.length >= 3;

    return {
      totalValue,
      totalRent,
      totalPitia,
      totalBalance,
      totalPI,
      blended,
      aggLtv,
      weakest,
      strongest,
      refiEligible,
      blanketMax,
      blanketQualifies,
    };
  }, [rows, derived]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEs ? "Analizador de DSCR de portafolio y préstamo global" : "Portfolio & Blanket DSCR Analyzer"}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {isEs
            ? "Agrega cada renta que tengas. Mira el DSCR por propiedad, el DSCR mezclado del portafolio y si un préstamo global o un refinanciamiento individual es la jugada correcta."
            : "Add every rental you own. See per-property DSCR, blended portfolio DSCR, and whether a blanket loan or individual refi is the right move."}
        </p>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">{isEs ? `Propiedades (${rows.length})` : `Properties (${rows.length})`}</p>
          <Button variant="outline" size="sm" onClick={add}>
            <Plus className="size-4" /> {isEs ? "Agregar propiedad" : "Add property"}
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="px-2 py-2 text-left">{isEs ? "Etiqueta" : "Label"}</th>
                <th className="px-2 py-2 text-right">{isEs ? "Valor" : "Value"}</th>
                <th className="px-2 py-2 text-right">{isEs ? "Renta" : "Rent"}</th>
                <th className="px-2 py-2 text-right">PITIA</th>
                <th className="px-2 py-2 text-right">{isEs ? "Saldo" : "Balance"}</th>
                <th className="px-2 py-2 text-right">P&amp;I</th>
                <th className="px-2 py-2 text-right">DSCR</th>
                <th className="px-2 py-2 text-right">LTV</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {derived.map((r) => (
                <tr
                  key={r.id}
                  className={cn(
                    "border-t",
                    r.dscr < 1 && "bg-destructive/5",
                    r.dscr >= 1.2 && "bg-success/5",
                  )}
                >
                  <td className="px-2 py-1">
                    <Input
                      value={r.label}
                      onChange={(e) => update(r.id, { label: e.target.value })}
                      className="h-9"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      value={r.value}
                      onChange={(e) => update(r.id, { value: +e.target.value || 0 })}
                      className="h-9 text-right"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      value={r.rent}
                      onChange={(e) => update(r.id, { rent: +e.target.value || 0 })}
                      className="h-9 text-right"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      value={r.pitia}
                      onChange={(e) => update(r.id, { pitia: +e.target.value || 0 })}
                      className="h-9 text-right"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      value={r.balance}
                      onChange={(e) => update(r.id, { balance: +e.target.value || 0 })}
                      className="h-9 text-right"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      value={r.pi}
                      onChange={(e) => update(r.id, { pi: +e.target.value || 0 })}
                      className="h-9 text-right"
                    />
                  </td>
                  <td
                    className={cn(
                      "px-2 py-1 text-right font-semibold",
                      r.dscr >= 1.2 ? "text-success" : r.dscr >= 1 ? "" : "text-destructive",
                    )}
                  >
                    {fmtDSCR(r.dscr)}
                  </td>
                  <td className="px-2 py-1 text-right">{fmtPct(r.ltv)}</td>
                  <td className="px-2 py-1 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(r.id)}
                      disabled={rows.length <= 1}
                      aria-label={isEs ? `Quitar ${r.label}` : `Remove ${r.label}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Aggregate summary */}
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <Card className="bg-secondary/30">
            <CardContent className="pt-5">
              <p className="text-xs uppercase text-muted-foreground">{isEs ? "Valor total" : "Total value"}</p>
              <p className="text-2xl font-bold">{fmtUSD(agg.totalValue)}</p>
            </CardContent>
          </Card>
          <Card className="bg-secondary/30">
            <CardContent className="pt-5">
              <p className="text-xs uppercase text-muted-foreground">{isEs ? "Renta mensual total" : "Total monthly rent"}</p>
              <p className="text-2xl font-bold">{fmtUSD(agg.totalRent)}</p>
            </CardContent>
          </Card>
          <Card className="bg-secondary/30">
            <CardContent className="pt-5">
              <p className="text-xs uppercase text-muted-foreground">{isEs ? "PITIA total" : "Total PITIA"}</p>
              <p className="text-2xl font-bold">{fmtUSD(agg.totalPitia)}</p>
            </CardContent>
          </Card>
          <Card
            className={cn(
              agg.blended >= 1.2
                ? "border-success/40 bg-success/10"
                : agg.blended >= 1
                  ? "bg-secondary/30"
                  : "border-destructive/30 bg-destructive/10",
            )}
          >
            <CardContent className="pt-5">
              <p className="text-xs uppercase text-muted-foreground">{isEs ? "DSCR mezclado" : "Blended DSCR"}</p>
              <p
                className={cn(
                  "text-2xl font-bold",
                  agg.blended >= 1.2
                    ? "text-success"
                    : agg.blended >= 1
                      ? ""
                      : "text-destructive",
                )}
              >
                {fmtDSCR(agg.blended)}
              </p>
              <p className="text-xs text-muted-foreground">{isEs ? "Renta total / PITIA total" : "Total rent / total PITIA"}</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs uppercase text-muted-foreground">{isEs ? "LTV agregado" : "Aggregate LTV"}</p>
              <p className="text-xl font-bold">{fmtPct(agg.aggLtv)}</p>
              <p className="text-xs text-muted-foreground">
                {fmtUSD(agg.totalBalance)} {isEs ? "deuda" : "debt"} / {fmtUSD(agg.totalValue)} {isEs ? "valor" : "value"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs uppercase text-muted-foreground">{isEs ? "Elegibles para refi" : "Refi-eligible"}</p>
              <p className="text-xl font-bold">
                {agg.refiEligible.length} / {rows.length}
              </p>
              <p className="text-xs text-muted-foreground">{isEs ? "DSCR individual ≥ 1.00" : "Individual DSCR ≥ 1.00"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs uppercase text-muted-foreground">{isEs ? "Capital" : "Equity"}</p>
              <p className="text-xl font-bold">{fmtUSD(agg.totalValue - agg.totalBalance)}</p>
              <p className="text-xs text-muted-foreground">
                {isEs ? "Valor − deuda (antes de costos)" : "Value − debt (before costs)"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Flags */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {agg.weakest && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <TrendingDown className="size-5 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-semibold">{isEs ? "Propiedad más débil" : "Weakest property"}</p>
                <p className="text-sm">
                  {agg.weakest.label} — DSCR{" "}
                  <span className="font-bold">{fmtDSCR(agg.weakest.dscr)}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {agg.weakest.dscr < 1
                    ? (isEs ? "Baja el número mezclado. Considera subir la renta, refinanciar a una tasa más baja o vender." : "Drags down the blended number. Consider raising rent, refi to a lower rate, or selling.")
                    : (isEs ? "Por debajo de tus mejores. Revisa precios y gastos operativos." : "Below your top performers. Review pricing and opex.")}
                </p>
              </div>
            </div>
          )}
          {agg.strongest && (
            <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
              <TrendingUp className="size-5 shrink-0 text-success" />
              <div>
                <p className="text-sm font-semibold">{isEs ? "Propiedad más fuerte" : "Strongest property"}</p>
                <p className="text-sm">
                  {agg.strongest.label} — DSCR{" "}
                  <span className="font-bold">{fmtDSCR(agg.strongest.dscr)}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {isEs ? "Saca capital aquí con un refinanciamiento individual con retiro de efectivo para financiar tu próxima compra." : "Pull equity here with a standalone cash-out refi to fund your next buy."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Blanket scenario */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">{isEs ? "Escenario de préstamo global (de portafolio)" : "Blanket (portfolio) loan scenario"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase text-muted-foreground">{isEs ? "Tasa global est." : "Est. blanket rate"}</p>
                <Input
                  type="number"
                  step="0.01"
                  value={blanketRate}
                  onChange={(e) => setBlanketRate(+e.target.value || 0)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {isEs ? "Los programas de portafolio típicamente 25-75 pbs por encima del precio DSCR individual." : "Portfolio programs typically 25-75 bps over individual DSCR pricing."}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">{isEs ? "Tope LTV (70%)" : "LTV cap (70%)"}</p>
                <p className="text-2xl font-bold">{fmtUSD(agg.blanketMax)}</p>
                <p className="text-xs text-muted-foreground">
                  {isEs ? "Préstamo máx al 70% LTV agregado" : "Max loan at 70% aggregate LTV"}
                </p>
              </div>
              <div
                className={cn(
                  "rounded-lg p-3",
                  agg.blanketQualifies
                    ? "border border-success/40 bg-success/10"
                    : "border border-destructive/30 bg-destructive/10",
                )}
              >
                <div className="flex items-center gap-2">
                  {agg.blanketQualifies ? (
                    <Check className="size-5 text-success" />
                  ) : (
                    <X className="size-5 text-destructive" />
                  )}
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      agg.blanketQualifies ? "text-success" : "text-destructive",
                    )}
                  >
                    {agg.blanketQualifies ? (isEs ? "Probablemente califica" : "Likely qualifies") : (isEs ? "Probablemente no califica" : "Likely does not qualify")}
                  </p>
                </div>
                <p className="mt-1 text-xs">
                  {isEs ? "Se requiere DSCR de portafolio ≥ 1.20; se requieren ≥ 3 propiedades" : "Portfolio DSCR ≥ 1.20 required; ≥ 3 properties required"}
                </p>
              </div>
            </div>
            <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
              <li>
                {isEs
                  ? "• Programas: CoreVest, A&D Mortgage, LendingOne, Arbor, Velocity — monto mínimo de préstamo agregado típico de $500k"
                  : "• Programs: CoreVest, A&D Mortgage, LendingOne, Arbor, Velocity — minimum $500k aggregate loan amount typical"}
              </li>
              <li>
                {isEs
                  ? "• Cláusulas de liberación: liberación de propiedad individual al 115-120% del principal pro-rata es común"
                  : "• Release provisions: individual property releases at 115-120% of pro-rata principal common"}
              </li>
              <li>
                {isEs
                  ? "• Garantía cruzada: todas las propiedades garantizan toda la deuda"
                  : "• Cross-collateralized: all properties secure all debt"}
              </li>
            </ul>
          </CardContent>
        </Card>

        {agg.refiEligible.length < rows.length && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-accent/40 bg-accent/5 p-4">
            <AlertTriangle className="size-5 shrink-0 text-accent" />
            <p className="text-sm">
              {isEs ? (
                <><strong>{rows.length - agg.refiEligible.length}</strong> de {rows.length} propiedades fallarían un refi DSCR individual (DSCR menor a 1.00). Un préstamo global de portafolio aún puede incluirlas si el DSCR mezclado es lo suficientemente fuerte.</>
              ) : (
                <><strong>{rows.length - agg.refiEligible.length}</strong> of {rows.length} properties would fail a standalone DSCR refi (DSCR below 1.00). A portfolio blanket can still wrap them if the blended DSCR is strong enough.</>
              )}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {isEs ? "Solo estimaciones. Los términos reales del programa de portafolio varían según el prestamista." : "Estimates only. Actual portfolio program terms vary by lender."}
          </p>
          <Button variant="cta" asChild>
            <a href={isEs ? "/es/get-matched?source=portfolio-dscr-analyzer" : "/get-matched?source=portfolio-dscr-analyzer"}>
              {isEs ? "Cotizar mi portafolio" : "Quote my portfolio"}
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

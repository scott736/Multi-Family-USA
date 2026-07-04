"use client";

import { Info, TrendingUp } from "lucide-react";

import EmailAnalysisCapture from "@/components/forms/EmailAnalysisCapture";
import { fmtUSD } from "@/lib/finance";
import { cn } from "@/lib/utils";

export interface MaxLoanResultsData {
  maxPI: number;
  maxLoan: number;
  pp75: number;
  pp80: number;
  warn: boolean;
}

export interface DscrComparisonRow {
  dscr: "0.75" | "1.0" | "1.25";
  maxPI: number;
  maxLoan: number;
}

interface MaxLoanCalculatorResultsPanelProps {
  isEs: boolean;
  results: MaxLoanResultsData | null;
  fixedCosts: number;
  rate: string;
  term: "30" | "15";
  targetDscr: "0.75" | "1.0" | "1.25";
}

interface MaxLoanCalculatorComparisonProps {
  isEs: boolean;
  selectedTargetDscr: "0.75" | "1.0" | "1.25";
  showComparison: boolean;
  rows: DscrComparisonRow[];
  analysisSummary?: Record<string, string | number>;
  sourcePage?: string;
}

export function MaxLoanCalculatorResultsPanel({
  isEs,
  results,
  fixedCosts,
  rate,
  term,
  targetDscr,
}: MaxLoanCalculatorResultsPanelProps) {
  return (
    <>
      <div className="lg:col-span-2 p-5 md:p-7 flex flex-col gap-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {isEs ? "Resultados del préstamo máximo" : "Max loan results"}
        </p>

        {results && results.maxLoan > 0 ? (
          <>
            <div className="rounded-xl bg-accent/10 ring-2 ring-accent/30 p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-bold">
                {isEs ? "Monto máximo del préstamo" : "Max loan amount"}
              </p>
              <div className="text-5xl font-bold text-accent tabular-nums mt-1">
                {fmtUSD(results.maxLoan)}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {isEs
                  ? `Al ${rate}% / ${term} años · mantiene DSCR ≥ ${targetDscr}x`
                  : `At ${rate}% / ${term}-yr · keeps DSCR ≥ ${targetDscr}x`}
              </p>
            </div>

            <dl className="space-y-2 text-sm">
              <ResultRow
                label={isEs ? "Principal e intereses máximo mensual" : "Max monthly P&I"}
                value={fmtUSD(results.maxPI)}
              />
              <ResultRow
                label={
                  isEs
                    ? "Costos fijos mensuales (impuesto + seguro + HOA)"
                    : "Monthly fixed costs (tax + ins + HOA)"
                }
                value={fmtUSD(fixedCosts)}
              />
              <ResultRow
                label={isEs ? "Compra máxima @ 75% LTV" : "Max purchase @ 75% LTV"}
                value={fmtUSD(results.pp75)}
                bold
              />
              <ResultRow
                label={isEs ? "Compra máxima @ 80% LTV" : "Max purchase @ 80% LTV"}
                value={fmtUSD(results.pp80)}
                bold
              />
            </dl>

            {results.warn && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                {isEs ? (
                  <>
                    <strong>Verifica tu valor de renta</strong> — el valor ingresado parece estar fuera del rango típico.
                    Verifica y vuelve a calcular.
                  </>
                ) : (
                  <>
                    <strong>Double-check your rent input</strong> — the value entered seems outside a typical range.
                    Verify and re-run.
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl bg-muted/40 ring-2 ring-border p-5 text-center">
            <p className="text-muted-foreground text-sm">
              {results && results.maxPI <= 0
                ? isEs
                  ? "Los costos fijos exceden la renta a este DSCR objetivo — no hay margen para principal e intereses. Reduce los costos fijos o usa un DSCR objetivo más bajo."
                  : "Fixed costs exceed rent at this DSCR target — no P&I room left. Lower fixed costs or use a lower DSCR target."
                : isEs
                  ? "Ingresa renta, costos fijos y tasa para calcular tu préstamo máximo."
                  : "Enter rent, fixed costs, and rate to calculate your max loan."}
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-border bg-secondary/40 rounded-b-2xl p-5 md:p-7">
        <div className="flex items-start gap-3">
          <Info className="size-5 shrink-0 text-accent mt-0.5" />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              {isEs ? "Cómo funciona" : "How this works"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              {isEs
                ? "Resolvemos para el principal e intereses mensual máximo de modo que renta ÷ (P&I + costos fijos) ≥ tu DSCR objetivo, y luego calculamos el monto del préstamo usando amortización estándar. Los rangos de precio de compra asumen 75% y 80% LTV al cierre. Ajusta el DSCR objetivo para modelar diferentes requisitos de prestamistas."
                : "We solve for the maximum monthly P&I such that rent ÷ (P&I + fixed costs) ≥ your target DSCR, then back-calculate the loan amount using standard amortization. The purchase price ranges assume 75% and 80% LTV at closing. Adjust the target DSCR to model different lender requirements."}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export function MaxLoanCalculatorComparison({
  isEs,
  selectedTargetDscr,
  showComparison,
  rows,
  analysisSummary,
  sourcePage,
}: MaxLoanCalculatorComparisonProps) {
  if (!showComparison) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/5 to-transparent p-5 md:p-7">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="size-4 text-accent" />
        <h3 className="text-lg font-bold text-foreground">
          {isEs ? "Comparación de DSCR objetivo" : "DSCR target comparison"}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="py-2 pr-4">{isEs ? "DSCR objetivo" : "Target DSCR"}</th>
              <th className="py-2 pr-4">{isEs ? "P&I máximo / mes" : "Max P&I / mo"}</th>
              <th className="py-2 pr-4">{isEs ? "Préstamo máximo" : "Max loan"}</th>
              <th className="py-2">{isEs ? "Precio máximo @ 75%" : "Max price @ 75%"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.dscr} className={cn(selectedTargetDscr === row.dscr && "bg-accent/10")}>
                <td className="py-2.5 pr-4 font-semibold">{row.dscr}x</td>
                <td className="py-2.5 pr-4 tabular-nums">{row.maxPI > 0 ? fmtUSD(row.maxPI) : "—"}</td>
                <td className="py-2.5 pr-4 tabular-nums">{row.maxLoan > 0 ? fmtUSD(row.maxLoan) : "—"}</td>
                <td className="py-2.5 tabular-nums">{row.maxLoan > 0 ? fmtUSD(row.maxLoan / 0.75) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>

      {analysisSummary && (
        <EmailAnalysisCapture
          analysisType={isEs ? "Préstamo máximo" : "Max loan"}
          analysisSummary={analysisSummary}
          lang={isEs ? "es" : "en"}
          sourcePage={sourcePage}
        />
      )}
    </div>
  );
}

function ResultRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums", bold && "font-bold text-foreground")}>{value}</dd>
    </div>
  );
}

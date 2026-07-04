"use client";

import {
  ArrowRight,
  CheckCircle2,
  Info,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";

import EmailAnalysisCapture from "@/components/forms/EmailAnalysisCapture";
import { fmtUSD } from "@/lib/finance";
import { cn } from "@/lib/utils";

export interface DscrTierState {
  key: string;
  label: string;
  color: string;
  ring: string;
  bg: string;
  message: string;
}

interface DscrCalculatorResultsPanelProps {
  isEs: boolean;
  dscr: number;
  tier: DscrTierState;
  rent: number;
  pitia: number;
}

interface DscrCalculatorResultsProps {
  isEs: boolean;
  tierKey: string;
  dscr: number;
  rentFor100: number;
  rentFor125: number;
  rentDeltaTo100: number;
  rentDeltaTo125: number;
  maxPiFor100: number;
  piCutFor100: number;
  analysisSummary?: Record<string, string | number>;
  sourcePage?: string;
}

export function DscrCalculatorResultsPanel({
  isEs,
  dscr,
  tier,
  rent,
  pitia,
}: DscrCalculatorResultsPanelProps) {
  return (
    <div className="lg:col-span-2 p-5 md:p-7 flex flex-col justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {isEs ? "Tu DSCR" : "Your DSCR"}
        </p>
        <div className={cn("mt-2 rounded-xl p-5 ring-2 transition", tier.ring, tier.bg)}>
          <div className={cn("text-6xl font-bold tabular-nums tracking-tight", tier.color)}>
            {dscr > 0 ? dscr.toFixed(2) : "—"}
          </div>
          <p className={cn("mt-2 text-sm font-semibold", tier.color)}>{tier.label}</p>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{tier.message}</p>
        </div>

        <dl className="mt-5 space-y-2 text-sm">
          <ResultRow
            label={isEs ? "Renta mensual bruta" : "Monthly gross rent"}
            value={fmtUSD(rent)}
          />
          <ResultRow
            label={isEs ? "PITIA mensual" : "Monthly PITIA"}
            value={fmtUSD(pitia)}
            bold
          />
          <ResultRow
            label={isEs ? "Flujo de caja mensual" : "Monthly cash flow"}
            value={fmtUSD(rent - pitia)}
            accent={rent - pitia >= 0 ? "good" : "bad"}
          />
          <ResultRow
            label={isEs ? "Flujo de caja anual" : "Annual cash flow"}
            value={fmtUSD((rent - pitia) * 12)}
            accent={rent - pitia >= 0 ? "good" : "bad"}
          />
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          <a
            href={isEs ? "/es/checklists#antes-de-aplicar" : "/checklists#before-you-apply"}
            className="font-semibold text-primary underline underline-offset-2"
          >
            {isEs
              ? "Revisa la lista Antes de Aplicar"
              : "Run through the Before You Apply checklist"}
          </a>
        </p>
      </div>
    </div>
  );
}

export function DscrCalculatorResults({
  isEs,
  tierKey,
  dscr,
  rentFor100,
  rentFor125,
  rentDeltaTo100,
  rentDeltaTo125,
  maxPiFor100,
  piCutFor100,
  analysisSummary,
  sourcePage,
}: DscrCalculatorResultsProps) {
  return (
    <>
      <div className="border-t border-border bg-secondary/40 rounded-b-2xl p-5 md:p-7">
        <div className="flex items-start gap-3">
          <Info className="size-5 shrink-0 text-accent mt-0.5" />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              {isEs ? "Qué significa esto" : "What this means"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              {isEs
                ? "DSCR es tu renta dividida entre PITIA (capital, interés, impuestos, seguro, cuotas de asociación). Es el número más importante que mira un prestamista DSCR. Un DSCR de 1.00 significa que tu renta cubre exactamente la hipoteca. Los prestamistas fijan el precio del préstamo según este número — mayor DSCR, mejor tasa, mayor LTV."
                : "DSCR is your rent divided by PITIA (principal, interest, taxes, insurance, association dues). It's the single most important number a multifamily lender looks at. A 1.00 DSCR means your rent exactly covers the mortgage. Lenders price the loan off of it — higher DSCR, better rate, higher LTV."}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 md:p-7">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="size-4 text-accent" />
          <h3 className="text-lg font-bold text-foreground">
            {isEs ? "¿Qué nivel de prestamista califica?" : "Which lender tier qualifies?"}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">{isEs ? "Rango DSCR" : "DSCR band"}</th>
                <th className="py-2 pr-4">{isEs ? "Lo que encontrarás" : "What you'll find"}</th>
                <th className="py-2">{isEs ? "Tope típico de LTV" : "Typical LTV cap"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <TierRow
                band={isEs ? "Menor a 0.75" : "Sub-0.75"}
                desc={
                  isEs
                    ? "Limitado — considera un programa sin ratio o tipo Griffin"
                    : "Limited — consider a no-ratio or Griffin-style program"
                }
                ltv="65–70%"
                active={tierKey === "red"}
              />
              <TierRow
                band="0.75 – 0.99"
                desc={isEs ? "Competitivo — 5+ opciones de prestamistas" : "Competitive — 5+ lender options"}
                ltv="70–75%"
                active={tierKey === "amber"}
              />
              <TierRow
                band="1.00 – 1.24"
                desc={
                  isEs
                    ? "Acceso amplio a prestamistas, precios convencionales"
                    : "Broad lender access, mainstream pricing"
                }
                ltv={isEs ? "hasta 80%" : "up to 80%"}
                active={tierKey === "yellow"}
              />
              <TierRow
                band="1.25+"
                desc={
                  isEs
                    ? "Mejores tasas, mayor grupo de prestamistas, aprobaciones más rápidas"
                    : "Best rates, widest lender pool, fastest approvals"
                }
                ltv={isEs ? "hasta 80% (85% selectos)" : "up to 80% (85% select)"}
                active={tierKey === "green"}
              />
            </tbody>
          </table>
        </div>
      </div>

      {dscr > 0 && dscr < 1.25 && (
        <div className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/5 to-transparent p-5 md:p-7">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="size-4 text-accent" />
            <h3 className="text-lg font-bold text-foreground">{isEs ? "Prueba ajustar" : "Try adjusting"}</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {dscr < 1.0 && rentDeltaTo100 > 0 && (
              <AdjustRow
                icon={<ArrowRight className="size-4" />}
                title={isEs ? "Sube la renta para llegar a DSCR 1.00" : "Raise rent to hit 1.00 DSCR"}
                detail={
                  isEs
                    ? `Necesitas ${fmtUSD(rentFor100)}/mes — eso es ${fmtUSD(rentDeltaTo100)} más que hoy.`
                    : `Need ${fmtUSD(rentFor100)}/mo — that's ${fmtUSD(rentDeltaTo100)} more than today.`
                }
              />
            )}
            {dscr < 1.25 && rentDeltaTo125 > 0 && (
              <AdjustRow
                icon={<ArrowRight className="size-4" />}
                title={isEs ? "Sube la renta para llegar a DSCR 1.25" : "Raise rent to hit 1.25 DSCR"}
                detail={
                  isEs
                    ? `Necesitas ${fmtUSD(rentFor125)}/mes — eso es ${fmtUSD(rentDeltaTo125)} más que hoy.`
                    : `Need ${fmtUSD(rentFor125)}/mo — that's ${fmtUSD(rentDeltaTo125)} more than today.`
                }
              />
            )}
            {dscr < 1.0 && piCutFor100 > 0 && maxPiFor100 > 0 && (
              <AdjustRow
                icon={<TrendingDown className="size-4" />}
                title={isEs ? "Reduce el P&I para llegar a DSCR 1.00" : "Cut P&I to hit 1.00 DSCR"}
                detail={
                  isEs
                    ? `P&I máximo de ${fmtUSD(maxPiFor100)}/mes — recorta ${fmtUSD(piCutFor100)} con un enganche mayor, compra de tasa o I/O.`
                    : `Max P&I of ${fmtUSD(maxPiFor100)}/mo — cut ${fmtUSD(piCutFor100)} via bigger down, rate buydown, or I/O.`
                }
              />
            )}
          </div>
        </div>
      )}

      {analysisSummary && dscr > 0 && (
        <EmailAnalysisCapture
          analysisType="DSCR"
          analysisSummary={analysisSummary}
          lang={isEs ? "es" : "en"}
          sourcePage={sourcePage}
          className="mt-0"
        />
      )}
    </>
  );
}

function ResultRow({
  label,
  value,
  bold,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: "good" | "bad";
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          bold && "font-bold text-foreground",
          accent === "good" && "text-success font-semibold",
          accent === "bad" && "text-destructive font-semibold",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function TierRow({
  band,
  desc,
  ltv,
  active,
}: {
  band: string;
  desc: string;
  ltv: string;
  active: boolean;
}) {
  return (
    <tr className={cn("transition", active && "bg-accent/10 ring-2 ring-accent/30")}>
      <td className="py-2.5 pr-4 font-semibold text-foreground">
        <div className="flex items-center gap-1.5">
          {active && <CheckCircle2 className="size-4 text-accent" />}
          {band}
        </div>
      </td>
      <td className="py-2.5 pr-4 text-muted-foreground">{desc}</td>
      <td className="py-2.5 font-medium tabular-nums">{ltv}</td>
    </tr>
  );
}

function AdjustRow({
  icon,
  title,
  detail,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-accent">{icon}</span>
        {title}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

"use client";

import { ArrowRight, Info, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import EmailAnalysisCapture from "@/components/forms/EmailAnalysisCapture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildDealReviewUrl } from "@/lib/deal-review-url";
import { fmtUSD, parseNum } from "@/lib/finance";
import { cn } from "@/lib/utils";

interface Fields {
  noi: string;
  loanAmount: string;
}

const DEFAULTS: Fields = {
  noi: "120000",
  loanAmount: "1200000",
};

interface DebtYieldCalculatorProps {
  lang?: "en" | "es";
}

export default function DebtYieldCalculator({
  lang = "en",
}: DebtYieldCalculatorProps = {}) {
  const isEs = lang === "es";
  const [f, setF] = useState<Fields>(DEFAULTS);

  const BENCHMARKS = isEs
    ? [
        { label: "9% — mínimo para la mayoría de prestamistas CRE", threshold: 9, verdict: "below" },
        { label: "10% — piso típico para puentes multifamiliares", threshold: 10, verdict: "below" },
        { label: "12% — sólido / mejor nivel de precio", threshold: 12, verdict: "good" },
      ]
    : [
        { label: "9% — minimum for most CRE lenders", threshold: 9, verdict: "below" },
        { label: "10% — typical floor for multifamily bridge", threshold: 10, verdict: "below" },
        { label: "12% — strong / best pricing tier", threshold: 12, verdict: "good" },
      ];

  const noi = parseNum(f.noi);
  const loan = parseNum(f.loanAmount);

  const debtYield = useMemo(() => {
    if (loan <= 0 || noi <= 0) return 0;
    return (noi / loan) * 100;
  }, [noi, loan]);

  function update<K extends keyof Fields>(k: K, v: string) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  function verdictStyle(dy: number) {
    if (dy >= 12)
      return {
        text: "text-success",
        ring: "ring-success/40",
        bg: "bg-success/10",
        label: isEs ? "Sólido — mejor nivel de precio" : "Strong — best pricing tier",
      };
    if (dy >= 10)
      return {
        text: "text-yellow-600 dark:text-yellow-400",
        ring: "ring-yellow-500/40",
        bg: "bg-yellow-500/10",
        label: isEs
          ? "Aceptable — cumple con los pisos de la mayoría de prestamistas"
          : "Acceptable — meets most lender floors",
      };
    if (dy >= 9)
      return {
        text: "text-amber-600 dark:text-amber-400",
        ring: "ring-amber-500/40",
        bg: "bg-amber-500/10",
        label: isEs
          ? "Marginal — algunos prestamistas pueden requerir más"
          : "Borderline — some lenders may require more",
      };
    if (dy > 0)
      return {
        text: "text-destructive",
        ring: "ring-destructive/40",
        bg: "bg-destructive/10",
        label: isEs ? "Por debajo de los mínimos típicos" : "Below typical lender minimums",
      };
    return {
      text: "text-muted-foreground",
      ring: "ring-border",
      bg: "bg-muted/40",
      label: isEs ? "Ingresa tus números" : "Enter your numbers",
    };
  }

  const v = verdictStyle(debtYield);

  const dealReviewUrl = useMemo(
    () =>
      buildDealReviewUrl(
        {
          source: "debt-yield-calculator",
          annualNoi: noi > 0 ? Math.round(noi) : undefined,
          loanAmount: loan > 0 ? Math.round(loan) : undefined,
          purpose: "acquisition",
        },
        isEs,
      ),
    [isEs, loan, noi],
  );

  const analysisSummary = useMemo(() => {
    if (debtYield <= 0) return undefined;
    return {
      "Debt yield": `${debtYield.toFixed(2)}%`,
      Verdict: v.label,
      NOI: fmtUSD(noi),
      "Loan amount": fmtUSD(loan),
    };
  }, [debtYield, loan, noi, v.label]);

  const sourcePage = isEs ? "/es/tools/debt-yield-calculator" : "/tools/debt-yield-calculator";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-accent/50 via-accent/20 to-primary/20 p-[1.5px] shadow-lg">
        <div className="rounded-2xl bg-card">
          <div className="grid gap-0 lg:grid-cols-5">
            {/* Inputs */}
            <div className="lg:col-span-3 p-5 md:p-7 border-b lg:border-b-0 lg:border-r border-border">
              <p className="text-xs font-bold uppercase tracking-wider text-accent">
                {isEs ? "Rendimiento de deuda" : "Debt yield"}
              </p>
              <h2 className="text-xl md:text-2xl font-bold text-foreground mt-0.5 mb-5">
                {isEs ? "Ingresa las métricas de la operación" : "Enter deal metrics"}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="noi"
                  label={isEs ? "Ingreso operativo neto (anual)" : "Net operating income (annual)"}
                  prefix="$"
                  value={f.noi}
                  onChange={(v) => update("noi", v)}
                  hint={isEs ? "NOI = ingresos brutos − gastos operativos" : "NOI = gross income − operating expenses"}
                />
                <Field
                  id="loanAmount"
                  label={isEs ? "Monto del préstamo" : "Loan amount"}
                  prefix="$"
                  value={f.loanAmount}
                  onChange={(v) => update("loanAmount", v)}
                  hint={isEs ? "Saldo hipotecario propuesto o existente" : "Proposed or existing mortgage balance"}
                />
              </div>

              <div className="mt-5 rounded-lg bg-secondary/60 p-4 text-sm">
                <p className="font-semibold text-foreground mb-1">{isEs ? "Fórmula" : "Formula"}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {isEs
                    ? "Rendimiento de Deuda = NOI / Monto del Préstamo × 100"
                    : "Debt Yield = NOI / Loan Amount × 100"}
                </p>
                {noi > 0 && loan > 0 && (
                  <p className="font-mono text-xs text-accent mt-1">
                    = {fmtUSD(noi)} / {fmtUSD(loan)} × 100 = {debtYield.toFixed(2)}%
                  </p>
                )}
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
                {isEs ? "Resultado" : "Result"}
              </p>

              <div className={cn("rounded-xl p-5 ring-2", v.ring, v.bg)}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {isEs ? "Rendimiento de deuda" : "Debt yield"}
                </p>
                <div className={cn("text-6xl font-bold tabular-nums tracking-tight mt-1", v.text)}>
                  {debtYield > 0 ? `${debtYield.toFixed(2)}%` : "—"}
                </div>
                <p className={cn("mt-2 text-sm font-semibold", v.text)}>{v.label}</p>
              </div>

              {/* Benchmark comparison */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isEs ? "Referencias de prestamistas" : "Lender benchmarks"}
                </p>
                {BENCHMARKS.map((b) => (
                  <div key={b.threshold} className="flex items-center justify-between text-sm">
                    <span className="text-xs text-muted-foreground">{b.label}</span>
                    <span className={cn("text-xs font-bold", debtYield >= b.threshold ? "text-success" : "text-destructive")}>
                      {debtYield > 0
                        ? debtYield >= b.threshold
                          ? isEs ? "Cumple" : "Meets"
                          : isEs ? "No cumple" : "Below"
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>

              {debtYield > 0 && debtYield < 9 && (
                <div className="rounded-lg bg-destructive/10 ring-1 ring-destructive/30 p-3 text-xs text-muted-foreground">
                  <strong className="text-destructive">{isEs ? "Para llegar al 9%:" : "To reach 9%:"}</strong>{" "}
                  {isEs
                    ? <>El NOI debe ser al menos {fmtUSD(loan * 0.09)}/año, o reduce el préstamo a {fmtUSD(noi / 0.09)}.</>
                    : <>NOI needs to be at least {fmtUSD(loan * 0.09)}/yr, or reduce loan to {fmtUSD(noi / 0.09)}.</>}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border bg-secondary/40 rounded-b-2xl p-5 md:p-7">
            <div className="flex items-start gap-3">
              <Info className="size-5 shrink-0 text-accent mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isEs
                  ? "El rendimiento de deuda mide el retorno que un prestamista obtendría si recuperara la propiedad por ejecución hipotecaria. Es independiente de la tasa — a diferencia del DSCR — por lo que los prestamistas comerciales lo usan como métrica de respaldo junto con LTV y DSCR. Un rendimiento de deuda de 9–12% es típico para multifamiliares de 5+ unidades y préstamos puente comerciales."
                  : "Debt yield measures the return a lender would earn if it took the property back in foreclosure. It's rate-agnostic — unlike DSCR — so commercial lenders often use it as a backstop underwriting metric alongside LTV and DSCR. A 9–12% debt yield is typical for 5+ unit multifamily and commercial bridge lending."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {analysisSummary && (
        <EmailAnalysisCapture
          analysisType={isEs ? "Rendimiento de deuda" : "Debt yield"}
          analysisSummary={analysisSummary}
          lang={isEs ? "es" : "en"}
          sourcePage={sourcePage}
        />
      )}

      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 p-6 md:p-8 text-primary-foreground">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">
              {isEs ? "¿Quiere una lectura de encaje real?" : "Want a real lender-fit read?"}
            </h3>
            <p className="mt-1 text-sm opacity-80">
              {isEs
                ? "Envíe NOI y monto de préstamo para una revisión gratuita — usualmente en una hora hábil. Sin consulta de crédito."
                : "Submit NOI and loan amount for a free underwriting review — usually within one business hour. No credit pull."}
            </p>
          </div>
          <Button asChild variant="cta" size="lg" className="shrink-0">
            <a href={dealReviewUrl}>
              {isEs ? "Solicitar revisión gratuita" : "Get free deal review"} <ArrowRight className="size-4" />
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

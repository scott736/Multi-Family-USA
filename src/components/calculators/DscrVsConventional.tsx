"use client";

import {
  ArrowRight,
  CheckCircle2,
  Copy,
  RotateCcw,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtUSD, monthlyPI, parseNum, remainingBalance } from "@/lib/finance";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const amortizedPI = (principal: number, annualRatePct: number, years = 30) =>
  monthlyPI(principal, annualRatePct, years * 12);

function totalInterestAt(months: number, principal: number, rate: number, pi: number) {
  const remaining = remainingBalance(principal, rate, 360, months);
  const principalPaid = principal - remaining;
  return pi * months - principalPaid;
}

/* -------------------------------------------------------------------------- */
/*  Rate estimators                                                           */
/* -------------------------------------------------------------------------- */

function estimateDscrRate({
  fico,
  ltv,
  dscr,
}: {
  fico: number;
  ltv: number;
  dscr: number;
}) {
  let base = 6.75;
  if (fico < 680) base += 0.5;
  if (fico < 660) base += 0.25;
  if (fico >= 740) base -= 0.125;
  if (fico >= 760) base -= 0.125;
  if (ltv > 75) base += 0.25;
  if (ltv > 80) base += 0.5;
  if (dscr > 0 && dscr < 1.0) base += 0.375;
  if (dscr > 0 && dscr < 0.75) base += 0.25;
  if (dscr >= 1.25) base -= 0.125;
  return base;
}

function estimateConventionalRate({ fico, ltv }: { fico: number; ltv: number }) {
  let base = 6.5; // investment conventional baseline
  if (fico < 680) base += 0.5;
  if (fico < 660) base += 0.5;
  if (fico >= 740) base -= 0.125;
  if (fico >= 760) base -= 0.125;
  if (ltv > 75) base += 0.25;
  if (ltv > 80) base += 0.625; // investment LLPA heavier
  return base;
}

/* -------------------------------------------------------------------------- */
/*  Types & state                                                             */
/* -------------------------------------------------------------------------- */

interface Fields {
  propertyValue: string;
  downPct: string;
  rent: string;
  tax: string;
  ins: string;
  hoa: string;
  fico: string;
  w2Income: string;
  monthlyDebts: string;
  purpose: "purchase" | "cash-out-refi" | "rate-term-refi";
}

const DEFAULTS: Fields = {
  propertyValue: "350000",
  downPct: "25",
  rent: "2950",
  tax: "320",
  ins: "130",
  hoa: "0",
  fico: "730",
  w2Income: "9500",
  monthlyDebts: "1800",
  purpose: "purchase",
};

interface DscrVsConventionalProps {
  lang?: "en" | "es";
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function DscrVsConventional({
  lang = "en",
}: DscrVsConventionalProps = {}) {
  const isEs = lang === "es";
  const [f, setF] = useState<Fields>(DEFAULTS);
  const [rentBump, setRentBump] = useState(0); // % bump scenario
  const [copied, setCopied] = useState(false);

  const t = isEs
    ? {
        dealInputs: "Datos de la operación",
        compareSideBySide: "Comparar lado a lado",
        reset: "Restablecer",
        copied: "¡Copiado!",
        share: "Compartir",
        propertyValue: "Valor de la propiedad",
        downPaymentPct: "Enganche (%)",
        ltvLine: (ltv: string, loan: string) => (
          <>LTV: <strong>{ltv}%</strong> · Préstamo: <strong>{loan}</strong></>
        ),
        monthlyRent: "Renta mensual",
        monthlyTax: "Impuestos mensuales",
        monthlyIns: "Seguro mensual",
        monthlyHoa: "HOA mensual",
        fico: "FICO",
        w2Income: "Ingreso W-2 mensual",
        w2IncomeHint: "Para cálculo de DTI",
        monthlyDebts: "Otras deudas mensuales",
        monthlyDebtsHint: "Tarjetas, auto, estudiantil, otras hipotecas",
        loanPurpose: "Propósito del préstamo",
        purchase: "Compra",
        cashOutRefi: "Refinanciamiento con retiro de efectivo",
        rateTermRefi: "Refinanciamiento de tasa y plazo",
        recommendation: "Recomendación",
        winnerDscr: "El préstamo DSCR gana en tu escenario",
        winnerConv: "El préstamo convencional gana en tu escenario",
        winnerTie: "Se necesita reestructurar — ninguno califica claramente",
        reasonDscrBelow1: "DSCR por debajo de 1.00 — el convencional es tu única ruta clara.",
        reasonDtiExceeds: (dti: string) =>
          `Un DTI de ${dti}% supera el límite del 45% del convencional — DSCR califica sin tocar tus ingresos personales.`,
        reasonConvCheaper: (saved: string, dti: string) =>
          `El convencional ahorra ~${saved} en intereses durante 10 años y tu DTI (${dti}%) tiene margen. El convencional gana en precio puro.`,
        reasonDscrFlex: (dti: string) =>
          `El DSCR no afecta tu DTI personal (el tuyo es ${dti}%) y mantiene libre el cupo de 10 propiedades de Fannie para una residencia principal o segunda casa. Pequeño premio en tasa, gran flexibilidad de portafolio.`,
        reasonNeither:
          "Ningún programa califica como está estructurado. Considera un DSCR sin ratio o préstamo de portafolio, o reestructura la operación (más enganche, otra propiedad).",
        dscrLoan: "Préstamo DSCR",
        conventional: "Convencional",
        winner: "Ganador",
        dscrRatio: "Ratio DSCR",
        qualifiesAt100: "¿Califica a 1.00?",
        qualifiesAt125: "¿Califica a 1.25?",
        yes: "Sí",
        no: "No",
        estimatedRate: "Tasa estimada",
        monthlyPi: "P&I mensual",
        monthlyPitia: "PITIA mensual",
        maxLtv: "LTV máximo",
        closeTimeline: "Tiempo de cierre",
        dscrCloseTime: "30–45 días",
        convCloseTime: "25–40 días",
        documentation: "Documentación",
        dscrDocs: "Solo la propiedad",
        convDocs: "W-2 + declaraciones de impuestos + extractos bancarios",
        hitsPersonalDti: "¿Afecta DTI personal?",
        fannieCap: "Límite Fannie de 10 propiedades",
        fannieCapValue: "Sí — cuenta",
        interest5: "Intereses · 5 años",
        interest10: "Intereses · 10 años",
        interest30: "Intereses · 30 años",
        pppTypical: "PPP (típico)",
        pppDscr: "3-3-3 o 5/4/3/2/1",
        ppp: "PPP",
        pppNone: "Ninguno",
        dti: "DTI",
        qualifiesAt45: "¿Califica al límite del 45%?",
        scenarioExplorer: "Explorador de escenarios",
        scenarioDescription: "¿Qué pasa si tu renta sube? Arrastra para volver a calcular ambos préstamos.",
        rentChange: "Cambio en renta:",
        newRent: "Nueva renta:",
        fullComparisonTitle: "DSCR vs Convencional — comparación completa",
        factor: "Factor",
        compareRows: [
          { label: "Base de calificación", dscr: "Flujo de caja de la propiedad", conv: "Ingreso personal (DTI)" },
          { label: "Documentos de ingresos", dscr: "Ninguno", conv: "2 años W-2, declaraciones, talones" },
          { label: "Límite DTI", dscr: "N/A", conv: "45–50%" },
          { label: "FICO mínimo", dscr: "620 típico", conv: "620 típico" },
          { label: "Enganche mínimo (compra)", dscr: "20–25%", conv: "15–25%" },
          { label: "LTV máx. compra", dscr: "80%", conv: "85% con PMI (casi residencial)" },
          { label: "LTV máx. cash-out", dscr: "75%", conv: "75%" },
          { label: "Tipos de propiedad", dscr: "SFR, 2–4, 5–10, condo, STR", conv: "SFR, 2–4, condo" },
          { label: "Titularidad", dscr: "Personal o LLC", conv: "Solo personal" },
          { label: "Reservas", dscr: "3–6 meses de PITIA", conv: "2–6 meses de PITIA" },
          { label: "Límite Fannie 10 préstamos", dscr: "No aplica", conv: "Aplica — tope estricto en 10" },
          { label: "Penalidad por prepago", dscr: "Típicamente 3–5 años", conv: "Ninguna" },
          { label: "Tiempo de cierre", dscr: "30–45 días", conv: "25–40 días" },
          { label: "Tasa vs comparable", dscr: "+0.25–0.75%", conv: "Base más baja" },
          { label: "Extranjeros no residentes", dscr: "Sí (varios prestamistas)", conv: "No" },
        ],
        ctaTitle: "Encuentra la mejor opción para TU escenario",
        ctaSubtitle: "Comparamos programas DSCR y convencionales para inversionistas lado a lado — gratis, sin verificación de crédito.",
        ctaButton: "Ver mis ofertas",
      }
    : {
        dealInputs: "Deal inputs",
        compareSideBySide: "Compare side-by-side",
        reset: "Reset",
        copied: "Copied!",
        share: "Share",
        propertyValue: "Property value",
        downPaymentPct: "Down payment (%)",
        ltvLine: (ltv: string, loan: string) => (
          <>LTV: <strong>{ltv}%</strong> · Loan: <strong>{loan}</strong></>
        ),
        monthlyRent: "Monthly rent",
        monthlyTax: "Monthly tax",
        monthlyIns: "Monthly insurance",
        monthlyHoa: "Monthly HOA",
        fico: "FICO",
        w2Income: "Monthly W-2 income",
        w2IncomeHint: "For DTI calc",
        monthlyDebts: "Other monthly debts",
        monthlyDebtsHint: "Cards, auto, student, other mortgages",
        loanPurpose: "Loan purpose",
        purchase: "Purchase",
        cashOutRefi: "Cash-out refinance",
        rateTermRefi: "Rate/term refinance",
        recommendation: "Recommendation",
        winnerDscr: "DSCR loan wins for your scenario",
        winnerConv: "Conventional wins for your scenario",
        winnerTie: "Restructure needed — neither qualifies cleanly",
        reasonDscrBelow1: "DSCR below 1.00 — conventional is your only clean path.",
        reasonDtiExceeds: (dti: string) =>
          `DTI of ${dti}% exceeds the 45% conventional cap — DSCR qualifies without touching personal income.`,
        reasonConvCheaper: (saved: string, dti: string) =>
          `Conventional saves ~${saved} in interest over 10 years and your DTI (${dti}%) has room. Conventional wins on pure pricing.`,
        reasonDscrFlex: (dti: string) =>
          `DSCR doesn't hit your personal DTI (yours is ${dti}%) and keeps the Fannie 10-property slot open for a primary or 2nd home. Small rate premium, big portfolio flexibility.`,
        reasonNeither:
          "Neither program qualifies as structured. Consider a no-ratio DSCR or portfolio loan, or restructure the deal (more down, different property).",
        dscrLoan: "DSCR loan",
        conventional: "Conventional",
        winner: "Winner",
        dscrRatio: "DSCR ratio",
        qualifiesAt100: "Qualifies at 1.00?",
        qualifiesAt125: "Qualifies at 1.25?",
        yes: "Yes",
        no: "No",
        estimatedRate: "Estimated rate",
        monthlyPi: "Monthly P&I",
        monthlyPitia: "Monthly PITIA",
        maxLtv: "Max LTV",
        closeTimeline: "Close timeline",
        dscrCloseTime: "30–45 days",
        convCloseTime: "25–40 days",
        documentation: "Documentation",
        dscrDocs: "Property only",
        convDocs: "W-2 + tax returns + bank stmts",
        hitsPersonalDti: "Hits personal DTI?",
        fannieCap: "Fannie 10-property cap",
        fannieCapValue: "Yes — counts",
        interest5: "Interest · 5 years",
        interest10: "Interest · 10 years",
        interest30: "Interest · 30 years",
        pppTypical: "PPP (typical)",
        pppDscr: "3-3-3 or 5/4/3/2/1",
        ppp: "PPP",
        pppNone: "None",
        dti: "DTI",
        qualifiesAt45: "Qualifies at 45% cap?",
        scenarioExplorer: "Scenario explorer",
        scenarioDescription: "What happens if your rent rises? Drag to re-run both loans.",
        rentChange: "Rent change:",
        newRent: "New rent:",
        fullComparisonTitle: "DSCR vs Conventional — full comparison",
        factor: "Factor",
        compareRows: [
          { label: "Qualification basis", dscr: "Property cash flow", conv: "Personal income (DTI)" },
          { label: "Income docs", dscr: "None", conv: "2 yrs W-2, tax returns, paystubs" },
          { label: "DTI cap", dscr: "N/A", conv: "45–50%" },
          { label: "Min FICO", dscr: "620 typical", conv: "620 typical" },
          { label: "Min down (purchase)", dscr: "20–25%", conv: "15–25%" },
          { label: "Max LTV purchase", dscr: "80%", conv: "85% with PMI (primary-ish)" },
          { label: "Max LTV cash-out", dscr: "75%", conv: "75%" },
          { label: "Property types", dscr: "SFR, 2–4, 5–10, condo, STR", conv: "SFR, 2–4, condo" },
          { label: "Vesting", dscr: "Personal or LLC", conv: "Personal only" },
          { label: "Reserves", dscr: "3–6 months PITIA", conv: "2–6 months PITIA" },
          { label: "Fannie 10-loan cap", dscr: "Does not apply", conv: "Applies — hard stop at 10" },
          { label: "Prepay penalty", dscr: "Typical 3–5 years", conv: "None" },
          { label: "Close timeline", dscr: "30–45 days", conv: "25–40 days" },
          { label: "Rate vs comparable", dscr: "+0.25–0.75%", conv: "Lower baseline" },
          { label: "Foreign nationals", dscr: "Yes (many lenders)", conv: "No" },
        ],
        ctaTitle: "Get matched with the best option for YOUR scenario",
        ctaSubtitle:
          "We shop DSCR and conventional investor programs side-by-side — free, no credit pull.",
        ctaButton: "See my offers",
      };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const next = { ...DEFAULTS };
    let touched = false;
    (Object.keys(DEFAULTS) as (keyof Fields)[]).forEach((k) => {
      const v = p.get(k);
      if (v != null) {
        touched = true;
        (next[k] as string) = v;
      }
    });
    if (touched) setF(next);
  }, []);

  const r = useMemo(() => {
    const value = parseNum(f.propertyValue);
    const downPct = parseNum(f.downPct);
    const ltv = Math.max(0, 100 - downPct);
    const loan = value * (ltv / 100);
    const rent = parseNum(f.rent) * (1 + rentBump / 100);
    const tax = parseNum(f.tax);
    const ins = parseNum(f.ins);
    const hoa = parseNum(f.hoa);
    const tiHoa = tax + ins + hoa;
    const fico = parseNum(f.fico);
    const income = parseNum(f.w2Income);
    const existingDebts = parseNum(f.monthlyDebts);

    /* DSCR side */
    const dscrRate1 = estimateDscrRate({ fico, ltv, dscr: 1.0 });
    const dscrPi1 = amortizedPI(loan, dscrRate1, 30);
    const dscrPitia1 = dscrPi1 + tiHoa;
    const dscrRatio1 = dscrPitia1 > 0 ? rent / dscrPitia1 : 0;

    const dscrRate = estimateDscrRate({ fico, ltv, dscr: dscrRatio1 });
    const dscrPi = amortizedPI(loan, dscrRate, 30);
    const dscrPitia = dscrPi + tiHoa;
    const dscr = dscrPitia > 0 ? rent / dscrPitia : 0;

    const dscrMaxLtv = f.purpose === "cash-out-refi" ? 75 : 80;
    const dscrQualifies10 = dscr >= 1.0;
    const dscrQualifies125 = dscr >= 1.25;

    /* Conventional side */
    const convRate = estimateConventionalRate({ fico, ltv });
    const convPi = amortizedPI(loan, convRate, 30);
    const dtiNumerator = existingDebts + convPi + tiHoa;
    const dti = income > 0 ? (dtiNumerator / income) * 100 : 0;
    const convQualifies = income > 0 && dti <= 45;
    const convMaxLtv =
      f.purpose === "cash-out-refi"
        ? 75
        : f.purpose === "rate-term-refi"
        ? 75
        : 80;

    /* Interest totals */
    const dscr5 = totalInterestAt(60, loan, dscrRate, dscrPi);
    const dscr10 = totalInterestAt(120, loan, dscrRate, dscrPi);
    const dscr30 = dscrPi * 360 - loan;

    const conv5 = totalInterestAt(60, loan, convRate, convPi);
    const conv10 = totalInterestAt(120, loan, convRate, convPi);
    const conv30 = convPi * 360 - loan;

    /* Winner logic */
    let winner: "dscr" | "conv" | "tie" = "tie";
    let reason: string = "";

    if (!dscrQualifies10 && convQualifies) {
      winner = "conv";
      reason = t.reasonDscrBelow1;
    } else if (!convQualifies && dscrQualifies10) {
      winner = "dscr";
      reason = t.reasonDtiExceeds(dti.toFixed(0));
    } else if (convQualifies && dscrQualifies10) {
      // both qualify — lower 10-year interest + lifestyle factors
      const convCheaper10 = conv10 < dscr10;
      if (convCheaper10 && dti < 40) {
        winner = "conv";
        reason = t.reasonConvCheaper(fmtUSD(dscr10 - conv10), dti.toFixed(0));
      } else {
        winner = "dscr";
        reason = t.reasonDscrFlex(dti.toFixed(0));
      }
    } else {
      winner = "tie";
      reason = t.reasonNeither;
    }

    return {
      value,
      loan,
      ltv,
      rent,
      tiHoa,
      dti,
      fico,
      dscr: {
        rate: dscrRate,
        pi: dscrPi,
        pitia: dscrPitia,
        ratio: dscr,
        qualifies10: dscrQualifies10,
        qualifies125: dscrQualifies125,
        maxLtv: dscrMaxLtv,
        int5: dscr5,
        int10: dscr10,
        int30: dscr30,
      },
      conv: {
        rate: convRate,
        pi: convPi,
        qualifies: convQualifies,
        maxLtv: convMaxLtv,
        int5: conv5,
        int10: conv10,
        int30: conv30,
      },
      winner,
      reason,
    };
  }, [f, rentBump, t]);

  function update<K extends keyof Fields>(k: K, v: Fields[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  function reset() {
    setF(DEFAULTS);
    setRentBump(0);
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }

  function copyLink() {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams();
    (Object.keys(f) as (keyof Fields)[]).forEach((k) =>
      p.set(k, String(f[k])),
    );
    const url = `${window.location.origin}${window.location.pathname}?${p.toString()}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/30 via-accent/20 to-primary/30 p-[1.5px] shadow-lg">
        <div className="rounded-2xl bg-card p-5 md:p-7">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-accent">
                {t.dealInputs}
              </p>
              <h2 className="text-xl md:text-2xl font-bold text-foreground mt-0.5">
                {t.compareSideBySide}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="size-3.5" />
                {t.reset}
              </Button>
              <Button variant="ghost" size="sm" onClick={copyLink}>
                <Copy className="size-3.5" />
                {copied ? t.copied : t.share}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <Money id="propertyValue" label={t.propertyValue} value={f.propertyValue} onChange={(v) => update("propertyValue", v)} />
            <div className="grid gap-1.5">
              <Label htmlFor="downPct" className="text-xs font-medium">
                {t.downPaymentPct}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                <Input
                  id="downPct"
                  inputMode="decimal"
                  className="pl-7 tabular-nums"
                  value={f.downPct}
                  onChange={(e) => update("downPct", e.target.value.replace(/[^0-9.]/g, ""))}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t.ltvLine(r.ltv.toFixed(0), fmtUSD(r.loan))}
              </p>
            </div>
            <Money id="rent" label={t.monthlyRent} value={f.rent} onChange={(v) => update("rent", v)} />
            <Money id="tax" label={t.monthlyTax} value={f.tax} onChange={(v) => update("tax", v)} />
            <Money id="ins" label={t.monthlyIns} value={f.ins} onChange={(v) => update("ins", v)} />
            <Money id="hoa" label={t.monthlyHoa} value={f.hoa} onChange={(v) => update("hoa", v)} />
            <div className="grid gap-1.5">
              <Label htmlFor="fico" className="text-xs font-medium">{t.fico}</Label>
              <Input
                id="fico"
                inputMode="numeric"
                className="tabular-nums"
                value={f.fico}
                onChange={(e) => update("fico", e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
            <Money id="w2Income" label={t.w2Income} value={f.w2Income} onChange={(v) => update("w2Income", v)} hint={t.w2IncomeHint} />
            <Money id="monthlyDebts" label={t.monthlyDebts} value={f.monthlyDebts} onChange={(v) => update("monthlyDebts", v)} hint={t.monthlyDebtsHint} />
            <div className="grid gap-1.5 sm:col-span-2 md:col-span-3">
              <Label htmlFor="purpose" className="text-xs font-medium">{t.loanPurpose}</Label>
              <select
                id="purpose"
                value={f.purpose}
                onChange={(e) =>
                  update("purpose", e.target.value as Fields["purpose"])
                }
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="purchase">{t.purchase}</option>
                <option value="cash-out-refi">{t.cashOutRefi}</option>
                <option value="rate-term-refi">{t.rateTermRefi}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Winner card */}
      <div
        className={cn(
          "rounded-2xl p-6 md:p-8 ring-2 shadow-md",
          r.winner === "dscr" && "bg-success/10 ring-success/40",
          r.winner === "conv" && "bg-primary/10 ring-primary/40",
          r.winner === "tie" && "bg-amber-500/10 ring-amber-500/40",
        )}
      >
        <div className="flex items-start md:items-center gap-3 md:gap-4">
          <div
            className={cn(
              "rounded-full p-2.5 shrink-0",
              r.winner === "dscr" && "bg-success text-success-foreground",
              r.winner === "conv" && "bg-primary text-primary-foreground",
              r.winner === "tie" && "bg-amber-500 text-white",
            )}
          >
            <Trophy className="size-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t.recommendation}
            </p>
            <h3 className="mt-0.5 text-xl md:text-2xl font-bold text-foreground">
              {r.winner === "dscr" && t.winnerDscr}
              {r.winner === "conv" && t.winnerConv}
              {r.winner === "tie" && t.winnerTie}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {r.reason}
            </p>
          </div>
        </div>
      </div>

      {/* Side-by-side cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* DSCR */}
        <div
          className={cn(
            "rounded-2xl border-2 bg-card p-5 md:p-7 transition",
            r.winner === "dscr"
              ? "border-success shadow-lg"
              : "border-border",
          )}
        >
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="text-lg font-bold text-foreground">{t.dscrLoan}</h3>
            {r.winner === "dscr" && (
              <span className="flex items-center gap-1 text-xs font-semibold text-success">
                <CheckCircle2 className="size-4" />
                {t.winner}
              </span>
            )}
          </div>
          <dl className="space-y-2.5 text-sm">
            <KV label={t.dscrRatio} value={r.dscr.ratio > 0 ? r.dscr.ratio.toFixed(2) : "—"} strong />
            <KV
              label={t.qualifiesAt100}
              value={r.dscr.qualifies10 ? t.yes : t.no}
              accent={r.dscr.qualifies10 ? "good" : "bad"}
            />
            <KV
              label={t.qualifiesAt125}
              value={r.dscr.qualifies125 ? t.yes : t.no}
              accent={r.dscr.qualifies125 ? "good" : "bad"}
            />
            <KV label={t.estimatedRate} value={`${r.dscr.rate.toFixed(3)}%`} strong />
            <KV label={t.monthlyPi} value={fmtUSD(r.dscr.pi)} />
            <KV label={t.monthlyPitia} value={fmtUSD(r.dscr.pitia)} />
            <KV label={t.maxLtv} value={`${r.dscr.maxLtv}%`} />
            <KV label={t.closeTimeline} value={t.dscrCloseTime} />
            <KV label={t.documentation} value={t.dscrDocs} />
            <KV label={t.hitsPersonalDti} value={t.no} accent="good" />
            <KV label={t.interest5} value={fmtUSD(r.dscr.int5)} />
            <KV label={t.interest10} value={fmtUSD(r.dscr.int10)} />
            <KV label={t.interest30} value={fmtUSD(r.dscr.int30)} />
            <KV label={t.pppTypical} value={t.pppDscr} />
          </dl>
        </div>

        {/* Conventional */}
        <div
          className={cn(
            "rounded-2xl border-2 bg-card p-5 md:p-7 transition",
            r.winner === "conv"
              ? "border-primary shadow-lg"
              : "border-border",
          )}
        >
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="text-lg font-bold text-foreground">{t.conventional}</h3>
            {r.winner === "conv" && (
              <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                <CheckCircle2 className="size-4" />
                {t.winner}
              </span>
            )}
          </div>
          <dl className="space-y-2.5 text-sm">
            <KV label={t.dti} value={`${r.dti.toFixed(1)}%`} strong />
            <KV
              label={t.qualifiesAt45}
              value={r.conv.qualifies ? t.yes : t.no}
              accent={r.conv.qualifies ? "good" : "bad"}
            />
            <KV label={t.estimatedRate} value={`${r.conv.rate.toFixed(3)}%`} strong />
            <KV label={t.monthlyPi} value={fmtUSD(r.conv.pi)} />
            <KV label={t.maxLtv} value={`${r.conv.maxLtv}%`} />
            <KV label={t.closeTimeline} value={t.convCloseTime} />
            <KV label={t.documentation} value={t.convDocs} />
            <KV label={t.hitsPersonalDti} value={t.yes} accent="bad" />
            <KV label={t.fannieCap} value={t.fannieCapValue} accent="bad" />
            <KV label={t.interest5} value={fmtUSD(r.conv.int5)} />
            <KV label={t.interest10} value={fmtUSD(r.conv.int10)} />
            <KV label={t.interest30} value={fmtUSD(r.conv.int30)} />
            <KV label={t.ppp} value={t.pppNone} accent="good" />
          </dl>
        </div>
      </div>

      {/* Scenario explorer */}
      <div className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/5 to-transparent p-5 md:p-7">
        <h3 className="text-lg font-bold text-foreground">{t.scenarioExplorer}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.scenarioDescription}
        </p>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-1.5">
            <span>{t.rentChange} <strong className="text-foreground tabular-nums">{rentBump >= 0 ? "+" : ""}{rentBump}%</strong></span>
            <span>{t.newRent} <strong className="text-foreground tabular-nums">{fmtUSD(r.rent)}</strong></span>
          </div>
          <input
            type="range"
            min={-15}
            max={25}
            step={1}
            value={rentBump}
            onChange={(e) => setRentBump(parseInt(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>−15%</span>
            <span>0%</span>
            <span>+25%</span>
          </div>
        </div>
      </div>

      {/* Full comparison table */}
      <div className="rounded-xl border border-border bg-card p-5 md:p-7">
        <h3 className="text-lg font-bold text-foreground mb-4">
          {t.fullComparisonTitle}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pr-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.factor}</th>
                <th className="py-2 pr-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">DSCR</th>
                <th className="py-2 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.conventional}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {t.compareRows.map((row, i) => (
                <CompareRow key={i} label={row.label} dscr={row.dscr} conv={row.conv} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 p-6 md:p-8 text-primary-foreground">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">
              {t.ctaTitle}
            </h3>
            <p className="mt-1 text-sm opacity-80">
              {t.ctaSubtitle}
            </p>
          </div>
          <Button asChild variant="cta" size="lg" className="shrink-0">
            <a href={isEs ? "/es/get-matched?source=dscr-vs-conv" : "/get-matched?source=dscr-vs-conv"}>
              {t.ctaButton}
              <ArrowRight className="size-4" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Subcomponents                                                             */
/* -------------------------------------------------------------------------- */

function Money({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className="pl-7 tabular-nums"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        />
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function KV({
  label,
  value,
  strong,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: "good" | "bad";
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          strong && "font-bold text-foreground",
          !strong && "text-foreground",
          accent === "good" && "text-success font-semibold",
          accent === "bad" && "text-destructive font-semibold",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function CompareRow({
  label,
  dscr,
  conv,
}: {
  label: string;
  dscr: string;
  conv: string;
}) {
  return (
    <tr>
      <td className="py-2 pr-4 font-semibold text-foreground">{label}</td>
      <td className="py-2 pr-4 text-muted-foreground">{dscr}</td>
      <td className="py-2 text-muted-foreground">{conv}</td>
    </tr>
  );
}

"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Info,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtUSD, monthlyPI, parseNum } from "@/lib/finance";

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const PROPERTY_TYPES_EN = [
  { value: "sfr", label: "Single-family (SFR)" },
  { value: "2-4", label: "2–4 unit" },
  { value: "5-10", label: "5–10 unit multifamily" },
  { value: "condo", label: "Condo" },
  { value: "str", label: "Short-term rental" },
] as const;

const PROPERTY_TYPES_ES = [
  { value: "sfr", label: "Unifamiliar (SFR)" },
  { value: "2-4", label: "2–4 unidades" },
  { value: "5-10", label: "Multifamiliar 5–10 unidades" },
  { value: "condo", label: "Condominio" },
  { value: "str", label: "Renta a corto plazo (STR)" },
] as const;

const LOAN_PURPOSES_EN = [
  { value: "purchase", label: "Purchase" },
  { value: "cash-out-refi", label: "Cash-out refinance" },
  { value: "rate-term-refi", label: "Rate/term refinance" },
] as const;

const LOAN_PURPOSES_ES = [
  { value: "purchase", label: "Compra" },
  { value: "cash-out-refi", label: "Refinanciamiento con retiro de efectivo" },
  { value: "rate-term-refi", label: "Refinanciamiento de tasa y plazo" },
] as const;

const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const amortizedPI = (principal: number, annualRatePct: number, years = 30) =>
  monthlyPI(principal, annualRatePct, years * 12);

/* -------------------------------------------------------------------------- */
/*  Rate estimation logic                                                     */
/* -------------------------------------------------------------------------- */

function estimateRate({
  fico,
  ltv,
  dscr,
  propertyType,
}: {
  fico: number;
  ltv: number;
  dscr: number;
  propertyType: string;
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

  if (propertyType === "2-4" || propertyType === "5-10") base += 0.25;
  if (propertyType === "str") base += 0.375;
  if (propertyType === "condo") base += 0.125;

  return { low: base - 0.125, high: base + 0.25, mid: base };
}

type LevelKey = "Strong" | "Good" | "Weak" | "Unlikely";

function qualificationLevel({
  dscr,
  fico,
  ltv,
  reserves,
  isEs,
}: {
  dscr: number;
  fico: number;
  ltv: number;
  reserves: number;
  isEs: boolean;
}): {
  key: LevelKey;
  label: string;
  color: string;
  bg: string;
  explanation: string;
} {
  let score = 0;
  if (dscr >= 1.25) score += 2;
  else if (dscr >= 1.0) score += 1;
  else if (dscr >= 0.75) score += 0;
  else score -= 2;

  if (fico >= 740) score += 2;
  else if (fico >= 700) score += 1;
  else if (fico >= 660) score += 0;
  else score -= 2;

  if (ltv <= 70) score += 1;
  else if (ltv <= 75) score += 0;
  else if (ltv <= 80) score -= 0;
  else score -= 2;

  if (reserves >= 6) score += 1;
  else if (reserves >= 3) score += 0;
  else score -= 1;

  if (score >= 4) {
    return {
      key: "Strong",
      label: isEs ? "Sólido" : "Strong",
      color: "text-success",
      bg: "bg-success/10 ring-success/40",
      explanation: isEs
        ? "Estás en el grupo más alto. Espera las mejores tasas del mercado, acceso al 80% de LTV y varias ofertas competitivas."
        : "You're in the top bucket. Expect best-in-market rates, 80% LTV access, and multiple competing offers.",
    };
  }
  if (score >= 2) {
    return {
      key: "Good",
      label: isEs ? "Bueno" : "Good",
      color: "text-yellow-600 dark:text-yellow-400",
      bg: "bg-yellow-500/10 ring-yellow-500/40",
      explanation: isEs
        ? "Expediente sólido. Acceso amplio a prestamistas con precios estándar. Pequeños ajustes — crédito, enganche, reservas — pueden llevarte a 'Sólido'."
        : "Solid file. Broad lender access at mainstream pricing. Small tweaks — credit, down, reserves — can push you to 'Strong'.",
    };
  }
  if (score >= 0) {
    return {
      key: "Weak",
      label: isEs ? "Débil" : "Weak",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10 ring-amber-500/40",
      explanation: isEs
        ? "Funcional pero limitado. El grupo de prestamistas se reduce a mesas especializadas. Espera ajustes a la tasa y límites de LTV más estrictos."
        : "Workable but thin. Lender pool narrows to specialty desks. Expect add-ons to rate and tighter LTV caps.",
    };
  }
  return {
    key: "Unlikely",
    label: isEs ? "Poco probable" : "Unlikely",
    color: "text-destructive",
    bg: "bg-destructive/10 ring-destructive/40",
    explanation: isEs
      ? "Los programas DSCR basados en ratio son poco probables. El camino a seguir es un producto sin ratio o de portafolio/extractos bancarios."
      : "Ratio-based DSCR programs are unlikely. Path forward is a no-ratio or portfolio/bank-statement product.",
  };
}

function lenderTierMatch(level: LevelKey, isEs: boolean) {
  if (level === "Strong")
    return isEs
      ? "15+ prestamistas DSCR nacionales compitiendo"
      : "15+ national DSCR lenders competing";
  if (level === "Good")
    return isEs ? "5+ prestamistas DSCR nacionales" : "5+ national DSCR lenders";
  if (level === "Weak")
    return isEs ? "2–3 prestamistas especializados" : "2–3 specialty lenders";
  return isEs
    ? "Solo préstamo sin ratio o de portafolio"
    : "No-ratio or portfolio loan only";
}

function probableLtvCap(fico: number, dscr: number): number {
  let cap = 80;
  if (fico < 720) cap = 75;
  if (fico < 680) cap = 70;
  if (fico < 660) cap = 70;
  if (dscr > 0 && dscr < 1.0) cap = Math.min(cap, 75);
  if (dscr > 0 && dscr < 0.75) cap = Math.min(cap, 70);
  return cap;
}

/* -------------------------------------------------------------------------- */
/*  State                                                                     */
/* -------------------------------------------------------------------------- */

interface Fields {
  propertyValue: string;
  downMode: "percent" | "dollar";
  downValue: string;
  rent: string;
  tiHoa: string;
  fico: string;
  propertyType: (typeof PROPERTY_TYPES_EN)[number]["value"];
  state: string;
  purpose: (typeof LOAN_PURPOSES_EN)[number]["value"];
  reserves: string;
}

const DEFAULTS: Fields = {
  propertyValue: "325000",
  downMode: "percent",
  downValue: "25",
  rent: "2750",
  tiHoa: "475",
  fico: "720",
  propertyType: "sfr",
  state: "FL",
  purpose: "purchase",
  reserves: "4",
};

interface QualificationEstimatorProps {
  lang?: "en" | "es";
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function QualificationEstimator({
  lang = "en",
}: QualificationEstimatorProps = {}) {
  const isEs = lang === "es";
  const [f, setF] = useState<Fields>(DEFAULTS);
  const [copied, setCopied] = useState(false);

  const t = isEs
    ? {
        qualificationInputs: "Datos de calificación",
        dealProfile: "Perfil de tu operación",
        propertyAndLoan: "Propiedad y préstamo",
        propertyValueLabel: "Valor de la propiedad / Precio de compra",
        downPayment: "Enganche",
        impliedLtv: "LTV implícito:",
        incomeAndExpenses: "Ingresos y gastos",
        monthlyRent: "Renta mensual",
        monthlyTiHoa: "Impuestos + seguro + HOA mensuales",
        tiHoaHint: "Total mensual — nosotros agregamos el P&I",
        borrowerProfile: "Perfil del prestatario",
        creditScore: "Puntaje de crédito",
        ficoHint: "Puntaje medio de los tres burós, 580–850",
        reservesLabel: "Reservas (meses de PITIA)",
        reservesHint: "Efectivo + activos líquidos elegibles",
        dealStructure: "Estructura de la operación",
        propertyType: "Tipo de propiedad",
        state: "Estado",
        loanPurpose: "Propósito del préstamo",
        reset: "Restablecer",
        copied: "¡Copiado!",
        copyShareableLink: "Copiar enlace para compartir",
        estimatedQualification: "Calificación estimada",
        estimatedDscr: "DSCR estimado",
        estimatedRateRange: "Rango de tasa estimada",
        probableLtvCap: "Límite probable de LTV",
        loanAmount: "Monto del préstamo",
        estMonthlyPi: "P&I mensual estimado",
        estMonthlyPitia: "PITIA mensual estimado",
        strengths: "Fortalezas",
        redFlags: "Señales de alerta",
        noStrengths: "Aún no hay fortalezas destacadas — primero ajusta una de las señales de alerta.",
        cleanFile: "Expediente limpio — no se activaron señales de alerta.",
        howWeEstimate: "Cómo estimamos",
        estimateExplanation:
          "Las tasas comienzan en una base del 6.75% (FICO 720, LTV 75%, DSCR 1.10, SFR) y se ajustan ±0.125–0.75% por factor. Las cotizaciones reales dependen del periodo de tenencia, reservas, estado y prestamista. Esta es una estimación inicial sólida — no un bloqueo de tasa.",
        ctaTitle: "Obtén una cotización real — sin verificación de crédito",
        ctaSubtitle: "1,000+ prestamistas compiten en una hora hábil",
        ctaButton: "Ver mis cotizaciones",
        // Red flag/strength messages
        redFlagDscr075: "DSCR por debajo de 0.75 — la mayoría de programas con ratio rechazan",
        redFlagFico660: "Crédito por debajo de 660 — se acumulan ajustes a la tasa",
        redFlagReserves: "Reservas menores a 2 meses — podría no cumplir el mínimo",
        redFlagLtv: (cap: number) => `LTV por encima del límite probable de ${cap}%`,
        redFlagStr: "STR con FICO menor a 680 — grupo de prestamistas muy reducido",
        strengthDscr125: "DSCR ≥ 1.25 — califica para el mejor nivel de precio",
        strengthFico740: "Crédito ≥ 740 — ajustes de precio de nivel superior",
        strengthReserves: "Reservas ≥ 6 meses — factor compensatorio fuerte",
        strengthDown30: "Enganche del 30%+ — desbloquea precios agresivos",
        strengthPurchase: "Compra con DSCR de 1.00+ — acceso amplio a prestamistas",
      }
    : {
        qualificationInputs: "Qualification inputs",
        dealProfile: "Your deal profile",
        propertyAndLoan: "Property & loan",
        propertyValueLabel: "Property value / purchase price",
        downPayment: "Down payment",
        impliedLtv: "Implied LTV:",
        incomeAndExpenses: "Income & expenses",
        monthlyRent: "Monthly rent",
        monthlyTiHoa: "Monthly taxes + insurance + HOA",
        tiHoaHint: "Combined monthly — we add P&I ourselves",
        borrowerProfile: "Borrower profile",
        creditScore: "Credit score",
        ficoHint: "Mid of tri-merge, 580–850",
        reservesLabel: "Reserves (months of PITIA)",
        reservesHint: "Cash + eligible liquid assets",
        dealStructure: "Deal structure",
        propertyType: "Property type",
        state: "State",
        loanPurpose: "Loan purpose",
        reset: "Reset",
        copied: "Copied!",
        copyShareableLink: "Copy shareable link",
        estimatedQualification: "Estimated qualification",
        estimatedDscr: "Estimated DSCR",
        estimatedRateRange: "Estimated rate range",
        probableLtvCap: "Probable LTV cap",
        loanAmount: "Loan amount",
        estMonthlyPi: "Est. monthly P&I",
        estMonthlyPitia: "Est. monthly PITIA",
        strengths: "Strengths",
        redFlags: "Red flags",
        noStrengths: "No standout strengths yet — tighten one of the red flags first.",
        cleanFile: "Clean file — no red flags triggered.",
        howWeEstimate: "How we estimate",
        estimateExplanation:
          "Rates start at a 6.75% baseline (720 FICO, 75% LTV, 1.10 DSCR, SFR) and adjust ±0.125–0.75% per factor. Actual quotes depend on seasoning, reserves, state, and lender. This is a solid first-pass estimate — not a rate lock.",
        ctaTitle: "Get an actual rate quote — no credit pull",
        ctaSubtitle: "1,000+ lenders compete in one business hour",
        ctaButton: "See my quotes",
        redFlagDscr075: "DSCR below 0.75 — most ratio programs decline",
        redFlagFico660: "Credit below 660 — rate add-ons stack",
        redFlagReserves: "Reserves under 2 months — may miss minimum",
        redFlagLtv: (cap: number) => `LTV above probable cap of ${cap}%`,
        redFlagStr: "STR with sub-680 FICO — very tight lender pool",
        strengthDscr125: "DSCR ≥ 1.25 — qualifies for best pricing tier",
        strengthFico740: "Credit ≥ 740 — top-tier pricing add-ons",
        strengthReserves: "Reserves ≥ 6 months — strong compensating factor",
        strengthDown30: "30%+ down — unlocks aggressive pricing",
        strengthPurchase: "Purchase with 1.00+ DSCR — broad lender access",
      };

  const propertyTypeOptions = isEs ? PROPERTY_TYPES_ES : PROPERTY_TYPES_EN;
  const loanPurposeOptions = isEs ? LOAN_PURPOSES_ES : LOAN_PURPOSES_EN;

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

  const result = useMemo(() => {
    const value = parseNum(f.propertyValue);
    const rent = parseNum(f.rent);
    const tiHoa = parseNum(f.tiHoa);
    const fico = parseNum(f.fico);
    const reserves = parseNum(f.reserves);

    const downPct =
      f.downMode === "percent"
        ? parseNum(f.downValue)
        : value > 0
        ? (parseNum(f.downValue) / value) * 100
        : 0;

    const ltv = Math.max(0, 100 - downPct);
    const loan = value * (ltv / 100);

    // For DSCR math, we need a payment. Use mid-estimated rate in an iteration.
    // First pass with baseline to get a rate:
    const firstRate = estimateRate({
      fico,
      ltv,
      dscr: 1.0,
      propertyType: f.propertyType,
    }).mid;
    const firstPI = amortizedPI(loan, firstRate, 30);
    const firstPitia = firstPI + tiHoa;
    const firstDscr = firstPitia > 0 ? rent / firstPitia : 0;

    // Second pass with actual DSCR feedback
    const rateObj = estimateRate({
      fico,
      ltv,
      dscr: firstDscr,
      propertyType: f.propertyType,
    });
    const pi = amortizedPI(loan, rateObj.mid, 30);
    const pitia = pi + tiHoa;
    const dscr = pitia > 0 ? rent / pitia : 0;

    const level = qualificationLevel({ dscr, fico, ltv, reserves, isEs });
    const ltvCap = probableLtvCap(fico, dscr);

    // Flags
    const redFlags: string[] = [];
    const strengths: string[] = [];

    if (dscr > 0 && dscr < 0.75) redFlags.push(t.redFlagDscr075);
    if (fico > 0 && fico < 660) redFlags.push(t.redFlagFico660);
    if (reserves < 2) redFlags.push(t.redFlagReserves);
    if (ltv > ltvCap) redFlags.push(t.redFlagLtv(ltvCap));
    if (f.propertyType === "str" && fico < 680) redFlags.push(t.redFlagStr);

    if (dscr >= 1.25) strengths.push(t.strengthDscr125);
    if (fico >= 740) strengths.push(t.strengthFico740);
    if (reserves >= 6) strengths.push(t.strengthReserves);
    if (downPct >= 30) strengths.push(t.strengthDown30);
    if (f.purpose === "purchase" && dscr >= 1.0) strengths.push(t.strengthPurchase);

    return {
      value,
      loan,
      rent,
      ltv,
      downPct,
      pi,
      pitia,
      dscr,
      rateObj,
      level,
      ltvCap,
      redFlags,
      strengths,
    };
  }, [f, isEs, t]);

  const getMatchedUrl = useMemo(() => {
    const params = new URLSearchParams({
      source: "qualification-estimator",
      propertyValue: f.propertyValue,
      loanAmount: result.loan > 0 ? String(Math.round(result.loan)) : "",
      monthlyRent: f.rent,
      fico: f.fico,
      state: f.state,
      propertyType: f.propertyType,
      purpose: f.purpose,
    });
    return (isEs ? "/es/get-matched?" : "/get-matched?") + params.toString();
  }, [f, result.loan, isEs]);

  function update<K extends keyof Fields>(k: K, v: Fields[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  function reset() {
    setF(DEFAULTS);
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
      <div className="rounded-2xl bg-gradient-to-br from-accent/50 via-primary/20 to-accent/30 p-[1.5px] shadow-lg">
        <div className="rounded-2xl bg-card">
          <div className="grid gap-0 lg:grid-cols-5">
            {/* Inputs */}
            <div className="lg:col-span-3 p-5 md:p-7 border-b lg:border-b-0 lg:border-r border-border">
              <p className="text-xs font-bold uppercase tracking-wider text-accent">
                {t.qualificationInputs}
              </p>
              <h2 className="text-xl md:text-2xl font-bold text-foreground mt-0.5">
                {t.dealProfile}
              </h2>

              {/* Property section */}
              <Section title={t.propertyAndLoan}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Money
                    id="propertyValue"
                    label={t.propertyValueLabel}
                    value={f.propertyValue}
                    onChange={(v) => update("propertyValue", v)}
                  />
                  <div className="grid gap-1.5">
                    <Label htmlFor="downValue" className="text-xs font-medium">
                      {t.downPayment}
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          {f.downMode === "percent" ? "%" : "$"}
                        </span>
                        <Input
                          id="downValue"
                          inputMode="decimal"
                          className={cn(
                            "tabular-nums",
                            f.downMode === "percent" ? "pl-7" : "pl-7",
                          )}
                          value={f.downValue}
                          onChange={(e) =>
                            update(
                              "downValue",
                              e.target.value.replace(/[^0-9.]/g, ""),
                            )
                          }
                        />
                      </div>
                      <div className="flex rounded-md border border-border overflow-hidden text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => update("downMode", "percent")}
                          className={cn(
                            "px-3 transition",
                            f.downMode === "percent"
                              ? "bg-primary text-primary-foreground"
                              : "bg-card hover:bg-secondary",
                          )}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => update("downMode", "dollar")}
                          className={cn(
                            "px-3 transition border-l border-border",
                            f.downMode === "dollar"
                              ? "bg-primary text-primary-foreground"
                              : "bg-card hover:bg-secondary",
                          )}
                        >
                          $
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {t.impliedLtv} <strong>{result.ltv.toFixed(0)}%</strong>
                    </p>
                  </div>
                </div>
              </Section>

              <Section title={t.incomeAndExpenses}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Money
                    id="rent"
                    label={t.monthlyRent}
                    value={f.rent}
                    onChange={(v) => update("rent", v)}
                  />
                  <Money
                    id="tiHoa"
                    label={t.monthlyTiHoa}
                    value={f.tiHoa}
                    onChange={(v) => update("tiHoa", v)}
                    hint={t.tiHoaHint}
                  />
                </div>
              </Section>

              <Section title={t.borrowerProfile}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="fico" className="text-xs font-medium">
                      {t.creditScore}
                    </Label>
                    <Input
                      id="fico"
                      inputMode="numeric"
                      min={580}
                      max={850}
                      className="tabular-nums"
                      value={f.fico}
                      onChange={(e) =>
                        update(
                          "fico",
                          e.target.value.replace(/[^0-9]/g, ""),
                        )
                      }
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {t.ficoHint}
                    </p>
                  </div>
                  <Money
                    id="reserves"
                    label={t.reservesLabel}
                    value={f.reserves}
                    onChange={(v) => update("reserves", v)}
                    currencyPrefix={false}
                    hint={t.reservesHint}
                  />
                </div>
              </Section>

              <Section title={t.dealStructure}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    id="propertyType"
                    label={t.propertyType}
                    value={f.propertyType}
                    onChange={(v) =>
                      update("propertyType", v as Fields["propertyType"])
                    }
                    options={propertyTypeOptions.map((p) => ({
                      value: p.value,
                      label: p.label,
                    }))}
                  />
                  <Select
                    id="state"
                    label={t.state}
                    value={f.state}
                    onChange={(v) => update("state", v)}
                    options={STATES.map((s) => ({ value: s, label: s }))}
                  />
                  <Select
                    id="purpose"
                    label={t.loanPurpose}
                    value={f.purpose}
                    onChange={(v) =>
                      update("purpose", v as Fields["purpose"])
                    }
                    options={loanPurposeOptions.map((p) => ({
                      value: p.value,
                      label: p.label,
                    }))}
                  />
                </div>
              </Section>

              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={reset}>
                  <RotateCcw className="size-3.5" />
                  {t.reset}
                </Button>
                <Button variant="ghost" size="sm" onClick={copyLink}>
                  <Copy className="size-3.5" />
                  {copied ? t.copied : t.copyShareableLink}
                </Button>
              </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-2 p-5 md:p-7 space-y-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t.estimatedQualification}
                </p>
                <div
                  className={cn(
                    "mt-2 rounded-xl p-5 ring-2 transition",
                    result.level.bg,
                  )}
                >
                  <div
                    className={cn(
                      "text-4xl font-bold tracking-tight",
                      result.level.color,
                    )}
                  >
                    {result.level.label}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    {result.level.explanation}
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Sparkles className="size-3.5 text-accent" />
                    {lenderTierMatch(result.level.key, isEs)}
                  </div>
                </div>
              </div>

              <dl className="space-y-2 text-sm">
                <KV label={t.estimatedDscr} value={result.dscr > 0 ? result.dscr.toFixed(2) : "—"} strong />
                <KV
                  label={t.estimatedRateRange}
                  value={`${result.rateObj.low.toFixed(3)}% – ${result.rateObj.high.toFixed(3)}%`}
                  strong
                />
                <KV
                  label={t.probableLtvCap}
                  value={`${result.ltvCap}%`}
                />
                <KV label={t.loanAmount} value={fmtUSD(result.loan)} />
                <KV label={t.estMonthlyPi} value={fmtUSD(result.pi)} />
                <KV label={t.estMonthlyPitia} value={fmtUSD(result.pitia)} />
              </dl>
              <p className="text-xs text-muted-foreground">
                <a
                  href={isEs ? "/es/checklists#antes-de-aplicar" : "/checklists#before-you-apply"}
                  className="font-semibold text-primary underline underline-offset-2"
                >
                  {isEs ? "Revisa la lista Antes de Aplicar" : "Run through the Before You Apply checklist"}
                </a>
              </p>
            </div>
          </div>

          {/* Flags */}
          <div className="border-t border-border grid gap-0 md:grid-cols-2">
            <div className="p-5 md:p-7 border-b md:border-b-0 md:border-r border-border">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="size-4 text-success" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  {t.strengths}
                </h3>
              </div>
              {result.strengths.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="size-4 shrink-0 text-success mt-0.5" />
                      <span className="text-foreground">{s}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t.noStrengths}
                </p>
              )}
            </div>
            <div className="p-5 md:p-7">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="size-4 text-amber-500" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  {t.redFlags}
                </h3>
              </div>
              {result.redFlags.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {result.redFlags.map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <XCircle className="size-4 shrink-0 text-destructive mt-0.5" />
                      <span className="text-foreground">{r}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t.cleanFile}
                </p>
              )}
            </div>
          </div>

          {/* What this means */}
          <div className="border-t border-border bg-secondary/40 rounded-b-2xl p-5 md:p-7">
            <div className="flex items-start gap-3">
              <Info className="size-5 shrink-0 text-accent mt-0.5" />
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  {t.howWeEstimate}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {t.estimateExplanation}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 p-6 md:p-8 text-primary-foreground">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">
              {t.ctaTitle}
            </h3>
            <p className="mt-1 text-sm opacity-80 flex items-center gap-1.5">
              <ShieldCheck className="size-4" />
              {t.ctaSubtitle}
            </p>
          </div>
          <Button asChild variant="cta" size="lg" className="shrink-0">
            <a href={getMatchedUrl}>
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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Money({
  id,
  label,
  value,
  onChange,
  hint,
  currencyPrefix = true,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  currencyPrefix?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <div className="relative">
        {currencyPrefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            $
          </span>
        )}
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className={cn("tabular-nums", currencyPrefix && "pl-7")}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        />
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Select({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function KV({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          strong ? "font-bold text-foreground" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

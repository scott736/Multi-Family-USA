"use client";

import {
  ArrowRight,
  Copy,
  RotateCcw,
} from "lucide-react";
import { useId, useMemo, useState } from "react";

import {
  DscrCalculatorResults,
  DscrCalculatorResultsPanel,
} from "@/components/calculators/DscrCalculatorResults";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildDealReviewUrl } from "@/lib/deal-review-url";
import { fmtUSD, parseNum } from "@/lib/finance";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function tier(dscr: number, isEs: boolean) {
  if (dscr <= 0) {
    return {
      key: "none",
      label: isEs ? "Ingresa tus números" : "Enter your numbers",
      color: "text-muted-foreground",
      ring: "ring-border",
      bg: "bg-muted/40",
      message: isEs
        ? "Completa la renta y el PITIA para ver tu DSCR."
        : "Fill in rent and PITIA to see your DSCR.",
    };
  }
  if (dscr < 0.75) {
    return {
      key: "red",
      label: isEs ? "Menor a 0.75 — opciones limitadas" : "Sub-0.75 — limited options",
      color: "text-destructive",
      ring: "ring-destructive/40",
      bg: "bg-destructive/10",
      message: isEs
        ? "La mayoría de los prestamistas DSCR basados en ratio no llegarán a esto. Considera un programa sin ratio o un prestamista con un nivel inferior a 0.75."
        : "Most ratio-based multifamily lenders won't hit this. Consider a no-ratio program or a lender with a sub-0.75 bucket.",
    };
  }
  if (dscr < 1.0) {
    return {
      key: "amber",
      label: isEs ? "0.75–0.99 — competitivo" : "0.75–0.99 — competitive",
      color: "text-amber-600 dark:text-amber-400",
      ring: "ring-amber-500/40",
      bg: "bg-amber-500/10",
      message: isEs
        ? "5+ opciones de prestamistas disponibles. Espera LTV limitado a 70–75% y precios un poco más altos."
        : "5+ lender options available. Expect LTV capped at 70–75% and slightly higher pricing.",
    };
  }
  if (dscr < 1.25) {
    return {
      key: "yellow",
      label: isEs ? "1.00–1.24 — acceso amplio" : "1.00–1.24 — broad access",
      color: "text-yellow-600 dark:text-yellow-400",
      ring: "ring-yellow-500/40",
      bg: "bg-yellow-500/10",
      message: isEs
        ? "Acceso amplio a prestamistas. Hasta 80% LTV con buen crédito. Precios sólidos del mercado medio."
        : "Broad lender access. Up to 80% LTV for strong credit. Solid mid-market pricing.",
    };
  }
  return {
    key: "green",
    label: isEs ? "1.25+ — mejores precios" : "1.25+ — best pricing",
    color: "text-success",
    ring: "ring-success/40",
    bg: "bg-success/10",
    message: isEs
      ? "Las mejores tasas disponibles. Acceso completo a LTV, aprobaciones más rápidas, mayor grupo de prestamistas."
      : "Best rates available. Full LTV access, fastest approvals, widest lender pool.",
  };
}

/* -------------------------------------------------------------------------- */
/*  Types & state                                                             */
/* -------------------------------------------------------------------------- */

interface Fields {
  rent: string;
  pi: string;
  tax: string;
  ins: string;
  hoa: string;
  flood: string;
  interestOnly: boolean;
}

const DEFAULTS: Fields = {
  rent: "2800",
  pi: "1620",
  tax: "320",
  ins: "110",
  hoa: "0",
  flood: "0",
  interestOnly: false,
};

function getInitialFields(): Fields {
  if (typeof window === "undefined") return DEFAULTS;
  const p = new URLSearchParams(window.location.search);
  const next = { ...DEFAULTS };
  (Object.keys(DEFAULTS) as (keyof Fields)[]).forEach((k) => {
    const v = p.get(k);
    if (v == null) return;
    if (k === "interestOnly") {
      next.interestOnly = v === "1" || v === "true";
      return;
    }
    (next[k] as string) = v;
  });
  return next;
}

interface DscrCalculatorProps {
  lang?: "en" | "es";
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function DscrCalculator({ lang = "en" }: DscrCalculatorProps = {}) {
  const isEs = lang === "es";
  const ioModeLabelId = useId();
  const [f, setF] = useState<Fields>(() => getInitialFields());
  const [copied, setCopied] = useState(false);

  const rent = parseNum(f.rent);
  const pi = parseNum(f.pi);
  const tax = parseNum(f.tax);
  const ins = parseNum(f.ins);
  const hoa = parseNum(f.hoa);
  const flood = parseNum(f.flood);

  const pitia = pi + tax + ins + hoa + flood;
  const dscr = pitia > 0 ? rent / pitia : 0;

  const t = tier(dscr, isEs);

  const getMatchedUrl = useMemo(() => {
    const assumedRate = 0.07;
    const assumedLtv = 0.75;
    let estimatedLoan = 0;
    if (pi > 0) {
      if (f.interestOnly) {
        estimatedLoan = (pi * 12) / assumedRate;
      } else {
        estimatedLoan = pi / 0.00665302;
      }
    }
    const estimatedValue = estimatedLoan / assumedLtv;

    return buildDealReviewUrl(
      {
        source: "dscr-calculator",
        monthlyRent: rent > 0 ? rent : undefined,
        loanAmount: estimatedLoan > 0 ? Math.round(estimatedLoan) : undefined,
        purchasePrice: estimatedValue > 0 ? Math.round(estimatedValue) : undefined,
        purpose: "acquisition",
        occupancy: 93,
      },
      isEs,
    );
  }, [rent, pi, f.interestOnly, isEs]);

  // Suggestions
  const rentFor100 = pitia;
  const rentFor125 = pitia * 1.25;
  const rentDeltaTo100 = Math.max(0, rentFor100 - rent);
  const rentDeltaTo125 = Math.max(0, rentFor125 - rent);

  // If we "reduce PI" (approximate rate/payment reduction) to hit 1.0
  const maxPiFor100 = rent - (tax + ins + hoa + flood);
  const piCutFor100 = Math.max(0, pi - maxPiFor100);

  const analysisSummary = useMemo(
    () => ({
      DSCR: dscr > 0 ? dscr.toFixed(2) : "—",
      Tier: t.label,
      "Monthly gross rent": rent > 0 ? fmtUSD(rent) : "—",
      "Monthly PITIA": pitia > 0 ? fmtUSD(pitia) : "—",
      "Monthly cash flow": rent > 0 || pitia > 0 ? fmtUSD(rent - pitia) : "—",
    }),
    [dscr, pitia, rent, t.label],
  );

  const sourcePage = isEs ? "/es/tools/commercial-dscr-calculator" : "/tools/commercial-dscr-calculator";

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
    p.set("rent", String(rent));
    p.set("pi", String(pi));
    p.set("tax", String(tax));
    p.set("ins", String(ins));
    p.set("hoa", String(hoa));
    p.set("flood", String(flood));
    p.set("interestOnly", f.interestOnly ? "1" : "0");
    const url = `${window.location.origin}${window.location.pathname}?${p.toString()}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="space-y-6">
      {/* Calculator card — gradient accent border */}
      <div className="rounded-2xl bg-gradient-to-br from-accent/50 via-accent/20 to-primary/20 p-[1.5px] shadow-lg">
        <div className="rounded-2xl bg-card">
          <div className="grid gap-0 lg:grid-cols-5">
            {/* Inputs */}
            <div className="lg:col-span-3 p-5 md:p-7 border-b lg:border-b-0 lg:border-r border-border">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-accent">
                    {isEs ? "Datos DSCR" : "DSCR inputs"}
                  </p>
                  <h2 className="text-xl md:text-2xl font-bold text-foreground mt-0.5">
                    {isEs ? "Ingresa tu operación" : "Enter your deal"}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span id={ioModeLabelId} className="text-xs font-medium text-muted-foreground">
                    {isEs ? "Modo I/O" : "I/O mode"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={f.interestOnly}
                    aria-labelledby={ioModeLabelId}
                    aria-label={isEs ? "Cambiar modo I/O" : "Toggle I/O mode"}
                    onClick={() =>
                      update("interestOnly", !f.interestOnly)
                    }
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        update("interestOnly", !f.interestOnly);
                      }
                    }}
                    tabIndex={0}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition",
                      f.interestOnly ? "bg-accent" : "bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-5 w-5 rounded-full bg-white shadow transform transition",
                        f.interestOnly ? "translate-x-5" : "translate-x-0.5",
                      )}
                    />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Money
                  id="rent"
                  label={isEs ? "Renta mensual bruta" : "Monthly gross rent"}
                  value={f.rent}
                  onChange={(v) => update("rent", v)}
                  hint={isEs ? "Renta de mercado o renta del contrato" : "Market rent or lease rent"}
                />
                <Money
                  id="pi"
                  label={
                    f.interestOnly
                      ? (isEs ? "Pago mensual solo de interés" : "Monthly interest-only payment")
                      : (isEs ? "Capital + interés mensual" : "Monthly principal + interest")
                  }
                  value={f.pi}
                  onChange={(v) => update("pi", v)}
                  hint={f.interestOnly
                    ? (isEs ? "Pago solo de interés" : "I-only payment")
                    : (isEs ? "P&I de la amortización" : "P&I from amortization")}
                />
                <Money
                  id="tax"
                  label={isEs ? "Impuesto predial mensual" : "Monthly property tax"}
                  value={f.tax}
                  onChange={(v) => update("tax", v)}
                  hint={isEs ? "Impuesto anual / 12" : "Annual tax / 12"}
                />
                <Money
                  id="ins"
                  label={isEs ? "Seguro mensual" : "Monthly insurance"}
                  value={f.ins}
                  onChange={(v) => update("ins", v)}
                  hint={isEs ? "Prima de riesgo / 12" : "Hazard premium / 12"}
                />
                <Money
                  id="hoa"
                  label={isEs ? "HOA mensual" : "Monthly HOA"}
                  value={f.hoa}
                  onChange={(v) => update("hoa", v)}
                  hint={isEs ? "Opcional" : "Optional"}
                />
                <Money
                  id="flood"
                  label={isEs ? "Inundación / otro" : "Flood / other"}
                  value={f.flood}
                  onChange={(v) => update("flood", v)}
                  hint={isEs ? "Opcional" : "Optional"}
                />
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={reset}>
                  <RotateCcw className="size-3.5" />
                  {isEs ? "Restablecer" : "Reset"}
                </Button>
                <Button variant="ghost" size="sm" onClick={copyLink}>
                  <Copy className="size-3.5" />
                  {copied
                    ? (isEs ? "¡Copiado!" : "Copied!")
                    : (isEs ? "Copiar enlace para compartir" : "Copy shareable link")}
                </Button>
              </div>
            </div>

            <DscrCalculatorResultsPanel isEs={isEs} dscr={dscr} tier={t} rent={rent} pitia={pitia} />
          </div>

          <DscrCalculatorResults
            isEs={isEs}
            tierKey={t.key}
            dscr={dscr}
            rentFor100={rentFor100}
            rentFor125={rentFor125}
            rentDeltaTo100={rentDeltaTo100}
            rentDeltaTo125={rentDeltaTo125}
            maxPiFor100={maxPiFor100}
            piCutFor100={piCutFor100}
            analysisSummary={analysisSummary}
            sourcePage={sourcePage}
          />
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 p-6 md:p-8 text-primary-foreground">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">
              {isEs ? "Obtenga una lectura de encaje según su DSCR" : "Get a lender-fit read at your DSCR"}
            </h3>
            <p className="mt-1 text-sm opacity-80">
              {isEs
                ? "Envíe sus supuestos para una revisión gratuita de suscripción y rutas de capital — usualmente en una hora hábil. Sin consulta de crédito."
                : "Submit your assumptions for a free underwriting review and capital-path options — usually within one business hour. No credit pull."}
            </p>
          </div>
          <Button
            asChild
            variant="cta"
            size="lg"
            className="shrink-0"
          >
            <a href={getMatchedUrl}>
              {isEs ? "Solicitar revisión gratuita" : "Get free deal review"}
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
      <Label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
          $
        </span>
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className="pl-7 tabular-nums"
          value={value}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9.]/g, "");
            onChange(raw);
          }}
        />
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

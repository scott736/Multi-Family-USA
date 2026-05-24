"use client";

import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Info,
  RotateCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtUSD, parseNum } from "@/lib/finance";

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

interface DscrCalculatorProps {
  lang?: "en" | "es";
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function DscrCalculator({ lang = "en" }: DscrCalculatorProps = {}) {
  const isEs = lang === "es";
  const [f, setF] = useState<Fields>(DEFAULTS);
  const [copied, setCopied] = useState(false);

  // hydrate from URL params once
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const next = { ...DEFAULTS };
    let touched = false;
    (Object.keys(DEFAULTS) as (keyof Fields)[]).forEach((k) => {
      const v = p.get(k);
      if (v != null) {
        touched = true;
        if (k === "interestOnly") {
          next.interestOnly = v === "1" || v === "true";
        } else {
          (next[k] as string) = v;
        }
      }
    });
    if (touched) setF(next);
  }, []);

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

    const params = new URLSearchParams({
      source: "dscr-calculator",
      monthlyRent: rent > 0 ? String(rent) : "",
      loanAmount: estimatedLoan > 0 ? String(Math.round(estimatedLoan)) : "",
      propertyValue: estimatedValue > 0 ? String(Math.round(estimatedValue)) : "",
      purpose: "purchase",
    });
    return (isEs ? "/deal-review?" : "/deal-review?") + params.toString();
  }, [rent, pi, f.interestOnly, isEs]);

  // Suggestions
  const rentFor100 = pitia;
  const rentFor125 = pitia * 1.25;
  const rentDeltaTo100 = Math.max(0, rentFor100 - rent);
  const rentDeltaTo125 = Math.max(0, rentFor125 - rent);

  // If we "reduce PI" (approximate rate/payment reduction) to hit 1.0
  const maxPiFor100 = rent - (tax + ins + hoa + flood);
  const piCutFor100 = Math.max(0, pi - maxPiFor100);

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
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-xs font-medium text-muted-foreground">
                    {isEs ? "Modo I/O" : "I/O mode"}
                  </span>
                  <span
                    role="switch"
                    aria-checked={f.interestOnly}
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
                  </span>
                </label>
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

            {/* Result */}
            <div className="lg:col-span-2 p-5 md:p-7 flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isEs ? "Tu DSCR" : "Your DSCR"}
                </p>
                <div
                  className={cn(
                    "mt-2 rounded-xl p-5 ring-2 transition",
                    t.ring,
                    t.bg,
                  )}
                >
                  <div
                    className={cn(
                      "text-6xl font-bold tabular-nums tracking-tight",
                      t.color,
                    )}
                  >
                    {dscr > 0 ? dscr.toFixed(2) : "—"}
                  </div>
                  <p
                    className={cn(
                      "mt-2 text-sm font-semibold",
                      t.color,
                    )}
                  >
                    {t.label}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    {t.message}
                  </p>
                </div>

                <dl className="mt-5 space-y-2 text-sm">
                  <Row
                    label={isEs ? "Renta mensual bruta" : "Monthly gross rent"}
                    value={fmtUSD(rent)}
                  />
                  <Row
                    label={isEs ? "PITIA mensual" : "Monthly PITIA"}
                    value={fmtUSD(pitia)}
                    bold
                  />
                  <Row
                    label={isEs ? "Flujo de caja mensual" : "Monthly cash flow"}
                    value={fmtUSD(rent - pitia)}
                    accent={rent - pitia >= 0 ? "good" : "bad"}
                  />
                  <Row
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
                    {isEs ? "Revisa la lista Antes de Aplicar" : "Run through the Before You Apply checklist"}
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* What this means */}
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
        </div>
      </div>

      {/* Lender tier match */}
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
                desc={isEs ? "Limitado — considera un programa sin ratio o tipo Griffin" : "Limited — consider a no-ratio or Griffin-style program"}
                ltv="65–70%"
                active={t.key === "red"}
              />
              <TierRow
                band="0.75 – 0.99"
                desc={isEs ? "Competitivo — 5+ opciones de prestamistas" : "Competitive — 5+ lender options"}
                ltv="70–75%"
                active={t.key === "amber"}
              />
              <TierRow
                band="1.00 – 1.24"
                desc={isEs ? "Acceso amplio a prestamistas, precios convencionales" : "Broad lender access, mainstream pricing"}
                ltv={isEs ? "hasta 80%" : "up to 80%"}
                active={t.key === "yellow"}
              />
              <TierRow
                band="1.25+"
                desc={isEs ? "Mejores tasas, mayor grupo de prestamistas, aprobaciones más rápidas" : "Best rates, widest lender pool, fastest approvals"}
                ltv={isEs ? "hasta 80% (85% selectos)" : "up to 80% (85% select)"}
                active={t.key === "green"}
              />
            </tbody>
          </table>
        </div>
      </div>

      {/* Try adjusting */}
      {dscr > 0 && dscr < 1.25 && (
        <div className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/5 to-transparent p-5 md:p-7">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="size-4 text-accent" />
            <h3 className="text-lg font-bold text-foreground">{isEs ? "Prueba ajustar" : "Try adjusting"}</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {dscr < 1.0 && rentDeltaTo100 > 0 && (
              <Adjust
                icon={<ArrowRight className="size-4" />}
                title={isEs ? "Sube la renta para llegar a DSCR 1.00" : "Raise rent to hit 1.00 DSCR"}
                detail={isEs
                  ? `Necesitas ${fmtUSD(rentFor100)}/mes — eso es ${fmtUSD(rentDeltaTo100)} más que hoy.`
                  : `Need ${fmtUSD(rentFor100)}/mo — that's ${fmtUSD(rentDeltaTo100)} more than today.`}
              />
            )}
            {dscr < 1.25 && rentDeltaTo125 > 0 && (
              <Adjust
                icon={<ArrowRight className="size-4" />}
                title={isEs ? "Sube la renta para llegar a DSCR 1.25" : "Raise rent to hit 1.25 DSCR"}
                detail={isEs
                  ? `Necesitas ${fmtUSD(rentFor125)}/mes — eso es ${fmtUSD(rentDeltaTo125)} más que hoy.`
                  : `Need ${fmtUSD(rentFor125)}/mo — that's ${fmtUSD(rentDeltaTo125)} more than today.`}
              />
            )}
            {dscr < 1.0 && piCutFor100 > 0 && maxPiFor100 > 0 && (
              <Adjust
                icon={<TrendingDown className="size-4" />}
                title={isEs ? "Reduce el P&I para llegar a DSCR 1.00" : "Cut P&I to hit 1.00 DSCR"}
                detail={isEs
                  ? `P&I máximo de ${fmtUSD(maxPiFor100)}/mes — recorta ${fmtUSD(piCutFor100)} con un enganche mayor, compra de tasa o I/O.`
                  : `Max P&I of ${fmtUSD(maxPiFor100)}/mo — cut ${fmtUSD(piCutFor100)} via bigger down, rate buydown, or I/O.`}
              />
            )}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 p-6 md:p-8 text-primary-foreground">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">
              {isEs ? "Conecta con prestamistas según tu DSCR" : "Get matched with lenders at your DSCR"}
            </h3>
            <p className="mt-1 text-sm opacity-80">
              {isEs
                ? "Comparamos 1,000+ prestamistas DSCR y te enviamos las 3 mejores ofertas — usualmente dentro de una hora hábil. Sin consulta de crédito."
                : "We shop 1,000+ multifamily lenders and send you the top 3 offers — usually within one business hour. No credit pull."}
            </p>
          </div>
          <Button
            asChild
            variant="cta"
            size="lg"
            className="shrink-0"
          >
            <a href={getMatchedUrl}>
              {isEs ? "Ver mis ofertas" : "Get my matches"}
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

function Row({
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
    <tr
      className={cn(
        "transition",
        active && "bg-accent/10 ring-2 ring-accent/30",
      )}
    >
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

function Adjust({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
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

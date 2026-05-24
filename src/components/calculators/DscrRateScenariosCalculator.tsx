"use client";

import { ArrowRight, CheckCircle2, Info, RotateCcw, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtUSD, monthlyPI, parseNum } from "@/lib/finance";

const piYears = (p: number, r: number, y: number) => monthlyPI(p, r, y * 12);

interface Fields {
  loanAmount: string;
  term: string;
  rent: string;
  tax: string;
  insurance: string;
  hoa: string;
}

const DEFAULTS: Fields = {
  loanAmount: "300000",
  term: "30",
  rent: "2800",
  tax: "300",
  insurance: "120",
  hoa: "0",
};

const RATES = [6.0, 6.5, 7.0, 7.5, 8.0, 8.5];

function dscrColor(dscr: number) {
  if (dscr >= 1.25) return { text: "text-success", bg: "bg-success/10 dark:bg-success/20", badge: "bg-success/20 text-success" };
  if (dscr >= 1.0) return { text: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10", badge: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300" };
  if (dscr >= 0.75) return { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", badge: "bg-amber-500/20 text-amber-700 dark:text-amber-300" };
  return { text: "text-destructive", bg: "bg-destructive/10", badge: "bg-destructive/20 text-destructive" };
}

interface DscrRateScenariosCalculatorProps {
  lang?: "en" | "es";
}

export default function DscrRateScenariosCalculator({ lang = "en" }: DscrRateScenariosCalculatorProps = {}) {
  const isEs = lang === "es";
  const [f, setF] = useState<Fields>(DEFAULTS);

  const loan = parseNum(f.loanAmount);
  const term = parseNum(f.term) || 30;
  const rent = parseNum(f.rent);
  const tax = parseNum(f.tax);
  const ins = parseNum(f.insurance);
  const hoa = parseNum(f.hoa);
  const otherPITIA = tax + ins + hoa;

  const scenarios = useMemo(() => {
    return RATES.map((rate) => {
      const pi = piYears(loan, rate, term);
      const pitia = pi + otherPITIA;
      const dscr = pitia > 0 && rent > 0 ? rent / pitia : 0;
      return { rate, pi, pitia, dscr };
    });
  }, [loan, term, rent, otherPITIA]);

  function update<K extends keyof Fields>(k: K, v: string) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  const hasData = loan > 0 && rent > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-accent/50 via-accent/20 to-primary/20 p-[1.5px] shadow-lg">
        <div className="rounded-2xl bg-card">
          {/* Inputs */}
          <div className="p-5 md:p-7 border-b border-border">
            <p className="text-xs font-bold uppercase tracking-wider text-accent">{isEs ? "Datos de escenarios de tasa" : "Rate scenario inputs"}</p>
            <h2 className="text-xl md:text-2xl font-bold text-foreground mt-0.5 mb-5">{isEs ? "Mira el DSCR a cada tasa" : "See DSCR at every rate"}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field id="loanAmount" label={isEs ? "Monto del préstamo" : "Loan amount"} prefix="$" value={f.loanAmount} onChange={(v) => update("loanAmount", v)} hint={isEs ? "Principal solicitado" : "Principal borrowed"} />
              <Field id="term" label={isEs ? "Plazo del préstamo (años)" : "Loan term (years)"} value={f.term} onChange={(v) => update("term", v)} hint={isEs ? "Típicamente 30" : "Typically 30"} />
              <Field id="rent" label={isEs ? "Renta mensual bruta" : "Monthly gross rent"} prefix="$" value={f.rent} onChange={(v) => update("rent", v)} hint={isEs ? "Renta de mercado o contrato" : "Market or lease rent"} />
              <Field id="tax" label={isEs ? "Impuesto predial mensual" : "Monthly property tax"} prefix="$" value={f.tax} onChange={(v) => update("tax", v)} hint={isEs ? "Anual ÷ 12" : "Annual ÷ 12"} />
              <Field id="insurance" label={isEs ? "Seguro mensual" : "Monthly insurance"} prefix="$" value={f.insurance} onChange={(v) => update("insurance", v)} hint={isEs ? "Prima de seguro contra riesgos ÷ 12" : "Hazard premium ÷ 12"} />
              <Field id="hoa" label={isEs ? "HOA mensual" : "Monthly HOA"} prefix="$" value={f.hoa} onChange={(v) => update("hoa", v)} hint={isEs ? "Opcional" : "Optional"} />
            </div>
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={() => setF(DEFAULTS)}>
                <RotateCcw className="size-3.5" /> {isEs ? "Restablecer" : "Reset"}
              </Button>
            </div>
          </div>

          {/* Rate table */}
          <div className="p-5 md:p-7">
            {!hasData ? (
              <div className="rounded-xl bg-muted/40 ring-2 ring-border p-5 text-sm text-muted-foreground text-center">
                {isEs ? "Ingresa el monto del préstamo y la renta para ver los escenarios de DSCR." : "Enter loan amount and rent to see DSCR scenarios."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-2 pr-4">{isEs ? "Tasa" : "Rate"}</th>
                      <th className="py-2 pr-4">P&I</th>
                      <th className="py-2 pr-4">PITIA</th>
                      <th className="py-2 pr-4">DSCR</th>
                      <th className="py-2">{isEs ? "Estado" : "Status"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {scenarios.map(({ rate, pi, pitia, dscr }) => {
                      const c = dscrColor(dscr);
                      const hits125 = dscr >= 1.25;
                      const hits100 = dscr >= 1.0;
                      return (
                        <tr key={rate} className={cn("transition", c.bg)}>
                          <td className="py-3 pr-4 font-semibold tabular-nums">{rate.toFixed(2)}%</td>
                          <td className="py-3 pr-4 tabular-nums">{fmtUSD(pi)}</td>
                          <td className="py-3 pr-4 tabular-nums">{fmtUSD(pitia)}</td>
                          <td className={cn("py-3 pr-4 font-bold tabular-nums", c.text)}>
                            {dscr > 0 ? dscr.toFixed(2) : "—"}
                          </td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-1">
                              {hits125 && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-success/20 text-success">
                                  <CheckCircle2 className="size-3" /> 1.25+
                                </span>
                              )}
                              {hits100 && !hits125 && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-yellow-500/20 text-yellow-700 dark:text-yellow-300">
                                  <CheckCircle2 className="size-3" /> 1.00+
                                </span>
                              )}
                              {!hits100 && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-destructive/20 text-destructive">
                                  <XCircle className="size-3" /> {isEs ? "Menor a 1.0" : "Sub-1.0"}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="border-t border-border bg-secondary/40 rounded-b-2xl p-5 md:p-7">
            <div className="flex items-start gap-3">
              <Info className="size-5 shrink-0 text-accent mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isEs
                  ? "Las filas verdes alcanzan el umbral de DSCR de 1.25 para el mejor precio. Las amarillas califican para acceso amplio a prestamistas. Por debajo de 1.0 aún tienes opciones — pero los topes de LTV se ajustan y aplican recargos a la tasa."
                  : "Green rows hit the 1.25 DSCR threshold for best pricing. Yellow rows qualify for broad lender access. Below 1.0 you still have options — but LTV caps tighten and rate add-ons apply."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 p-6 md:p-8 text-primary-foreground">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">{isEs ? "Asegura la mejor tasa para tu DSCR" : "Lock in the best rate for your DSCR"}</h3>
            <p className="mt-1 text-sm opacity-80">{isEs ? "Comparamos más de 1,000 prestamistas DSCR. Las 3 mejores ofertas en una hora hábil. Sin consulta de crédito." : "We shop 1,000+ DSCR lenders. Top 3 offers in one business hour. No credit pull."}</p>
          </div>
          <Button asChild variant="cta" size="lg" className="shrink-0">
            <a href={isEs ? "/es/get-matched?source=dscr-rate-scenarios-calculator" : "/get-matched?source=dscr-rate-scenarios-calculator"}>{isEs ? "Ver mis ofertas" : "Get my matches"} <ArrowRight className="size-4" /></a>
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

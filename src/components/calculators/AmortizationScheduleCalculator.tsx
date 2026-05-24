"use client";

import { ArrowRight, ChevronDown, ChevronUp, Info, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtUSD, fmtUSD2, monthlyPI, parseNum } from "@/lib/finance";

interface MonthRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
  cumInterest: number;
  cumPrincipal: number;
}

interface YearRow {
  year: number;
  totalPayment: number;
  totalPrincipal: number;
  totalInterest: number;
  endBalance: number;
  equity: number;
}

interface Fields {
  loanAmount: string;
  rate: string;
  term: string;
}

const DEFAULTS: Fields = {
  loanAmount: "350000",
  rate: "7.25",
  term: "30",
};

interface AmortizationScheduleCalculatorProps {
  lang?: "en" | "es";
}

export default function AmortizationScheduleCalculator({ lang = "en" }: AmortizationScheduleCalculatorProps = {}) {
  const isEs = lang === "es";
  const [f, setF] = useState<Fields>(DEFAULTS);
  const [showAllMonths, setShowAllMonths] = useState(false);

  const loan = parseNum(f.loanAmount);
  const rate = parseNum(f.rate);
  const term = parseNum(f.term) || 30;

  const { monthlyRows, yearRows, payment } = useMemo(() => {
    if (loan <= 0 || rate <= 0) return { monthlyRows: [], yearRows: [], payment: 0 };

    const r = rate / 100 / 12;
    const n = term * 12;
    const pmt = monthlyPI(loan, rate, n);

    const monthlyRows: MonthRow[] = [];
    let balance = loan;
    let cumInterest = 0;
    let cumPrincipal = 0;

    for (let m = 1; m <= n; m++) {
      const interest = balance * r;
      const principal = Math.min(pmt - interest, balance);
      balance = Math.max(balance - principal, 0);
      cumInterest += interest;
      cumPrincipal += principal;

      monthlyRows.push({
        month: m,
        payment: pmt,
        principal,
        interest,
        balance,
        cumInterest,
        cumPrincipal,
      });
    }

    // Build year rows
    const yearRows: YearRow[] = [];
    for (let y = 1; y <= term; y++) {
      const startIdx = (y - 1) * 12;
      const endIdx = y * 12;
      const yearMonths = monthlyRows.slice(startIdx, endIdx);
      const totalPayment = yearMonths.reduce((s, r) => s + r.payment, 0);
      const totalPrincipal = yearMonths.reduce((s, r) => s + r.principal, 0);
      const totalInterest = yearMonths.reduce((s, r) => s + r.interest, 0);
      const endBalance = yearMonths[yearMonths.length - 1]?.balance ?? 0;
      const equity = loan - endBalance;

      yearRows.push({ year: y, totalPayment, totalPrincipal, totalInterest, endBalance, equity });
    }

    return { monthlyRows, yearRows, payment: pmt };
  }, [loan, rate, term]);

  const hasData = loan > 0 && rate > 0;

  // First 12 months + all if expanded
  const displayedMonths = showAllMonths ? monthlyRows : monthlyRows.slice(0, 12);

  function update<K extends keyof Fields>(k: K, v: string) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-accent/50 via-accent/20 to-primary/20 p-[1.5px] shadow-lg">
        <div className="rounded-2xl bg-card p-5 md:p-7">
          <p className="text-xs font-bold uppercase tracking-wider text-accent">{isEs ? "Tabla de amortización" : "Amortization schedule"}</p>
          <h2 className="text-xl md:text-2xl font-bold text-foreground mt-0.5 mb-5">{isEs ? "Ingresa los datos del préstamo" : "Enter loan details"}</h2>

          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            <Field id="loanAmount" label={isEs ? "Monto del préstamo" : "Loan amount"} prefix="$" value={f.loanAmount} onChange={(v) => update("loanAmount", v)} />
            <Field id="rate" label={isEs ? "Tasa de interés %" : "Interest rate %"} suffix="%" value={f.rate} onChange={(v) => update("rate", v)} />
            <Field id="term" label={isEs ? "Plazo del préstamo (años)" : "Loan term (years)"} value={f.term} onChange={(v) => update("term", v)} />
          </div>

          {hasData && payment > 0 && (
            <div className="mb-6 rounded-xl bg-accent/10 ring-2 ring-accent/30 p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-accent">{isEs ? "Pago mensual" : "Monthly payment"}</p>
              <p className="text-4xl font-bold tabular-nums text-foreground mt-1">{fmtUSD2(payment)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isEs ? "Total pagado" : "Total paid"}: {fmtUSD(payment * term * 12)} · {isEs ? "Intereses totales" : "Total interest"}: {fmtUSD(payment * term * 12 - loan)}
              </p>
            </div>
          )}

          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={() => { setF(DEFAULTS); setShowAllMonths(false); }}>
              <RotateCcw className="size-3.5" /> {isEs ? "Restablecer" : "Reset"}
            </Button>
          </div>
        </div>
      </div>

      {/* Annual summary table */}
      {hasData && yearRows.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 md:p-7">
          <h3 className="text-base font-bold text-foreground mb-4">{isEs ? "Resumen año por año" : "Year-by-year summary"}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">{isEs ? "Año" : "Year"}</th>
                  <th className="py-2 pr-3">{isEs ? "Total pagado" : "Total paid"}</th>
                  <th className="py-2 pr-3">{isEs ? "Principal" : "Principal"}</th>
                  <th className="py-2 pr-3">{isEs ? "Intereses" : "Interest"}</th>
                  <th className="py-2 pr-3">{isEs ? "Saldo" : "Balance"}</th>
                  <th className="py-2">{isEs ? "Capital" : "Equity"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {yearRows.map((row) => (
                  <tr key={row.year} className={row.year % 2 === 0 ? "bg-secondary/20" : ""}>
                    <td className="py-2 pr-3 font-semibold">{isEs ? "Año" : "Yr"} {row.year}</td>
                    <td className="py-2 pr-3 tabular-nums">{fmtUSD(row.totalPayment)}</td>
                    <td className="py-2 pr-3 tabular-nums text-success">{fmtUSD(row.totalPrincipal)}</td>
                    <td className="py-2 pr-3 tabular-nums text-destructive">{fmtUSD(row.totalInterest)}</td>
                    <td className="py-2 pr-3 tabular-nums">{fmtUSD(row.endBalance)}</td>
                    <td className="py-2 tabular-nums text-accent">{fmtUSD(row.equity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly detail table */}
      {hasData && monthlyRows.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 md:p-7">
          <h3 className="text-base font-bold text-foreground mb-4">{isEs ? "Detalle mensual" : "Monthly detail"}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">{isEs ? "Mes" : "Month"}</th>
                  <th className="py-2 pr-3">{isEs ? "Pago" : "Payment"}</th>
                  <th className="py-2 pr-3">{isEs ? "Principal" : "Principal"}</th>
                  <th className="py-2 pr-3">{isEs ? "Intereses" : "Interest"}</th>
                  <th className="py-2">{isEs ? "Saldo" : "Balance"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {displayedMonths.map((row) => (
                  <tr key={row.month} className={row.month % 2 === 0 ? "bg-secondary/20" : ""}>
                    <td className="py-1.5 pr-3 tabular-nums text-xs">{row.month}</td>
                    <td className="py-1.5 pr-3 tabular-nums text-xs">{fmtUSD2(row.payment)}</td>
                    <td className="py-1.5 pr-3 tabular-nums text-xs text-success">{fmtUSD2(row.principal)}</td>
                    <td className="py-1.5 pr-3 tabular-nums text-xs text-destructive">{fmtUSD2(row.interest)}</td>
                    <td className="py-1.5 tabular-nums text-xs">{fmtUSD(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {monthlyRows.length > 12 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-4 w-full"
              onClick={() => setShowAllMonths((v) => !v)}
            >
              {showAllMonths ? (
                <><ChevronUp className="size-4" /> {isEs ? "Mostrar menos" : "Show less"}</>
              ) : (
                <><ChevronDown className="size-4" /> {isEs ? `Mostrar los ${monthlyRows.length} meses` : `Show all ${monthlyRows.length} months`}</>
              )}
            </Button>
          )}
        </div>
      )}

      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 p-6 md:p-8 text-primary-foreground">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">{isEs ? "Obtén la mejor tasa para este monto de préstamo" : "Get the best rate on this loan amount"}</h3>
            <p className="mt-1 text-sm opacity-80">{isEs ? "Comparamos más de 1,000 prestamistas DSCR. Las 3 mejores ofertas en una hora. Sin consulta de crédito." : "We shop 1,000+ DSCR lenders. Top 3 offers in one hour. No credit pull."}</p>
          </div>
          <Button asChild variant="cta" size="lg" className="shrink-0">
            <a href={isEs ? "/es/get-matched?source=amortization-schedule-calculator" : "/get-matched?source=amortization-schedule-calculator"}>{isEs ? "Ver mis ofertas" : "Get my matches"} <ArrowRight className="size-4" /></a>
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

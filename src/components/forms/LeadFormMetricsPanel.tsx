'use client';

import { BarChart3, Percent, TrendingUp } from 'lucide-react';

import { cn } from '@/lib/utils';

interface LeadFormMetricsPanelProps {
  ltv: number;
  dscr: number;
  debtYield: number;
  isHero: boolean;
  isPolished: boolean;
  lang?: 'en' | 'es';
}

function metricTone(value: number, good: number, ok: number): string {
  if (value <= 0) return 'text-muted-foreground';
  if (value >= good) return 'text-success';
  if (value >= ok) return 'text-accent';
  return 'text-destructive';
}

export function LeadFormMetricsPanel({
  ltv,
  dscr,
  debtYield,
  isHero,
  isPolished,
  lang = 'en',
}: LeadFormMetricsPanelProps) {
  const isEs = lang === 'es';
  const metrics = [
    {
      label: 'LTV',
      value: ltv ? `${ltv.toFixed(1)}%` : '—',
      icon: Percent,
      tone: metricTone(ltv, 0, 75),
      hint: ltv > 75 ? (isEs ? 'Por encima' : 'Above typical') : ltv > 0 ? (isEs ? 'En rango' : 'In range') : '',
    },
    {
      label: isEs ? 'DSCR est.' : 'Est. DSCR',
      value: dscr ? `${dscr.toFixed(2)}x` : '—',
      icon: TrendingUp,
      tone: metricTone(dscr, 1.25, 1.0),
      hint:
        dscr >= 1.25
          ? isEs
            ? 'Fuerte'
            : 'Strong'
          : dscr >= 1.0
            ? isEs
              ? 'Límite'
              : 'Borderline'
            : dscr > 0
              ? isEs
                ? 'Ajustado'
                : 'Tight'
              : '',
    },
    {
      label: isEs ? 'Debt yield' : 'Debt Yield',
      value: debtYield ? `${debtYield.toFixed(1)}%` : '—',
      icon: BarChart3,
      tone: metricTone(debtYield, 9, 8),
      hint:
        debtYield >= 9
          ? isEs
            ? 'Fuerte'
            : 'Strong'
          : debtYield >= 8
            ? isEs
              ? 'Aceptable'
              : 'Acceptable'
            : debtYield > 0
              ? isEs
                ? 'Delgado'
                : 'Thin'
              : '',
    },
  ];

  if (isHero) {
    return (
      <div className="overflow-hidden rounded-xl border border-primary/12 bg-gradient-to-br from-primary/[0.05] via-background/90 to-accent/[0.06] shadow-inner shadow-primary/[0.04]">
        <div className="border-b border-primary/8 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
            {isEs ? 'Lectura direccional en vivo' : 'Live directional read'}
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border/50">
          {metrics.map(({ label, value, icon: Icon, tone, hint }) => (
            <div key={label} className="px-2 py-2.5 text-center">
              <Icon className="mx-auto mb-1 size-3.5 text-muted-foreground/70" />
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className={cn('mt-0.5 text-sm font-bold tabular-nums', tone)}>{value}</p>
              {hint && <p className="mt-0.5 text-[9px] text-muted-foreground">{hint}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isPolished) {
    return (
      <div className="overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.04] via-background to-accent/[0.06]">
        <div className="border-b border-primary/10 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">
            {isEs ? 'Lectura direccional en vivo' : 'Live directional read'}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {isEs ? 'Se actualiza al ingresar los números del deal' : 'Updates as you enter deal numbers'}
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border/60">
          {metrics.map(({ label, value, icon: Icon, tone, hint }) => (
            <div key={label} className="px-3 py-4 text-center">
              <Icon className="mx-auto mb-2 size-4 text-muted-foreground/70" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className={cn('mt-1 text-xl font-bold tabular-nums', tone)}>{value}</p>
              {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs">
      <p className="font-bold uppercase tracking-wider text-primary">
        {isEs ? 'Lectura direccional instantánea' : 'Instant directional read'}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-muted-foreground">
        {metrics.map(({ label, value }) => (
          <div key={label}>
            <span className="block">{label}</span>
            <strong className="text-foreground">{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

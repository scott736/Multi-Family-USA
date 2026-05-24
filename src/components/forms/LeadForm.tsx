'use client';

import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  DollarSign,
  Loader2,
  Mail,
  Percent,
  Phone,
  ShieldCheck,
  TrendingUp,
  User,
} from 'lucide-react';
import * as React from 'react';
import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trackConversion } from '@/lib/analytics';
import { cn } from '@/lib/utils';

const STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

const PURPOSES = [
  { value: 'acquisition', label: 'Acquisition' },
  { value: 'refinance', label: 'Refinance' },
  { value: 'bridge-to-stabilized', label: 'Bridge to Stabilized Refi' },
  { value: 'supplemental-or-second', label: 'Supplemental / 2nd Position' },
] as const;

const PROPERTY_TYPES = [
  { value: 'garden-style', label: 'Garden-Style Apartments' },
  { value: 'mid-rise', label: 'Mid-Rise Multifamily' },
  { value: 'value-add', label: 'Value-Add C-Class' },
  { value: 'suburban-community', label: 'Suburban Apartment Community' },
  { value: 'mixed-multifamily', label: 'Mixed Multifamily (5+ units)' },
] as const;

const TIMELINES = [
  { value: 'asap', label: 'ASAP (< 30 days)' },
  { value: '30-60', label: '30-60 days' },
  { value: '60-90', label: '60-90 days' },
  { value: '90-plus', label: '90+ days' },
] as const;

const STEPS = [
  { label: 'Asset', short: 'Asset', icon: Building2 },
  { label: 'Numbers', short: 'Numbers', icon: DollarSign },
  { label: 'Profile', short: 'Profile', icon: ShieldCheck },
  { label: 'Contact', short: 'Contact', icon: User },
] as const;

interface LeadFormProps {
  variant?: 'full' | 'compact' | 'hero' | 'premium';
  sourcePage?: string;
  sourceContext?: string;
  headline?: string;
  subheadline?: string;
  submitLabel?: string;
  className?: string;
}

function metricTone(value: number, good: number, ok: number): string {
  if (value <= 0) return 'text-muted-foreground';
  if (value >= good) return 'text-success';
  if (value >= ok) return 'text-accent';
  return 'text-destructive';
}

export default function LeadForm({
  variant = 'full',
  sourcePage = '/',
  sourceContext,
  headline,
  subheadline,
  submitLabel,
  className = '',
}: LeadFormProps) {
  const isNarrow = variant === 'compact' || variant === 'hero';
  const isPremium = variant === 'premium';

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    purpose: '',
    propertyType: '',
    units: '',
    state: '',
    purchasePrice: '',
    loanAmount: '',
    annualNoi: '',
    occupancy: '',
    creditScore: '',
    timeline: '',
    name: '',
    email: '',
    phone: '',
    website: '',
  });

  const parsed = useMemo(() => {
    const purchasePrice = parseFloat(formData.purchasePrice) || 0;
    const loanAmount = parseFloat(formData.loanAmount) || 0;
    const annualNoi = parseFloat(formData.annualNoi) || 0;
    const occupancy = parseFloat(formData.occupancy) || 0;
    const impliedDebtService = loanAmount > 0 ? loanAmount * 0.082 : 0;
    const dscr = impliedDebtService > 0 ? annualNoi / impliedDebtService : 0;
    const ltv = purchasePrice > 0 ? (loanAmount / purchasePrice) * 100 : 0;
    const debtYield = loanAmount > 0 ? (annualNoi / loanAmount) * 100 : 0;
    return { purchasePrice, loanAmount, annualNoi, occupancy, dscr, ltv, debtYield };
  }, [formData]);

  const isStepValid = () => {
    switch (step) {
      case 1:
        return !!formData.purpose && !!formData.propertyType && (parseInt(formData.units, 10) || 0) >= 5;
      case 2:
        return parsed.purchasePrice > 0 && parsed.loanAmount > 0 && parsed.annualNoi > 0 && parsed.occupancy > 0;
      case 3: {
        const credit = parseInt(formData.creditScore, 10) || 0;
        return credit >= 500 && credit <= 850 && !!formData.state && !!formData.timeline;
      }
      case 4:
        return (
          formData.name.trim().length >= 2 &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
          formData.phone.trim().length >= 7
        );
      default:
        return false;
    }
  };

  const update = (key: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const next = () => {
    if (isStepValid()) setStep((prev) => Math.min(4, prev + 1));
  };

  const back = () => {
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStepValid()) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          sourcePage,
          sourceContext,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Submission failed. Please try again.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);

      trackConversion('deal_review_submit', {
        source_page: sourcePage,
        source_context: sourceContext,
        variant,
      });

      const params = new URLSearchParams({
        status: 'success',
        name: formData.name,
        state: formData.state,
        purpose: formData.purpose,
        assignedOfficer: data.assignedTo?.id || '',
      });
      window.location.href = `/thank-you?${params.toString()}`;
    } catch {
      setErrorMsg('Submission failed. Please try again or call us directly.');
      setLoading(false);
    }
  };

  const choiceButtonClass = (selected: boolean) =>
    cn(
      'flex w-full items-center rounded-xl border text-left font-semibold transition-all duration-200',
      isPremium
        ? cn(
            'p-3.5 text-sm hover:-translate-y-0.5 hover:shadow-md',
            selected
              ? 'border-accent bg-accent/10 shadow-md shadow-accent/10 ring-2 ring-accent/40'
              : 'border-border/80 bg-background/80 hover:border-primary/30 hover:bg-secondary/60',
          )
        : cn(
            'text-xs hover:bg-secondary/50',
            selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card',
          ),
    );

  const inputClass = cn(
    'tabular-nums transition-shadow duration-200',
    isPremium && 'h-12 rounded-xl border-border/80 bg-background/90 focus-visible:ring-2 focus-visible:ring-accent/30',
  );

  const renderStepIndicator = () => {
    if (isPremium) {
      const progress = ((step - 1) / (STEPS.length - 1)) * 100;
      return (
        <div className="mb-7">
          <div className="mb-3 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>
              Step {step} of {STEPS.length}
            </span>
            <span className="text-accent">{Math.round((step / STEPS.length) * 100)}% complete</span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary via-accent to-accent transition-all duration-500 ease-out"
              style={{ width: `${progress === 0 ? 8 : progress}%` }}
            />
          </div>
          <div className="mt-5 grid grid-cols-4 gap-1">
            {STEPS.map(({ label, icon: Icon }, i) => {
              const stepNum = i + 1;
              const done = step > stepNum;
              const active = step === stepNum;
              return (
                <div key={label} className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      'flex size-9 items-center justify-center rounded-full border-2 transition-all duration-300',
                      done && 'border-success bg-success text-success-foreground shadow-sm shadow-success/25',
                      active && !done && 'border-accent bg-accent/15 text-accent shadow-md shadow-accent/20 scale-110',
                      !done && !active && 'border-border bg-background text-muted-foreground',
                    )}
                  >
                    {done ? <Check className="size-4" strokeWidth={3} /> : <Icon className="size-4" />}
                  </div>
                  <span
                    className={cn(
                      'hidden text-[10px] font-bold uppercase tracking-wider @sm:block',
                      active ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className={cn('mb-5 grid grid-cols-4 gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>
        {STEPS.map(({ label }, i) => (
          <span
            key={label}
            className={cn('border-b-2 pb-1 text-center', step >= i + 1 ? 'border-primary text-primary' : 'border-transparent')}
          >
            {i + 1}. {label}
          </span>
        ))}
      </div>
    );
  };

  const renderMetricsPanel = () => {
    const metrics = [
      {
        label: 'LTV',
        value: parsed.ltv ? `${parsed.ltv.toFixed(1)}%` : '—',
        icon: Percent,
        tone: metricTone(parsed.ltv, 0, 75),
        hint: parsed.ltv > 75 ? 'Above typical' : parsed.ltv > 0 ? 'In range' : '',
      },
      {
        label: 'Est. DSCR',
        value: parsed.dscr ? `${parsed.dscr.toFixed(2)}x` : '—',
        icon: TrendingUp,
        tone: metricTone(parsed.dscr, 1.25, 1.0),
        hint: parsed.dscr >= 1.25 ? 'Strong' : parsed.dscr >= 1.0 ? 'Borderline' : parsed.dscr > 0 ? 'Tight' : '',
      },
      {
        label: 'Debt Yield',
        value: parsed.debtYield ? `${parsed.debtYield.toFixed(1)}%` : '—',
        icon: BarChart3,
        tone: metricTone(parsed.debtYield, 9, 8),
        hint: parsed.debtYield >= 9 ? 'Strong' : parsed.debtYield >= 8 ? 'Acceptable' : parsed.debtYield > 0 ? 'Thin' : '',
      },
    ];

    if (isPremium) {
      return (
        <div className="overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.04] via-background to-accent/[0.06]">
          <div className="border-b border-primary/10 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Live directional read</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Updates as you enter deal numbers</p>
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
        <p className="font-bold uppercase tracking-wider text-primary">Instant directional read</p>
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
  };

  if (success) {
    return (
      <div
        className={cn(
          'rounded-xl border border-success/30 bg-success/5 p-8 text-center',
          isPremium && 'rounded-2xl shadow-2xl',
        )}
      >
        <CheckCircle2 className="mx-auto mb-4 size-16 text-success" />
        <h3 className="text-2xl font-bold text-foreground">Thanks — your deal review is in queue.</h3>
        <p className="mt-3 text-muted-foreground">We will send an initial underwriting read and lender-fit direction shortly.</p>
      </div>
    );
  }

  const formCard = (
    <div
      className={cn(
        '@container transition-all duration-300',
        isPremium
          ? 'rounded-2xl bg-card p-6 shadow-2xl shadow-primary/10 md:p-8'
          : cn(
              'rounded-2xl border border-border bg-card shadow-lg',
              isNarrow ? 'p-4' : 'p-5 md:p-7',
              variant === 'hero' && 'shadow-2xl ring-1 ring-primary/10',
            ),
        className,
      )}
    >
      <div className={cn('mb-5', isNarrow && 'mb-4', isPremium && 'mb-6')}>
        <h3
          className={cn(
            'font-bold tracking-tight text-foreground',
            isPremium ? 'text-2xl md:text-[1.65rem]' : isNarrow ? 'text-lg leading-snug' : 'text-xl md:text-2xl',
          )}
        >
          {headline ?? 'Free multifamily deal review'}
        </h3>
        <p className={cn('mt-1.5 leading-relaxed text-muted-foreground', isPremium ? 'text-sm' : 'text-sm')}>
          {subheadline ?? 'US 5+ unit only. No credit pull. Get a practical underwriting and lender-fit read.'}
        </p>
      </div>

      {renderStepIndicator()}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-10000px] h-0 w-0 opacity-0"
          value={formData.website}
          onChange={(e) => update('website', e.target.value)}
        />

        <div key={step} className="animate-in fade-in slide-in-from-right-3 duration-300 fill-mode-both">
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-2.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deal purpose</Label>
                <div className="grid gap-2 @sm:grid-cols-2">
                  {PURPOSES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => update('purpose', p.value)}
                      className={cn(choiceButtonClass(formData.purpose === p.value), 'justify-center text-center')}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Property type</Label>
                <div className="grid gap-2 @sm:grid-cols-2">
                  {PROPERTY_TYPES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => update('propertyType', p.value)}
                      className={cn(choiceButtonClass(formData.propertyType === p.value), 'gap-2.5')}
                    >
                      <Building2
                        className={cn(
                          'size-4 shrink-0',
                          formData.propertyType === p.value ? 'text-accent' : 'text-muted-foreground',
                        )}
                      />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="lf-units" className="text-xs font-medium text-foreground">
                  Unit count <span className="text-muted-foreground">(5+ required)</span>
                </Label>
                <Input
                  id="lf-units"
                  type="number"
                  inputMode="numeric"
                  min={5}
                  placeholder="24"
                  className={inputClass}
                  value={formData.units}
                  onChange={(e) => update('units', e.target.value.replace(/[^0-9]/g, ''))}
                  required
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="grid gap-4 @md:grid-cols-2">
                {[
                  ['purchasePrice', 'Purchase price', '3,250,000'],
                  ['loanAmount', 'Requested loan amount', '2,200,000'],
                  ['annualNoi', 'Annual NOI', '285,000'],
                  ['occupancy', 'Occupancy %', '93'],
                ].map(([key, label, placeholder]) => (
                  <div key={key} className="grid gap-1.5">
                    <Label htmlFor={`lf-${key}`} className="text-xs font-medium text-foreground">
                      {label}
                    </Label>
                    <div className="relative">
                      {key !== 'occupancy' && (
                        <DollarSign className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      )}
                      <Input
                        id={`lf-${key}`}
                        type="number"
                        inputMode="decimal"
                        placeholder={placeholder}
                        className={cn(inputClass, key !== 'occupancy' ? 'pl-10' : '')}
                        value={formData[key as keyof typeof formData]}
                        onChange={(e) => update(key as keyof typeof formData, e.target.value.replace(/[^0-9.]/g, ''))}
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>

              {renderMetricsPanel()}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="grid gap-4 @md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="lf-credit" className="text-xs font-medium text-foreground">
                    Estimated sponsor credit score
                  </Label>
                  <Input
                    id="lf-credit"
                    type="number"
                    inputMode="numeric"
                    min={500}
                    max={850}
                    placeholder="720"
                    className={inputClass}
                    value={formData.creditScore}
                    onChange={(e) => update('creditScore', e.target.value.replace(/[^0-9]/g, ''))}
                    required
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="lf-state" className="text-xs font-medium text-foreground">
                    Property state
                  </Label>
                  <select
                    id="lf-state"
                    className={cn(
                      'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                      isPremium && 'h-12 rounded-xl border-border/80 bg-background/90 focus-visible:ring-accent/30',
                    )}
                    value={formData.state}
                    onChange={(e) => update('state', e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select state
                    </option>
                    {STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Execution timeline</Label>
                <div className="grid gap-2 @sm:grid-cols-2">
                  {TIMELINES.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => update('timeline', o.value)}
                      className={cn(choiceButtonClass(formData.timeline === o.value), 'justify-center text-center')}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="grid gap-1.5">
                <Label htmlFor="lf-name" className="text-xs font-medium text-foreground">
                  Full name
                </Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="lf-name"
                    type="text"
                    placeholder="Jane Investor"
                    className={cn(inputClass, 'pl-10')}
                    value={formData.name}
                    onChange={(e) => update('name', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="lf-email" className="text-xs font-medium text-foreground">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="lf-email"
                    type="email"
                    placeholder="jane@email.com"
                    className={cn(inputClass, 'pl-10')}
                    value={formData.email}
                    onChange={(e) => update('email', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="lf-phone" className="text-xs font-medium text-foreground">
                  Phone
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="lf-phone"
                    type="tel"
                    placeholder="(555) 555-5555"
                    className={cn(inputClass, 'pl-10')}
                    value={formData.phone}
                    onChange={(e) => update('phone', e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="animate-in fade-in rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            {errorMsg}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          {step > 1 && (
            <button
              type="button"
              onClick={back}
              disabled={loading}
              className={cn(
                'inline-flex h-12 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-5 text-sm font-bold text-foreground transition hover:bg-secondary/80 disabled:opacity-50',
                !isPremium && 'h-11 rounded-lg',
              )}
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={next}
              disabled={!isStepValid()}
              className={cn(
                'inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition hover:bg-primary/95 disabled:opacity-50',
                isPremium && 'shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25',
                !isPremium && 'h-11 rounded-lg',
              )}
            >
              Continue
              <ArrowRight className="size-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!isStepValid() || loading}
              className={cn(
                'inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold transition disabled:opacity-50',
                isPremium
                  ? 'bg-gradient-to-r from-accent via-accent to-[hsl(38_90%_48%)] text-accent-foreground shadow-lg shadow-accent/30 hover:shadow-xl hover:shadow-accent/40 hover:brightness-105'
                  : 'h-11 rounded-lg bg-accent text-accent-foreground shadow-md hover:bg-accent/90',
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  {submitLabel ?? 'Get My Deal Review'}
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          )}
        </div>
      </form>

      {!isPremium && (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[10px] leading-normal text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0 text-success" />
          <span>No credit pull. US multifamily only. Your info is shared only for deal review follow-up.</span>
        </p>
      )}
    </div>
  );

  if (isPremium) {
    return (
      <div className="rounded-[1.35rem] bg-gradient-to-br from-accent/50 via-accent/20 to-primary/30 p-[1px] shadow-2xl shadow-primary/20">
        {formCard}
      </div>
    );
  }

  return formCard;
}

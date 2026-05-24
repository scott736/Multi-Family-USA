'use client';

import { ArrowLeft, ArrowRight, Building2, CheckCircle2, DollarSign, Mail, Phone, ShieldCheck, User } from 'lucide-react';
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

interface LeadFormProps {
  variant?: 'full' | 'compact' | 'hero';
  sourcePage?: string;
  sourceContext?: string;
  headline?: string;
  subheadline?: string;
  submitLabel?: string;
  className?: string;
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

  if (success) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/5 p-8 text-center">
        <CheckCircle2 className="mx-auto mb-4 size-16 text-success" />
        <h3 className="text-2xl font-bold text-foreground">Thanks - your deal review is in queue.</h3>
        <p className="mt-3 text-muted-foreground">We will send an initial underwriting read and lender-fit direction shortly.</p>
      </div>
    );
  }

  return (
    <div className={cn(
      '@container rounded-2xl border border-border bg-card shadow-lg transition-all duration-300',
      isNarrow ? 'p-4' : 'p-5 md:p-7',
      variant === 'hero' ? 'shadow-2xl ring-1 ring-primary/10' : '',
      className,
    )}>
      <div className={cn('mb-5', isNarrow && 'mb-4')}>
        <h3 className={cn('font-bold text-foreground tracking-tight', isNarrow ? 'text-lg leading-snug' : 'text-xl md:text-2xl')}>
          {headline ?? 'Free multifamily deal review'}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          {subheadline ?? 'US 5+ unit only. No credit pull. Get a practical underwriting and lender-fit read.'}
        </p>
      </div>

      <div className={cn('mb-5 grid grid-cols-4 gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>
        {["Asset", "Numbers", "Profile", "Contact"].map((label, i) => (
          <span key={label} className={cn('border-b-2 pb-1 text-center', step >= i + 1 ? 'border-primary text-primary' : 'border-transparent')}>
            {i + 1}. {label}
          </span>
        ))}
      </div>

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

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deal purpose</Label>
              <div className="grid gap-2 @sm:grid-cols-2">
                {PURPOSES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => update('purpose', p.value)}
                    className={cn(
                      'flex w-full items-center justify-center rounded-xl border p-3 text-center text-xs font-bold transition-all hover:bg-secondary/50',
                      formData.purpose === p.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card',
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Property type</Label>
              <div className="grid gap-2 @sm:grid-cols-2">
                {PROPERTY_TYPES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => update('propertyType', p.value)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-xl border p-3 text-left text-xs font-semibold transition-all hover:bg-secondary/50',
                      formData.propertyType === p.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card',
                    )}
                  >
                    <Building2 className="size-4 text-muted-foreground" />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="lf-units" className="text-xs font-medium text-foreground">Unit count (5+ required)</Label>
              <Input
                id="lf-units"
                type="number"
                inputMode="numeric"
                min={5}
                placeholder="24"
                className="tabular-nums"
                value={formData.units}
                onChange={(e) => update('units', e.target.value.replace(/[^0-9]/g, ''))}
                required
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid gap-4 @md:grid-cols-2">
              {[
                ['purchasePrice', 'Purchase price', '3250000'],
                ['loanAmount', 'Requested loan amount', '2200000'],
                ['annualNoi', 'Annual NOI', '285000'],
                ['occupancy', 'Occupancy %', '93'],
              ].map(([key, label, placeholder]) => (
                <div key={key} className="grid gap-1.5">
                  <Label htmlFor={`lf-${key}`} className="text-xs font-medium text-foreground">{label}</Label>
                  <div className="relative">
                    {(key !== 'occupancy') && <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />}
                    <Input
                      id={`lf-${key}`}
                      type="number"
                      inputMode="decimal"
                      placeholder={placeholder}
                      className={cn('tabular-nums', key !== 'occupancy' ? 'pl-9' : '')}
                      value={formData[key as keyof typeof formData]}
                      onChange={(e) => update(key as keyof typeof formData, e.target.value.replace(/[^0-9.]/g, ''))}
                      required
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs">
              <p className="font-bold uppercase tracking-wider text-primary">Instant directional read</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-muted-foreground">
                <div><span className="block">LTV</span><strong className="text-foreground">{parsed.ltv ? `${parsed.ltv.toFixed(1)}%` : '-'} </strong></div>
                <div><span className="block">Est. DSCR</span><strong className="text-foreground">{parsed.dscr ? `${parsed.dscr.toFixed(2)}x` : '-'}</strong></div>
                <div><span className="block">Debt Yield</span><strong className="text-foreground">{parsed.debtYield ? `${parsed.debtYield.toFixed(1)}%` : '-'}</strong></div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid gap-4 @md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="lf-credit" className="text-xs font-medium text-foreground">Estimated sponsor credit score</Label>
                <Input
                  id="lf-credit"
                  type="number"
                  inputMode="numeric"
                  min={500}
                  max={850}
                  placeholder="720"
                  className="tabular-nums"
                  value={formData.creditScore}
                  onChange={(e) => update('creditScore', e.target.value.replace(/[^0-9]/g, ''))}
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="lf-state" className="text-xs font-medium text-foreground">Property state</Label>
                <select
                  id="lf-state"
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  value={formData.state}
                  onChange={(e) => update('state', e.target.value)}
                  required
                >
                  <option value="" disabled>Select state</option>
                  {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Execution timeline</Label>
              <div className="grid gap-2 @sm:grid-cols-2">
                {TIMELINES.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => update('timeline', o.value)}
                    className={cn(
                      'flex w-full items-center justify-center rounded-xl border p-3 text-center text-xs font-bold transition-all hover:bg-secondary/50',
                      formData.timeline === o.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card',
                    )}
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
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="lf-name" className="text-xs font-medium text-foreground">Full name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input id="lf-name" type="text" placeholder="Jane Investor" className="pl-9" value={formData.name} onChange={(e) => update('name', e.target.value)} required />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="lf-email" className="text-xs font-medium text-foreground">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input id="lf-email" type="email" placeholder="jane@email.com" className="pl-9" value={formData.email} onChange={(e) => update('email', e.target.value)} required />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="lf-phone" className="text-xs font-medium text-foreground">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input id="lf-phone" type="tel" placeholder="(555) 555-5555" className="pl-9" value={formData.phone} onChange={(e) => update('phone', e.target.value)} required />
                </div>
              </div>
            </div>
          </div>
        )}

        {errorMsg && <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">{errorMsg}</div>}

        <div className="flex gap-3 pt-2">
          {step > 1 && (
            <button
              type="button"
              onClick={back}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-bold text-foreground transition hover:bg-secondary/80 disabled:opacity-50"
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
              className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/95 transition disabled:opacity-50"
            >
              Continue
              <ArrowRight className="size-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!isStepValid() || loading}
              className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent text-accent-foreground font-bold text-sm shadow-md hover:bg-accent/90 transition disabled:opacity-50"
            >
              {loading ? 'Submitting...' : (submitLabel ?? 'Get My Deal Review')}
              {!loading && <ArrowRight className="size-4" />}
            </button>
          )}
        </div>
      </form>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground text-center leading-normal">
        <ShieldCheck className="size-3.5 text-success shrink-0" />
        <span>No credit pull. US multifamily only. Your info is shared only for deal review follow-up.</span>
      </p>
    </div>
  );
}

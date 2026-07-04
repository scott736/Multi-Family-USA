'use client';

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  DollarSign,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from 'lucide-react';
import * as React from 'react';
import { useEffect, useMemo, useReducer, useState } from 'react';

import { LeadFormMetricsPanel } from '@/components/forms/LeadFormMetricsPanel';
import { LeadFormStepIndicator } from '@/components/forms/LeadFormStepIndicator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trackConversion } from '@/lib/analytics';
import { parseLeadFormPrefill } from '@/lib/deal-review-url';
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
  lang?: 'en' | 'es';
}

const INITIAL_FORM_DATA = {
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
};

type LeadFormData = typeof INITIAL_FORM_DATA;

interface LeadFormUiState {
  step: number;
  loading: boolean;
  errorMsg: string;
  success: boolean;
}

type LeadFormUiAction =
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'submit-start' }
  | { type: 'submit-failure'; message: string }
  | { type: 'submit-success' };

const INITIAL_UI_STATE: LeadFormUiState = {
  step: 1,
  loading: false,
  errorMsg: '',
  success: false,
};

function leadFormUiReducer(state: LeadFormUiState, action: LeadFormUiAction): LeadFormUiState {
  switch (action.type) {
    case 'next':
      return { ...state, step: Math.min(4, state.step + 1) };
    case 'back':
      return { ...state, step: Math.max(1, state.step - 1) };
    case 'submit-start':
      return { ...state, loading: true, errorMsg: '' };
    case 'submit-failure':
      return { ...state, loading: false, errorMsg: action.message };
    case 'submit-success':
      return { ...state, loading: false, success: true };
    default:
      return state;
  }
}

export default function LeadForm({
  variant = 'full',
  sourcePage = '/',
  sourceContext,
  headline,
  subheadline,
  submitLabel,
  className = '',
  lang = 'en',
}: LeadFormProps) {
  const isEs = lang === 'es';
  const bookCallHref = isEs ? '/es/book-strategy-call' : '/book-strategy-call';
  const isHero = variant === 'hero';
  const isPremium = variant === 'premium';
  const isPolished = isPremium;
  const isCompact = variant === 'compact';

  const heroSelectClass =
    'flex h-10 w-full rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm shadow-xs backdrop-blur-sm transition-shadow duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/35';
  const heroStepPanelClass = 'min-h-[340px]';

  const [{ step, loading, errorMsg, success }, dispatchUi] = useReducer(leadFormUiReducer, INITIAL_UI_STATE);

  const [formData, setFormData] = useState<LeadFormData>(INITIAL_FORM_DATA);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefill = parseLeadFormPrefill(window.location.search);
    if (Object.keys(prefill).length === 0) return;
    setFormData((prev) => ({
      ...prev,
      ...(prefill.purpose ? { purpose: prefill.purpose } : {}),
      ...(prefill.purchasePrice ? { purchasePrice: prefill.purchasePrice } : {}),
      ...(prefill.loanAmount ? { loanAmount: prefill.loanAmount } : {}),
      ...(prefill.annualNoi ? { annualNoi: prefill.annualNoi } : {}),
      ...(prefill.occupancy ? { occupancy: prefill.occupancy } : {}),
      ...(prefill.state ? { state: prefill.state } : {}),
      ...(prefill.units ? { units: prefill.units } : {}),
    }));
    if (prefill.sourceContext && !sourceContext) {
      trackConversion('lead_form_prefill', { source: prefill.sourceContext });
    }
  }, [sourceContext]);

  useEffect(() => {
    trackConversion('lead_form_step', {
      step,
      variant,
      source_page: sourcePage,
      source_context: sourceContext,
    });
  }, [step, variant, sourcePage, sourceContext]);

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
        return (
          parsed.purchasePrice > 0 &&
          parsed.loanAmount > 0 &&
          parsed.annualNoi > 0 &&
          parsed.occupancy > 0 &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
        );
      case 3: {
        const credit = parseInt(formData.creditScore, 10) || 0;
        return credit >= 500 && credit <= 850 && !!formData.state && !!formData.timeline;
      }
      case 4:
        return formData.name.trim().length >= 2 && formData.phone.trim().length >= 7;
      default:
        return false;
    }
  };

  const update = (key: keyof LeadFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const savePartialLead = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return;

    void fetch('/api/lead-partial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        sourcePage,
        sourceContext,
        lang,
      }),
    }).catch(() => {});
  };

  const next = () => {
    if (!isStepValid()) return;
    if (step === 2) savePartialLead();
    dispatchUi({ type: 'next' });
  };

  const back = () => {
    dispatchUi({ type: 'back' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStepValid()) return;

    dispatchUi({ type: 'submit-start' });

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
        dispatchUi({ type: 'submit-failure', message: data.error || 'Submission failed. Please try again.' });
        return;
      }

      dispatchUi({ type: 'submit-success' });

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
      dispatchUi({ type: 'submit-failure', message: 'Submission failed. Please try again or call us directly.' });
    }
  };

  const inputClass = cn(
    'tabular-nums transition-shadow duration-200',
    isPremium && 'h-12 rounded-xl border-border/80 bg-background/90 focus-visible:ring-2 focus-visible:ring-accent/30',
    isHero && 'h-10 rounded-xl border-border/70 bg-background/80 backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-accent/35',
  );

  if (success) {
    return (
      <div
        className={cn(
          'rounded-xl border border-success/30 bg-success/5 p-8 text-center',
          isPolished && 'rounded-2xl shadow-2xl',
        )}
      >
        <CheckCircle2 className="mx-auto mb-4 size-16 text-success" />
        <h3 className="text-2xl font-bold text-foreground">Thanks — your deal review is in queue.</h3>
        <p className="mt-3 text-muted-foreground">We will send an initial underwriting read and lender-fit direction shortly.</p>
      </div>
    );
  }

  return renderLeadFormCard({
    className,
    errorMsg,
    formData,
    handleSubmit,
    headline,
    heroSelectClass,
    heroStepPanelClass,
    inputClass,
    isCompact,
    isHero,
    isPolished,
    isPremium,
    isStepValid,
    loading,
    parsed,
    step,
    subheadline,
    submitLabel,
    update,
    onBack: back,
    onNext: next,
    bookCallHref,
    isEs,
  });
}

interface LeadFormParsedMetrics {
  ltv: number;
  dscr: number;
  debtYield: number;
}

interface RenderLeadFormCardProps {
  className: string;
  errorMsg: string;
  formData: LeadFormData;
  handleSubmit: (e: React.FormEvent) => void;
  headline?: string;
  heroSelectClass: string;
  heroStepPanelClass: string;
  inputClass: string;
  isCompact: boolean;
  isHero: boolean;
  isPolished: boolean;
  isPremium: boolean;
  isStepValid: () => boolean;
  loading: boolean;
  parsed: LeadFormParsedMetrics;
  step: number;
  subheadline?: string;
  submitLabel?: string;
  update: (key: keyof LeadFormData, value: string) => void;
  onBack: () => void;
  onNext: () => void;
  bookCallHref: string;
  isEs: boolean;
}

function renderLeadFormCard({
  className,
  errorMsg,
  formData,
  handleSubmit,
  headline,
  heroSelectClass,
  heroStepPanelClass,
  inputClass,
  isCompact,
  isHero,
  isPolished,
  isPremium,
  isStepValid,
  loading,
  parsed,
  step,
  subheadline,
  submitLabel,
  update,
  onBack,
  onNext,
  bookCallHref,
  isEs,
}: RenderLeadFormCardProps) {
  const formCard = (
    <div
      className={cn(
        '@container transition-all duration-300',
        isPremium
          ? 'rounded-2xl bg-card p-6 shadow-2xl shadow-primary/10 md:p-8'
          : isHero
            ? 'rounded-2xl border border-border/60 bg-card/85 p-5 shadow-xl shadow-primary/[0.06] ring-1 ring-primary/[0.05] backdrop-blur-md'
            : cn(
                'rounded-2xl border border-border bg-card shadow-lg',
                isCompact ? 'p-4' : 'p-5 md:p-7',
              ),
        className,
      )}
    >
      <div className={cn('mb-5', isCompact && 'mb-4', isPremium && 'mb-6', isHero && 'mb-4')}>
        <h3
          className={cn(
            'font-bold tracking-tight text-foreground',
            isPremium
              ? 'text-2xl md:text-[1.65rem]'
              : isHero
                ? 'text-lg md:text-xl'
                : isCompact
                  ? 'text-lg leading-snug'
                  : 'text-xl md:text-2xl',
          )}
        >
          {headline ?? 'Free multifamily deal review'}
        </h3>
        <p
          className={cn(
            'mt-1.5 leading-relaxed text-muted-foreground',
            isPremium ? 'text-sm' : isHero ? 'text-xs md:text-sm' : 'text-sm',
          )}
        >
          {subheadline ??
            (isHero
              ? 'Four quick steps — asset, numbers, profile, contact. No credit pull.'
              : 'US 5+ unit only. No credit pull. Get a practical underwriting and lender-fit read.')}
        </p>
      </div>

      <LeadFormStepIndicator step={step} steps={STEPS} isHero={isHero} isPolished={isPolished} />

      <form onSubmit={handleSubmit} noValidate className={cn(isPremium ? 'space-y-6' : isHero ? 'space-y-4' : 'space-y-5')}>
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

        <div
          key={step}
          className={cn(
            'animate-in fade-in slide-in-from-right-3 duration-300 fill-mode-both',
            isHero && heroStepPanelClass,
          )}
        >
          {step === 1 && (
            <div className={cn(isPremium ? 'space-y-6' : isHero ? 'space-y-3.5' : 'space-y-5')}>
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Deal purpose</Label>
                <div className="grid gap-2 @sm:grid-cols-2">
                  {PURPOSES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => update('purpose', p.value)}
                      className={cn(choiceButtonClass(formData.purpose === p.value, isPremium, isHero), 'justify-center text-center')}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {isHero ? (
                <div className="grid gap-3 @sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Property type
                    </Label>
                    <select
                      id="lf-property-type"
                      className={heroSelectClass}
                      value={formData.propertyType}
                      onChange={(e) => update('propertyType', e.target.value)}
                      required
                    >
                      <option value="" disabled>
                        Select type
                      </option>
                      {PROPERTY_TYPES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="lf-units"
                      className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Unit count <span className="font-medium normal-case tracking-normal text-foreground/70">(5+)</span>
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
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Property type
                    </Label>
                    <div className="grid gap-2 @sm:grid-cols-2">
                      {PROPERTY_TYPES.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => update('propertyType', p.value)}
                          className={cn(choiceButtonClass(formData.propertyType === p.value, isPremium, isHero), 'gap-2.5')}
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

                  <div
                    className={cn(
                      'grid gap-1.5 transition-colors',
                      isPremium && 'rounded-xl border border-border/80 bg-secondary/30 p-4',
                    )}
                  >
                    <Label
                      htmlFor="lf-units"
                      className={cn(
                        'font-semibold uppercase tracking-wider text-muted-foreground',
                        'text-xs',
                      )}
                    >
                      Unit count <span className="font-medium normal-case tracking-normal text-foreground/70">(5+ required)</span>
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
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div className={cn(isHero ? 'space-y-3.5' : 'space-y-5')}>
              <div className={cn(isHero ? 'grid gap-3 @sm:grid-cols-2' : 'grid gap-4 @md:grid-cols-2')}>
                {[
                  ['purchasePrice', 'Purchase price', '3,250,000'],
                  ['loanAmount', 'Requested loan amount', '2,200,000'],
                  ['annualNoi', 'Annual NOI', '285,000'],
                  ['occupancy', 'Occupancy %', '93'],
                ].map(([key, label, placeholder]) => (
                  <div key={key} className="grid gap-1.5">
                    <Label
                      htmlFor={`lf-${key}`}
                      className={cn('font-medium text-foreground', isHero ? 'text-[11px]' : 'text-xs')}
                    >
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
                        value={formData[key as keyof LeadFormData]}
                        onChange={(e) => update(key as keyof LeadFormData, e.target.value.replace(/[^0-9.]/g, ''))}
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>

              <LeadFormMetricsPanel
                ltv={parsed.ltv}
                dscr={parsed.dscr}
                debtYield={parsed.debtYield}
                isHero={isHero}
                isPolished={isPolished}
              />

              <div className="grid gap-1.5">
                <Label
                  htmlFor="lf-email"
                  className={cn('font-medium text-foreground', isHero ? 'text-[11px]' : 'text-xs')}
                >
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
                <p className="text-[11px] text-muted-foreground">
                  {isEs
                    ? 'Guardamos su progreso para poder enviarle la revisión.'
                    : 'We save your progress so we can send your deal review.'}
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className={cn(isHero ? 'space-y-3.5' : 'space-y-5')}>
              <div className={cn(isHero ? 'grid gap-3 @sm:grid-cols-2' : 'grid gap-4 @md:grid-cols-2')}>
                <div className="grid gap-1.5">
                  <Label
                    htmlFor="lf-credit"
                    className={cn('font-medium text-foreground', isHero ? 'text-[11px]' : 'text-xs')}
                  >
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
                  <Label
                    htmlFor="lf-state"
                    className={cn('font-medium text-foreground', isHero ? 'text-[11px]' : 'text-xs')}
                  >
                    Property state
                  </Label>
                  <select
                    id="lf-state"
                    className={cn(
                      'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                      isPremium && 'h-12 rounded-xl border-border/80 bg-background/90 focus-visible:ring-accent/30',
                      isHero && heroSelectClass,
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

              {isHero ? (
                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Execution timeline
                  </Label>
                  <select
                    id="lf-timeline"
                    className={heroSelectClass}
                    value={formData.timeline}
                    onChange={(e) => update('timeline', e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select timeline
                    </option>
                    {TIMELINES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Execution timeline
                  </Label>
                  <div className="grid gap-2 @sm:grid-cols-2">
                    {TIMELINES.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => update('timeline', o.value)}
                        className={cn(choiceButtonClass(formData.timeline === o.value, isPremium, isHero), 'justify-center text-center')}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className={cn(isHero ? 'grid gap-3 @sm:grid-cols-2' : 'space-y-4')}>
              <div className={cn('grid gap-1.5', isHero && '@sm:col-span-2')}>
                <Label
                  htmlFor="lf-name"
                  className={cn('font-medium text-foreground', isHero ? 'text-[11px]' : 'text-xs')}
                >
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

              <div className={cn('grid gap-1.5', isHero && '@sm:col-span-2')}>
                <Label
                  htmlFor="lf-phone"
                  className={cn('font-medium text-foreground', isHero ? 'text-[11px]' : 'text-xs')}
                >
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

        {step >= 2 && step < 4 && (
          <p className="text-center text-xs text-muted-foreground">
            {isEs ? '¿Prefiere hablar en vivo?' : 'Prefer to talk live?'}{' '}
            <a
              href={bookCallHref}
              className="font-semibold text-accent hover:underline"
              data-analytics-location="lead-form-escape"
            >
              {isEs ? 'Reserve una llamada de 30 min →' : 'Book a 30-min strategy call →'}
            </a>
          </p>
        )}

        {errorMsg && (
          <div className="animate-in fade-in rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            {errorMsg}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          {step > 1 && (
            <button
              type="button"
              onClick={onBack}
              disabled={loading}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 border border-border bg-card px-5 text-sm font-bold text-foreground transition hover:bg-secondary/80 disabled:opacity-50',
                isPremium ? 'h-12 rounded-xl' : isHero ? 'h-11 rounded-xl' : 'h-11 rounded-lg',
              )}
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={onNext}
              disabled={!isStepValid()}
              className={cn(
                'inline-flex flex-1 items-center justify-center gap-1.5 text-sm font-bold transition disabled:opacity-50',
                isPremium ? 'h-12 rounded-xl' : isHero ? 'h-11 rounded-xl' : 'h-11 rounded-lg',
                isHero || isPremium
                  ? 'bg-gradient-to-r from-accent via-accent to-[hsl(38_90%_48%)] text-accent-foreground shadow-md shadow-accent/25 hover:shadow-lg hover:shadow-accent/35 hover:brightness-105'
                  : 'bg-primary text-primary-foreground hover:bg-primary/95',
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
                'inline-flex flex-1 items-center justify-center gap-2 text-sm font-bold transition disabled:opacity-50',
                isPremium || isHero
                  ? 'h-10 rounded-lg bg-gradient-to-r from-accent via-accent to-[hsl(38_90%_48%)] text-accent-foreground shadow-md shadow-accent/25 hover:shadow-lg hover:shadow-accent/35 hover:brightness-105'
                  : 'h-11 rounded-lg bg-accent text-accent-foreground shadow-md hover:bg-accent/90',
                isPremium && 'h-12 rounded-xl shadow-lg shadow-accent/30 hover:shadow-xl hover:shadow-accent/40',
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
        <p
          className={cn(
            'mt-3 flex items-center justify-center gap-1.5 text-center leading-normal text-muted-foreground',
            isHero ? 'text-[11px]' : 'text-[10px]',
          )}
        >
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

  if (isHero) {
    return (
      <div className="group relative">
        <div
          className="pointer-events-none absolute -inset-3 rounded-[1.35rem] bg-gradient-to-br from-accent/25 via-transparent to-primary/15 opacity-70 blur-2xl transition duration-700 group-hover:opacity-100"
          aria-hidden="true"
        />
        <div className="relative rounded-[1.2rem] bg-gradient-to-br from-accent/35 via-accent/10 to-primary/20 p-px shadow-2xl shadow-primary/10">
          {formCard}
        </div>
      </div>
    );
  }

  return formCard;
}

function choiceButtonClass(selected: boolean, isPremium: boolean, isHero: boolean) {
  return cn(
    'flex w-full items-center border text-left font-semibold transition-all duration-200',
    isPremium
      ? cn(
          'rounded-xl p-3.5 text-sm hover:-translate-y-0.5 hover:shadow-md',
          selected
            ? 'border-accent bg-accent/10 shadow-md shadow-accent/10 ring-2 ring-accent/40'
            : 'border-border/80 bg-background/80 hover:border-primary/30 hover:bg-secondary/60',
        )
      : isHero
        ? cn(
            'rounded-xl px-3 py-2.5 text-xs transition-all duration-200',
            selected
              ? 'border-accent bg-accent/12 shadow-sm shadow-accent/15 ring-2 ring-accent/35'
              : 'border-border/70 bg-background/70 hover:-translate-y-px hover:border-primary/25 hover:bg-secondary/50 hover:shadow-sm',
          )
        : cn(
            'rounded-xl text-xs hover:bg-secondary/50',
            selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card',
          ),
  );
}

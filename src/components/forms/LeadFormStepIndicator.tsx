'use client';

import { Check, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface LeadFormStep {
  label: string;
  short: string;
  icon: LucideIcon;
}

interface LeadFormStepIndicatorProps {
  step: number;
  steps: readonly LeadFormStep[];
  isHero: boolean;
  isPolished: boolean;
}

export function LeadFormStepIndicator({
  step,
  steps,
  isHero,
  isPolished,
}: LeadFormStepIndicatorProps) {
  if (isHero) {
    const progress = (step / steps.length) * 100;
    return (
      <div className="mb-5">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Your investor journey</p>
          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
            Step {step}/{steps.length} · {Math.round(progress)}%
          </span>
        </div>
        <div className="relative h-1.5 overflow-hidden rounded-full bg-secondary/90">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary via-accent to-[hsl(38_90%_48%)] transition-all duration-500 ease-out"
            style={{ width: `${Math.max(progress, 8)}%` }}
          />
        </div>
        <div className="mt-3.5 grid grid-cols-4 gap-1">
          {steps.map(({ label, short, icon: Icon }, i) => {
            const stepNum = i + 1;
            const done = step > stepNum;
            const active = step === stepNum;
            return (
              <div key={label} className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full border transition-all duration-300',
                    done && 'border-success bg-success text-success-foreground shadow-sm shadow-success/20',
                    active &&
                      !done &&
                      'scale-110 border-accent bg-accent/15 text-accent shadow-md shadow-accent/20',
                    !done && !active && 'border-border/80 bg-background/80 text-muted-foreground',
                  )}
                >
                  {done ? <Check className="size-3" strokeWidth={3} /> : <Icon className="size-3.5" />}
                </div>
                <span
                  className={cn(
                    'text-[9px] font-bold uppercase tracking-wider',
                    active ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {short}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (isPolished) {
    const progress = ((step - 1) / (steps.length - 1)) * 100;
    return (
      <div className="mb-7">
        <div className="mb-3 flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>
            Step {step} of {steps.length}
          </span>
          <span className="text-accent">{Math.round((step / steps.length) * 100)}% complete</span>
        </div>
        <div className="relative h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary via-accent to-accent transition-all duration-500 ease-out"
            style={{ width: `${progress === 0 ? 8 : progress}%` }}
          />
        </div>
        <div className="mt-5 grid grid-cols-4 gap-1">
          {steps.map(({ label, icon: Icon }, i) => {
            const stepNum = i + 1;
            const done = step > stepNum;
            const active = step === stepNum;
            return (
              <div key={label} className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'flex size-9 items-center justify-center rounded-full border-2 transition-all duration-300',
                    done && 'border-success bg-success text-success-foreground shadow-sm shadow-success/25',
                    active && !done && 'scale-110 border-accent bg-accent/15 text-accent shadow-md shadow-accent/20',
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
    <div className="mb-5 grid grid-cols-4 gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {steps.map(({ label }, i) => (
        <span
          key={label}
          className={cn(
            'border-b-2 pb-1 text-center',
            step >= i + 1 ? 'border-primary text-primary' : 'border-transparent',
          )}
        >
          {i + 1}. {label}
        </span>
      ))}
    </div>
  );
}

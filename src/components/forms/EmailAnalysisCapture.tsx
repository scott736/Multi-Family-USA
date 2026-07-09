'use client';

import { CheckCircle2, Loader2, Mail, Send } from 'lucide-react';
import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface EmailAnalysisCaptureProps {
  analysisType: string;
  analysisSummary: Record<string, string | number>;
  lang?: 'en' | 'es';
  sourcePage?: string;
  className?: string;
}

export default function EmailAnalysisCapture({
  analysisType,
  analysisSummary,
  lang = 'en',
  sourcePage,
  className = '',
}: EmailAnalysisCaptureProps) {
  const isEs = lang === 'es';
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const hasResults = Object.values(analysisSummary).some(
    (v) => v !== '' && v !== 0 && v !== '—' && v !== '-',
  );

  if (!hasResults) {
    return null;
  }

  const resolvedSourcePage =
    sourcePage ?? (typeof window !== 'undefined' ? window.location.pathname : '/');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg(isEs ? 'Ingrese un correo electrónico válido.' : 'Enter a valid email address.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/analysis-email/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          analysisType,
          analysisSummary,
          lang,
          sourcePage: resolvedSourcePage,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || (isEs ? 'Error al enviar. Inténtelo de nuevo.' : 'Submission failed. Please try again.'));
        return;
      }

      setSuccess(true);
    } catch {
      setErrorMsg(isEs ? 'Error al enviar. Inténtelo de nuevo.' : 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={cn('rounded-xl border border-success/30 bg-success/5 p-4', className)}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-success" />
          <p className="text-sm font-semibold text-foreground">
            {isEs ? 'Análisis enviado — revise su correo.' : 'Analysis sent — check your inbox.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-border bg-secondary/30 p-4', className)}>
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {isEs ? 'Guardar resultados' : 'Save your results'}
      </p>
      <form onSubmit={handleSubmit} noValidate className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor={`analysis-email-${analysisType}`} className="sr-only">
            {isEs ? 'Correo electrónico' : 'Email address'}
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={`analysis-email-${analysisType}`}
              type="email"
              autoComplete="email"
              placeholder={isEs ? 'Correo para recibir este análisis' : 'Email to receive this analysis'}
              className="pl-10 bg-background"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary/95 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {isEs ? 'Enviando…' : 'Sending…'}
            </>
          ) : (
            <>
              <Send className="size-4" />
              {isEs ? 'Enviarme este análisis' : 'Email me this analysis'}
            </>
          )}
        </button>
      </form>
      {errorMsg && <p className="mt-2 text-xs text-destructive">{errorMsg}</p>}
    </div>
  );
}

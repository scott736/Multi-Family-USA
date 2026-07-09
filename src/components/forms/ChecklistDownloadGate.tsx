'use client';

import { CheckCircle2, Download, Loader2, Mail } from 'lucide-react';
import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface ChecklistDownloadGateProps {
  checklistId: string;
  checklistTitle: string;
  lang?: 'en' | 'es';
  className?: string;
}

function printableChecklistUrl(checklistId: string, lang: 'en' | 'es'): string {
  const base = `/downloads/checklists/${checklistId}`;
  return lang === 'es' ? `${base}?lang=es` : base;
}

function openPrintableChecklist(checklistId: string, lang: 'en' | 'es'): void {
  window.open(printableChecklistUrl(checklistId, lang), '_blank', 'noopener,noreferrer');
}

export default function ChecklistDownloadGate({
  checklistId,
  checklistTitle,
  lang = 'en',
  className = '',
}: ChecklistDownloadGateProps) {
  const isEs = lang === 'es';
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const sourcePage =
    typeof window !== 'undefined' ? window.location.pathname : `/checklists/${checklistId}`;
  const printableHref = printableChecklistUrl(checklistId, lang);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg(isEs ? 'Ingrese un correo electrónico válido.' : 'Enter a valid email address.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/checklist-lead/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          checklistId,
          checklistTitle,
          lang,
          sourcePage,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || (isEs ? 'Error al enviar. Inténtelo de nuevo.' : 'Submission failed. Please try again.'));
        return;
      }

      setSuccess(true);
      openPrintableChecklist(checklistId, lang);
    } catch {
      setErrorMsg(isEs ? 'Error al enviar. Inténtelo de nuevo.' : 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div
        className={cn(
          'my-8 rounded-xl border border-success/30 bg-success/5 p-6 text-center',
          className,
        )}
      >
        <CheckCircle2 className="mx-auto mb-3 size-10 text-success" />
        <h3 className="text-lg font-bold text-foreground">
          {isEs ? 'Lista lista para imprimir' : 'Checklist ready to print'}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {isEs
            ? 'Si no se abrió automáticamente, use el enlace imprimible a continuación.'
            : 'If it did not open automatically, use the printable link below.'}
        </p>
        <a
          href={printableHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
        >
          <Download className="size-4" />
          {isEs ? 'Abrir versión imprimible' : 'Open printable version'}
        </a>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'my-8 rounded-xl border border-border bg-card p-6 shadow-sm',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Download className="mt-0.5 size-5 shrink-0 text-accent" />
        <div className="flex-1">
          <h3 className="text-lg font-bold text-foreground">
            {isEs ? 'Abrir lista imprimible' : 'Open printable checklist'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEs
              ? `Reciba la lista "${checklistTitle}" en su correo y ábrala al instante para imprimir o guardar como PDF.`
              : `Get the "${checklistTitle}" checklist by email and open the printable version instantly (print or save as PDF).`}
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor={`checklist-email-${checklistId}`} className="text-xs font-medium">
                {isEs ? 'Correo electrónico' : 'Email address'}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id={`checklist-email-${checklistId}`}
                  type="email"
                  autoComplete="email"
                  placeholder={isEs ? 'usted@empresa.com' : 'you@company.com'}
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-bold text-accent-foreground shadow-md transition hover:bg-accent/90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {isEs ? 'Enviando…' : 'Sending…'}
                </>
              ) : (
                <>
                  <Download className="size-4" />
                  {isEs ? 'Abrir lista' : 'Open checklist'}
                </>
              )}
            </button>
          </form>

          {errorMsg && (
            <p className="mt-3 text-xs text-destructive">{errorMsg}</p>
          )}

          <p className="mt-3 text-[11px] text-muted-foreground">
            {isEs
              ? 'Sin spam. Solo usamos su correo para enviar el recurso y seguimiento relacionado.'
              : 'No spam. We only use your email to deliver this resource and related follow-up.'}
          </p>
        </div>
      </div>
    </div>
  );
}

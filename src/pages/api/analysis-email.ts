export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';

import { LEAD_INBOX, SITE_SHORT_NAME, SITE_URL } from '@/consts';
import { sendElasticEmail } from '@/lib/elastic-email';
import { persistAnalysisEmail } from '@/lib/leads/persist-analysis-email';
import { logger } from '@/lib/logger';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

const analysisEmailSchema = z.object({
  email: z.string().email().max(200),
  analysisType: z.string().min(1).max(100),
  analysisSummary: z.record(z.union([z.string(), z.number()])),
  lang: z.enum(['en', 'es']).default('en'),
  sourcePage: z.string().max(500).optional(),
  website: z.string().max(0).optional(),
});

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

function formatSummaryRows(summary: Record<string, string | number>): string {
  return Object.entries(summary)
    .map(
      ([key, value]) =>
        `<tr><td style="background:#f3f4f6;font-weight:600;padding:8px;">${escapeHtml(key)}</td><td style="padding:8px;">${escapeHtml(String(value))}</td></tr>`,
    )
    .join('');
}

function buildUserEmail(
  email: string,
  analysisType: string,
  summary: Record<string, string | number>,
  lang: 'en' | 'es',
) {
  const isEs = lang === 'es';
  const rows = formatSummaryRows(summary);

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;max-width:640px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 12px;font-size:22px;">${isEs ? 'Su análisis guardado' : 'Your saved analysis'}</h2>
  <p style="font-size:15px;line-height:1.6;color:#374151;">
    ${isEs
      ? `Aquí está el resumen de su calculadora <strong>${escapeHtml(analysisType)}</strong> de ${SITE_SHORT_NAME}.`
      : `Here is your <strong>${escapeHtml(analysisType)}</strong> calculator summary from ${SITE_SHORT_NAME}.`}
  </p>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px;margin:20px 0;">
    ${rows}
  </table>
  <p style="font-size:14px;line-height:1.6;color:#374151;">
    ${isEs
      ? `¿Quiere una lectura de encaje con prestamistas? <a href="${SITE_URL}/es/deal-review/">Solicite una revisión gratuita del deal</a>.`
      : `Want a lender-fit read on your numbers? <a href="${SITE_URL}/deal-review/">Request a free deal review</a>.`}
  </p>
  <p style="margin-top:32px;font-size:13px;color:#6b7280;">
    — The ${SITE_SHORT_NAME} team<br/>
    <a href="${SITE_URL}" style="color:#6b7280;">${SITE_URL.replace(/^https?:\/\//, '')}</a>
  </p>
</body>
</html>`;

  const textLines = Object.entries(summary).map(([k, v]) => `${k}: ${v}`);
  const text = isEs
    ? `Su análisis ${analysisType}:\n\n${textLines.join('\n')}\n\nRevisión gratuita: ${SITE_URL}/es/deal-review/`
    : `Your ${analysisType} analysis:\n\n${textLines.join('\n')}\n\nFree deal review: ${SITE_URL}/deal-review/`;

  return {
    subject: isEs
      ? `Su análisis ${analysisType} — ${SITE_SHORT_NAME}`
      : `Your ${analysisType} analysis — ${SITE_SHORT_NAME}`,
    html,
    text,
  };
}

function buildInternalEmail(
  email: string,
  analysisType: string,
  summary: Record<string, string | number>,
  lang: 'en' | 'es',
  sourcePage?: string,
) {
  const rows = formatSummaryRows(summary);
  const html = `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;max-width:640px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 12px;font-size:20px;">Calculator analysis emailed — ${escapeHtml(analysisType)}</h2>
  <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">${escapeHtml(email)} · ${new Date().toUTCString()}</p>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px;">
    <tr><td style="background:#fef3c7;font-weight:600;padding:8px;">Source</td><td style="padding:8px;">${escapeHtml(sourcePage ?? '/')}</td></tr>
    <tr><td style="background:#fef3c7;font-weight:600;padding:8px;">Language</td><td style="padding:8px;">${escapeHtml(lang)}</td></tr>
    ${rows}
  </table>
</body>
</html>`;

  const text = [
    `Calculator analysis — ${analysisType}`,
    `Email: ${email}`,
    `Source: ${sourcePage ?? '/'}`,
    ...Object.entries(summary).map(([k, v]) => `${k}: ${v}`),
  ].join('\n');

  return {
    subject: `[Calculator] ${email} — ${analysisType}`,
    html,
    text,
  };
}

export const POST: APIRoute = async ({ request }) => {
  const rl = await rateLimit(request, { id: 'analysis-email', limit: 8, windowSeconds: 60 * 60 });
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = analysisEmailSchema.safeParse(raw);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid input', details: parsed.error.flatten().fieldErrors }),
      { status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const data = parsed.data;

  if (data.website && data.website.length > 0) {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (Object.keys(data.analysisSummary).length === 0) {
    return new Response(JSON.stringify({ success: false, error: 'Analysis summary is empty' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const userEmail = buildUserEmail(data.email, data.analysisType, data.analysisSummary, data.lang);
    const internal = buildInternalEmail(
      data.email,
      data.analysisType,
      data.analysisSummary,
      data.lang,
      data.sourcePage,
    );

    await Promise.all([
      persistAnalysisEmail({
        email: data.email,
        analysisType: data.analysisType,
        analysisSummary: data.analysisSummary,
        lang: data.lang,
        sourcePage: data.sourcePage,
      }),
      sendElasticEmail({
        to: data.email,
        subject: userEmail.subject,
        html: userEmail.html,
        text: userEmail.text,
      }),
      sendElasticEmail({
        to: [...LEAD_INBOX],
        replyTo: data.email,
        subject: internal.subject,
        html: internal.html,
        text: internal.text,
      }),
    ]);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    logger.error('Analysis email capture failed', err);
    return new Response(
      JSON.stringify({ success: false, error: "We couldn't send your analysis. Please try again." }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
};

export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';

import { fireCrmWebhook } from '@/lib/crm-webhook';
import { LEAD_INBOX } from '@/consts';
import { VALID_CHECKLIST_IDS } from '@/lib/checklists/checklist-data';
import { sendElasticEmail } from '@/lib/elastic-email';
import { persistChecklistLead } from '@/lib/leads/persist-checklist-lead';
import { logger } from '@/lib/logger';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

const checklistLeadSchema = z.object({
  email: z.string().email().max(200),
  checklistId: z.string().refine((id) => VALID_CHECKLIST_IDS.includes(id), 'Invalid checklist'),
  checklistTitle: z.string().max(200).optional(),
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

function buildInternalEmail(data: z.infer<typeof checklistLeadSchema>) {
  const title = data.checklistTitle ?? data.checklistId;
  const html = `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;max-width:640px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 12px;font-size:20px;">Checklist download — ${escapeHtml(title)}</h2>
  <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">Submitted ${new Date().toUTCString()}</p>
  <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px;">
    <tr><td style="background:#f3f4f6;font-weight:600;width:180px;">Email</td><td>${escapeHtml(data.email)}</td></tr>
    <tr><td style="background:#f3f4f6;font-weight:600;">Checklist</td><td>${escapeHtml(data.checklistId)}</td></tr>
    <tr><td style="background:#f3f4f6;font-weight:600;">Language</td><td>${escapeHtml(data.lang)}</td></tr>
    <tr><td style="background:#f3f4f6;font-weight:600;">Source page</td><td>${escapeHtml(data.sourcePage ?? '/')}</td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Checklist download — ${title}`,
    `Email: ${data.email}`,
    `Checklist: ${data.checklistId}`,
    `Language: ${data.lang}`,
    `Source: ${data.sourcePage ?? '/'}`,
  ].join('\n');

  return {
    subject: `[Checklist] ${data.email} — ${title}`,
    html,
    text,
  };
}

export const POST: APIRoute = async ({ request }) => {
  const rl = await rateLimit(request, { id: 'checklist-lead', limit: 8, windowSeconds: 60 * 60 });
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

  const parsed = checklistLeadSchema.safeParse(raw);
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

  try {
    const internal = buildInternalEmail(data);

    await Promise.all([
      persistChecklistLead({
        email: data.email,
        checklistId: data.checklistId,
        checklistTitle: data.checklistTitle,
        lang: data.lang,
        sourcePage: data.sourcePage,
      }),
      sendElasticEmail({
        to: [...LEAD_INBOX],
        replyTo: data.email,
        subject: internal.subject,
        html: internal.html,
        text: internal.text,
      }),
    ]);

    void fireCrmWebhook({
      event: 'checklist_signup',
      email: data.email,
      source: data.sourcePage,
      toolName: data.checklistTitle ?? data.checklistId,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    logger.error('Checklist lead capture failed', err);
    return new Response(
      JSON.stringify({ success: false, error: "We couldn't process your request. Please try again." }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
};

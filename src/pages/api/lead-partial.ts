export const prerender = false;

import { createHash } from 'node:crypto';

import type { APIRoute } from 'astro';
import { z } from 'zod';

import { sendElasticEmail } from '@/lib/elastic-email';
import { leadOversightCc } from '@/lib/lead-inbox';
import { persistFormLead } from '@/lib/leads/persist-form-lead';
import { logger } from '@/lib/logger';
import { teamMembers } from '@/lib/nylas/config';
import type { TeamMember } from '@/lib/nylas/types';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

const partialLeadSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  purchasePrice: z.coerce.number().positive().max(500_000_000).optional(),
  loanAmount: z.coerce.number().positive().max(500_000_000).optional(),
  annualNoi: z.coerce.number().positive().max(100_000_000).optional(),
  occupancy: z.coerce.number().min(1).max(100).optional(),
  creditScore: z.coerce.number().int().min(500).max(850).optional(),
  units: z.coerce.number().int().min(5).max(5000).optional(),
  state: z.string().length(2).optional(),
  purpose: z
    .enum(['acquisition', 'refinance', 'bridge-to-stabilized', 'supplemental-or-second'])
    .optional(),
  propertyType: z
    .enum(['garden-style', 'mid-rise', 'value-add', 'suburban-community', 'mixed-multifamily'])
    .optional(),
  timeline: z.enum(['asap', '30-60', '60-90', '90-plus']).optional(),
  sourcePage: z.string().max(500).optional(),
  sourceContext: z.string().max(500).optional(),
  website: z.string().max(0).optional(),
  lang: z.enum(['en', 'es']).optional(),
});

type PartialLead = z.infer<typeof partialLeadSchema>;

function assignLeadToOfficer(email: string): TeamMember {
  if (teamMembers.length === 0) {
    throw new Error('No officers configured for lead routing');
  }
  const hash = createHash('sha1').update(email.toLowerCase()).digest();
  const idx = hash[0] % teamMembers.length;
  return teamMembers[idx];
}

const formatMoney = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

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

function buildPartialInternalEmail(lead: PartialLead, assignedTo: TeamMember) {
  const rows: [string, string][] = [
    ['Status', 'Partial — form in progress (step 2 completed)'],
    ['Email', lead.email],
  ];

  if (lead.name) rows.push(['Name', lead.name]);
  if (lead.phone) rows.push(['Phone', lead.phone]);
  if (lead.state) rows.push(['State', lead.state]);
  if (lead.purpose) rows.push(['Purpose', lead.purpose]);
  if (lead.propertyType) rows.push(['Property type', lead.propertyType]);
  if (lead.units) rows.push(['Units', String(lead.units)]);
  if (lead.purchasePrice) rows.push(['Purchase price', formatMoney(lead.purchasePrice)]);
  if (lead.loanAmount) rows.push(['Loan amount', formatMoney(lead.loanAmount)]);
  if (lead.annualNoi) rows.push(['Annual NOI', formatMoney(lead.annualNoi)]);
  if (lead.occupancy) rows.push(['Occupancy', `${lead.occupancy.toFixed(1)}%`]);

  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="background:#f3f4f6;font-weight:600;width:220px;">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;max-width:680px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 12px;font-size:22px;">Partial Lead — ${escapeHtml(lead.email)}</h2>
  <p style="margin:0 0 18px;color:#6b7280;font-size:14px;">Captured ${new Date().toUTCString()} from ${escapeHtml(lead.sourcePage ?? '/')} (user may still be completing the form).</p>
  <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px;">
    <tr><td style="background:#fef3c7;font-weight:600;width:220px;">Assigned to</td><td>${escapeHtml(assignedTo.name)} &lt;${escapeHtml(assignedTo.email)}&gt;</td></tr>
    ${tableRows}
  </table>
</body>
</html>`;

  const text = [
    `Partial Lead — ${lead.email}`,
    `Assigned to: ${assignedTo.name} <${assignedTo.email}>`,
    ...rows.map(([label, value]) => `${label}: ${value}`),
  ].join('\n');

  return {
    subject: `[Partial Lead] ${lead.email}${lead.state ? ` — ${lead.state}` : ''}`,
    html,
    text,
  };
}

export const POST: APIRoute = async ({ request }) => {
  const rl = await rateLimit(request, { id: 'lead-partial', limit: 10, windowSeconds: 60 * 60 });
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

  const parsed = partialLeadSchema.safeParse(raw);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid input', details: parsed.error.flatten().fieldErrors }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const lead = parsed.data;

  if (lead.website && lead.website.length > 0) {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const assignedTo = assignLeadToOfficer(lead.email);
    const internal = buildPartialInternalEmail(lead, assignedTo);

    await persistFormLead(
        {
          name: lead.name ?? '(partial)',
          email: lead.email,
          phone: lead.phone ?? 'pending',
          propertyValue: lead.purchasePrice ?? 0,
          loanAmount: lead.loanAmount ?? 0,
          monthlyRent: lead.annualNoi ? lead.annualNoi / 12 : 0,
          fico: lead.creditScore ?? 0,
          state: lead.state ?? '—',
          purpose: lead.purpose ?? 'partial',
          propertyType: lead.propertyType ?? 'partial',
          timeline: lead.timeline ?? 'partial',
          sourcePage: lead.sourcePage,
          sourceContext: lead.sourceContext,
          metadata: {
            isPartial: true,
            units: lead.units,
            annualNoi: lead.annualNoi,
            occupancy: lead.occupancy,
          },
        },
        assignedTo,
        { isPartial: true, lang: lead.lang ?? 'en' },
    );

    try {
      await sendElasticEmail({
        to: assignedTo.email,
        cc: leadOversightCc(assignedTo.email),
        replyTo: lead.email,
        subject: internal.subject,
        html: internal.html,
        text: internal.text,
      });
    } catch (emailErr) {
      logger.error('Partial lead notification email failed', emailErr);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    logger.error('Partial lead capture failed', err);
    return new Response(JSON.stringify({ success: false, error: 'Partial save failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

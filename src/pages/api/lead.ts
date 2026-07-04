export const prerender = false;

import { createHash } from 'node:crypto';

import type { APIRoute } from 'astro';
import { z } from 'zod';

import { SITE_PHONE, SITE_SHORT_NAME, SITE_URL } from '@/consts';
import { sendElasticEmail } from '@/lib/elastic-email';
import { leadOversightCc } from '@/lib/lead-inbox';
import { persistFormLead } from '@/lib/leads/persist-form-lead';
import { logger } from '@/lib/logger';
import { teamMembers } from '@/lib/nylas/config';
import type { TeamMember } from '@/lib/nylas/types';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

const leadSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  phone: z.string().min(7).max(40),
  purchasePrice: z.coerce.number().positive().max(500_000_000),
  loanAmount: z.coerce.number().positive().max(500_000_000),
  annualNoi: z.coerce.number().positive().max(100_000_000),
  occupancy: z.coerce.number().min(1).max(100),
  creditScore: z.coerce.number().int().min(500).max(850),
  units: z.coerce.number().int().min(5).max(5000),
  state: z.string().length(2),
  purpose: z.enum(['acquisition', 'refinance', 'bridge-to-stabilized', 'supplemental-or-second']),
  propertyType: z.enum(['garden-style', 'mid-rise', 'value-add', 'suburban-community', 'mixed-multifamily']),
  timeline: z.enum(['asap', '30-60', '60-90', '90-plus']),
  sourcePage: z.string().max(500).optional(),
  sourceContext: z.string().max(500).optional(),
  website: z.string().max(0).optional(),
});

type Lead = z.infer<typeof leadSchema>;

function assignLeadToOfficer(email: string): TeamMember {
  if (teamMembers.length === 0) {
    throw new Error('No officers configured for lead routing');
  }
  const hash = createHash('sha1').update(email.toLowerCase()).digest();
  const idx = hash[0] % teamMembers.length;
  return teamMembers[idx];
}

function scoreLead(lead: Lead) {
  const ltv = lead.purchasePrice > 0 ? (lead.loanAmount / lead.purchasePrice) * 100 : 0;
  const impliedDebtService = lead.loanAmount * 0.082;
  const dscr = impliedDebtService > 0 ? lead.annualNoi / impliedDebtService : 0;
  const debtYield = lead.loanAmount > 0 ? (lead.annualNoi / lead.loanAmount) * 100 : 0;

  let score = 0;
  if (lead.units >= 50) score += 20;
  else if (lead.units >= 20) score += 14;
  else score += 8;

  if (lead.creditScore >= 740) score += 20;
  else if (lead.creditScore >= 680) score += 14;
  else score += 8;

  if (ltv <= 70) score += 20;
  else if (ltv <= 75) score += 15;
  else if (ltv <= 80) score += 9;
  else score += 3;

  if (dscr >= 1.25) score += 20;
  else if (dscr >= 1.1) score += 14;
  else if (dscr >= 1.0) score += 8;
  else score += 2;

  if (debtYield >= 10.5) score += 20;
  else if (debtYield >= 9) score += 14;
  else if (debtYield >= 8) score += 8;
  else score += 3;

  const tier = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
  return { score, tier, ltv, dscr, debtYield };
}

function buildNurturePlan(lead: Lead, tier: string) {
  return [
    {
      day: 0,
      subject: 'Deal review received: next underwriting steps',
      focus: `Acknowledge intake and confirm target execution path (${lead.purpose}).`,
    },
    {
      day: 2,
      subject: 'Underwriting checklist and missing assumptions',
      focus: 'Collect missing assumptions for NOI durability, occupancy, and reserves.',
    },
    {
      day: 5,
      subject: 'Capital path comparison and rate-risk notes',
      focus: `Provide tier ${tier} execution options with bridge/agency/bank fit guidance.`,
    },
  ];
}

async function fireCrmWebhook(payload: Record<string, unknown>) {
  const crmWebhookUrl = import.meta.env.CRM_WEBHOOK_URL as string | undefined;
  if (!crmWebhookUrl) return;

  try {
    await fetch(crmWebhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    logger.error('CRM webhook send failed', err);
  }
}

const formatMoney = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function buildInternalEmail(lead: Lead, assignedTo: TeamMember, scoring: ReturnType<typeof scoreLead>) {
  const html = `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;max-width:680px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 12px;font-size:22px;">New Multifamily Lead - ${escapeHtml(lead.name)}</h2>
  <p style="margin:0 0 18px;color:#6b7280;font-size:14px;">Submitted ${new Date().toUTCString()} from ${escapeHtml(lead.sourcePage ?? '/')}.</p>
  <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px;">
    <tr><td style="background:#fef3c7;font-weight:600;width:220px;">Assigned to</td><td>${escapeHtml(assignedTo.name)} &lt;${escapeHtml(assignedTo.email)}&gt;</td></tr>
    <tr><td style="background:#f3f4f6;font-weight:600;">Lead score</td><td><strong>${scoring.score}</strong> (Tier ${scoring.tier})</td></tr>
    <tr><td style="background:#f3f4f6;font-weight:600;">State</td><td>${escapeHtml(lead.state)}</td></tr>
    <tr><td style="background:#f3f4f6;font-weight:600;">Purpose</td><td>${escapeHtml(lead.purpose)}</td></tr>
    <tr><td style="background:#f3f4f6;font-weight:600;">Property type</td><td>${escapeHtml(lead.propertyType)}</td></tr>
    <tr><td style="background:#f3f4f6;font-weight:600;">Units</td><td>${lead.units}</td></tr>
    <tr><td style="background:#f3f4f6;font-weight:600;">Purchase price</td><td>${formatMoney(lead.purchasePrice)}</td></tr>
    <tr><td style="background:#f3f4f6;font-weight:600;">Loan amount</td><td>${formatMoney(lead.loanAmount)} (${scoring.ltv.toFixed(1)}% LTV)</td></tr>
    <tr><td style="background:#f3f4f6;font-weight:600;">Annual NOI</td><td>${formatMoney(lead.annualNoi)}</td></tr>
    <tr><td style="background:#f3f4f6;font-weight:600;">Occupancy</td><td>${lead.occupancy.toFixed(1)}%</td></tr>
    <tr><td style="background:#f3f4f6;font-weight:600;">Est. DSCR</td><td>${scoring.dscr.toFixed(2)}x</td></tr>
    <tr><td style="background:#f3f4f6;font-weight:600;">Debt yield</td><td>${scoring.debtYield.toFixed(2)}%</td></tr>
    <tr><td style="background:#f3f4f6;font-weight:600;">Sponsor credit</td><td>${lead.creditScore}</td></tr>
    <tr><td style="background:#f3f4f6;font-weight:600;">Timeline</td><td>${escapeHtml(lead.timeline)}</td></tr>
  </table>
</body>
</html>`;

  const text = [
    `New Multifamily Lead - ${lead.name}`,
    `Lead score: ${scoring.score} (Tier ${scoring.tier})`,
    `Assigned to: ${assignedTo.name} <${assignedTo.email}>`,
    `State: ${lead.state}`,
    `Purpose: ${lead.purpose}`,
    `Property type: ${lead.propertyType}`,
    `Units: ${lead.units}`,
    `Purchase price: ${formatMoney(lead.purchasePrice)}`,
    `Loan amount: ${formatMoney(lead.loanAmount)} (${scoring.ltv.toFixed(1)}% LTV)`,
    `Annual NOI: ${formatMoney(lead.annualNoi)}`,
    `Occupancy: ${lead.occupancy.toFixed(1)}%`,
    `Est. DSCR: ${scoring.dscr.toFixed(2)}x`,
    `Debt yield: ${scoring.debtYield.toFixed(2)}%`,
    `Sponsor credit: ${lead.creditScore}`,
    `Timeline: ${lead.timeline}`,
  ].join('\n');

  return { subject: `[Lead] ${lead.name} - ${lead.state} - ${formatMoney(lead.loanAmount)}`, html, text };
}

function buildAutoReply(lead: Lead) {
  const firstName = escapeHtml(lead.name.split(' ')[0]);

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;max-width:640px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 12px;font-size:22px;">Thanks ${firstName} - your deal review request is in queue.</h2>
  <p style="font-size:15px;line-height:1.6;">
    A multifamily specialist is reviewing your assumptions and will follow up within one business hour
    with an initial underwriting read and likely lender-fit paths.
  </p>
  <ul style="font-size:14px;line-height:1.7;color:#374151;">
    <li>State: <strong>${escapeHtml(lead.state)}</strong></li>
    <li>Asset: ${escapeHtml(lead.propertyType)} (${lead.units} units)</li>
    <li>Request: ${escapeHtml(lead.purpose)} for ${formatMoney(lead.loanAmount)}</li>
  </ul>
  <p style="font-size:15px;line-height:1.6;">
    If anything needs correction, reply to this email. For immediate support call
    <a href="tel:${SITE_PHONE.replace(/\D/g, '')}">${SITE_PHONE}</a>
    or <a href="${SITE_URL}/book-strategy-call/">book a 30-minute strategy call</a>.
  </p>
  <p style="margin-top:32px;font-size:13px;color:#6b7280;">
    - The ${SITE_SHORT_NAME} team<br/>
    <a href="${SITE_URL}" style="color:#6b7280;">${SITE_URL.replace(/^https?:\/\//, '')}</a>
  </p>
</body>
</html>`;

  const text = `Thanks ${lead.name.split(' ')[0]} - your deal review request is in queue.

A multifamily specialist is reviewing your assumptions and will follow up within one business hour.

State: ${lead.state}
Asset: ${lead.propertyType} (${lead.units} units)
Request: ${lead.purpose} for ${formatMoney(lead.loanAmount)}

Reply to this email for updates, call ${SITE_PHONE}, or book a strategy call at ${SITE_URL}/book-strategy-call/.`;

  return { subject: `We received your deal review request - ${SITE_SHORT_NAME}`, html, text };
}

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

export const POST: APIRoute = async ({ request }) => {
  const rl = await rateLimit(request, { id: 'lead', limit: 5, windowSeconds: 60 * 60 });
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

  const parsed = leadSchema.safeParse(raw);
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
    const scoring = scoreLead(lead);
    const nurtureSequence = buildNurturePlan(lead, scoring.tier);

    const internal = buildInternalEmail(lead, assignedTo, scoring);
    const reply = buildAutoReply(lead);

    await Promise.all([
      persistFormLead(
        {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          propertyValue: lead.purchasePrice,
          loanAmount: lead.loanAmount,
          monthlyRent: lead.annualNoi / 12,
          fico: lead.creditScore,
          state: lead.state,
          purpose: lead.purpose,
          propertyType: lead.propertyType,
          timeline: lead.timeline,
          sourcePage: lead.sourcePage,
          sourceContext: lead.sourceContext,
          score: scoring.score,
          scoreTier: scoring.tier,
          metadata: {
            units: lead.units,
            annualNoi: lead.annualNoi,
            occupancy: lead.occupancy,
            ltv: scoring.ltv,
            dscr: scoring.dscr,
            debtYield: scoring.debtYield,
          },
        },
        assignedTo,
      ),
      sendElasticEmail({
        to: assignedTo.email,
        cc: leadOversightCc(assignedTo.email),
        replyTo: lead.email,
        subject: internal.subject,
        html: internal.html,
        text: internal.text,
      }),
      sendElasticEmail({
        to: lead.email,
        replyTo: assignedTo.email,
        subject: reply.subject,
        html: reply.html,
        text: reply.text,
      }),
      fireCrmWebhook({
        event: 'multifamily_lead_captured',
        lead,
        assignedTo,
        scoring,
        nurtureSequence,
        capturedAt: new Date().toISOString(),
      }),
    ]);

    return new Response(JSON.stringify({ success: true, assignedTo, scoring, nurtureSequence }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    logger.error('Lead capture failed', err);
    return new Response(
      JSON.stringify({ success: false, error: "We couldn't deliver your request. Please call us instead." }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
};

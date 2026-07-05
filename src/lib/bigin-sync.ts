import type { CrmWebhookPayload } from '@/lib/crm-webhook';

const DEFAULT_ACCOUNTS_URL = 'https://accounts.zoho.com';
const DEFAULT_API_DOMAIN = 'https://www.zohoapis.com';
const DEFAULT_LAYOUT_ID = '6352533000000091023';
const DEFAULT_OWNER_ID = '6352533000000471001';
const DEFAULT_SUB_PIPELINE = 'Sales Pipeline Standard';
const DEFAULT_STAGE = 'Warm Leads';

interface ZohoTokenResponse {
  access_token: string;
  api_domain?: string;
  expires_in: number;
  error?: string;
}

interface ZohoRecordResponse {
  data?: Array<{
    code: string;
    status: string;
    message: string;
    details?: { id?: string };
  }>;
}

type CachedToken = {
  accessToken: string;
  apiDomain: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;

function readEnv(name: string): string | undefined {
  const fromImportMeta =
    typeof import.meta !== 'undefined' ? import.meta.env?.[name] : undefined;
  const fromProcess =
    typeof process !== 'undefined' ? process.env[name] : undefined;
  return fromImportMeta || fromProcess;
}

function siteDomain(): string {
  const site = readEnv('SITE') || readEnv('ZOHO_BIGIN_SITE');
  if (!site) return 'unknown';
  return site.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function siteLabel(): string {
  const domain = siteDomain();
  if (domain === 'unknown') return 'Website';
  return domain;
}

function referralSource(): string {
  return readEnv('ZOHO_BIGIN_REFERRAL_SOURCE') || siteLabel();
}

export function isBiginConfigured(): boolean {
  return Boolean(
    readEnv('ZOHO_BIGIN_CLIENT_ID') &&
      readEnv('ZOHO_BIGIN_CLIENT_SECRET') &&
      readEnv('ZOHO_BIGIN_REFRESH_TOKEN'),
  );
}

function splitName(fullName?: string): { firstName: string; lastName: string } {
  const trimmed = (fullName || '').trim();
  const fallbackFirst = siteLabel().split('.')[0] || 'Website';

  if (!trimmed) {
    return { firstName: fallbackFirst, lastName: 'Lead' };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: 'Lead' };
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

function buildDealName(payload: CrmWebhookPayload): string {
  const label = payload.name || payload.email || 'Unknown lead';

  switch (payload.event) {
    case 'calculator_lead':
      return `${payload.toolName || 'Calculator'} — ${label}`;
    case 'checklist_signup':
      return `Checklist signup — ${label}`;
    case 'guide_lead':
      return `${payload.toolName || 'Guide'} — ${label}`;
    case 'contact_form_submitted':
      return `Contact — ${payload.topic || 'general'} — ${label}`;
    case 'booking_pending':
    case 'booking_confirmed':
    case 'strategy_call_booked': {
      const service = payload.serviceName || 'Strategy call';
      const bookedWith = payload.teamMemberName
        ? `${service} with ${payload.teamMemberName}`
        : service;
      return `${bookedWith} — ${label}`;
    }
    case 'content_share':
      return `Shared article — ${payload.toolName || 'Guide article'}`;
    case 'multifamily_lead_captured':
      return `Multifamily lead — ${label}`;
    case 'multifamily_lead_partial':
      return `Partial multifamily lead — ${label}`;
    case 'lead_magnet':
      return `${payload.toolName || 'Lead magnet'} — ${label}`;
    case 'quiz_lead':
      return `Quiz lead — ${label}`;
    case 'lead_captured':
      return `${payload.toolName || 'Lead'} — ${label}`;
    default:
      return `${payload.event} — ${label}`;
  }
}

function buildDescription(payload: CrmWebhookPayload): string {
  const lines = [
    `Event: ${payload.event}`,
    payload.source ? `Source: ${payload.source}` : null,
    payload.toolName ? `Tool: ${payload.toolName}` : null,
    payload.topic ? `Topic: ${payload.topic}` : null,
    payload.serviceName ? `Service: ${payload.serviceName}` : null,
    payload.teamMemberName ? `Booked with: ${payload.teamMemberName}` : null,
    payload.startTime ? `Start time: ${payload.startTime}` : null,
    payload.phone ? `Phone: ${payload.phone}` : null,
    payload.email ? `Email: ${payload.email}` : null,
    `Site: ${siteDomain()}`,
  ].filter(Boolean);

  if (payload.metadata) {
    for (const [key, value] of Object.entries(payload.metadata)) {
      if (value !== undefined && value !== null && value !== '') {
        lines.push(`${key}: ${value}`);
      }
    }
  }

  return lines.join('\n');
}

async function getAccessToken(): Promise<{ accessToken: string; apiDomain: string }> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return {
      accessToken: cachedToken.accessToken,
      apiDomain: cachedToken.apiDomain,
    };
  }

  const clientId = readEnv('ZOHO_BIGIN_CLIENT_ID');
  const clientSecret = readEnv('ZOHO_BIGIN_CLIENT_SECRET');
  const refreshToken = readEnv('ZOHO_BIGIN_REFRESH_TOKEN');
  const accountsUrl = readEnv('ZOHO_BIGIN_ACCOUNTS_URL') || DEFAULT_ACCOUNTS_URL;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Zoho Bigin credentials are not configured');
  }

  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });

  const response = await fetch(`${accountsUrl}/oauth/v2/token?${params.toString()}`, {
    method: 'POST',
  });
  const data = (await response.json()) as ZohoTokenResponse;

  if (!response.ok || !data.access_token) {
    throw new Error(data.error || 'Failed to refresh Zoho Bigin access token');
  }

  const apiDomain = data.api_domain || readEnv('ZOHO_BIGIN_API_DOMAIN') || DEFAULT_API_DOMAIN;
  cachedToken = {
    accessToken: data.access_token,
    apiDomain,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return { accessToken: data.access_token, apiDomain };
}

async function zohoRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const { accessToken, apiDomain } = await getAccessToken();
  const response = await fetch(`${apiDomain}${path}`, {
    method,
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await response.json()) as T & { message?: string };
  if (!response.ok) {
    throw new Error(
      (data as { message?: string }).message || `Zoho Bigin API error (${response.status})`,
    );
  }

  return data;
}

async function upsertContact(payload: CrmWebhookPayload): Promise<string | undefined> {
  if (!payload.email) return undefined;

  const { firstName, lastName } = splitName(payload.name);
  const response = await zohoRequest<ZohoRecordResponse>(
    'POST',
    '/bigin/v2/Contacts/upsert',
    {
      data: [
        {
          First_Name: firstName,
          Last_Name: lastName,
          Email: payload.email,
          ...(payload.phone ? { Mobile: payload.phone } : {}),
          Description: buildDescription(payload),
        },
      ],
      duplicate_check_fields: ['Email'],
      trigger: [],
    },
  );

  const record = response.data?.[0];
  if (record?.status !== 'success' || !record.details?.id) {
    throw new Error(record?.message || 'Failed to upsert Bigin contact');
  }

  return record.details.id;
}

async function createDeal(
  payload: CrmWebhookPayload,
  contactId?: string,
): Promise<void> {
  const ownerId = readEnv('ZOHO_BIGIN_OWNER_ID') || DEFAULT_OWNER_ID;
  const layoutId = readEnv('ZOHO_BIGIN_LAYOUT_ID') || DEFAULT_LAYOUT_ID;
  const subPipeline = readEnv('ZOHO_BIGIN_DEAL_SUB_PIPELINE') || DEFAULT_SUB_PIPELINE;
  const stage = readEnv('ZOHO_BIGIN_DEAL_STAGE') || DEFAULT_STAGE;

  const deal: Record<string, unknown> = {
    Deal_Name: buildDealName(payload),
    Description: buildDescription(payload),
    Owner: { id: ownerId },
    Layout: { id: layoutId },
    Pipeline: subPipeline,
    Sub_Pipeline: subPipeline,
    Stage: stage,
    Referral_Source: referralSource(),
  };

  if (contactId) {
    deal.Contact_Name = { id: contactId };
  }

  const response = await zohoRequest<ZohoRecordResponse>(
    'POST',
    '/bigin/v2/Pipelines',
    {
      data: [deal],
      trigger: [],
    },
  );

  const record = response.data?.[0];
  if (record?.status !== 'success') {
    throw new Error(record?.message || 'Failed to create Bigin deal');
  }
}

export async function syncLeadToBigin(payload: CrmWebhookPayload): Promise<void> {
  if (!isBiginConfigured()) return;

  try {
    const contactId = await upsertContact(payload);
    await createDeal(payload, contactId);
  } catch (error) {
    console.error('Bigin sync error:', error);
  }
}

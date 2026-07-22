/**
 * Elastic Email transactional client.
 *
 * Uses the v4 API: https://api.elasticemail.com/v4/emails/transactional
 * Auth via `X-ElasticEmail-ApiKey` header.
 *
 * Kept intentionally minimal — no SDK dependency, just fetch + JSON.
 */

import { SITE_SHORT_NAME } from '@/consts';
import { logger } from '@/lib/logger';

const ELASTIC_EMAIL_API = 'https://api.elasticemail.com/v4/emails/transactional';

const DEFAULT_FROM_EMAIL =
  (import.meta.env.ELASTIC_FROM_EMAIL as string | undefined)?.trim() ||
  (typeof process !== 'undefined' ? process.env.ELASTIC_FROM_EMAIL?.trim() : undefined) ||
  'bookings@multifamily-usa.com';
const DEFAULT_FROM_NAME = SITE_SHORT_NAME;

// Elastic Email caps TimeOffset at 35 days (50,400 minutes).
const MAX_TIME_OFFSET_MINUTES = 35 * 24 * 60;

function getApiKey(): string {
  const key = import.meta.env.ELASTIC_EMAIL_API_KEY
    || (typeof process !== 'undefined' ? process.env.ELASTIC_EMAIL_API_KEY : undefined);
  if (!key) {
    throw new Error('ELASTIC_EMAIL_API_KEY is not set');
  }
  return key;
}

export interface ElasticSendOptions {
  to: string | string[];
  cc?: string[];
  subject: string;
  html: string;
  text?: string;
  /** Overrides the default bookings@multifamily-usa.com sender. */
  from?: string;
  /** Overrides the default sender display name. */
  fromName?: string;
  replyTo?: string;
  /**
   * ISO-8601 timestamp to defer delivery. Converted to Elastic Email's
   * `Options.TimeOffset` (minutes from now; max 35 days).
   */
  scheduledAt?: string;
  /**
   * Click tracking rewrites links via tracking.* → Elastic Email (TLS cert
   * mismatch → Firefox blocks CTAs). Default false for booking-safe links.
   */
  trackClicks?: boolean;
  /** Open tracking does not rewrite links. Defaults to true. */
  trackOpens?: boolean;
}

export interface ElasticSendResult {
  /** Unique MessageID returned by Elastic Email, surfaced as `id` for
   *  interchangeability with other providers. */
  id?: string;
  transactionId?: string;
}

export async function sendElasticEmail(options: ElasticSendOptions): Promise<ElasticSendResult> {
  const toList = Array.isArray(options.to) ? options.to : [options.to];
  const ccList = options.cc ?? [];

  let timeOffsetMinutes: number | undefined;
  if (options.scheduledAt) {
    const scheduled = new Date(options.scheduledAt).getTime();
    const diffMs = scheduled - Date.now();
    const minutes = Math.round(diffMs / 60_000);
    if (minutes > 0) {
      timeOffsetMinutes = Math.min(minutes, MAX_TIME_OFFSET_MINUTES);
    }
  }

  const trackClicks = options.trackClicks === true;
  const trackOpens = options.trackOpens !== false;

  const payload = {
    Recipients: {
      To: toList,
      ...(ccList.length > 0 && { CC: ccList }),
    },
    Content: {
      Body: [
        { ContentType: 'HTML', Content: options.html, Charset: 'utf-8' },
        ...(options.text
          ? [{ ContentType: 'PlainText', Content: options.text, Charset: 'utf-8' } as const]
          : []),
      ],
      From: `${options.fromName ?? DEFAULT_FROM_NAME} <${options.from ?? DEFAULT_FROM_EMAIL}>`,
      Subject: options.subject,
      ...(options.replyTo && { ReplyTo: options.replyTo }),
    },
    Options: {
      TrackClicks: trackClicks ? 'true' : 'false',
      TrackOpens: trackOpens ? 'true' : 'false',
      ...(timeOffsetMinutes !== undefined && { TimeOffset: timeOffsetMinutes }),
    },
  };

  const response = await fetch(ELASTIC_EMAIL_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-ElasticEmail-ApiKey': getApiKey(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Elastic Email send failed', {
      status: response.status,
      body: errorText,
    });
    throw new Error(`Elastic Email send failed (${response.status}): ${errorText}`);
  }

  try {
    const data = (await response.json()) as { MessageID?: string; TransactionID?: string };
    return { id: data.MessageID, transactionId: data.TransactionID };
  } catch {
    return {};
  }
}

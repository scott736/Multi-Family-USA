import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fireCrmWebhook } from '@/lib/crm-webhook';

const ORIGINAL_URL = process.env.CRM_WEBHOOK_URL;
const ZOHO_KEYS = [
  'ZOHO_BIGIN_CLIENT_ID',
  'ZOHO_BIGIN_CLIENT_SECRET',
  'ZOHO_BIGIN_REFRESH_TOKEN',
] as const;
const ORIGINAL_ZOHO = Object.fromEntries(
  ZOHO_KEYS.map((key) => [key, process.env[key]]),
);

beforeEach(() => {
  vi.restoreAllMocks();
  delete process.env.CRM_WEBHOOK_URL;
  for (const key of ZOHO_KEYS) {
    delete process.env[key];
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_URL === undefined) {
    delete process.env.CRM_WEBHOOK_URL;
  } else {
    process.env.CRM_WEBHOOK_URL = ORIGINAL_URL;
  }
  for (const key of ZOHO_KEYS) {
    if (ORIGINAL_ZOHO[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = ORIGINAL_ZOHO[key];
    }
  }
});

describe('fireCrmWebhook', () => {
  it('does nothing when no webhook URL is configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await fireCrmWebhook({ event: 'contact_form_submitted' });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the enriched payload to the configured URL', async () => {
    process.env.CRM_WEBHOOK_URL = 'https://crm.example.com/hook';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await fireCrmWebhook({ event: 'booking_confirmed', name: 'Jordan' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://crm.example.com/hook');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      event: 'booking_confirmed',
      name: 'Jordan',
      site: 'unknown',
    });
    expect(typeof body.timestamp).toBe('string');
  });

  it('logs but does not throw when the response is not ok', async () => {
    process.env.CRM_WEBHOOK_URL = 'https://crm.example.com/hook';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('boom'),
      }),
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      fireCrmWebhook({ event: 'booking_confirmed' }),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('swallows network errors', async () => {
    process.env.CRM_WEBHOOK_URL = 'https://crm.example.com/hook';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      fireCrmWebhook({ event: 'contact_form_submitted' }),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});

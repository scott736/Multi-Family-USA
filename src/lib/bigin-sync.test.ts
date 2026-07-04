import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { syncLeadToBigin, isBiginConfigured } from '@/lib/bigin-sync';

const ENV_KEYS = [
  'ZOHO_BIGIN_CLIENT_ID',
  'ZOHO_BIGIN_CLIENT_SECRET',
  'ZOHO_BIGIN_REFRESH_TOKEN',
] as const;

const ORIGINAL_ENV = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

beforeEach(() => {
  vi.restoreAllMocks();
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (ORIGINAL_ENV[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = ORIGINAL_ENV[key];
    }
  }
});

describe('isBiginConfigured', () => {
  it('returns false when credentials are missing', () => {
    expect(isBiginConfigured()).toBe(false);
  });

  it('returns true when all credentials are present', () => {
    process.env.ZOHO_BIGIN_CLIENT_ID = 'client';
    process.env.ZOHO_BIGIN_CLIENT_SECRET = 'secret';
    process.env.ZOHO_BIGIN_REFRESH_TOKEN = 'refresh';
    process.env.ZOHO_BIGIN_REFERRAL_SOURCE = 'TestSite.ca';

    expect(isBiginConfigured()).toBe(true);
  });
});

describe('syncLeadToBigin', () => {
  it('does nothing when Bigin is not configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await syncLeadToBigin({
      event: 'calculator_lead',
      email: 'lead@example.com',
      name: 'Jordan Lee',
      toolName: 'Mortgage calculator',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('upserts a contact and creates a deal when configured', async () => {
    process.env.ZOHO_BIGIN_CLIENT_ID = 'client';
    process.env.ZOHO_BIGIN_CLIENT_SECRET = 'secret';
    process.env.ZOHO_BIGIN_REFRESH_TOKEN = 'refresh';
    process.env.ZOHO_BIGIN_REFERRAL_SOURCE = 'TestSite.ca';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'token-123',
            api_domain: 'https://www.zohoapis.com',
            expires_in: 3600,
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                code: 'SUCCESS',
                status: 'success',
                message: 'record added',
                details: { id: 'contact-1' },
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                code: 'SUCCESS',
                status: 'success',
                message: 'record added',
                details: { id: 'deal-1' },
              },
            ],
          }),
      });

    vi.stubGlobal('fetch', fetchMock);

    await syncLeadToBigin({
      event: 'calculator_lead',
      email: 'lead@example.com',
      name: 'Jordan Lee',
      toolName: 'Mortgage calculator',
      source: 'https://firsthomeguide.ca/tools/mortgage-calculator/',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);

    const [, contactCall] = fetchMock.mock.calls[1];
    const contactBody = JSON.parse(contactCall.body);
    expect(contactBody.data[0]).toMatchObject({
      First_Name: 'Jordan',
      Last_Name: 'Lee',
      Email: 'lead@example.com',
    });

    const [, dealCall] = fetchMock.mock.calls[2];
    const dealBody = JSON.parse(dealCall.body);
    expect(dealBody.data[0]).toMatchObject({
      Deal_Name: 'Mortgage calculator — Jordan Lee',
      Stage: 'Warm Leads',
      Sub_Pipeline: 'Sales Pipeline Standard',
      Referral_Source: 'TestSite.ca',
      Contact_Name: { id: 'contact-1' },
    });
  });

  it('logs but does not throw when Bigin sync fails', async () => {
    process.env.ZOHO_BIGIN_CLIENT_ID = 'client';
    process.env.ZOHO_BIGIN_CLIENT_SECRET = 'secret';
    process.env.ZOHO_BIGIN_REFRESH_TOKEN = 'refresh';
    process.env.ZOHO_BIGIN_REFERRAL_SOURCE = 'TestSite.ca';

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'invalid token' }),
      }),
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      syncLeadToBigin({
        event: 'contact_form_submitted',
        email: 'lead@example.com',
        name: 'Jordan Lee',
      }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
  });
});

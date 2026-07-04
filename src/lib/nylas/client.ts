import { logger } from '@/lib/logger';

const DEFAULT_API_URI = 'https://api.us.nylas.com';

function getApiKey(): string | undefined {
  return (
    (import.meta.env.NYLAS_API_KEY as string | undefined) ||
    (typeof process !== 'undefined' ? process.env.NYLAS_API_KEY : undefined)
  );
}

function getApiUri(): string {
  const uri =
    (import.meta.env.NYLAS_API_URI as string | undefined) ||
    (typeof process !== 'undefined' ? process.env.NYLAS_API_URI : undefined);
  return (uri || DEFAULT_API_URI).replace(/\/$/, '');
}

export function isNylasConfigured(): boolean {
  return !!getApiKey();
}

export class NylasApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = 'NylasApiError';
  }
}

export async function nylasFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('NYLAS_API_KEY is not configured');
  }

  const url = `${getApiUri()}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error('Nylas API request failed', { path, status: response.status, body });
    throw new NylasApiError(`Nylas API error (${response.status})`, response.status, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

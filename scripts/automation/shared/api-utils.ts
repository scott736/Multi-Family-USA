// ============================================
// Shared API Utilities
// ============================================

/**
 * Fetch with timeout using AbortController.
 * Prevents hanging requests from blocking GitHub Actions indefinitely.
 */
export function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 60000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    clearTimeout(timeout);
  });
}

/**
 * Fetch with timeout + retry on network errors or retryable HTTP statuses.
 * Exponential backoff with ±20% jitter between attempts.
 */
const DEFAULT_RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config: {
    timeoutMs?: number;
    maxRetries?: number;
    retryableStatuses?: number[];
  } = {}
): Promise<Response> {
  const {
    timeoutMs = 60000,
    maxRetries = 3,
    retryableStatuses = DEFAULT_RETRYABLE_STATUSES,
  } = config;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);
      if (response.ok || !retryableStatuses.includes(response.status)) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
      if (attempt === maxRetries) return response;
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) throw error;
    }

    const base = 1000 * Math.pow(2, attempt);
    const jitter = base * (0.8 + Math.random() * 0.4);
    await new Promise((resolve) => setTimeout(resolve, jitter));
  }

  throw lastError ?? new Error("fetchWithRetry: retries exhausted");
}

/**
 * Validate and parse a JSON response from the LLM.
 * Handles markdown code blocks, missing fields, and parse errors.
 */
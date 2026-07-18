/**
 * Conversion tracking — dataLayer for GTM; Cloudflare Web Analytics can be wired later.
 */
export function trackConversion(
  event: string,
  payload: Record<string, unknown> = {},
): void {
  if (typeof window === 'undefined') return;

  const w = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
  if (Array.isArray(w.dataLayer)) {
    w.dataLayer.push({ event, ...payload });
  }

  if (import.meta.env.DEV) {
    console.debug('[analytics]', event, payload);
  }
}

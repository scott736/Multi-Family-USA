/**
 * Conversion tracking — Vercel Analytics custom events (no GA4).
 * Also pushes to window.dataLayer when a tag manager is injected externally.
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

  import('@vercel/analytics')
    .then(({ track }) => {
      const props: Record<string, string | number | boolean | null> = {};
      for (const [key, value] of Object.entries(payload)) {
        if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean' ||
          value === null
        ) {
          props[key] = value;
        } else if (value !== undefined) {
          props[key] = String(value);
        }
      }
      track(event, props);
    })
    .catch(() => {
      /* analytics optional in dev / when blocked */
    });
}

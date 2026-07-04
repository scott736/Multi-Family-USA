/**
 * Vanilla conversion click tracking — avoids hydrating React on every page.
 */
function trackConversion(
  event: string,
  payload: Record<string, unknown> = {},
): void {
  const w = window as Window & { dataLayer?: Array<Record<string, unknown>> };
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

function inferLinkLocation(anchor: HTMLAnchorElement): string {
  if (anchor.dataset.analyticsLocation) {
    return anchor.dataset.analyticsLocation;
  }
  if (anchor.closest('[data-sticky-cta]')) return 'sticky-mobile';
  if (anchor.closest('[data-site-banner]')) return 'banner';
  if (anchor.closest('header')) return 'navbar';
  if (anchor.closest('footer')) return 'footer';
  return 'other';
}

function handleDocumentClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const anchor = target.closest('a');
  if (!(anchor instanceof HTMLAnchorElement)) return;

  const href = anchor.getAttribute('href') ?? '';
  const location = inferLinkLocation(anchor);

  if (href.startsWith('tel:')) {
    trackConversion('phone_click', {
      link_location: location,
      phone_href: href,
    });
    return;
  }

  if (href.includes('/deal-review')) {
    let source: string | undefined;
    try {
      source =
        new URL(href, window.location.origin).searchParams.get('source') ??
        undefined;
    } catch {
      source = undefined;
    }

    trackConversion('deal_review_click', {
      link_location: location,
      link_href: href,
      ...(source ? { source } : {}),
    });
    return;
  }

  if (href.includes('/book-strategy-call')) {
    trackConversion('book_call_click', {
      link_location: location,
      link_href: href,
    });
    return;
  }

  if (href.includes('/get-matched')) {
    let source: string | undefined;
    try {
      source =
        new URL(href, window.location.origin).searchParams.get('source') ??
        undefined;
    } catch {
      source = undefined;
    }

    trackConversion('get_matched_click', {
      link_location: location,
      link_href: href,
      ...(source ? { source } : {}),
    });
  }
}

document.addEventListener('click', handleDocumentClick);

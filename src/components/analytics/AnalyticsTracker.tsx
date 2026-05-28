'use client';

import { useEffect } from 'react';

import { trackConversion } from '@/lib/analytics';

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

/** Delegated click tracking for tel: and get-matched links site-wide. */
export function AnalyticsTracker() {
  useEffect(() => {
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  return null;
}

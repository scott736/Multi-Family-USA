import { defineMiddleware } from "astro:middleware";

/**
 * Legacy SearchAction / client-search URLs used `?q=…` (including the literal
 * `{search_term_string}` template Google once crawled). Calculator CTAs also
 * land on `/deal-review/?source=…&…` with a self-canonical, which GSC reports as
 * "Alternate page with proper canonical tag". 301 to the clean path instead.
 */
export const onRequest = defineMiddleware((context, next) => {
  const url = context.url;
  const { pathname, searchParams } = url;

  if (searchParams.size === 0) {
    return next();
  }

  const isDealReview =
    pathname === "/deal-review" ||
    pathname === "/deal-review/" ||
    pathname === "/es/deal-review" ||
    pathname === "/es/deal-review/";
  const hasLegacySearch = searchParams.has("q");

  if (!isDealReview && !hasLegacySearch) {
    return next();
  }

  if (hasLegacySearch) {
    searchParams.delete("q");
  }

  if (isDealReview) {
    // Drop calculator tracking params; keep the clean lead form URL.
    for (const key of [...searchParams.keys()]) {
      searchParams.delete(key);
    }
  }

  const search = searchParams.toString();
  const cleanPath = pathname.endsWith("/") || pathname === "/" ? pathname : `${pathname}/`;
  const location = `${cleanPath}${search ? `?${search}` : ""}${url.hash}`;
  return context.redirect(location, 301);
});

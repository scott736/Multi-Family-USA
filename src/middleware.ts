import { defineMiddleware } from "astro:middleware";

/**
 * Legacy SearchAction / client-search URLs used `?q=…` (including the literal
 * `{search_term_string}` template Google once crawled). Those responses are the
 * same static HTML as the clean path with a self-canonical, which GSC reports as
 * "Alternate page with proper canonical tag". 301 to the clean path instead.
 */
export const onRequest = defineMiddleware((context, next) => {
  const url = context.url;
  if (!url.searchParams.has("q")) {
    return next();
  }

  url.searchParams.delete("q");
  const search = url.searchParams.toString();
  const location = `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
  return context.redirect(location, 301);
});

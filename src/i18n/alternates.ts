import type { Lang } from "./utils";

export interface AlternateLink {
  hreflang: string;
  href: string;
}

/** Directory-style URLs need a trailing slash for canonical/hreflang parity. */
export function ensureTrailingSlash(path: string): string {
  if (path === "/") return "/";
  return path.endsWith("/") ? path : `${path}/`;
}

export function stripEsPrefix(path: string): string {
  if (path === "/es" || path === "/es/") return "/";
  if (path.startsWith("/es/")) return path.slice(3) || "/";
  return path;
}

export function addEsPrefix(path: string): string {
  if (path === "/") return "/es/";
  if (path.startsWith("/es/") || path === "/es") return ensureTrailingSlash(path);
  return ensureTrailingSlash(`/es${path.startsWith("/") ? "" : "/"}${path}`);
}

export function buildHreflangAlternates(
  siteUrl: string,
  opts: {
    pathname: string;
    enPath?: string;
    esPath?: string;
    includeSpanish?: boolean;
  },
): AlternateLink[] {
  const isEs = opts.pathname === "/es" || opts.pathname.startsWith("/es/");
  const derivedEn = ensureTrailingSlash(
    opts.enPath ?? (isEs ? stripEsPrefix(opts.pathname) : opts.pathname),
  );
  const derivedEs = ensureTrailingSlash(
    opts.esPath ?? (isEs ? opts.pathname : addEsPrefix(opts.pathname)),
  );
  const includeSpanish = opts.includeSpanish ?? true;

  const alternates: AlternateLink[] = [
    { hreflang: "en-US", href: `${siteUrl}${derivedEn}` },
    { hreflang: "x-default", href: `${siteUrl}${derivedEn}` },
  ];

  if (includeSpanish) {
    alternates.splice(1, 0, { hreflang: "es-US", href: `${siteUrl}${derivedEs}` });
  }

  return alternates;
}

export function pageLangFromPath(pathname: string): Lang {
  return pathname === "/es" || pathname.startsWith("/es/") ? "es" : "en";
}

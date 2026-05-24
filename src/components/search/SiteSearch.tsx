"use client";

import { Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PagefindModule = {
  init: () => Promise<void>;
  debouncedSearch: (
    query: string,
    options?: { filters?: Record<string, string> },
  ) => Promise<{
    results: Array<{ id: string; data: () => Promise<PagefindResultData> }>;
  } | null>;
};

type PagefindResultData = {
  url: string;
  meta: { title?: string };
  excerpt: string;
};

type SearchResult = {
  url: string;
  title: string;
  excerpt: string;
  pillar: string;
};

interface SiteSearchProps {
  lang?: "en" | "es";
}

const PILLAR_ORDER = [
  "learn",
  "tools",
  "states",
  "compare",
  "invest",
  "blog",
  "other",
] as const;

const PILLAR_LABELS: Record<
  (typeof PILLAR_ORDER)[number],
  { en: string; es: string }
> = {
  learn: { en: "Learn", es: "Aprender" },
  tools: { en: "Tools", es: "Herramientas" },
  states: { en: "States", es: "Estados" },
  compare: { en: "Compare", es: "Comparar" },
  invest: { en: "Invest", es: "Invertir" },
  blog: { en: "Blog", es: "Blog" },
  other: { en: "Other", es: "Otros" },
};

function getPillar(url: string, isEs: boolean): (typeof PILLAR_ORDER)[number] {
  let path = url.replace(/^https?:\/\/[^/]+/, "");
  if (isEs) path = path.replace(/^\/es/, "") || "/";

  if (
    path.startsWith("/learn") ||
    path.startsWith("/requirements") ||
    path.startsWith("/pros-and-cons") ||
    path.startsWith("/glossary") ||
    path.startsWith("/que-es")
  ) {
    return "learn";
  }
  if (path.startsWith("/tools") || path.startsWith("/calculadora")) return "tools";
  if (path.startsWith("/states") || path.startsWith("/cities")) return "states";
  if (
    path.startsWith("/compare") ||
    path === "/rates" ||
    path.startsWith("/loan-types") ||
    path.startsWith("/property-types")
  ) {
    return "compare";
  }
  if (path.startsWith("/invest")) return "invest";
  if (path.startsWith("/blog")) return "blog";
  return "other";
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export default function SiteSearch({ lang = "en" }: SiteSearchProps) {
  const isEs = lang === "es";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pagefindRef = useRef<PagefindModule | null>(null);

  const labels = {
    placeholder: isEs ? "Buscar guías, herramientas, estados…" : "Search guides, tools, states…",
    empty: isEs ? "Escribe para buscar en el sitio." : "Type to search the site.",
    none: isEs ? "Sin resultados." : "No results found.",
    close: isEs ? "Cerrar búsqueda" : "Close search",
    open: isEs ? "Buscar en el sitio" : "Search site",
    shortcut: isEs ? "Presiona ⌘K" : "Press ⌘K",
  };

  const loadPagefind = useCallback(async () => {
    if (pagefindRef.current) return pagefindRef.current;
    if (typeof window === "undefined") return null;
    try {
      const url = new URL("/pagefind/pagefind.js", window.location.origin).href;
      const mod = (await import(/* @vite-ignore */ url)) as { default: PagefindModule };
      await mod.default.init();
      pagefindRef.current = mod.default;
      setReady(true);
      return mod.default;
    } catch {
      setReady(false);
      return null;
    }
  }, []);

  const runSearch = useCallback(
    async (term: string) => {
      const pf = await loadPagefind();
      if (!pf || !term.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const response = await pf.debouncedSearch(term.trim(), {
        filters: { lang },
      });

      if (!response) {
        setResults([]);
        setLoading(false);
        return;
      }

      const items = await Promise.all(
        response.results.slice(0, 24).map(async (r) => {
          const data = await r.data();
          return {
            url: data.url,
            title: data.meta.title ?? data.url,
            excerpt: stripHtml(data.excerpt),
            pillar: getPillar(data.url, isEs),
          };
        }),
      );

      setResults(items);
      setLoading(false);
    },
    [isEs, lang, loadPagefind],
  );

  useEffect(() => {
    if (!open) return;
    void loadPagefind();
    inputRef.current?.focus();
  }, [loadPagefind, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("overflow-hidden");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("overflow-hidden");
    };
  }, [open]);

  useEffect(() => {
    const onShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onShortcut);
    return () => document.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      void runSearch(query);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [open, query, runSearch]);

  const grouped = PILLAR_ORDER.map((pillar) => ({
    pillar,
    label: PILLAR_LABELS[pillar][isEs ? "es" : "en"],
    items: results.filter((r) => r.pillar === pillar),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={labels.open}
        className="inline-flex size-9 items-center justify-center rounded-full border border-input bg-background text-foreground shadow-xs hover:bg-secondary"
      >
        <Search className="size-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-background/80 p-4 pt-[10vh] backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={labels.open}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={labels.placeholder}
                className="border-0 shadow-none focus-visible:ring-0"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={labels.close}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-2">
              {!ready && query.trim() && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {isEs
                    ? "La búsqueda estará disponible después del build del sitio."
                    : "Search is available after the site build."}
                </p>
              )}

              {!query.trim() && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {labels.empty}
                  <span className="mt-2 block text-xs opacity-70">{labels.shortcut}</span>
                </p>
              )}

              {query.trim() && ready && !loading && results.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {labels.none}
                </p>
              )}

              {grouped.map((group) => (
                <div key={group.pillar} className="mb-3">
                  <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
                    {group.label}
                  </p>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item.url}>
                        <a
                          href={item.url}
                          className="block rounded-md px-3 py-2 hover:bg-secondary"
                          onClick={() => setOpen(false)}
                        >
                          <span className="text-sm font-semibold text-foreground">
                            {item.title}
                          </span>
                          {item.excerpt && (
                            <span
                              className={cn(
                                "mt-0.5 block text-xs text-muted-foreground line-clamp-2",
                              )}
                            >
                              {item.excerpt}
                            </span>
                          )}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

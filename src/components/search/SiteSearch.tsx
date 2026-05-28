"use client";

import { Search, X } from "lucide-react";
import { useCallback, useEffect, useReducer, useRef } from "react";

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

interface SiteSearchState {
  open: boolean;
  query: string;
  results: SearchResult[];
  loading: boolean;
  ready: boolean;
}

type SiteSearchAction =
  | { type: "set-open"; open: boolean }
  | { type: "set-query"; query: string }
  | { type: "set-results"; results: SearchResult[] }
  | { type: "set-loading"; loading: boolean }
  | { type: "set-ready"; ready: boolean };

const INITIAL_STATE: SiteSearchState = {
  open: false,
  query: "",
  results: [],
  loading: false,
  ready: false,
};

function siteSearchReducer(
  state: SiteSearchState,
  action: SiteSearchAction,
): SiteSearchState {
  switch (action.type) {
    case "set-open":
      return { ...state, open: action.open };
    case "set-query":
      return { ...state, query: action.query };
    case "set-results":
      return { ...state, results: action.results };
    case "set-loading":
      return { ...state, loading: action.loading };
    case "set-ready":
      return { ...state, ready: action.ready };
    default:
      return state;
  }
}

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
  const [{ open, query, results, loading, ready }, dispatch] = useReducer(
    siteSearchReducer,
    INITIAL_STATE,
  );
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
      const mod = (await import(/* @vite-ignore */ "/pagefind/pagefind.js")) as {
        default: PagefindModule;
      };
      await mod.default.init();
      pagefindRef.current = mod.default;
      dispatch({ type: "set-ready", ready: true });
      return mod.default;
    } catch {
      dispatch({ type: "set-ready", ready: false });
      return null;
    }
  }, []);

  const closeDialog = useCallback(() => {
    dispatch({ type: "set-open", open: false });
  }, []);

  const runSearch = useCallback(
    async (term: string) => {
      const pf = await loadPagefind();
      if (!pf || !term.trim()) {
        dispatch({ type: "set-results", results: [] });
        dispatch({ type: "set-loading", loading: false });
        return;
      }

      dispatch({ type: "set-loading", loading: true });
      const response = await pf.debouncedSearch(term.trim(), {
        filters: { lang },
      });

      if (!response) {
        dispatch({ type: "set-results", results: [] });
        dispatch({ type: "set-loading", loading: false });
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

      dispatch({ type: "set-results", results: items });
      dispatch({ type: "set-loading", loading: false });
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
      if (e.key === "Escape") dispatch({ type: "set-open", open: false });
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
        dispatch({ type: "set-open", open: true });
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

  const groupedMap = results.reduce<
    Map<
      (typeof PILLAR_ORDER)[number],
      {
        pillar: (typeof PILLAR_ORDER)[number];
        rank: number;
        label: string;
        items: SearchResult[];
      }
    >
  >((acc, item) => {
    const existing = acc.get(item.pillar);
    if (existing) {
      existing.items.push(item);
      return acc;
    }

    acc.set(item.pillar, {
      pillar: item.pillar,
      rank: PILLAR_ORDER.indexOf(item.pillar),
      label: PILLAR_LABELS[item.pillar][isEs ? "es" : "en"],
      items: [item],
    });
    return acc;
  }, new Map());

  const grouped = Array.from(groupedMap.values())
    .sort((a, b) => a.rank - b.rank)
    .map(({ rank: _rank, ...group }) => group);

  return (
    <>
      <button
        type="button"
        onClick={() => dispatch({ type: "set-open", open: true })}
        aria-label={labels.open}
        className="inline-flex size-9 items-center justify-center rounded-full border border-input bg-background text-foreground shadow-xs hover:bg-secondary"
      >
        <Search className="size-4" aria-hidden="true" />
      </button>

      {open && (
        <dialog open className="fixed inset-0 z-[100] p-0" aria-label={labels.open}>
          <div className="relative flex min-h-dvh items-start justify-center p-4 pt-[10vh]">
            <button
              type="button"
              aria-label={labels.close}
              onClick={closeDialog}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <div className="relative z-10 w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => dispatch({ type: "set-query", query: e.target.value })}
                  placeholder={labels.placeholder}
                  className="border-0 shadow-none focus-visible:ring-0"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={closeDialog}
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
                            onClick={closeDialog}
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
        </dialog>
      )}
    </>
  );
}

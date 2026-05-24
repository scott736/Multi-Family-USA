"use client";

import { ArrowUpDown, Check, Minus, X } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export interface Lender {
  name: string;
  slug: string;
  fundedVolume?: string;
  statesCount: number | string;
  minDscr: string;
  minFico: string;
  maxLtv: string;
  minLoan?: string;
  maxLoan?: string;
  hasCalculator: boolean;
  foreignNational?: "yes" | "limited" | "no";
  specialty?: string;
  notes?: string;
  specialty_es?: string;
  notes_es?: string;
  minDscr_es?: string;
  website?: string;
  dataLastVerified: string;
}

interface Props {
  lenders: Lender[];
  lang?: "en" | "es";
}

type SortKey =
  | "name"
  | "fundedVolume"
  | "statesCount"
  | "minDscr"
  | "minFico"
  | "maxLtv";

type SortDir = "asc" | "desc";

// Parse helpers. Return NaN for unparseable so they sort to the bottom.
function parseDscr(v: string): number {
  const m = v.match(/[\d.]+/);
  return m ? parseFloat(m[0]) : NaN;
}

function parseFico(v: string): number {
  const m = v.match(/\d+/);
  return m ? parseInt(m[0], 10) : NaN;
}

function parseLtv(v: string): number {
  const m = v.match(/\d+/);
  return m ? parseInt(m[0], 10) : NaN;
}

function parseFundedVolume(v?: string): number {
  if (!v) return 0;
  const num = parseFloat(v.replace(/[^\d.]/g, ""));
  if (isNaN(num)) return 0;
  if (/b/i.test(v)) return num * 1_000;
  if (/m/i.test(v)) return num;
  return num;
}

function parseStatesCount(v: number | string): number {
  if (typeof v === "number") return v;
  if (v.toLowerCase().includes("national")) return 50;
  const m = v.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

function CalcIndicator({
  has,
  lang = "en",
}: {
  has: boolean;
  lang?: "en" | "es";
}) {
  const isEs = lang === "es";
  return has ? (
    <span className="inline-flex items-center gap-1 text-success">
      <Check className="size-4" />
      <span className="sr-only">{isEs ? "Sí" : "Yes"}</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <X className="size-4" />
      <span className="sr-only">{isEs ? "No" : "No"}</span>
    </span>
  );
}

function FnBadge({
  v,
  lang = "en",
}: {
  v?: "yes" | "limited" | "no";
  lang?: "en" | "es";
}) {
  if (!v)
    return (
      <span className="text-xs text-muted-foreground">
        <Minus className="size-3 inline" />
      </span>
    );
  const styles = {
    yes: "bg-success/15 text-success ring-success/30",
    limited: "bg-accent/20 text-accent-foreground ring-accent/40",
    no: "bg-muted text-muted-foreground ring-border",
  } as const;
  const isEs = lang === "es";
  const label = isEs
    ? { yes: "Sí", limited: "Limitado", no: "No" }[v]
    : { yes: "Yes", limited: "Limited", no: "No" }[v];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1",
        styles[v],
      )}
    >
      {label}
    </span>
  );
}

export default function LenderTable({ lenders, lang = "en" }: Props) {
  const isEs = lang === "es";
  const t = {
    search: isEs ? "Buscar" : "Search",
    searchPlaceholder: isEs ? "Nombre o especialidad" : "Name or specialty",
    minDscrAllowed: isEs ? "DSCR mínimo permitido" : "Min DSCR allowed",
    minFicoAccepted: isEs ? "FICO mínimo aceptado" : "Min FICO accepted",
    stateCoverage: isEs ? "Cobertura estatal" : "State coverage",
    foreignNational: isEs ? "Extranjero" : "Foreign national",
    publicCalculator: isEs ? "Calculadora pública" : "Public calculator",
    any: isEs ? "Cualquiera" : "Any",
    yes: isEs ? "Sí" : "Yes",
    limited: isEs ? "Limitado" : "Limited",
    no: "No",
    orBelow: isEs ? "o menos" : "or below",
    statesPlus: isEs ? "estados o más" : "+ states",
    nationalOption: isEs ? "50 estados / Nacional" : "50-state / National",
    showing: isEs ? "Mostrando" : "Showing",
    of: isEs ? "de" : "of",
    lenders: isEs ? "prestamistas" : "lenders",
    resetFilters: isEs ? "Restablecer filtros" : "Reset filters",
    lender: isEs ? "Prestamista" : "Lender",
    funded: isEs ? "Financiado" : "Funded",
    states: isEs ? "Estados" : "States",
    minDscr: isEs ? "DSCR mín." : "Min DSCR",
    minFico: isEs ? "FICO mín." : "Min FICO",
    maxLtv: isEs ? "LTV máx." : "Max LTV",
    loanRange: isEs ? "Rango de préstamo" : "Loan range",
    calc: isEs ? "Calc." : "Calc",
    foreignNatl: isEs ? "Extranjero" : "Foreign Nat'l",
    specialty: isEs ? "Especialidad" : "Specialty",
    noMatches: isEs
      ? "Ningún prestamista coincide con esos filtros. Intenta restablecerlos."
      : "No lenders match those filters. Try resetting.",
  };
  const specialtyOf = (l: Lender) =>
    isEs ? (l.specialty_es ?? l.specialty) : l.specialty;
  const notesOf = (l: Lender) => (isEs ? (l.notes_es ?? l.notes) : l.notes);
  const minDscrOf = (l: Lender) =>
    isEs ? (l.minDscr_es ?? l.minDscr) : l.minDscr;
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [minDscrFilter, setMinDscrFilter] = useState<string>("any");
  const [minFicoFilter, setMinFicoFilter] = useState<string>("any");
  const [fnFilter, setFnFilter] = useState<string>("any");
  const [calcFilter, setCalcFilter] = useState<string>("any");
  const [stateFilter, setStateFilter] = useState<string>("any");
  const [query, setQuery] = useState<string>("");

  const filtered = useMemo(() => {
    const out = lenders.filter((l) => {
      if (query) {
        const q = query.toLowerCase();
        if (
          !l.name.toLowerCase().includes(q) &&
          !(specialtyOf(l) ?? "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (minDscrFilter !== "any") {
        const threshold = parseFloat(minDscrFilter);
        const v = parseDscr(l.minDscr);
        // If the lender allows DSCR at/below threshold, it passes.
        if (!isNaN(v) && v > threshold) return false;
      }
      if (minFicoFilter !== "any") {
        const threshold = parseInt(minFicoFilter, 10);
        const v = parseFico(l.minFico);
        if (!isNaN(v) && v > threshold) return false;
      }
      if (fnFilter !== "any") {
        if (l.foreignNational !== fnFilter) return false;
      }
      if (calcFilter !== "any") {
        const want = calcFilter === "yes";
        if (l.hasCalculator !== want) return false;
      }
      if (stateFilter !== "any") {
        // Only filter out lenders whose coverage is clearly smaller than the
        // requested bar. "National" and 50 always pass.
        const count = parseStatesCount(l.statesCount);
        const threshold = parseInt(stateFilter, 10);
        if (count < threshold) return false;
      }
      return true;
    });

    out.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "fundedVolume":
          cmp = parseFundedVolume(a.fundedVolume) - parseFundedVolume(b.fundedVolume);
          break;
        case "statesCount":
          cmp = parseStatesCount(a.statesCount) - parseStatesCount(b.statesCount);
          break;
        case "minDscr": {
          const av = parseDscr(a.minDscr);
          const bv = parseDscr(b.minDscr);
          cmp = (isNaN(av) ? Infinity : av) - (isNaN(bv) ? Infinity : bv);
          break;
        }
        case "minFico": {
          const av = parseFico(a.minFico);
          const bv = parseFico(b.minFico);
          cmp = (isNaN(av) ? Infinity : av) - (isNaN(bv) ? Infinity : bv);
          break;
        }
        case "maxLtv": {
          const av = parseLtv(a.maxLtv);
          const bv = parseLtv(b.maxLtv);
          cmp = (isNaN(av) ? -Infinity : av) - (isNaN(bv) ? -Infinity : bv);
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return out;
  }, [
    lenders,
    sortKey,
    sortDir,
    minDscrFilter,
    minFicoFilter,
    fnFilter,
    calcFilter,
    stateFilter,
    query,
  ]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function clearFilters() {
    setMinDscrFilter("any");
    setMinFicoFilter("any");
    setFnFilter("any");
    setCalcFilter("any");
    setStateFilter("any");
    setQuery("");
  }

  const SortButton = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className="inline-flex items-center gap-1 font-semibold text-left hover:text-primary"
    >
      {label}
      <ArrowUpDown
        className={cn(
          "size-3 shrink-0 transition-colors",
          sortKey === k ? "text-primary" : "text-muted-foreground/60",
        )}
      />
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4 md:p-5">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t.search}
            <input
              type="search"
              placeholder={t.searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t.minDscrAllowed}
            <select
              value={minDscrFilter}
              onChange={(e) => setMinDscrFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            >
              <option value="any">{t.any}</option>
              <option value="0.75">0.75 {t.orBelow}</option>
              <option value="1.0">1.00 {t.orBelow}</option>
              <option value="1.25">1.25 {t.orBelow}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t.minFicoAccepted}
            <select
              value={minFicoFilter}
              onChange={(e) => setMinFicoFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            >
              <option value="any">{t.any}</option>
              <option value="620">620 {t.orBelow}</option>
              <option value="660">660 {t.orBelow}</option>
              <option value="680">680 {t.orBelow}</option>
              <option value="700">700 {t.orBelow}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t.stateCoverage}
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            >
              <option value="any">{t.any}</option>
              <option value="30">{isEs ? "30 estados o más" : "30+ states"}</option>
              <option value="40">{isEs ? "40 estados o más" : "40+ states"}</option>
              <option value="46">{isEs ? "46 estados o más" : "46+ states"}</option>
              <option value="50">{t.nationalOption}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t.foreignNational}
            <select
              value={fnFilter}
              onChange={(e) => setFnFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            >
              <option value="any">{t.any}</option>
              <option value="yes">{t.yes}</option>
              <option value="limited">{t.limited}</option>
              <option value="no">{t.no}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t.publicCalculator}
            <select
              value={calcFilter}
              onChange={(e) => setCalcFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            >
              <option value="any">{t.any}</option>
              <option value="yes">{t.yes}</option>
              <option value="no">{t.no}</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {t.showing} <strong className="text-foreground">{filtered.length}</strong> {t.of}{" "}
            {lenders.length} {t.lenders}
          </span>
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-medium text-primary hover:underline"
          >
            {t.resetFilters}
          </button>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-3 text-left"><SortButton k="name" label={t.lender} /></th>
              <th className="px-3 py-3 text-left"><SortButton k="fundedVolume" label={t.funded} /></th>
              <th className="px-3 py-3 text-left"><SortButton k="statesCount" label={t.states} /></th>
              <th className="px-3 py-3 text-left"><SortButton k="minDscr" label={t.minDscr} /></th>
              <th className="px-3 py-3 text-left"><SortButton k="minFico" label={t.minFico} /></th>
              <th className="px-3 py-3 text-left"><SortButton k="maxLtv" label={t.maxLtv} /></th>
              <th className="px-3 py-3 text-left">{t.loanRange}</th>
              <th className="px-3 py-3 text-left">{t.calc}</th>
              <th className="px-3 py-3 text-left">{t.foreignNatl}</th>
              <th className="px-3 py-3 text-left">{t.specialty}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {filtered.map((l) => (
              <tr key={l.slug} className="hover:bg-secondary/30">
                <td className="px-3 py-3 font-semibold text-foreground">
                  <a href={`#lender-${l.slug}`} className="hover:text-primary">
                    {l.name}
                  </a>
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {l.fundedVolume ?? "—"}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {l.statesCount}
                </td>
                <td className="px-3 py-3 text-foreground">{minDscrOf(l)}</td>
                <td className="px-3 py-3 text-foreground">{l.minFico}</td>
                <td className="px-3 py-3 text-foreground">{l.maxLtv}</td>
                <td className="px-3 py-3 text-muted-foreground">
                  {l.minLoan || l.maxLoan
                    ? `${l.minLoan ?? "—"} / ${l.maxLoan ?? "—"}`
                    : "—"}
                </td>
                <td className="px-3 py-3"><CalcIndicator has={l.hasCalculator} lang={lang} /></td>
                <td className="px-3 py-3"><FnBadge v={l.foreignNational} lang={lang} /></td>
                <td className="px-3 py-3 text-muted-foreground max-w-xs">
                  {specialtyOf(l) ?? "—"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  {t.noMatches}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-3 lg:hidden">
        {filtered.map((l) => (
          <a
            key={l.slug}
            href={`#lender-${l.slug}`}
            className="block rounded-xl border border-border bg-card p-4 hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground">{l.name}</p>
                {specialtyOf(l) && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {specialtyOf(l)}
                  </p>
                )}
              </div>
              <FnBadge v={l.foreignNational} lang={lang} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-y-1 gap-x-3 text-xs tabular-nums">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t.funded}</dt>
                <dd>{l.fundedVolume ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t.states}</dt>
                <dd>{l.statesCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t.minDscr}</dt>
                <dd>{minDscrOf(l)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t.minFico}</dt>
                <dd>{l.minFico}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t.maxLtv}</dt>
                <dd>{l.maxLtv}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t.calc}</dt>
                <dd><CalcIndicator has={l.hasCalculator} lang={lang} /></dd>
              </div>
            </dl>
          </a>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {t.noMatches}
          </div>
        )}
      </div>
    </div>
  );
}

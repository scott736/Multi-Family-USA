"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const FICO_BANDS = [
  { value: "740+", label: "740+", midpoint: 740 },
  { value: "720-739", label: "720–739", midpoint: 720 },
  { value: "700-719", label: "700–719", midpoint: 700 },
  { value: "680-699", label: "680–699", midpoint: 680 },
  { value: "660-679", label: "660–679", midpoint: 660 },
  { value: "620-659", label: "620–659", midpoint: 620 },
] as const;

const DSCR_BANDS = [
  { value: "125", label: "1.25+", gridLabel: "DSCR 1.25+" },
  { value: "100", label: "1.00–1.24", gridLabel: "DSCR 1.00-1.24" },
  { value: "075", label: "0.75–0.99", gridLabel: "DSCR 0.75-0.99" },
] as const;

const LTV_BANDS = [
  { value: "ltv60", label: "60% LTV", pct: 60 },
  { value: "ltv65", label: "65% LTV", pct: 65 },
  { value: "ltv70", label: "70% LTV", pct: 70 },
  { value: "ltv75", label: "75% LTV", pct: 75 },
  { value: "ltv80", label: "80% LTV", pct: 80 },
] as const;

const PURPOSES = [
  { value: "purchase", labelEn: "Purchase", labelEs: "Compra" },
  { value: "rate-term-refi", labelEn: "Refinance", labelEs: "Refinanciamiento" },
] as const;

interface RatesScenarioFilterProps {
  lang?: "en" | "es";
}

export default function RatesScenarioFilter({ lang = "en" }: RatesScenarioFilterProps) {
  const isEs = lang === "es";
  const [fico, setFico] = useState<(typeof FICO_BANDS)[number]["value"]>("720-739");
  const [dscr, setDscr] = useState<(typeof DSCR_BANDS)[number]["value"]>("100");
  const [ltv, setLtv] = useState<(typeof LTV_BANDS)[number]["value"]>("ltv75");
  const [purpose, setPurpose] =
    useState<(typeof PURPOSES)[number]["value"]>("purchase");
  const [highlightedRate, setHighlightedRate] = useState<string | null>(null);

  const ficoBand = FICO_BANDS.find((b) => b.value === fico)!;
  const dscrBand = DSCR_BANDS.find((b) => b.value === dscr)!;
  const ltvBand = LTV_BANDS.find((b) => b.value === ltv)!;

  useEffect(() => {
    document
      .querySelectorAll("[data-rate-row], [data-rate-col], [data-rate-cell]")
      .forEach((el) => {
        el.classList.remove(
          "rate-highlight-row",
          "rate-highlight-col",
          "rate-highlight-cell",
          "ring-2",
          "ring-accent/60",
          "bg-accent/10",
        );
      });

    const grid = document.querySelector(`[data-rate-grid="${dscr}"]`);
    if (!grid) {
      setHighlightedRate(null);
      return;
    }

    grid.scrollIntoView({ behavior: "smooth", block: "nearest" });

    const row = grid.querySelector(`[data-rate-row="${fico}"]`);
    const cell = row?.querySelector(`[data-rate-col="${ltv}"]`);

    grid.querySelectorAll(`[data-rate-row="${fico}"]`).forEach((el) => {
      el.classList.add("rate-highlight-row", "bg-accent/10");
    });
    grid.querySelectorAll(`[data-rate-col="${ltv}"]`).forEach((el) => {
      el.classList.add("rate-highlight-col", "bg-accent/5");
    });

    if (cell) {
      cell.classList.add(
        "rate-highlight-cell",
        "ring-2",
        "ring-accent/60",
        "bg-accent/15",
        "font-bold",
      );
      setHighlightedRate(cell.textContent?.trim() ?? null);
    } else {
      setHighlightedRate(null);
    }
  }, [dscr, fico, ltv]);

  const estimatorUrl = useMemo(() => {
    const params = new URLSearchParams({
      fico: String(ficoBand.midpoint),
      purpose,
      downMode: "percent",
      downValue: String(100 - ltvBand.pct),
    });
    const base = isEs
      ? "/es/tools/qualification-estimator"
      : "/tools/qualification-estimator";
    return `${base}?${params.toString()}`;
  }, [ficoBand.midpoint, isEs, ltvBand.pct, purpose]);

  const matchedUrl = useMemo(() => {
    const params = new URLSearchParams({
      fico: String(ficoBand.midpoint),
      purpose,
      source: "rates-scenario-filter",
    });
    const base = isEs ? "/es/get-matched" : "/get-matched";
    return `${base}?${params.toString()}`;
  }, [ficoBand.midpoint, isEs, purpose]);

  const copy = isEs
    ? {
        title: "Encuentra tu celda de tasa",
        subtitle:
          "Selecciona tu escenario para resaltar la fila y columna en las tablas de abajo.",
        fico: "Banda FICO",
        dscr: "Banda DSCR",
        ltv: "LTV objetivo",
        purpose: "Propósito del préstamo",
        match: "Resaltando",
        estimator: "Estimador de calificación",
        getMatched: "Emparejarse con prestamistas",
      }
    : {
        title: "Find your rate cell",
        subtitle:
          "Pick your scenario to highlight the matching row and column in the tables below.",
        fico: "FICO band",
        dscr: "DSCR band",
        ltv: "Target LTV",
        purpose: "Loan purpose",
        match: "Highlighting",
        estimator: "Qualification estimator",
        getMatched: "Get matched with lenders",
      };

  return (
    <div className="rounded-xl border border-border bg-card p-5 md:p-6">
      <h2 className="text-lg font-bold text-foreground md:text-xl">{copy.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="rates-fico">{copy.fico}</Label>
          <select
            id="rates-fico"
            value={fico}
            onChange={(e) =>
              setFico(e.target.value as (typeof FICO_BANDS)[number]["value"])
            }
            className="mt-1.5 flex h-11 w-full rounded border border-input bg-background px-3 text-sm shadow-xs"
          >
            {FICO_BANDS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="rates-dscr">{copy.dscr}</Label>
          <select
            id="rates-dscr"
            value={dscr}
            onChange={(e) =>
              setDscr(e.target.value as (typeof DSCR_BANDS)[number]["value"])
            }
            className="mt-1.5 flex h-11 w-full rounded border border-input bg-background px-3 text-sm shadow-xs"
          >
            {DSCR_BANDS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="rates-ltv">{copy.ltv}</Label>
          <select
            id="rates-ltv"
            value={ltv}
            onChange={(e) =>
              setLtv(e.target.value as (typeof LTV_BANDS)[number]["value"])
            }
            className="mt-1.5 flex h-11 w-full rounded border border-input bg-background px-3 text-sm shadow-xs"
          >
            {LTV_BANDS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="rates-purpose">{copy.purpose}</Label>
          <select
            id="rates-purpose"
            value={purpose}
            onChange={(e) =>
              setPurpose(e.target.value as (typeof PURPOSES)[number]["value"])
            }
            className="mt-1.5 flex h-11 w-full rounded border border-input bg-background px-3 text-sm shadow-xs"
          >
            {PURPOSES.map((p) => (
              <option key={p.value} value={p.value}>
                {isEs ? p.labelEs : p.labelEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {highlightedRate && (
        <p className="mt-4 text-sm text-muted-foreground">
          {copy.match}{" "}
          <strong className="text-foreground">
            {dscrBand.gridLabel} · {ficoBand.label} · {ltvBand.label}
          </strong>
          {" — "}
          <span className="font-semibold text-accent">{highlightedRate}</span>
          <span className="text-xs"> (30-yr fixed baseline)</span>
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <a href={estimatorUrl}>
          <Button variant="outline" className="gap-2">
            {copy.estimator}
            <ArrowRight className="size-4" />
          </Button>
        </a>
        <a href={matchedUrl}>
          <Button className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
            {copy.getMatched}
            <ArrowRight className="size-4" />
          </Button>
        </a>
      </div>
    </div>
  );
}

import { getCollection, type CollectionEntry } from "astro:content";

export type ContentKind =
  | "state"
  | "loanType"
  | "propertyType"
  | "guide"
  | "comparison"
  | "investorProfile";

export type Lang = "en" | "es";

export interface RelatedLink {
  href: string;
  title: string;
  description: string;
  kicker: string;
}

export interface RelatedGroup {
  label: string;
  description?: string;
  links: RelatedLink[];
}

interface BuildInput {
  kind: ContentKind;
  slug: string;
  lang?: Lang;
  keywords?: string[];
  explicitTools?: string[];
  explicitGuides?: string[];
}

// --- Tool catalogs ---------------------------------------------------------
// Tools are Astro pages, not a content collection, so we keep their titles and
// descriptions here for consistent, SEO-friendly anchor text. Each language
// has its own catalog so both titles and URLs switch cleanly.
type ToolEntry = { title: string; description: string };

const TOOLS_EN: Record<string, ToolEntry> = {
  "/tools/dscr-calculator": {
    title: "DSCR Ratio Calculator",
    description: "Calculate your DSCR in seconds and see pass/fail by lender tier.",
  },
  "/tools/qualification-estimator": {
    title: "DSCR Qualification Estimator",
    description:
      "Estimate your rate range, LTV cap, and approval odds before you apply.",
  },
  "/tools/dscr-vs-conventional": {
    title: "DSCR vs Conventional Calculator",
    description:
      "Side-by-side qualification, rate, LTV, and lifetime-cost comparison.",
  },
  "/tools/prepayment-penalty-analyzer": {
    title: "Prepayment Penalty Analyzer",
    description:
      "Model step-down PPPs and compute the break-even for a no-PPP buydown.",
  },
  "/tools/brrrr-modeler": {
    title: "BRRRR Strategy Modeler",
    description:
      "Model the full Buy–Rehab–Rent–Refi cycle with DSCR refi seasoning rules.",
  },
  "/tools/portfolio-dscr-analyzer": {
    title: "Portfolio DSCR Analyzer",
    description:
      "Blend DSCR across your rental portfolio and preview blanket-loan structure.",
  },
  "/tools/refinance-timing-optimizer": {
    title: "Refinance Timing Optimizer",
    description: "Find the optimal refi window given PPP and appreciation curves.",
  },
  "/tools/str-dscr-analyzer": {
    title: "Short-Term Rental DSCR Analyzer",
    description:
      "Run Airbnb income through lender STR haircuts with LTR fallback.",
  },
  "/rates": {
    title: "Today's DSCR Loan Rates",
    description: "Live DSCR rate ranges by credit tier, LTV, and product type.",
  },
  "/compare/best-dscr-lenders": {
    title: "Best DSCR Lenders of 2026",
    description:
      "Head-to-head shortlist of the leading DSCR lenders with program details.",
  },
};

const TOOLS_ES: Record<string, ToolEntry> = {
  "/es/tools/dscr-calculator": {
    title: "Calculadora de Ratio DSCR",
    description:
      "Calcula tu DSCR en segundos y ve si aprueba o no por nivel de prestamista.",
  },
  "/es/tools/qualification-estimator": {
    title: "Estimador de Calificación DSCR",
    description:
      "Estima tu rango de tasa, límite de LTV y probabilidad de aprobación antes de aplicar.",
  },
  "/es/tools/dscr-vs-conventional": {
    title: "Calculadora DSCR vs Convencional",
    description:
      "Comparación lado a lado de calificación, tasa, LTV y costo total.",
  },
  "/es/tools/prepayment-penalty-analyzer": {
    title: "Analizador de Penalización por Pago Anticipado",
    description:
      "Modela PPPs escalonados y calcula el punto de equilibrio de un buydown sin PPP.",
  },
  "/es/tools/brrrr-modeler": {
    title: "Modelador de Estrategia BRRRR",
    description:
      "Modela el ciclo completo Compra–Rehab–Renta–Refi con reglas de seasoning DSCR.",
  },
  "/es/tools/portfolio-dscr-analyzer": {
    title: "Analizador DSCR de Portafolio",
    description:
      "Combina el DSCR de tu portafolio de rentas y previsualiza la estructura blanket.",
  },
  "/es/tools/refinance-timing-optimizer": {
    title: "Optimizador de Tiempo de Refinanciamiento",
    description:
      "Encuentra la ventana óptima de refi según curvas de PPP y apreciación.",
  },
  "/es/tools/str-dscr-analyzer": {
    title: "Analizador DSCR de Renta a Corto Plazo",
    description:
      "Pasa el ingreso de Airbnb por los haircuts STR del prestamista con respaldo LTR.",
  },
  "/es/rates": {
    title: "Tasas de Préstamos DSCR Hoy",
    description:
      "Rangos de tasas DSCR en vivo por nivel de crédito, LTV y tipo de producto.",
  },
  "/es/compare/best-dscr-lenders": {
    title: "Mejores Prestamistas DSCR de 2026",
    description:
      "Lista comparativa de los principales prestamistas DSCR con detalles de programa.",
  },
};

// --- Localized UI labels ---------------------------------------------------
// Group headings, descriptions, kickers, and small phrases that appear in
// rendered cards. Keyed by lang so the caller can pick one dict.
type Labels = {
  kickers: {
    interactiveTool: string;
    liveRates: string;
    resource: string;
    guide: string;
    stateGuide: string;
    loanType: string;
    propertyType: string;
    comparison: string;
    investorProfile: string;
  };
  state: {
    dscrLoansIn: (name: string) => string;
    compareOthers: { label: string; description: string };
    productsForDeal: { label: string; description: string };
    propertyTypesHere: { label: string };
  };
  loanType: {
    otherProducts: { label: string; description: string };
    howCompares: { label: string };
    statesHeavyUse: { label: string };
  };
  propertyType: {
    similarTypes: { label: string; description: string };
    productsFit: { label: string };
    popularStates: { label: string };
  };
  guide: {
    keepReading: { label: string; description: string };
    applyToLoan: { label: string };
  };
  comparison: {
    otherComparisons: { label: string };
    ifDscrStart: { label: string };
  };
  investorProfile: {
    otherProfiles: { label: string };
    productsFitStrategy: { label: string };
    foundationalReading: { label: string };
  };
  editorsPicks: { label: string; description: string };
  runTheNumbers: { label: string; description: string };
};

const LABELS_EN: Labels = {
  kickers: {
    interactiveTool: "Interactive tool",
    liveRates: "Live rates",
    resource: "Resource",
    guide: "Guide",
    stateGuide: "State guide",
    loanType: "Loan type",
    propertyType: "Property type",
    comparison: "Comparison",
    investorProfile: "Investor profile",
  },
  state: {
    dscrLoansIn: (name: string) => `DSCR Loans in ${name}`,
    compareOthers: {
      label: "Compare other states",
      description: "DSCR rules, rates, and tax posture in similar markets.",
    },
    productsForDeal: {
      label: "DSCR loan products for your next deal",
      description: "The financing structures investors use most in this market.",
    },
    propertyTypesHere: { label: "Property types investors finance here" },
  },
  loanType: {
    otherProducts: {
      label: "Other DSCR loan products",
      description:
        "Alternatives and common next steps for this financing path.",
    },
    howCompares: { label: "How this compares to other loan programs" },
    statesHeavyUse: { label: "States where this product is in heavy use" },
  },
  propertyType: {
    similarTypes: {
      label: "Similar property types",
      description:
        "How DSCR underwriting shifts when the asset class changes.",
    },
    productsFit: { label: "Loan products that fit this property type" },
    popularStates: { label: "Popular states for this asset" },
  },
  guide: {
    keepReading: {
      label: "Keep reading",
      description: "More guides on this area of DSCR lending.",
    },
    applyToLoan: { label: "Apply it to a real loan" },
  },
  comparison: {
    otherComparisons: { label: "Other DSCR comparisons" },
    ifDscrStart: { label: "If you're leaning DSCR — start here" },
  },
  investorProfile: {
    otherProfiles: { label: "Other investor profiles" },
    productsFitStrategy: { label: "Loan products that fit this strategy" },
    foundationalReading: { label: "Foundational reading" },
  },
  editorsPicks: {
    label: "Editor's picks",
    description: "Hand-chosen follow-ups for this topic.",
  },
  runTheNumbers: {
    label: "Run the numbers",
    description: "Free interactive tools to stress-test your deal.",
  },
};

const LABELS_ES: Labels = {
  kickers: {
    interactiveTool: "Herramienta interactiva",
    liveRates: "Tasas en vivo",
    resource: "Recurso",
    guide: "Guía",
    stateGuide: "Guía estatal",
    loanType: "Tipo de préstamo",
    propertyType: "Tipo de propiedad",
    comparison: "Comparación",
    investorProfile: "Perfil de inversionista",
  },
  state: {
    dscrLoansIn: (name: string) => `Préstamos DSCR en ${name}`,
    compareOthers: {
      label: "Compara otros estados",
      description:
        "Reglas DSCR, tasas y postura fiscal en mercados similares.",
    },
    productsForDeal: {
      label: "Productos de préstamo DSCR para tu próximo trato",
      description:
        "Las estructuras de financiamiento que los inversionistas usan más en este mercado.",
    },
    propertyTypesHere: {
      label: "Tipos de propiedad que los inversionistas financian aquí",
    },
  },
  loanType: {
    otherProducts: {
      label: "Otros productos de préstamo DSCR",
      description:
        "Alternativas y próximos pasos comunes para esta vía de financiamiento.",
    },
    howCompares: { label: "Cómo se compara con otros programas de préstamo" },
    statesHeavyUse: {
      label: "Estados donde este producto se usa ampliamente",
    },
  },
  propertyType: {
    similarTypes: {
      label: "Tipos de propiedad similares",
      description:
        "Cómo cambia la suscripción DSCR cuando cambia el tipo de activo.",
    },
    productsFit: {
      label: "Productos de préstamo que se ajustan a este tipo de propiedad",
    },
    popularStates: { label: "Estados populares para este activo" },
  },
  guide: {
    keepReading: {
      label: "Sigue leyendo",
      description: "Más guías sobre esta área de los préstamos DSCR.",
    },
    applyToLoan: { label: "Aplícalo a un préstamo real" },
  },
  comparison: {
    otherComparisons: { label: "Otras comparaciones DSCR" },
    ifDscrStart: { label: "Si te inclinas por DSCR — comienza aquí" },
  },
  investorProfile: {
    otherProfiles: { label: "Otros perfiles de inversionista" },
    productsFitStrategy: {
      label: "Productos de préstamo que se ajustan a esta estrategia",
    },
    foundationalReading: { label: "Lectura fundamental" },
  },
  editorsPicks: {
    label: "Selección del editor",
    description: "Próximos pasos elegidos a mano para este tema.",
  },
  runTheNumbers: {
    label: "Calcula los números",
    description:
      "Herramientas interactivas gratuitas para analizar tu trato.",
  },
};

// Featured anchors — used when we need a safe default pick for a group.
const FEATURED_LOAN_TYPES = [
  "purchase",
  "cash-out-refinance",
  "rate-and-term-refinance",
];
const FEATURED_PROPERTY_TYPES = [
  "single-family-rental",
  "2-4-unit",
  "short-term-rental",
];
const CORE_GUIDES = [
  "what-is-a-dscr-loan",
  "dscr-loan-requirements",
  "credit-score-tiers",
  "down-payment-and-ltv",
];
const TIER_1_STATES = [
  "florida",
  "texas",
  "california",
  "georgia",
  "arizona",
  "tennessee",
  "north-carolina",
];

// Per-content-type recommendation rules. These capture the semantic
// relationships a human editor would draw between pages — similar strategy,
// common pairings, adjacent products.
const PROPERTY_TYPE_ADJACENCY: Record<string, string[]> = {
  "single-family-rental": ["2-4-unit", "short-term-rental", "warrantable-condos"],
  "2-4-unit": ["single-family-rental", "5-10-unit-multifamily", "mixed-use"],
  "5-10-unit-multifamily": ["2-4-unit", "mixed-use", "single-family-rental"],
  "short-term-rental": ["single-family-rental", "warrantable-condos", "2-4-unit"],
  "warrantable-condos": [
    "non-warrantable-condos",
    "single-family-rental",
    "short-term-rental",
  ],
  "non-warrantable-condos": [
    "warrantable-condos",
    "single-family-rental",
    "short-term-rental",
  ],
  "mixed-use": ["5-10-unit-multifamily", "2-4-unit", "single-family-rental"],
};

const LOAN_TYPE_ADJACENCY: Record<string, string[]> = {
  purchase: ["cash-out-refinance", "rate-and-term-refinance", "interest-only-dscr"],
  "cash-out-refinance": [
    "rate-and-term-refinance",
    "purchase",
    "portfolio-blanket-dscr",
  ],
  "rate-and-term-refinance": [
    "cash-out-refinance",
    "purchase",
    "interest-only-dscr",
  ],
  "interest-only-dscr": ["purchase", "no-ratio-dscr", "cash-out-refinance"],
  "no-ratio-dscr": ["interest-only-dscr", "purchase", "portfolio-blanket-dscr"],
  "portfolio-blanket-dscr": [
    "cash-out-refinance",
    "no-ratio-dscr",
    "purchase",
  ],
};

// Guide → loan-type and property-type hints: guides point at the loan/property
// topics most likely to keep a reader moving forward.
const GUIDE_LOAN_TYPE_HINTS: Record<string, string[]> = {
  "what-is-a-dscr-loan": ["purchase", "cash-out-refinance"],
  "dscr-loan-requirements": ["purchase", "cash-out-refinance"],
  "dscr-loan-pros-and-cons": ["purchase", "no-ratio-dscr"],
  "dscr-loan-risks": ["interest-only-dscr", "no-ratio-dscr"],
  "credit-score-tiers": ["purchase", "cash-out-refinance"],
  "down-payment-and-ltv": ["purchase", "cash-out-refinance"],
  "closing-costs-and-fees": ["purchase", "rate-and-term-refinance"],
  "prepayment-penalties": [
    "cash-out-refinance",
    "rate-and-term-refinance",
  ],
  "reserve-requirements": ["portfolio-blanket-dscr", "cash-out-refinance"],
  "entity-structure-llc-guide": ["purchase", "portfolio-blanket-dscr"],
  "holding-company-strategy": ["portfolio-blanket-dscr", "cash-out-refinance"],
  "series-llc": ["portfolio-blanket-dscr", "purchase"],
  "1031-exchange-with-dscr": ["cash-out-refinance", "purchase"],
};

// Investor-profile → recommended loan types.
const PROFILE_LOAN_TYPES: Record<string, string[]> = {
  "first-time-investor": ["purchase", "rate-and-term-refinance"],
  "self-employed": ["purchase", "cash-out-refinance", "no-ratio-dscr"],
  "foreign-national": ["purchase", "no-ratio-dscr"],
  "portfolio-builder": [
    "portfolio-blanket-dscr",
    "cash-out-refinance",
    "interest-only-dscr",
  ],
  "brrrr-and-dscr-strategy": [
    "cash-out-refinance",
    "rate-and-term-refinance",
    "purchase",
  ],
};

// Comparison → which guide/loan-type to feature as "the DSCR side" of the
// comparison, so readers who just decided in favor of DSCR have a next step.
const COMPARISON_NEXT_STEPS: Record<string, string[]> = {
  "dscr-vs-conventional": ["purchase", "dscr-loan-requirements"],
  "dscr-vs-bank-statement": ["purchase", "what-is-a-dscr-loan"],
  "dscr-vs-hard-money": ["rate-and-term-refinance", "cash-out-refinance"],
  "dscr-vs-bridge": ["rate-and-term-refinance", "cash-out-refinance"],
  "dscr-vs-commercial": ["portfolio-blanket-dscr", "5-10-unit-multifamily"],
};

function idToSlug(id: string): string {
  return id.replace(/\.mdx$/, "");
}

function unique<T>(arr: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function cap<T>(arr: T[], n: number): T[] {
  return arr.slice(0, n);
}

// Map a content kind + lang to the actual collection name. Keeps the lang
// switch contained to one place.
type AnyCollectionName =
  | "states"
  | "loanTypes"
  | "propertyTypes"
  | "guides"
  | "comparisons"
  | "investorProfiles"
  | "esStates"
  | "esLoanTypes"
  | "esPropertyTypes"
  | "esGuides"
  | "esComparisons"
  | "esInvestorProfiles";

function collectionName(
  kind: "states" | "loanTypes" | "propertyTypes" | "guides" | "comparisons" | "investorProfiles",
  lang: Lang,
): AnyCollectionName {
  if (lang === "en") return kind;
  switch (kind) {
    case "states":
      return "esStates";
    case "loanTypes":
      return "esLoanTypes";
    case "propertyTypes":
      return "esPropertyTypes";
    case "guides":
      return "esGuides";
    case "comparisons":
      return "esComparisons";
    case "investorProfiles":
      return "esInvestorProfiles";
  }
}

// URL prefix for this lang — "" for English, "/es" for Spanish.
function prefix(lang: Lang): string {
  return lang === "es" ? "/es" : "";
}

function scoreByKeyword(
  candidateKeywords: string[] | undefined,
  target: string[] | undefined,
): number {
  if (!candidateKeywords?.length || !target?.length) return 0;
  const set = new Set(candidateKeywords.map((k) => k.toLowerCase()));
  let score = 0;
  for (const t of target) {
    if (set.has(t.toLowerCase())) score += 1;
  }
  return score;
}

type RelatedCollections = [
  CollectionEntry<"states">[],
  CollectionEntry<"loanTypes">[],
  CollectionEntry<"propertyTypes">[],
  CollectionEntry<"guides">[],
  CollectionEntry<"comparisons">[],
  CollectionEntry<"investorProfiles">[],
];

const relatedCollectionsByLang = new Map<Lang, Promise<RelatedCollections>>();

function loadRelatedCollections(lang: Lang): Promise<RelatedCollections> {
  const cached = relatedCollectionsByLang.get(lang);
  if (cached) return cached;

  const promise = Promise.all([
    // @ts-expect-error — dynamic collection-name lookup; runtime-safe union
    getCollection(collectionName("states", lang)),
    // @ts-expect-error — dynamic collection-name lookup
    getCollection(collectionName("loanTypes", lang)),
    // @ts-expect-error — dynamic collection-name lookup
    getCollection(collectionName("propertyTypes", lang)),
    // @ts-expect-error — dynamic collection-name lookup
    getCollection(collectionName("guides", lang)),
    // @ts-expect-error — dynamic collection-name lookup
    getCollection(collectionName("comparisons", lang)),
    // @ts-expect-error — dynamic collection-name lookup
    getCollection(collectionName("investorProfiles", lang)),
  ]) as Promise<RelatedCollections>;

  relatedCollectionsByLang.set(lang, promise);
  return promise;
}

export async function getRelatedLinks(
  input: BuildInput,
): Promise<RelatedGroup[]> {
  const lang: Lang = input.lang ?? "en";
  const L = lang === "es" ? LABELS_ES : LABELS_EN;
  const TOOLS = lang === "es" ? TOOLS_ES : TOOLS_EN;
  const p = prefix(lang);

  const [states, loanTypes, propertyTypes, guides, comparisons, profiles] =
    await loadRelatedCollections(lang);

  function toolLink(href: string): RelatedLink | null {
    const t = TOOLS[href];
    if (!t) return null;
    const isTool = href.startsWith("/tools/") || href.startsWith("/es/tools/");
    const isRates = href === "/rates" || href === "/es/rates";
    const kicker = isTool
      ? L.kickers.interactiveTool
      : isRates
        ? L.kickers.liveRates
        : L.kickers.resource;
    return { href, title: t.title, description: t.description, kicker };
  }

  function guideLink(entry: CollectionEntry<"guides">): RelatedLink {
    return {
      href: `${p}/learn/${idToSlug(entry.id)}`,
      title: entry.data.title,
      description: entry.data.description,
      kicker: L.kickers.guide,
    };
  }

  function stateLink(entry: CollectionEntry<"states">): RelatedLink {
    return {
      href: `${p}/states/${idToSlug(entry.id)}`,
      title: L.state.dscrLoansIn(entry.data.stateName),
      description: entry.data.description,
      kicker: L.kickers.stateGuide,
    };
  }

  function loanTypeLink(entry: CollectionEntry<"loanTypes">): RelatedLink {
    return {
      href: `${p}/loan-types/${idToSlug(entry.id)}`,
      title: entry.data.title,
      description: entry.data.description,
      kicker: L.kickers.loanType,
    };
  }

  function propertyTypeLink(entry: CollectionEntry<"propertyTypes">): RelatedLink {
    return {
      href: `${p}/property-types/${idToSlug(entry.id)}`,
      title: entry.data.title,
      description: entry.data.description,
      kicker: L.kickers.propertyType,
    };
  }

  function comparisonLink(entry: CollectionEntry<"comparisons">): RelatedLink {
    return {
      href: `${p}/compare/${idToSlug(entry.id)}`,
      title: entry.data.title,
      description: entry.data.description,
      kicker: L.kickers.comparison,
    };
  }

  function profileLink(entry: CollectionEntry<"investorProfiles">): RelatedLink {
    return {
      href: `${p}/invest/${idToSlug(entry.id)}`,
      title: entry.data.title,
      description: entry.data.description,
      kicker: L.kickers.investorProfile,
    };
  }

  const stateBySlug = new Map(states.map((e) => [idToSlug(e.id), e]));
  const loanTypeBySlug = new Map(loanTypes.map((e) => [idToSlug(e.id), e]));
  const propertyTypeBySlug = new Map(
    propertyTypes.map((e) => [idToSlug(e.id), e]),
  );
  const guideBySlug = new Map(guides.map((e) => [idToSlug(e.id), e]));
  const comparisonBySlug = new Map(
    comparisons.map((e) => [idToSlug(e.id), e]),
  );
  const profileBySlug = new Map(profiles.map((e) => [idToSlug(e.id), e]));

  const selfHref = (() => {
    switch (input.kind) {
      case "state":
        return `${p}/states/${input.slug}`;
      case "loanType":
        return `${p}/loan-types/${input.slug}`;
      case "propertyType":
        return `${p}/property-types/${input.slug}`;
      case "guide":
        return `${p}/learn/${input.slug}`;
      case "comparison":
        return `${p}/compare/${input.slug}`;
      case "investorProfile":
        return `${p}/invest/${input.slug}`;
    }
  })();

  const pickLoanTypes = (slugs: string[], n: number): RelatedLink[] =>
    cap(
      slugs
        .map((s) => loanTypeBySlug.get(s))
        .filter((e): e is CollectionEntry<"loanTypes"> => !!e)
        .map(loanTypeLink)
        .filter((l) => l.href !== selfHref),
      n,
    );

  const pickPropertyTypes = (slugs: string[], n: number): RelatedLink[] =>
    cap(
      slugs
        .map((s) => propertyTypeBySlug.get(s))
        .filter((e): e is CollectionEntry<"propertyTypes"> => !!e)
        .map(propertyTypeLink)
        .filter((l) => l.href !== selfHref),
      n,
    );

  const pickGuides = (slugs: string[], n: number): RelatedLink[] =>
    cap(
      slugs
        .map((s) => guideBySlug.get(s))
        .filter((e): e is CollectionEntry<"guides"> => !!e)
        .map(guideLink)
        .filter((l) => l.href !== selfHref),
      n,
    );

  const pickStates = (slugs: string[], n: number): RelatedLink[] =>
    cap(
      slugs
        .map((s) => stateBySlug.get(s))
        .filter((e): e is CollectionEntry<"states"> => !!e)
        .map(stateLink)
        .filter((l) => l.href !== selfHref),
      n,
    );

  const pickComparisons = (slugs: string[], n: number): RelatedLink[] =>
    cap(
      slugs
        .map((s) => comparisonBySlug.get(s))
        .filter((e): e is CollectionEntry<"comparisons"> => !!e)
        .map(comparisonLink)
        .filter((l) => l.href !== selfHref),
      n,
    );

  const pickProfiles = (slugs: string[], n: number): RelatedLink[] =>
    cap(
      slugs
        .map((s) => profileBySlug.get(s))
        .filter((e): e is CollectionEntry<"investorProfiles">=> !!e)
        .map(profileLink)
        .filter((l) => l.href !== selfHref),
      n,
    );

  const groups: RelatedGroup[] = [];

  // 1. Content-type-specific auto groups.
  switch (input.kind) {
    case "state": {
      const current = stateBySlug.get(input.slug);
      const otherStates = states.filter((e) => idToSlug(e.id) !== input.slug);
      const sameTier = current
        ? otherStates.filter((e) => e.data.tier === current.data.tier)
        : [];
      const tierPicks = unique(
        sameTier.length >= 3 ? sameTier : [...sameTier, ...otherStates],
        (e) => e.id,
      );
      groups.push({
        label: L.state.compareOthers.label,
        description: L.state.compareOthers.description,
        links: cap(tierPicks.map(stateLink), 4),
      });
      groups.push({
        label: L.state.productsForDeal.label,
        description: L.state.productsForDeal.description,
        links: pickLoanTypes(FEATURED_LOAN_TYPES, 3),
      });
      groups.push({
        label: L.state.propertyTypesHere.label,
        links: pickPropertyTypes(FEATURED_PROPERTY_TYPES, 3),
      });
      break;
    }

    case "loanType": {
      const adjacency = LOAN_TYPE_ADJACENCY[input.slug] ?? FEATURED_LOAN_TYPES;
      groups.push({
        label: L.loanType.otherProducts.label,
        description: L.loanType.otherProducts.description,
        links: pickLoanTypes(adjacency, 3),
      });
      groups.push({
        label: L.loanType.howCompares.label,
        links: pickComparisons(
          comparisons.map((c) => idToSlug(c.id)),
          3,
        ),
      });
      groups.push({
        label: L.loanType.statesHeavyUse.label,
        links: pickStates(TIER_1_STATES, 4),
      });
      break;
    }

    case "propertyType": {
      const adjacency =
        PROPERTY_TYPE_ADJACENCY[input.slug] ?? FEATURED_PROPERTY_TYPES;
      groups.push({
        label: L.propertyType.similarTypes.label,
        description: L.propertyType.similarTypes.description,
        links: pickPropertyTypes(adjacency, 3),
      });
      groups.push({
        label: L.propertyType.productsFit.label,
        links: pickLoanTypes(FEATURED_LOAN_TYPES, 3),
      });
      groups.push({
        label: L.propertyType.popularStates.label,
        links: pickStates(TIER_1_STATES, 4),
      });
      break;
    }

    case "guide": {
      const current = guideBySlug.get(input.slug);
      const sameCategory = current
        ? guides
            .filter(
              (e) =>
                e.data.category === current.data.category &&
                idToSlug(e.id) !== input.slug,
            )
            .map(guideLink)
        : [];
      const keywordRanked = current
        ? guides
            .filter((e) => idToSlug(e.id) !== input.slug)
            .map((e) => ({
              e,
              score: scoreByKeyword(e.data.keywords, current.data.keywords),
            }))
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((x) => guideLink(x.e))
        : [];
      const combined = unique(
        [...sameCategory, ...keywordRanked, ...pickGuides(CORE_GUIDES, 4)],
        (l) => l.href,
      );
      groups.push({
        label: L.guide.keepReading.label,
        description: L.guide.keepReading.description,
        links: cap(combined, 4),
      });
      const loanHints =
        GUIDE_LOAN_TYPE_HINTS[input.slug] ?? FEATURED_LOAN_TYPES;
      groups.push({
        label: L.guide.applyToLoan.label,
        links: pickLoanTypes(loanHints, 3),
      });
      break;
    }

    case "comparison": {
      groups.push({
        label: L.comparison.otherComparisons.label,
        links: pickComparisons(
          comparisons.map((c) => idToSlug(c.id)),
          3,
        ),
      });
      const nextSteps = COMPARISON_NEXT_STEPS[input.slug] ?? [];
      const loanNextSteps = nextSteps.filter((s) => loanTypeBySlug.has(s));
      const guideNextSteps = nextSteps.filter((s) => guideBySlug.has(s));
      const propNextSteps = nextSteps.filter((s) => propertyTypeBySlug.has(s));
      const nextLinks: RelatedLink[] = [
        ...pickLoanTypes(loanNextSteps, 2),
        ...pickGuides(guideNextSteps, 2),
        ...pickPropertyTypes(propNextSteps, 1),
      ];
      if (nextLinks.length) {
        groups.push({
          label: L.comparison.ifDscrStart.label,
          links: cap(nextLinks, 3),
        });
      }
      break;
    }

    case "investorProfile": {
      const allProfiles = profiles.map((p) => idToSlug(p.id));
      groups.push({
        label: L.investorProfile.otherProfiles.label,
        links: pickProfiles(allProfiles, 3),
      });
      const profileLoans =
        PROFILE_LOAN_TYPES[input.slug] ?? FEATURED_LOAN_TYPES;
      groups.push({
        label: L.investorProfile.productsFitStrategy.label,
        links: pickLoanTypes(profileLoans, 3),
      });
      groups.push({
        label: L.investorProfile.foundationalReading.label,
        links: pickGuides(CORE_GUIDES, 3),
      });
      break;
    }
  }

  // 2. Explicit frontmatter (relatedGuides) — merge into the "Keep reading"
  // group if present, otherwise append a new group. Editors' picks always win.
  // Hrefs from frontmatter are assumed English-style (e.g. "/learn/<slug>");
  // when lang === "es", we prepend "/es" so they resolve to Spanish routes.
  if (input.explicitGuides?.length) {
    const explicit: RelatedLink[] = [];
    for (const rawHref of input.explicitGuides) {
      // Normalize to current lang. If caller passed "/es/..." already, leave
      // it alone; otherwise add the /es prefix for Spanish.
      const href =
        lang === "es" && !rawHref.startsWith("/es")
          ? `/es${rawHref.startsWith("/") ? "" : "/"}${rawHref}`
          : rawHref;
      if (href === selfHref) continue;
      const learnPrefix = `${p}/learn/`;
      const investPrefix = `${p}/invest/`;
      const comparePrefix = `${p}/compare/`;
      const loanPrefix = `${p}/loan-types/`;
      const propPrefix = `${p}/property-types/`;
      const statePrefix = `${p}/states/`;
      if (href.startsWith(learnPrefix)) {
        const slug = href.slice(learnPrefix.length);
        const entry = guideBySlug.get(slug);
        if (entry) explicit.push(guideLink(entry));
      } else if (href.startsWith(investPrefix)) {
        const slug = href.slice(investPrefix.length);
        const entry = profileBySlug.get(slug);
        if (entry) explicit.push(profileLink(entry));
      } else if (href.startsWith(comparePrefix)) {
        const slug = href.slice(comparePrefix.length);
        const entry = comparisonBySlug.get(slug);
        if (entry) explicit.push(comparisonLink(entry));
        else {
          const tool = toolLink(href);
          if (tool) explicit.push(tool);
        }
      } else if (href.startsWith(loanPrefix)) {
        const slug = href.slice(loanPrefix.length);
        const entry = loanTypeBySlug.get(slug);
        if (entry) explicit.push(loanTypeLink(entry));
      } else if (href.startsWith(propPrefix)) {
        const slug = href.slice(propPrefix.length);
        const entry = propertyTypeBySlug.get(slug);
        if (entry) explicit.push(propertyTypeLink(entry));
      } else if (href.startsWith(statePrefix)) {
        const slug = href.slice(statePrefix.length);
        const entry = stateBySlug.get(slug);
        if (entry) explicit.push(stateLink(entry));
      }
    }
    if (explicit.length) {
      const keepReading = groups.find(
        (g) => g.label === L.guide.keepReading.label,
      );
      if (keepReading) {
        keepReading.links = cap(
          unique([...explicit, ...keepReading.links], (l) => l.href),
          5,
        );
      } else {
        groups.unshift({
          label: L.editorsPicks.label,
          description: L.editorsPicks.description,
          links: cap(explicit, 5),
        });
      }
    }
  }

  // 3. Tools — merge explicit frontmatter with a sensible default set.
  const defaultTools =
    lang === "es"
      ? [
          "/es/tools/dscr-calculator",
          "/es/tools/qualification-estimator",
          "/es/rates",
        ]
      : [
          "/tools/dscr-calculator",
          "/tools/qualification-estimator",
          "/rates",
        ];
  // Explicit tool hrefs may come from English frontmatter; normalize to match
  // TOOLS_ES keys when lang === "es".
  const normalizedExplicitTools = (input.explicitTools ?? []).map((h) =>
    lang === "es" && !h.startsWith("/es")
      ? `/es${h.startsWith("/") ? "" : "/"}${h}`
      : h,
  );
  const toolHrefs = unique(
    [...normalizedExplicitTools, ...defaultTools],
    (h) => h,
  );
  const toolLinks: RelatedLink[] = toolHrefs
    .map(toolLink)
    .filter((l): l is RelatedLink => !!l && l.href !== selfHref);
  if (toolLinks.length) {
    groups.push({
      label: L.runTheNumbers.label,
      description: L.runTheNumbers.description,
      links: cap(toolLinks, 4),
    });
  }

  // 4. Strip empty groups and globally dedupe so no link appears twice across
  //    groups on the same page (first occurrence wins).
  const seenHrefs = new Set<string>();
  const deduped: RelatedGroup[] = [];
  for (const g of groups) {
    const links = g.links.filter((l) => {
      if (seenHrefs.has(l.href)) return false;
      seenHrefs.add(l.href);
      return true;
    });
    if (links.length) deduped.push({ ...g, links });
  }

  return deduped;
}

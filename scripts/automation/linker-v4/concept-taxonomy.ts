// ============================================
// Smart Linker v8 — Financing Concept & Asset Taxonomy
// ============================================
// Ontology for semantic target matching (not just token overlap).

import { tokenize } from "./semantic-filter";

/** Financing concepts a page or paragraph can be about. */
export type FinancingConcept =
  | "fixed-vs-variable-rates"
  | "portfolio-scaling-limits"
  | "force-appreciation-value-add"
  | "dscr-qualification"
  | "commercial-financing"
  | "residential-financing"
  | "self-storage-financing"
  | "development-ground-up"
  | "cmhc-programs"
  | "refinancing-equity"
  | "bridge-financing"
  | "cross-border-us"
  | "multifamily-investing"
  | "fix-and-flip"
  | "down-payment-qualification"
  | "rental-analysis-cash-flow"
  | "lender-selection"
  | "amortization-terms"
  | "joint-venture-partnerships";

export type AssetClass =
  | "residential"
  | "commercial"
  | "multifamily"
  | "self-storage"
  | "development"
  | "mixed-use"
  | "office"
  | "retail"
  | "industrial"
  | "short-term-rental"
  | "investment-property";

const CONCEPT_PATTERNS: Record<FinancingConcept, RegExp[]> = {
  "fixed-vs-variable-rates": [
    /\bfixed\s+(?:vs\.?|versus|or)\s+variable\b/i,
    /\bvariable\s+rate\s+mortgage/i,
    /\bfixed\s+rate\s+mortgage/i,
    /\bconvert\s+to\s+(?:a\s+)?fixed\s+rate/i,
    /\brate\s+(?:type|decision|choice)\b/i,
    /\bamortization\s+period/i,
  ],
  "portfolio-scaling-limits": [
    /\bresidential\s+mortgage(?:s)?\s+(?:one|a)\s+borrower\s+can\s+hold\b/i,
    /\bmortgage(?:s)?\s+(?:one|a)\s+borrower\s+can\s+hold\b/i,
    /\blender(?:'?s)?\s+cap\b/i,
    /\bportfolio\s+growth\b/i,
    /\bscaling\s+(?:your\s+)?portfolio\b/i,
    /\bmultiple\s+rental\s+propert/i,
    /\bqualif(?:y|ying)\s+for\s+multiple\b/i,
    /\bmaxed\s+out\b/i,
    /\bhit(?:ting)?\s+(?:the\s+)?(?:wall|limit|ceiling)\b/i,
    /\b\d+\s+(?:or|to)\s+\d+\s+propert/i,
  ],
  "force-appreciation-value-add": [
    /\bforce(?:d)?\s+appreciation\b/i,
    /\bvalue[- ]add\b/i,
    /\bunderperforming\s+apartment\b/i,
    /\bincrease\s+(?:noi|rental\s+income)\b/i,
    /\brenovation(?:s)?\s+(?:to\s+)?(?:increase|boost)\b/i,
    /\bbrrrr\b/i,
    /\btakeout\s+financ/i,
  ],
  "dscr-qualification": [
    /\bdscr\b/i,
    /\bdebt\s+service\s+coverage\b/i,
    /\bdebt\s+coverage\s+ratio\b/i,
    /\bqualif(?:y|ying|ication)\s+(?:on|with)\s+rental\s+income\b/i,
  ],
  "commercial-financing": [
    /\bcommercial\s+mortgage/i,
    /\bcommercial\s+(?:lend|financ|property|loan)/i,
    /\bnoi\b/i,
    /\bnet\s+operating\s+income\b/i,
    /\b5\+\s+unit/i,
    /\bapartment\s+building\b/i,
  ],
  "residential-financing": [
    /\bresidential\s+mortgage/i,
    /\b1[- ]?4\s+unit/i,
    /\bsingle[- ]family\b/i,
    /\bduplex\b/i,
    /\btriplex\b/i,
    /\bfourplex\b/i,
    /\binvestment\s+property\s+mortgage/i,
    /\brental\s+property\s+mortgage/i,
  ],
  "self-storage-financing": [
    /\bself[- ]storage\b/i,
    /\bstorage\s+facilit/i,
    /\bstorage\s+unit\s+(?:facility|invest)/i,
  ],
  "development-ground-up": [
    /\bground[- ]up\s+(?:construction|development|build)/i,
    /\bdevelopment\s+project\b/i,
    /\bnew\s+build\b/i,
    /\bconstruction\s+financ/i,
    /\bdeveloping\s+a\s+new\b/i,
  ],
  "cmhc-programs": [
    /\bcmhc\b/i,
    /\bmli\s+(?:select|standard|max)\b/i,
    /\binsured\s+(?:mortgage|financ)/i,
  ],
  "refinancing-equity": [
    /\brefinanc/i,
    /\bequity\s+take(?:-| )?out\b/i,
    /\bpull\s+(?:out\s+)?equity\b/i,
    /\bcash[- ]out\s+refi/i,
  ],
  "bridge-financing": [
    /\bbridge\s+loan/i,
    /\bbridge\s+financ/i,
    /\binterim\s+financ/i,
  ],
  "cross-border-us": [
    /\bus\s+(?:invest|rental|property|market)/i,
    /\bforeign\s+national\b/i,
    /\bcross[- ]border\b/i,
    /\bcanadian(?:s)?\s+(?:invest|buy|financ).*(?:u\.?s\.?|united\s+states)/i,
  ],
  "multifamily-investing": [
    /\bmultifamily\b/i,
    /\bmulti[- ]family\b/i,
    /\bapartment\s+(?:building|complex|invest)/i,
    /\b5\+\s+units?\b/i,
  ],
  "fix-and-flip": [
    /\bfix[- ]and[- ]flip\b/i,
    /\bhouse\s+flipp/i,
    /\brenovation\s+(?:loan|financ)/i,
    /\bpurchase\s+plus\s+improvements\b/i,
  ],
  "down-payment-qualification": [
    /\bdown\s+payment\b/i,
    /\bminimum\s+equity\b/i,
    /\bhow\s+much\s+(?:cash|money)\s+(?:do\s+i\s+)?need\b/i,
  ],
  "rental-analysis-cash-flow": [
    /\bcash\s+flow\b/i,
    /\bcap\s+rate\b/i,
    /\bvacancy\s+rate\b/i,
    /\brental\s+(?:income|yield)\b/i,
    /\banalyz(?:e|ing)\s+(?:a\s+)?(?:deal|property|investment)\b/i,
  ],
  "lender-selection": [
    /\b(?:a|b)\s+lender\b/i,
    /\bmortgage\s+broker\b/i,
    /\bchoos(?:e|ing)\s+(?:a\s+)?lender\b/i,
    /\bbank\s+vs\.?\s+broker\b/i,
  ],
  "amortization-terms": [
    /\bamortization\b/i,
    /\b25[- ]year\s+vs\.?\s+30[- ]year\b/i,
    /\bloan\s+term\b/i,
  ],
  "joint-venture-partnerships": [
    /\bjoint\s+venture\b/i,
    /\bpartnership\s+(?:structure|agreement)\b/i,
    /\bco[- ]invest/i,
  ],
};

const ASSET_PATTERNS: Record<AssetClass, RegExp[]> = {
  residential: [
    /\bresidential\b/i,
    /\b1[- ]?4\s+unit/i,
    /\bsingle[- ]family\b/i,
    /\bduplex\b/i,
    /\btriplex\b/i,
    /\bfourplex\b/i,
    /\bprimary\s+residence\b/i,
    /\bvariable\s+rate\s+mortgage/i,
    /\bfixed\s+rate\s+mortgage/i,
    /\binvestment\s+property\s+mortgage/i,
  ],
  commercial: [/\bcommercial\s+(?:property|mortgage|real\s+estate|loan|financ)/i],
  multifamily: [/\bmultifamily\b/i, /\bmulti[- ]family\b/i, /\bapartment\s+building/i, /\b5\+\s+unit/i],
  "self-storage": [/\bself[- ]storage\b/i, /\bstorage\s+facilit/i],
  development: [
    /\bdevelopment\s+project\b/i,
    /\bground[- ]up\b/i,
    /\bnew\s+construction\b/i,
    /\bdevelop(?:er|ing)\s+(?:a\s+)?(?:new|project)/i,
  ],
  "mixed-use": [/\bmixed[- ]use\b/i],
  office: [/\boffice\s+(?:building|property|space)\b/i],
  retail: [/\bretail\s+(?:property|space|building)\b/i],
  industrial: [/\bindustrial\s+(?:property|warehouse|building)\b/i],
  "short-term-rental": [/\bshort[- ]term\s+rental\b/i, /\bairbnb\b/i, /\bvrbo\b/i],
  "investment-property": [/\binvestment\s+propert/i, /\brental\s+propert/i],
};

/** Concepts that must NOT be conflated — if context has A, reject target focused on B. */
const CONCEPT_CONFLICTS: Array<[FinancingConcept, FinancingConcept]> = [
  ["portfolio-scaling-limits", "force-appreciation-value-add"],
  ["fixed-vs-variable-rates", "force-appreciation-value-add"],
  ["fixed-vs-variable-rates", "development-ground-up"],
  ["self-storage-financing", "development-ground-up"],
  ["residential-financing", "commercial-financing"],
  ["rental-analysis-cash-flow", "joint-venture-partnerships"],
];

/** Asset classes that are incompatible when context is strongly one-sided. */
const ASSET_INCOMPATIBLE: Array<[AssetClass, AssetClass]> = [
  ["residential", "commercial"],
  ["residential", "development"],
  ["self-storage", "development"],
  ["residential", "multifamily"],
];

export function inferConcepts(text: string): Set<FinancingConcept> {
  const found = new Set<FinancingConcept>();
  for (const [concept, patterns] of Object.entries(CONCEPT_PATTERNS) as [
    FinancingConcept,
    RegExp[],
  ][]) {
    if (patterns.some((p) => p.test(text))) found.add(concept);
  }
  return found;
}

export function inferAssetClasses(text: string): Set<AssetClass> {
  const found = new Set<AssetClass>();
  for (const [asset, patterns] of Object.entries(ASSET_PATTERNS) as [
    AssetClass,
    RegExp[],
  ][]) {
    if (patterns.some((p) => p.test(text))) found.add(asset);
  }
  if (found.size === 0) found.add("investment-property");
  return found;
}

export function deriveConceptsFromMeta(
  title: string,
  description: string,
  tags: string[] = [],
  topicsCovered: string[] = [],
  readerPromise = ""
): FinancingConcept[] {
  const text = [title, description, readerPromise, tags.join(" "), topicsCovered.join(" ")].join(
    " "
  );
  const inferred = inferConcepts(text);
  const concepts = Array.from(inferred);

  const tagConceptMap: Record<string, FinancingConcept[]> = {
    "brrrr": ["force-appreciation-value-add", "fix-and-flip"],
    "multifamily": ["multifamily-investing", "commercial-financing"],
    "dscr-loans": ["dscr-qualification"],
    "commercial-financing": ["commercial-financing"],
    "fix-and-flip": ["fix-and-flip"],
    "cmhc": ["cmhc-programs"],
    "us-investing": ["cross-border-us"],
    "value-add": ["force-appreciation-value-add"],
    "portfolio-scaling": ["portfolio-scaling-limits"],
    "refinancing-strategies": ["refinancing-equity"],
  };

  for (const tag of tags) {
    const mapped = tagConceptMap[tag.toLowerCase()];
    if (mapped) mapped.forEach((c) => concepts.push(c));
  }

  if (/\bforce(?:d)?\s+appreciation\b/i.test(title)) {
    concepts.push("force-appreciation-value-add");
  }
  if (/\bfixed\s+vs\.?\s+variable\b/i.test(title)) {
    concepts.push("fixed-vs-variable-rates");
  }
  if (/\bself[- ]storage\b/i.test(title)) {
    concepts.push("self-storage-financing");
  }
  if (/\bscal(?:e|ing)\b/i.test(title) && /\bportfolio\b/i.test(title)) {
    concepts.push("portfolio-scaling-limits");
  }

  return [...new Set(concepts)];
}

export function deriveTopicsExcluded(concepts: FinancingConcept[]): string[] {
  const excluded: string[] = [];
  const excludeMap: Partial<Record<FinancingConcept, string[]>> = {
    "force-appreciation-value-add": [
      "mortgage-count-limits",
      "fixed-vs-variable-decisions",
      "residential-qualification-basics",
    ],
    "development-ground-up": [
      "operating-existing-self-storage",
      "residential-rate-decisions",
    ],
    "commercial-financing": ["residential-1-4-unit-only"],
    "residential-financing": ["commercial-5-plus-units"],
    "self-storage-financing": ["general-development-investing"],
    "fixed-vs-variable-rates": ["value-add-renovation-strategy"],
  };

  for (const c of concepts) {
    const items = excludeMap[c];
    if (items) excluded.push(...items);
  }
  return [...new Set(excluded)];
}

export function conceptOverlap(
  contextConcepts: Set<FinancingConcept>,
  targetConcepts: FinancingConcept[]
): number {
  if (targetConcepts.length === 0) return 0;
  let n = 0;
  for (const c of targetConcepts) {
    if (contextConcepts.has(c)) n++;
  }
  return n;
}

export function hasConceptConflict(
  contextConcepts: Set<FinancingConcept>,
  targetConcepts: FinancingConcept[]
): boolean {
  const targetSet = new Set(targetConcepts);
  for (const [a, b] of CONCEPT_CONFLICTS) {
    if (contextConcepts.has(a) && targetSet.has(b)) return true;
    if (contextConcepts.has(b) && targetSet.has(a)) return true;
  }
  return false;
}

export function hasAssetConflict(
  contextAssets: Set<AssetClass>,
  targetAssets: string[] | undefined
): boolean {
  if (!targetAssets?.length) return false;

  const targetSet = new Set(targetAssets.map((a) => a.toLowerCase()));

  for (const [a, b] of ASSET_INCOMPATIBLE) {
    const ctxHasA = contextAssets.has(a);
    const ctxHasB = contextAssets.has(b);
    const tgtHasA = targetSet.has(a) || targetSet.has(a.replace("-", ""));
    const tgtHasB = targetSet.has(b) || targetSet.has(b.replace("-", ""));

    if (ctxHasA && !ctxHasB && tgtHasB && !tgtHasA) return true;
    if (ctxHasB && !ctxHasA && tgtHasA && !tgtHasB) return true;
  }

  if (contextAssets.has("self-storage") && targetSet.has("development") && !contextAssets.has("development")) {
    return true;
  }

  if (contextAssets.has("residential") && targetSet.has("commercial") && !contextAssets.has("commercial") && !contextAssets.has("multifamily")) {
    return true;
  }

  return false;
}

/** Score 0–1: does the anchor+context question match what the target answers? */
export function scoreReaderIntentAlignment(
  anchor: string,
  context: string,
  questionsAnswered: string[] = [],
  readerPromise = ""
): number {
  if (!questionsAnswered.length && !readerPromise) return 0.5;

  const ctxTokens = new Set(tokenize(`${anchor} ${context}`));
  const sources = [...questionsAnswered, readerPromise].filter(Boolean);

  let best = 0;
  for (const q of sources) {
    const qTokens = tokenize(q.replace(/\?/g, ""));
    if (qTokens.length === 0) continue;
    let overlap = 0;
    for (const t of qTokens) {
      if (ctxTokens.has(t)) overlap++;
    }
    const ratio = overlap / qTokens.length;
    if (ratio > best) best = ratio;
  }

  return Math.min(1, best);
}

export function hitsTopicsExcluded(
  anchor: string,
  context: string,
  topicsExcluded: string[] = []
): boolean {
  if (!topicsExcluded.length) return false;
  const text = `${anchor} ${context}`.toLowerCase();

  const exclusionPatterns: Record<string, RegExp[]> = {
    "mortgage-count-limits": [
      /\bmortgage(?:s)?\s+(?:one|a)\s+borrower\s+can\s+hold\b/i,
      /\blender(?:'?s)?\s+cap\b/i,
      /\bresidential\s+mortgage(?:s)?\s+.*\bhold\b/i,
      /\bportfolio\s+growth\b/i,
    ],
    "fixed-vs-variable-decisions": [
      /\bfixed\s+(?:vs\.?|versus|or)\s+variable\b/i,
      /\bvariable\s+rate\b/i,
      /\bconvert\s+to\s+(?:a\s+)?fixed\b/i,
    ],
    "residential-qualification-basics": [
      /\bresidential\s+mortgage\b/i,
      /\bfirst[- ]time\b/i,
    ],
    "operating-existing-self-storage": [
      /\bself[- ]storage\s+financ/i,
      /\bstorage\s+facilit/i,
      /\boperat(?:e|ing)\s+(?:a\s+)?storage\b/i,
    ],
    "general-development-investing": [
      /\bself[- ]storage\b/i,
      /\bstorage\s+asset\s+class\b/i,
    ],
    "commercial-5-plus-units": [/\b5\+\s+unit/i, /\bapartment\s+building\b/i],
    "residential-1-4-unit-only": [/\b1[- ]?4\s+unit/i, /\bsingle[- ]family\b/i],
    "value-add-renovation-strategy": [
      /\bforce(?:d)?\s+appreciation\b/i,
      /\bvalue[- ]add\b/i,
    ],
  };

  for (const topic of topicsExcluded) {
    const patterns = exclusionPatterns[topic];
    if (patterns?.some((p) => p.test(text))) return true;
  }
  return false;
}

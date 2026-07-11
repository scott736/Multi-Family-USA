// ============================================
// Smart CTA — Multi-Family USA contextual inline CTAs
// ============================================

import type { TopicCluster } from "../types";

export const BOOKING_URL = "/book-strategy-call/";

export const CTA_BUTTON = `<a href="/book-strategy-call/" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-zinc-600 h-10 px-8 no-underline">Book Your Strategy Call</a>`;

function getBookingUrl(_region?: string): string {
  return BOOKING_URL;
}

/**
 * Content keyword signals for MFUSA commercial multifamily topics.
 * Topic with the most keyword hits wins (hub-and-spoke routing).
 */
export const CONTENT_CTA_SIGNALS: Record<string, string[]> = {
  agency: [
    "fannie mae",
    "freddie mac",
    "optigo",
    "agency debt",
    "agency loan",
    "gse",
    "agency stabilized",
  ],
  bridge: [
    "bridge loan",
    "bridge debt",
    "value-add",
    "value add",
    "transitional",
    "floating-rate bridge",
    "extension option",
  ],
  "commercial-dscr": [
    "commercial dscr",
    "debt service coverage",
    "dscr floor",
    "dscr requirement",
    "coverage ratio",
  ],
  "debt-yield": ["debt yield", "dy ", "binding constraint", "term sheet velocity"],
  "cap-rate-noi": ["cap rate", "net operating income", "noi normalization", "going-in cap"],
  "loan-sizing": ["loan sizing", "max loan", "loan proceeds", "size the loan", "sizing calculator"],
  "property-type": [
    "garden-style",
    "garden style",
    "mid-rise",
    "suburban apartment",
    "c-class",
    "property type",
  ],
  "small-multifamily": [
    "5–10 unit",
    "5-10 unit",
    "5+ unit",
    "five-plus",
    "small multifamily",
    "small apartment",
  ],
  geography: ["state financing", "city market", "rent control", "property tax", "foreclosure"],
  "deal-process": [
    "due diligence",
    "closing checklist",
    "lender document",
    "entity structure",
    "term sheet",
    "pro forma",
  ],
  "capital-compare": [
    "agency vs bridge",
    "bank vs debt fund",
    "fixed vs floating",
    "recourse vs",
    "capital stack",
  ],
  rates: ["rate spread", "all-in cost", "sofr", "benchmark", "spread indication"],
  construction: [
    "construction loan",
    "ground-up",
    "221(d)(4)",
    "fha hud",
    "major rehab",
    "construction financing",
  ],
  "loan-products": [
    "loan type",
    "loan product",
    "cmbs",
    "debt fund",
    "bank balance-sheet",
    "balance sheet loan",
  ],
};

const SMART_CTA_TEMPLATES: Record<string, string[]> = {
  fundamentals: [
    "Commercial multifamily financing changes at five units — {link} to map the right debt path before you underwrite further.",
    "The wrong product choice costs more than a bad cap-rate assumption — {link} and we'll pressure-test lender fit on your asset.",
  ],
  underwriting: [
    "DSCR, debt yield, and LTV often conflict — {link} so we can show which constraint actually binds your deal.",
    "Running the metrics is step one; structuring around them is step two — {link} to turn calculator output into a term-sheet plan.",
  ],
  qualification: [
    "Coverage floors and debt-yield minimums decide proceeds more than headline rate — {link} to size the loan the way lenders will.",
    "If you're guessing at qualification, you're guessing at leverage — {link} and we'll run a lender-style read.",
  ],
  "capital-markets": [
    "Agency, bridge, bank, CMBS, and FHA price different stories — {link} to match execution to your business plan.",
    "Product choice is a capital-markets decision, not a branding preference — {link} before you shop quotes.",
  ],
  execution: [
    "Term sheets stall on packaging, not ambition — {link} and we'll review what lenders actually need to clear conditions.",
    "Closing speed follows diligence discipline — {link} to tighten the path from LOI to funding.",
  ],
  risk: [
    "Rate and extension risk should drive structure, not hope — {link} to model refinance and downside cases with a specialist.",
    "Floating debt without an exit plan is a strategy risk — {link} before you lean into bridge.",
  ],
  rates: [
    "Spread context matters more than a single quoted rate — {link} to frame all-in cost across agency and bridge paths.",
    "Pricing moves with asset quality and channel — {link} so we can translate today's market into your deal.",
  ],
};

const CLUSTER_CTA_OVERRIDES: Partial<Record<TopicCluster, string[]>> = {
  "loan-products": [
    "If you're still choosing between agency, bridge, bank, or FHA — {link} and we'll map product fit to your NOI story.",
  ],
  "agency-execution": [
    "Stabilized agency grids hinge on DSCR, debt yield, and occupancy — {link} to see whether Fannie/Freddie is realistic for this asset.",
  ],
  "bridge-value-add": [
    "Bridge works when the business plan and exit are underwritten — {link} to pressure-test extension risk before you close.",
  ],
  "underwriting-metrics": [
    "When debt yield binds before DSCR, proceeds change fast — {link} and we'll walk through the binding constraint on your deal.",
  ],
  "property-types": [
    "Garden, mid-rise, and value-add C-class underwrite differently — {link} to align property type with lender appetite.",
  ],
  "small-multifamily": [
    "5–10 unit deals are commercial — not residential rentals with bigger numbers — {link} before you size debt like a 1–4 unit loan.",
  ],
  "market-geography": [
    "State tax, rent control, and local capital markets change lender fit — {link} to review financing in your market.",
  ],
  "deal-execution": [
    "Lender-ready packages clear faster than perfect narratives — {link} and we'll review your diligence and closing checklist.",
  ],
  "capital-stack": [
    "Agency vs bridge is a stack decision with different exit math — {link} to compare paths against your hold period.",
  ],
  "rates-spreads": [
    "All-in cost includes spread, fees, caps, and prepay — {link} to frame pricing beyond the headline rate.",
  ],
  "sponsor-strategy": [
    "First-time, value-add, and institutional sponsors need different debt playbooks — {link} to match structure to your profile.",
  ],
  "construction-rehab": [
    "Construction and major rehab need takeout thinking on day one — {link} to structure funding from close through stabilization.",
  ],
};

const FUNNEL_STAGE_TEMPLATES: Record<string, string[]> = {
  awareness: [
    "Exploring multifamily debt options? {link} — free, no obligation, focused on 5+ unit commercial deals.",
    "Not sure which channel fits yet? {link} and we'll outline the sensible first path.",
  ],
  consideration: [
    "Comparing structures is smart — {link} and we'll help you see which path fits your NOI and timeline.",
  ],
  decision: [
    "Ready to structure the debt? {link} and we'll move from theory to lender fit.",
    "Have a live deal? {link} or send it for a free underwriting review.",
  ],
};

const CONTENT_TOPIC_TO_CLUSTER: Record<string, TopicCluster> = {
  agency: "agency-execution",
  bridge: "bridge-value-add",
  "commercial-dscr": "underwriting-metrics",
  "debt-yield": "underwriting-metrics",
  "cap-rate-noi": "underwriting-metrics",
  "loan-sizing": "underwriting-metrics",
  "property-type": "property-types",
  "small-multifamily": "small-multifamily",
  geography: "market-geography",
  "deal-process": "deal-execution",
  "capital-compare": "capital-stack",
  rates: "rates-spreads",
  construction: "construction-rehab",
  "loan-products": "loan-products",
};

const CONTENT_CTA_TEMPLATES: Record<string, string[]> = {
  "commercial-dscr": [
    "Commercial DSCR is how lenders size multifamily debt — {link} to interpret coverage floors for your product path.",
  ],
  "debt-yield": [
    "Debt yield often decides term-sheet velocity — {link} to see whether it binds before DSCR on your deal.",
  ],
};

const SMART_CTA_TEMPLATES_ES: Record<string, string[]> = {
  fundamentals: [
    "El financiamiento multifamiliar comercial cambia a partir de cinco unidades — {link} para mapear el camino de deuda correcto.",
  ],
  underwriting: [
    "DSCR, debt yield y LTV suelen entrar en conflicto — {link} para ver qué restricción realmente limita su operación.",
  ],
  qualification: [
    "Los mínimos de cobertura y debt yield definen el proceeds — {link} para dimensionar el préstamo como lo hace el prestamista.",
  ],
  "capital-markets": [
    "Agency, bridge, bank, CMBS y FHA cuentan historias distintas — {link} para alinear la ejecución con su plan de negocio.",
  ],
  execution: [
    "Las term sheets se atrasan por el packaging — {link} para revisar lo que el prestamista necesita para cerrar.",
  ],
  risk: [
    "El riesgo de tasa y extensión debe impulsar la estructura — {link} para modelar el refinanciamiento con un especialista.",
  ],
  rates: [
    "El spread importa más que una sola tasa publicada — {link} para enmarcar el costo all-in de su ejecución.",
  ],
};

const CLUSTER_CTA_OVERRIDES_ES: Partial<Record<TopicCluster, string[]>> = {
  "loan-products": [
    "Si aún elige entre agency, bridge, bank o FHA — {link} y mapearemos el producto a su historia de NOI.",
  ],
  "underwriting-metrics": [
    "Cuando el debt yield ata antes que el DSCR, el proceeds cambia rápido — {link} para revisar la restricción vinculante.",
  ],
  "small-multifamily": [
    "Los edificios de 5–10 unidades son comerciales — {link} antes de dimensionar la deuda como un préstamo 1–4 unidades.",
  ],
  "deal-execution": [
    "Los paquetes listos para el prestamista cierran más rápido — {link} para revisar su checklist de cierre.",
  ],
};

const FUNNEL_STAGE_TEMPLATES_ES: Record<string, string[]> = {
  awareness: [
    "¿Explorando opciones de deuda multifamiliar? {link} — gratis y sin obligación.",
  ],
  consideration: [
    "Comparar estructuras es inteligente — {link} para ver qué camino encaja con su NOI.",
  ],
  decision: [
    "¿Listo para estructurar la deuda? {link} y pasemos de la teoría al lender fit.",
  ],
};

// FR bank kept minimal (site is en/es); falls back to EN categories if unused
const SMART_CTA_TEMPLATES_FR = SMART_CTA_TEMPLATES;
const CLUSTER_CTA_OVERRIDES_FR = CLUSTER_CTA_OVERRIDES;
const FUNNEL_STAGE_TEMPLATES_FR = FUNNEL_STAGE_TEMPLATES;

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function detectContentTopic(content: string): string | null {
  const contentLower = content.toLowerCase();
  let bestTopic: string | null = null;
  let bestScore = 0;

  for (const [topic, keywords] of Object.entries(CONTENT_CTA_SIGNALS)) {
    let score = 0;
    for (const keyword of keywords) {
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      const matches = contentLower.match(regex);
      if (matches) score += matches.length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }

  return bestScore >= 3 ? bestTopic : null;
}

export function insertSmartCTAs(
  content: string,
  category: string,
  topicCluster?: TopicCluster,
  aiGeneratedCTAs?: string[],
  region?: string,
  funnelStage?: "awareness" | "consideration" | "decision",
  locale: string = "en"
): string {
  const inlineLinkPattern = /\[.*?\]\(\/book-strategy-call\/?\)/;
  if (inlineLinkPattern.test(content)) {
    return content;
  }

  const lang = (locale || "en").toLowerCase();
  const isEs = lang === "es";
  const isFr = lang === "fr";

  let cta1: string;
  let cta2: string | null = null;

  const bookingUrl = getBookingUrl(region);
  const linkText1 = isEs
    ? "[reserva una llamada estratégica gratuita con Multi-Family USA](" + bookingUrl + ")"
    : isFr
      ? "[réservez un appel stratégique gratuit avec Multi-Family USA](" + bookingUrl + ")"
      : "[book a free strategy call with Multi-Family USA](" + bookingUrl + ")";
  const linkText2 = isEs
    ? "[reserva una llamada estratégica gratuita con nosotros](" + bookingUrl + ")"
    : isFr
      ? "[réservez un appel stratégique gratuit avec nous](" + bookingUrl + ")"
      : "[schedule a free strategy session with us](" + bookingUrl + ")";

  if (aiGeneratedCTAs && aiGeneratedCTAs.length > 0) {
    cta1 = aiGeneratedCTAs[0].replace("{link}", linkText1);
    cta2 =
      aiGeneratedCTAs.length > 1
        ? aiGeneratedCTAs[1].replace("{link}", linkText2)
        : null;
  } else {
    const contentTopic = detectContentTopic(content);

    let contentTemplates: string[] | undefined;
    if (contentTopic) {
      const mappedCluster = CONTENT_TOPIC_TO_CLUSTER[contentTopic];
      contentTemplates = mappedCluster
        ? CLUSTER_CTA_OVERRIDES[mappedCluster]
        : CONTENT_CTA_TEMPLATES[contentTopic];
    }

    const categoryBank = isEs
      ? SMART_CTA_TEMPLATES_ES
      : isFr
        ? SMART_CTA_TEMPLATES_FR
        : SMART_CTA_TEMPLATES;
    const categoryTemplates = categoryBank[category] || categoryBank.fundamentals;
    const clusterBank = isEs
      ? CLUSTER_CTA_OVERRIDES_ES
      : isFr
        ? CLUSTER_CTA_OVERRIDES_FR
        : CLUSTER_CTA_OVERRIDES;
    const clusterTemplates = topicCluster ? clusterBank[topicCluster] : undefined;

    const funnelBank = isEs
      ? FUNNEL_STAGE_TEMPLATES_ES
      : isFr
        ? FUNNEL_STAGE_TEMPLATES_FR
        : FUNNEL_STAGE_TEMPLATES;
    const funnelTemplates = funnelStage ? funnelBank[funnelStage] || [] : [];
    const allTemplates = [
      ...funnelTemplates,
      ...(contentTemplates || clusterTemplates || []),
      ...categoryTemplates,
    ];

    const contentHash = hashString(content.slice(0, 2000));
    const idx1 = contentHash % allTemplates.length;
    let idx2 = (contentHash + 1) % allTemplates.length;
    if (idx2 === idx1 && allTemplates.length > 1) {
      idx2 = (idx1 + 1) % allTemplates.length;
    }
    const template1 = allTemplates[idx1];
    const template2 = allTemplates.length > 1 ? allTemplates[idx2] : null;

    cta1 = template1.replace("{link}", linkText1);
    cta2 =
      template2 && template2 !== template1
        ? template2.replace("{link}", linkText2)
        : null;
  }

  const h2Pattern = /\n(## [^\n]+)/g;
  const h2Positions: number[] = [];
  let match;
  while ((match = h2Pattern.exec(content)) !== null) {
    h2Positions.push(match.index);
  }

  if (h2Positions.length < 2) {
    if (h2Positions.length === 1) {
      const insertPos = h2Positions[0];
      return content.slice(0, insertPos) + "\n\n" + cta1 + "\n" + content.slice(insertPos);
    }
    return content + "\n\n" + cta1 + "\n";
  }

  const insertions: Array<{ pos: number; text: string }> = [];
  const cta1Idx = Math.min(2, h2Positions.length - 1);
  insertions.push({ pos: h2Positions[cta1Idx], text: cta1 });

  if (cta2 && h2Positions.length >= 4) {
    const cta2Idx = Math.min(4, h2Positions.length - 1);
    insertions.push({ pos: h2Positions[cta2Idx], text: cta2 });
  }

  insertions.sort((a, b) => b.pos - a.pos);

  let result = content;
  for (const { pos, text } of insertions) {
    result = result.slice(0, pos) + "\n\n" + text + "\n" + result.slice(pos);
  }

  return result;
}

export function stripSmartCTAs(content: string): string {
  const escapedUrl = BOOKING_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `[^\\n]*\\[[^\\]]+\\]\\(${escapedUrl}[^)]*\\)[^\\n]*`,
    "g"
  );
  let result = content.replace(pattern, "");
  result = result.replace(/\n{3,}/g, "\n\n");
  return result;
}

const GLOSSARY_CTA_SIGNALS: Record<string, string[]> = {
  dscr: ["dscr", "debt service", "coverage ratio", "debt coverage"],
  "debt-yield": ["debt yield"],
  "cap-rate": ["cap rate", "noi"],
  agency: ["fannie", "freddie", "agency"],
  bridge: ["bridge", "value-add", "transitional"],
  commercial: ["commercial", "multifamily", "5+", "apartment"],
};

const GLOSSARY_CTA_TEMPLATES: Record<string, Record<string, string>> = {
  en: {
    dscr: "Understanding {term} is step one — {link} to see how coverage floors affect your multifamily proceeds. Or {calc} to run the numbers.",
    "debt-yield": "Debt yield often binds agency and CMBS sizing — {link} or {calc} to test your deal.",
    "cap-rate": "Cap rate and NOI drive valuation and leverage — {link} or {calc} before you request quotes.",
    agency: "Agency execution has its own grids — {link} to see if Fannie/Freddie fits your stabilized asset.",
    bridge: "Bridge debt needs a clear exit — {link} to pressure-test value-add structure.",
    commercial: "Commercial multifamily hinges on metrics like {term} — {link} to structure debt around the numbers.",
    default: "Need help applying {term} to a 5+ unit deal? {link} — free and focused on commercial multifamily.",
  },
  es: {
    dscr: "Entender {term} es el primer paso — {link} para ver cómo los pisos de cobertura afectan su préstamo. O {calc}.",
    "debt-yield": "El debt yield suele limitar agency y CMBS — {link} o {calc} para probar su operación.",
    "cap-rate": "Cap rate y NOI impulsan valor y apalancamiento — {link} o {calc}.",
    agency: "La ejecución agency tiene sus propias grillas — {link} para ver si Fannie/Freddie encaja.",
    bridge: "La deuda bridge necesita una salida clara — {link} para revisar la estructura value-add.",
    commercial: "El multifamiliar comercial depende de métricas como {term} — {link}.",
    default: "¿Necesita aplicar {term} a una operación de 5+ unidades? {link}.",
  },
  fr: {
    default: "Besoin d'aide pour appliquer {term} à une opération multifamiliale ? {link}.",
  },
};

function detectGlossaryTopic(term: string, definition: string): string {
  const text = `${term} ${definition}`.toLowerCase();
  let best = "default";
  let bestScore = 0;
  for (const [topic, keywords] of Object.entries(GLOSSARY_CTA_SIGNALS)) {
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = topic;
    }
  }
  return best;
}

function glossaryLinkText(locale: string): string {
  if (locale === "es") return "[reserve una llamada estratégica gratuita](" + BOOKING_URL + ")";
  if (locale === "fr") return "[réservez un appel stratégique gratuit](" + BOOKING_URL + ")";
  return "[book a free strategy call](" + BOOKING_URL + ")";
}

function glossaryCalcLink(locale: string, path: string): string {
  const labels: Record<string, string> = {
    en: "try our calculator",
    es: "pruebe nuestra calculadora",
    fr: "essayez notre calculateur",
  };
  const label = labels[locale] || labels.en;
  return `[${label}](${path})`;
}

export function insertGlossaryCTA(
  content: string,
  term: string,
  definition: string,
  locale: string = "en"
): string {
  const inlineLinkPattern = /\[.*?\]\(\/book-strategy-call\/?\)/;
  if (inlineLinkPattern.test(content)) return content;

  const lang = (locale || "en").toLowerCase();
  const topic = detectGlossaryTopic(term, definition);
  const templates = GLOSSARY_CTA_TEMPLATES[lang] || GLOSSARY_CTA_TEMPLATES.en;
  const template = templates[topic] || templates.default;

  const calcPaths: Record<string, string> = {
    dscr: "/tools/commercial-dscr-calculator/",
    "debt-yield": "/tools/debt-yield-calculator/",
    "cap-rate": "/tools/cap-rate-noi-calculator/",
  };
  const calcPath = calcPaths[topic];
  const calcLink = calcPath ? glossaryCalcLink(lang, calcPath) : glossaryLinkText(lang);

  const cta = template
    .replace(/\{term\}/g, term)
    .replace("{link}", glossaryLinkText(lang))
    .replace("{calc}", calcLink);

  const trimmed = content.trim();
  if (!trimmed) return cta + "\n";
  return trimmed + "\n\n" + cta + "\n";
}

export function stripGlossaryCTAs(content: string): string {
  return stripSmartCTAs(content);
}

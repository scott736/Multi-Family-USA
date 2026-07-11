// ============================================
// Service CTA — Contextual service-hub link
// ============================================
// Inserts one editorial sentence linking to a relevant service hub page.
// Complements Smart CTAs (booking) — does not replace them.

import { CONTENT_CTA_SIGNALS } from "./smart-cta";

/** Parent service hubs only (no city-specific pages). */
export const SERVICE_HUB_URLS = [
  "/loan-types/",
  "/property-types/",
  "/learn/",
  "/tools/",
  "/states/",
  "/cities/",
  "/compare/",
  "/invest/",
  "/checklists/",
  "/rates/",
  "/book-strategy-call/",
  "/deal-review/",
  "/tools/commercial-dscr-calculator/",
  "/tools/debt-yield-calculator/",
  "/tools/cap-rate-noi-calculator/",
  "/tools/loan-sizing-calculator/",
] as const;

const SERVICE_HUB_SET = new Set<string>(SERVICE_HUB_URLS);

/** CONTENT_CTA_SIGNALS topics → parent service hub. */
export const TOPIC_TO_SERVICE: Record<string, string> = {
  "dscr-loans": "/tools/commercial-dscr-calculator/",
  multifamily: "/loan-types/",
  refinancing: "/learn/multifamily-cash-out-refinance/",
  development: "/learn/multifamily-construction-financing/",
  "brrrr-flipping": "/loan-types/bridge-value-add/",
  "private-lending": "/invest/",
  "joint-venture": "/invest/",
  "cross-border": "/loan-types/",
  factoring: "/loan-types/",
  "rent-to-own": "/learn/",
  "vacation-rental": "/property-types/",
};

/**
 * Category fallbacks for MFUSA blog categories / linker categories.
 */
export const CATEGORY_SERVICE_FALLBACK: Record<string, string> = {
  "mortgage-financing": "/loan-types/",
  "investing-fundamentals": "/learn/",
  "scaling-portfolio": "/invest/",
  "partnerships-capital": "/invest/",
  "us-cross-border": "/loan-types/",
  "personal-finance-mindset": "/learn/",
  fundamentals: "/learn/",
  qualification: "/learn/",
  "capital-markets": "/compare/",
  execution: "/checklists/",
  risk: "/learn/rate-risk-and-refinance-planning/",
};

const SERVICE_CTA_MARKER = "<!-- service-cta -->";

const HUB_LINK_LABELS: Record<string, { en: string; es: string; fr: string }> = {
  "/loan-types/": {
    en: "our multifamily loan types guide",
    es: "nuestra guía de tipos de préstamos multifamiliares",
    fr: "notre guide des types de prêts multifamiliaux",
  },
  "/property-types/": {
    en: "our multifamily property types guide",
    es: "nuestra guía de tipos de propiedades multifamiliares",
    fr: "notre guide des types de propriétés multifamiliales",
  },
  "/learn/": {
    en: "our multifamily financing guides",
    es: "nuestras guías de financiamiento multifamiliar",
    fr: "nos guides de financement multifamilial",
  },
  "/tools/": {
    en: "our multifamily underwriting tools",
    es: "nuestras herramientas de underwriting multifamiliar",
    fr: "nos outils de souscription multifamiliale",
  },
  "/tools/commercial-dscr-calculator/": {
    en: "our commercial DSCR calculator",
    es: "nuestra calculadora DSCR comercial",
    fr: "notre calculateur DSCR commercial",
  },
  "/tools/debt-yield-calculator/": {
    en: "our debt yield calculator",
    es: "nuestra calculadora de debt yield",
    fr: "notre calculateur de debt yield",
  },
  "/tools/cap-rate-noi-calculator/": {
    en: "our cap rate and NOI calculator",
    es: "nuestra calculadora de cap rate y NOI",
    fr: "notre calculateur de taux de capitalisation et NOI",
  },
  "/tools/loan-sizing-calculator/": {
    en: "our loan sizing calculator",
    es: "nuestra calculadora de dimensionamiento de préstamo",
    fr: "notre calculateur de dimensionnement de prêt",
  },
  "/states/": {
    en: "our state multifamily financing guides",
    es: "nuestras guías estatales de financiamiento multifamiliar",
    fr: "nos guides étatiques de financement multifamilial",
  },
  "/cities/": {
    en: "our city multifamily market guides",
    es: "nuestras guías de mercados multifamiliares por ciudad",
    fr: "nos guides de marchés multifamiliaux par ville",
  },
  "/compare/": {
    en: "our multifamily capital comparisons",
    es: "nuestras comparaciones de capital multifamiliar",
    fr: "nos comparaisons de capital multifamilial",
  },
  "/invest/": {
    en: "our investor playbooks",
    es: "nuestros playbooks para inversores",
    fr: "nos playbooks pour investisseurs",
  },
  "/checklists/": {
    en: "our multifamily financing checklists",
    es: "nuestras listas de verificación de financiamiento",
    fr: "nos listes de contrôle de financement",
  },
  "/rates/": {
    en: "our multifamily rate context",
    es: "nuestro contexto de tasas multifamiliares",
    fr: "notre contexte de taux multifamiliaux",
  },
  "/book-strategy-call/": {
    en: "book a free strategy call",
    es: "reservar una llamada estratégica gratuita",
    fr: "réserver un appel stratégique gratuit",
  },
  "/deal-review/": {
    en: "our free deal review",
    es: "nuestra revisión gratuita de operaciones",
    fr: "notre revue gratuite d'opérations",
  },
};

const SERVICE_CTA_TEMPLATES: Record<"en" | "es" | "fr", string[]> = {
  en: [
    "For a deeper look at the financing angle behind this topic, see {link}.",
    "When you're ready to structure the mortgage side of this strategy, {link} covers the programs that typically fit.",
    "The right financing product can change the math on this entirely — explore {link} for the options most investors use.",
    "If this approach is on your radar, {link} walks through how Multi-Family USA structures these deals.",
  ],
  es: [
    "Para profundizar en el ángulo de financiamiento de este tema, consulta {link}.",
    "Cuando quieras estructurar el lado hipotecario de esta estrategia, {link} cubre los programas que suelen encajar.",
    "El producto de financiamiento correcto puede cambiar por completo los números — explora {link} para ver las opciones que más usan los inversores.",
    "Si este enfoque está en tu radar, {link} explica cómo Multi-Family USA estructura estas operaciones.",
  ],
  fr: [
    "Pour approfondir l'angle financement de ce sujet, consultez {link}.",
    "Quand vous serez prêt à structurer le volet hypothécaire de cette stratégie, {link} couvre les programmes qui conviennent le mieux.",
    "Le bon produit de financement peut changer complètement les chiffres — explorez {link} pour les options que la plupart des investisseurs utilisent.",
    "Si cette approche vous intéresse, {link} explique comment Multi-Family USA structure ces opérations.",
  ],
};

function ensureTrailingSlash(url: string): string {
  const trimmed = url.trim().split(/[?#]/)[0];
  if (!trimmed.startsWith("/")) return trimmed;
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function normalizeHubPath(url: string): string {
  let path = url.trim();
  const domainMatch = path.match(/^https?:\/\/(?:www\.)?multifamily-usa\.com(\/.*)/i);
  if (domainMatch) path = domainMatch[1];
  return ensureTrailingSlash(path.split(/[?#]/)[0]);
}

/** True when URL points at a parent service hub (or a path under one). */
export function isServiceHubUrl(url: string): boolean {
  const normalized = normalizeHubPath(url);
  if (SERVICE_HUB_SET.has(normalized)) return true;
  for (const hub of SERVICE_HUB_URLS) {
    const h = hub.replace(/\/$/, "");
    if (normalized.startsWith(`${h}/`)) return true;
  }
  return false;
}

/** True if the article body already links to any service hub. */
export function hasServiceHubLink(content: string): boolean {
  for (const m of content.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g)) {
    if (isServiceHubUrl(m[2])) return true;
  }
  // Absolute multifamily-usa.com service links
  for (const m of content.matchAll(/href=["']([^"']+)["']/gi)) {
    if (isServiceHubUrl(m[1])) return true;
  }
  return false;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function detectContentTopic(content: string): string | null {
  const contentLower = content.toLowerCase();
  // Prefer specific financing topics over generic "refinanc*" noise
  const TOPIC_WEIGHT: Record<string, number> = {
    "brrrr-flipping": 2,
    "dscr-loans": 2,
    multifamily: 2,
    development: 2,
    "cross-border": 2,
    "vacation-rental": 2,
    "rent-to-own": 1.5,
    factoring: 1.5,
    "private-lending": 1.5,
    "joint-venture": 1.5,
    refinancing: 0.4,
  };

  let bestTopic: string | null = null;
  let bestScore = 0;

  for (const [topic, keywords] of Object.entries(CONTENT_CTA_SIGNALS)) {
    let score = 0;
    for (const keyword of keywords) {
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      const matches = contentLower.match(regex);
      if (matches) score += matches.length;
    }
    const weighted = score * (TOPIC_WEIGHT[topic] ?? 1);
    if (weighted > bestScore) {
      bestScore = weighted;
      bestTopic = topic;
    }
  }

  return bestScore >= 3 ? bestTopic : null;
}

export function resolveServiceHub(content: string, category?: string): string {
  const topic = detectContentTopic(content);
  if (topic && TOPIC_TO_SERVICE[topic]) {
    return TOPIC_TO_SERVICE[topic];
  }
  const cat = category || "investing-fundamentals";
  return CATEGORY_SERVICE_FALLBACK[cat] || "/invest-in-real-estate/";
}

function buildServiceLink(hubUrl: string, locale: string): string {
  const lang = (locale || "en").toLowerCase() as "en" | "es" | "fr";
  const labels = HUB_LINK_LABELS[hubUrl];
  const label =
    labels?.[lang] ||
    labels?.en ||
    (lang === "es"
      ? "nuestra guía de financiamiento"
      : lang === "fr"
        ? "notre guide de financement"
        : "our financing guide");
  return `[${label}](${hubUrl})`;
}

/**
 * Insert one Service CTA after ~2nd H2.
 * Skips when any service hub link already exists.
 */
export function insertServiceCTA(
  content: string,
  category?: string,
  locale: string = "en"
): string {
  if (hasServiceHubLink(content)) {
    return content;
  }

  const lang = (["en", "es", "fr"].includes((locale || "en").toLowerCase())
    ? (locale || "en").toLowerCase()
    : "en") as "en" | "es" | "fr";

  const hubUrl = resolveServiceHub(content, category);
  const templates = SERVICE_CTA_TEMPLATES[lang];
  const idx = hashString(content.slice(0, 2000)) % templates.length;
  const sentence = templates[idx].replace("{link}", buildServiceLink(hubUrl, lang));
  const block = `${SERVICE_CTA_MARKER}\n${sentence}`;

  const h2Pattern = /\n(## [^\n]+)/g;
  const h2Positions: number[] = [];
  let match;
  while ((match = h2Pattern.exec(content)) !== null) {
    h2Positions.push(match.index);
  }

  if (h2Positions.length >= 2) {
    const insertIdx = Math.min(2, h2Positions.length - 1);
    const pos = h2Positions[insertIdx];
    return content.slice(0, pos) + "\n\n" + block + "\n" + content.slice(pos);
  }

  if (h2Positions.length === 1) {
    const pos = h2Positions[0];
    return content.slice(0, pos) + "\n\n" + block + "\n" + content.slice(pos);
  }

  return content + "\n\n" + block + "\n";
}

/** Remove Service CTA blocks previously inserted by insertServiceCTA. */
export function stripServiceCTA(content: string): string {
  let result = content.replace(
    new RegExp(`\\n*${SERVICE_CTA_MARKER}\\n[^\\n]*`, "g"),
    ""
  );
  result = result.replace(/\n{3,}/g, "\n\n");
  return result;
}

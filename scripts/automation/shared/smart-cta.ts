// ============================================
// Smart CTA - Contextual Inline Call-to-Action
// ============================================

import type { TopicCluster } from "../types";

export const BOOKING_URL = "/book-strategy-call/";

export const CTA_BUTTON = `<a href="/book-strategy-call/" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-zinc-600 h-10 px-8 no-underline">Book Your Strategy Call</a>`;

function getBookingUrl(region?: string): string {
  return region === "usa" ? "/book-strategy-call/?region=usa" : BOOKING_URL;
}

/**
 * Content keyword signals for topic detection.
 * Each key is a CTA topic, and the value is an array of keywords/phrases
 * to look for in the post body. The topic with the most keyword hits wins.
 */
export const CONTENT_CTA_SIGNALS: Record<string, string[]> = {
  "factoring": [
    "factoring", "invoice factoring", "accounts receivable", "receivable financing",
    "factor rate", "factoring company", "invoice financing", "receivables",
  ],
  "private-lending": [
    "private lend", "private mortgage", "private lender", "mortgage investment corporation",
    "alternative lend", "alternative mortgage", "syndicate mortgage", "private capital",
  ],
  "development": [
    "development financ", "construction loan", "ground-up", "new build",
    "builder", "developer loan", "land development", "construction financ",
    "development project", "building permit",
  ],
  "dscr-loans": [
    "dscr", "debt service coverage", "no income verification", "non-qm",
    "foreign national loan", "close in llc", "rental income qualification",
  ],
  "brrrr-flipping": [
    "brrrr", "fix and flip", "fix-and-flip", "house flip", "flipping",
    "rehab", "after repair value", "arv", "forced appreciation",
  ],
  "multifamily": [
    "multifamily", "multi-family", "apartment building", "5+ unit",
    "apartment invest", "cmhc mli", "mli select", "multi-unit",
  ],
  "refinancing": [
    "refinanc", "heloc", "home equity", "equity takeout",
    "cash-out refinance", "rate-and-term",
  ],
  "cross-border": [
    "cross-border", "canadian investing in the u.s", "invest in the us",
    "foreign national", "itin", "us real estate",
  ],
  "joint-venture": [
    "joint venture", "jv partner", "jv agreement", "jv structure",
    "capital partner", "money partner", "equity partner",
  ],
  "rent-to-own": [
    "rent-to-own", "rent to own", "lease option", "lease-to-own",
    "lease to own", "rto ",
  ],
  "vacation-rental": [
    "short-term rental", "airbnb", "vacation rental", "str ",
    "vrbo", "furnished rental",
  ],
};

/**
 * Smart CTA templates organized by category.
 * Each template has a sentence with {link} placeholder that gets replaced
 * with a markdown hyperlink to the booking page.
 *
 * Templates are designed to feel like natural editorial advice, not ads.
 */
const SMART_CTA_TEMPLATES: Record<string, string[]> = {
  "mortgage-financing": [
    "Before you commit to any mortgage product, it helps to get a second opinion — {link} to see which options actually fit your financial picture.",
    "Every borrower's situation is different, and the wrong mortgage structure can cost you thousands — {link} to make sure you're set up properly.",
    "Mortgage rules change frequently, so what worked last year might not apply today — {link} to get current, personalized guidance.",
    "Choosing the wrong lender or term can quietly erode your returns — {link} and we'll walk you through the numbers.",
    "Your debt ratios, income type, and property plans all affect what you qualify for — {link} so we can map out a strategy that works for your goals.",
  ],
  "investing-fundamentals": [
    "Getting your financing strategy right from the start saves you from costly mistakes down the road — {link} before you make your next move.",
    "The difference between a good deal and a great one often comes down to how it's financed — {link} and let's look at the numbers together.",
    "Whether you're buying your first rental or your tenth, having the right mortgage structure matters — {link} to build a plan that scales with you.",
    "Many investors leave money on the table by not exploring all their financing options — {link} and we'll show you what's available.",
    "Real estate investing is a team sport, and your mortgage strategy is the foundation — {link} to make sure yours is solid.",
  ],
  "scaling-portfolio": [
    "Scaling past a handful of properties requires a financing strategy most investors don't know about — {link} and we'll show you how it works.",
    "Traditional lenders will eventually cut you off, but there are ways around that — {link} to learn how investors keep growing their portfolios.",
    "The biggest mistake scaling investors make is not planning their financing two or three deals ahead — {link} so we can build that roadmap together.",
    "At a certain point, your mortgage strategy matters more than the deal itself — {link} to make sure your financing keeps up with your ambitions.",
  ],
  "partnerships-capital": [
    "Structuring a joint venture the wrong way can cost you the partnership and the profit — {link} and we'll help you get the financing side right.",
    "Raising capital is one thing, but making sure the mortgage structure supports the partnership is another — {link} to align your financing with your JV strategy.",
    "Before you bring on a partner, make sure you understand how it affects your borrowing power — {link} and let's map it out.",
  ],
  "us-cross-border": [
    "Cross-border investing adds layers of complexity to your financing — {link} and we'll walk you through the Canadian-friendly options.",
    "DSCR loans and foreign national programs have specific requirements that most brokers miss — {link} to work with a team that specializes in cross-border deals.",
    "Investing in the U.S. from Canada is a smart move, but only if your financing is structured correctly — {link} to avoid the common pitfalls.",
    "Currency exchange, LLC structures, and DSCR requirements all affect your deal — {link} and we'll help you navigate all of it.",
  ],
  "personal-finance-mindset": [
    "Building wealth starts with knowing your options — {link} and find out what's possible for your situation.",
    "The investors who succeed are the ones who take that first step — {link} and let's map out your path forward.",
    "Financial clarity is the first step to financial freedom — {link} to understand your mortgage options and start planning.",
  ],
};

/**
 * Cluster-specific template overrides for more targeted messaging.
 */
const CLUSTER_CTA_OVERRIDES: Partial<Record<TopicCluster, string[]>> = {
  "mortgage-basics": [
    "Understanding mortgages is step one — getting the right one is step two. {link} and we'll match you with the best product for your situation.",
  ],
  "brrrr-flipping": [
    "The refinance stage of BRRRR is where most investors stumble — {link} to make sure your exit financing is locked in before you start the project.",
  ],
  "multifamily-investing": [
    "Multifamily financing has different rules than residential — {link} and we'll show you exactly what you qualify for under CMHC or conventional programs.",
  ],
  "refinancing-strategies": [
    "Refinancing at the wrong time or with the wrong lender can leave equity trapped — {link} to make sure your refinance actually moves you forward.",
  ],
  "commercial-lending": [
    "Commercial mortgage qualification works differently than residential — {link} and we'll help you understand your options before you make an offer.",
  ],
  "dscr-foreign-national": [
    "DSCR loans let you qualify based on the property's income, not yours — {link} and we'll help you figure out if a DSCR program fits your next deal.",
    "Foreign national and DSCR programs have specific requirements most brokers don't handle — {link} to work with a team that specializes in these products.",
  ],
  "us-investing-basics": [
    "Buying U.S. real estate from Canada involves financing, tax, and legal steps most investors miss — {link} and we'll walk you through the process.",
    "Getting started in the U.S. market is easier than you think when you have the right mortgage team — {link} to see what programs are available to you.",
  ],
  "cross-border-tax-legal": [
    "Cross-border tax and legal structure mistakes can cost you thousands — {link} so we can help you set up your financing the right way from day one.",
  ],
  "portfolio-scaling": [
    "Scaling past a handful of properties requires a financing strategy most investors don't know about — {link} and we'll show you how it works.",
    "Traditional lenders will eventually cut you off, but there are ways around that — {link} to learn how investors keep growing their portfolios.",
  ],
  "joint-ventures-partnerships": [
    "Structuring a joint venture the wrong way can cost you the partnership and the profit — {link} and we'll help you get the financing side right.",
    "Before you bring on a JV partner, make sure you understand how it affects your borrowing power — {link} and let's map it out.",
  ],
  "short-term-rentals": [
    "Short-term rental properties can generate strong cash flow, but lenders look at them differently — {link} to understand your financing options for STR investments.",
    "Financing a vacation rental requires a strategy that accounts for seasonal income — {link} and we'll help you find the right program.",
  ],
  "mortgage-qualification": [
    "How much you qualify for depends on more than your income — debt ratios, property type, and lender choice all play a role. {link} and we'll show you exactly where you stand.",
    "Most investors don't realize they can qualify for more than their bank tells them — {link} to see what a broker who specializes in investors can do for you.",
  ],
  "getting-started": [
    "The hardest part of real estate investing is getting started, and the right financing makes it a lot easier — {link} to find out what you qualify for today.",
    "You don't need to have it all figured out before your first deal — {link} and we'll help you build a plan that makes sense for where you are right now.",
  ],
  "rental-property-analysis": [
    "The numbers on a rental property only work if your financing is structured correctly — {link} and we'll help you run the real numbers before you commit.",
    "Cash flow projections mean nothing if your mortgage eats into your returns — {link} to make sure your financing supports your investment thesis.",
  ],
  "capital-raising": [
    "Raising capital for real estate deals is easier when you can show investors a solid financing plan — {link} and we'll help you put that plan together.",
    "Whether you're syndicating or raising private money, your mortgage structure needs to support the deal — {link} to make sure the numbers work for everyone involved.",
  ],
  "investor-mindset": [
    "Your mindset is the foundation — but having a financing plan turns ambition into action. {link} and let's build that plan together.",
    "The best investment you can make is in your own preparation — {link} and we'll show you exactly where you stand financially.",
  ],
  "success-stories": [
    "Every successful investor started with one deal and the right team behind them — {link} and let's figure out what your first or next deal looks like.",
    "The investors who build real wealth don't do it alone — {link} to get the same kind of financing guidance that helped them scale.",
  ],
  "team-building": [
    "Your mortgage broker is one of the most important people on your investing team — {link} to work with someone who understands investor deals inside and out.",
    "A great team starts with the right financing partner — {link} and we'll show you how the right mortgage strategy supports everything else.",
  ],
  "market-analysis": [
    "Market conditions change, but having the right financing in place means you're ready to move when opportunity shows up — {link} to get pre-positioned for your next deal.",
    "Understanding the market is step one — having the financing to act on it is step two. {link} and we'll make sure you're ready.",
  ],
  "property-management": [
    "Good property management protects your cash flow, but the right mortgage structure is what creates it — {link} to make sure your financing is working as hard as your property manager.",
    "Managing rentals gets easier when your debt service is optimized — {link} and we'll help you review your financing to maximize what you keep.",
  ],
};

/**
 * Funnel-stage-specific CTA templates.
 * These are prepended to the template pool when funnelStage is available,
 * giving them higher selection weight for stage-appropriate messaging.
 */
const FUNNEL_STAGE_TEMPLATES: Record<string, string[]> = {
  "awareness": [
    "If you're just starting to explore your options, {link} — it's free, and there's no obligation.",
    "Not sure where to start? {link} and we'll help you figure out the right first step.",
    "Curious about what you might qualify for? {link} — no commitment, just answers.",
  ],
  "consideration": [
    "Comparing your options is smart — {link} and we'll help you see which financing path fits best.",
    "Before you narrow down your choices, {link} to get a clear picture of what's available to you.",
  ],
  "decision": [
    "You already know what you need — {link} and let's get your financing locked in.",
    "Ready to move? {link} and we'll fast-track your pre-approval.",
    "Don't let this deal slip away — {link} and we'll have your financing structured within 48 hours.",
  ],
};

/**
 * Maps content-detected topics to cluster keys where templates are identical.
 * When detectContentTopic returns one of these keys, the cluster override
 * templates are used directly instead of maintaining duplicate text.
 */
const CONTENT_TOPIC_TO_CLUSTER: Record<string, TopicCluster> = {
  "brrrr-flipping": "brrrr-flipping",
  "multifamily": "multifamily-investing",
  "refinancing": "refinancing-strategies",
  "joint-venture": "joint-ventures-partnerships",
  "vacation-rental": "short-term-rentals",
};

/**
 * Content-detected topic CTA templates.
 * These are used when keyword scanning identifies a specific topic
 * that doesn't map to an existing cluster override.
 * Topics with identical cluster templates are mapped via CONTENT_TOPIC_TO_CLUSTER.
 */
const CONTENT_CTA_TEMPLATES: Record<string, string[]> = {
  "factoring": [
    "Invoice factoring can unlock cash flow that's stuck in receivables — {link} to explore whether factoring fits your investment strategy.",
    "Not every financing tool is a mortgage — factoring gives you liquidity fast. {link} to see how it can work alongside your real estate portfolio.",
  ],
  "private-lending": [
    "Private lending opens doors that traditional banks won't — {link} to find out what private and alternative financing options are available to you.",
    "When the banks say no, private lenders often say yes — {link} and we'll walk you through the costs, terms, and trade-offs.",
  ],
  "development": [
    "Development financing has unique requirements that differ from standard investment loans — {link} to make sure your project is funded properly from land to completion.",
    "Construction and development deals need specialized financing — {link} and we'll help you structure the right loan for your build.",
  ],
  "dscr-loans": [
    "DSCR loans let you qualify based on the property's income, not yours — {link} and we'll help you figure out if a DSCR loan makes sense for your next deal.",
    "If you want to scale without hitting income qualification walls, DSCR financing is worth exploring — {link} to see what rates and terms are available.",
  ],
  "cross-border": [
    "Cross-border investing adds layers of complexity to your financing — {link} and we'll walk you through the Canadian-friendly options.",
    "Investing in the U.S. from Canada is a smart move, but only if your financing is structured correctly — {link} to avoid the common pitfalls.",
  ],
  "rent-to-own": [
    "Rent-to-own deals have unique financing considerations on both sides of the transaction — {link} to make sure your structure protects you and your tenant-buyer.",
    "Getting the mortgage side of a rent-to-own deal right is critical — {link} and we'll help you set it up properly.",
  ],
};

/**
 * Simple deterministic hash from a string to a number.
 * Used to pick template variants based on content so the same article
 * always gets the same CTA, but different articles get different ones.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Scan content for keyword signals and return the best-matching CTA topic.
 * Returns null if no strong signal is found (falls back to category/cluster).
 */
function detectContentTopic(content: string): string | null {
  const contentLower = content.toLowerCase();
  let bestTopic: string | null = null;
  let bestScore = 0;

  for (const [topic, keywords] of Object.entries(CONTENT_CTA_SIGNALS)) {
    let score = 0;
    for (const keyword of keywords) {
      // Count occurrences to weight frequently-discussed topics higher
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      const matches = contentLower.match(regex);
      if (matches) score += matches.length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }

  // Require a minimum signal strength to override category/cluster defaults
  return bestScore >= 3 ? bestTopic : null;
}

/**
 * Insert 1-2 Smart CTAs into article content.
 * Uses AI-generated CTAs when provided, otherwise falls back to templates.
 * Places them after the 2nd and optionally 4th H2 sections.
 *
 * @param content - Markdown body content
 * @param category - Article category for template selection
 * @param topicCluster - Article topic cluster for override templates
 * @param aiGeneratedCTAs - Optional AI-generated CTA sentences with {link} placeholders
 * @returns Content with Smart CTAs inserted
 */
export function insertSmartCTAs(
  content: string,
  category: string,
  topicCluster?: TopicCluster,
  aiGeneratedCTAs?: string[],
  region?: string,
  funnelStage?: 'awareness' | 'consideration' | 'decision',
  locale: string = "en"
): string {
  // Skip if inline Smart CTAs already present (markdown links to booking page).
  // HTML CTA buttons (href="...") are a separate feature and should NOT trigger this skip.
  const inlineLinkPattern = /\[.*?\]\(\/book-strategy-call\/?\)/;
  if (inlineLinkPattern.test(content)) {
    return content;
  }

  const lang = (locale || "en").toLowerCase();
  const isEs = lang === "es";
  const isFr = lang === "fr";

  // Build CTA sentences from AI-generated or template sources
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
    // Use AI-generated CTAs
    cta1 = aiGeneratedCTAs[0].replace("{link}", linkText1);
    cta2 = aiGeneratedCTAs.length > 1
      ? aiGeneratedCTAs[1].replace("{link}", linkText2)
      : null;
  } else {
    // Fall back to template selection
    const contentTopic = detectContentTopic(content);

    // Resolve content topic: use cluster overrides for topics that map to a cluster
    let contentTemplates: string[] | undefined;
    if (contentTopic) {
      const mappedCluster = CONTENT_TOPIC_TO_CLUSTER[contentTopic];
      contentTemplates = mappedCluster
        ? CLUSTER_CTA_OVERRIDES[mappedCluster]
        : CONTENT_CTA_TEMPLATES[contentTopic];
    }

    const categoryBank = isEs ? SMART_CTA_TEMPLATES_ES : isFr ? SMART_CTA_TEMPLATES_FR : SMART_CTA_TEMPLATES;
    const categoryTemplates = categoryBank[category] || categoryBank["investing-fundamentals"];
    const clusterBank = isEs ? CLUSTER_CTA_OVERRIDES_ES : isFr ? CLUSTER_CTA_OVERRIDES_FR : CLUSTER_CTA_OVERRIDES;
    const clusterTemplates = topicCluster ? clusterBank[topicCluster] : undefined;

    const funnelTemplates = funnelStage ? ((isEs ? FUNNEL_STAGE_TEMPLATES_ES : isFr ? FUNNEL_STAGE_TEMPLATES_FR : FUNNEL_STAGE_TEMPLATES)[funnelStage] || []) : [];
    const allTemplates = [...funnelTemplates, ...(contentTemplates || clusterTemplates || []), ...categoryTemplates];

    const contentHash = hashString(content.slice(0, 2000));
    const idx1 = contentHash % allTemplates.length;
    let idx2 = (contentHash + 1) % allTemplates.length;
    if (idx2 === idx1 && allTemplates.length > 1) {
      idx2 = (idx1 + 1) % allTemplates.length;
    }
    const template1 = allTemplates[idx1];
    const template2 = allTemplates.length > 1 ? allTemplates[idx2] : null;

    cta1 = template1.replace("{link}", linkText1);
    cta2 = template2 && template2 !== template1 ? template2.replace("{link}", linkText2) : null;
  }

  // Find all H2 positions in a single pass
  const h2Pattern = /\n(## [^\n]+)/g;
  const h2Positions: number[] = [];
  let match;
  while ((match = h2Pattern.exec(content)) !== null) {
    h2Positions.push(match.index);
  }

  if (h2Positions.length < 2) {
    // Not enough sections — insert one CTA at the end of the first section
    if (h2Positions.length === 1) {
      const insertPos = h2Positions[0];
      return content.slice(0, insertPos) + "\n\n" + cta1 + "\n" + content.slice(insertPos);
    }
    // No H2s at all — append to end
    return content + "\n\n" + cta1 + "\n";
  }

  // Build insertion list sorted by position descending (bottom-up)
  // so earlier offsets remain valid after each splice
  const insertions: Array<{ pos: number; text: string }> = [];

  // CTA1 before 2nd or 3rd H2
  const cta1Idx = Math.min(2, h2Positions.length - 1);
  insertions.push({ pos: h2Positions[cta1Idx], text: cta1 });

  // CTA2 before 4th or 5th H2 (if enough sections and we have a second template)
  if (cta2 && h2Positions.length >= 4) {
    const cta2Idx = Math.min(4, h2Positions.length - 1);
    insertions.push({ pos: h2Positions[cta2Idx], text: cta2 });
  }

  // Sort descending by position so bottom-up insertion preserves offsets
  insertions.sort((a, b) => b.pos - a.pos);

  let result = content;
  for (const { pos, text } of insertions) {
    result = result.slice(0, pos) + "\n\n" + text + "\n" + result.slice(pos);
  }

  return result;
}

/**
 * Strip existing inline Smart CTA sentences from article content.
 * Removes full lines containing markdown links to the booking URL.
 * Cleans up leftover triple+ blank lines.
 */
// ============================================
// Spanish template bank
// ============================================

const SMART_CTA_TEMPLATES_ES: Record<string, string[]> = {
  "mortgage-financing": [
    "Antes de comprometerte con cualquier producto hipotecario, conviene pedir una segunda opinión — {link} para ver qué opciones realmente encajan con tu situación financiera.",
    "La situación de cada prestatario es diferente, y la estructura hipotecaria equivocada puede costarte miles — {link} para asegurarte de estar bien posicionado.",
    "Las reglas hipotecarias cambian con frecuencia, así que lo que funcionó el año pasado puede no aplicar hoy — {link} para obtener orientación actualizada y personalizada.",
    "Elegir el prestamista o el plazo equivocado puede erosionar tus rendimientos en silencio — {link} y revisaremos los números contigo.",
  ],
  "investing-fundamentals": [
    "Acertar con tu estrategia de financiación desde el principio te ahorra errores costosos más adelante — {link} antes de tu próximo movimiento.",
    "La diferencia entre un buen negocio y uno excelente suele estar en cómo se financia — {link} y analicemos los números juntos.",
    "Ya sea tu primer alquiler o el décimo, tener la estructura hipotecaria correcta importa — {link} para construir un plan que escale contigo.",
    "Muchos inversores dejan dinero sobre la mesa al no explorar todas sus opciones de financiación — {link} y te mostraremos lo que está disponible.",
  ],
  "scaling-portfolio": [
    "Escalar más allá de unas pocas propiedades requiere una estrategia de financiación que la mayoría de inversores desconoce — {link} y te mostraremos cómo funciona.",
    "Los prestamistas tradicionales terminarán por cortarte el crédito, pero hay formas de sortearlo — {link} para aprender cómo otros inversores siguen creciendo su cartera.",
    "El mayor error de los inversores que escalan es no planificar la financiación dos o tres operaciones antes — {link} para construir esa hoja de ruta juntos.",
  ],
  "partnerships-capital": [
    "Estructurar mal una empresa conjunta puede costarte la sociedad y las ganancias — {link} y te ayudaremos a hacer bien la parte de la financiación.",
    "Recaudar capital es una cosa, pero asegurarte de que la estructura hipotecaria respalda la sociedad es otra — {link} para alinear la financiación con tu estrategia de JV.",
    "Antes de incorporar un socio, asegúrate de entender cómo afecta tu capacidad de endeudamiento — {link} y lo mapeamos contigo.",
  ],
  "us-cross-border": [
    "La inversión transfronteriza añade capas de complejidad a tu financiación — {link} y te explicaremos las opciones amigables para canadienses.",
    "Los préstamos DSCR y los programas para extranjeros tienen requisitos específicos que la mayoría de brokers pasa por alto — {link} para trabajar con un equipo especializado en operaciones transfronterizas.",
    "Invertir en EE. UU. desde Canadá es una jugada inteligente, pero solo si tu financiación está bien estructurada — {link} para evitar los errores más comunes.",
  ],
  "personal-finance-mindset": [
    "Construir riqueza empieza por conocer tus opciones — {link} y descubre qué es posible en tu situación.",
    "Los inversores que triunfan son quienes dan ese primer paso — {link} y mapeemos tu camino.",
    "La claridad financiera es el primer paso hacia la libertad financiera — {link} para entender tus opciones hipotecarias y empezar a planificar.",
  ],
};

const CLUSTER_CTA_OVERRIDES_ES: Partial<Record<TopicCluster, string[]>> = {
  "mortgage-basics": [
    "Entender las hipotecas es el primer paso — obtener la correcta es el segundo. {link} y te emparejaremos con el producto ideal para tu situación.",
  ],
  "brrrr-flipping": [
    "La fase de refinanciación en BRRRR es donde la mayoría de inversores tropieza — {link} para asegurar la financiación de salida antes de empezar el proyecto.",
  ],
  "multifamily-investing": [
    "Las reglas de financiación multifamiliar son distintas de las residenciales — {link} y te mostraremos exactamente qué calificas bajo CMHC o programas convencionales.",
  ],
  "refinancing-strategies": [
    "Refinanciar en el momento equivocado o con el prestamista equivocado puede dejar la plusvalía atrapada — {link} para que tu refinanciación te haga avanzar de verdad.",
  ],
  "commercial-lending": [
    "La calificación hipotecaria comercial funciona distinto a la residencial — {link} y entenderás tus opciones antes de hacer una oferta.",
  ],
  "dscr-foreign-national": [
    "Los préstamos DSCR te permiten calificar según los ingresos de la propiedad, no los tuyos — {link} y veremos si un programa DSCR encaja con tu próxima operación.",
    "Los programas DSCR y de extranjeros tienen requisitos específicos que no todos los brokers manejan — {link} para trabajar con un equipo especializado.",
  ],
  "us-investing-basics": [
    "Comprar inmuebles en EE. UU. desde Canadá implica pasos de financiación, fiscales y legales que muchos inversores omiten — {link} y te guiamos en el proceso.",
  ],
  "cross-border-tax-legal": [
    "Los errores de estructura fiscal y legal transfronteriza pueden costarte miles — {link} para configurar tu financiación correctamente desde el día uno.",
  ],
  "portfolio-scaling": [
    "Escalar más allá de unas pocas propiedades requiere una estrategia de financiación que pocos conocen — {link} y te mostraremos cómo funciona.",
  ],
  "joint-ventures-partnerships": [
    "Estructurar mal una JV puede costarte la sociedad y las ganancias — {link} y te ayudaremos a hacer bien la parte de la financiación.",
  ],
  "short-term-rentals": [
    "Las propiedades de alquiler a corto plazo pueden generar buen flujo de caja, pero los prestamistas las evalúan distinto — {link} para entender tus opciones de financiación STR.",
  ],
  "mortgage-qualification": [
    "Cuánto calificas depende de más que tu ingreso — ratios de deuda, tipo de propiedad y elección de prestamista importan. {link} y te mostraremos exactamente dónde estás parado.",
  ],
  "getting-started": [
    "Lo más difícil de invertir en bienes raíces es empezar, y la financiación correcta lo hace mucho más fácil — {link} para saber qué calificas hoy.",
  ],
  "rental-property-analysis": [
    "Los números de una propiedad de alquiler solo funcionan si la financiación está bien estructurada — {link} y correremos los números reales antes de que te comprometas.",
  ],
  "capital-raising": [
    "Recaudar capital para operaciones inmobiliarias es más fácil cuando muestras a los inversores un plan de financiación sólido — {link} y te ayudamos a armarlo.",
  ],
  "investor-mindset": [
    "Tu mentalidad es la base — pero tener un plan de financiación convierte la ambición en acción. {link} y construimos ese plan juntos.",
  ],
  "success-stories": [
    "Cada inversor exitoso empezó con una operación y el equipo correcto detrás — {link} y veamos cómo se ve tu próxima operación.",
  ],
  "team-building": [
    "Tu bróker hipotecario es una de las personas más importantes en tu equipo de inversión — {link} para trabajar con alguien que entiende las operaciones de inversión al detalle.",
  ],
  "market-analysis": [
    "Las condiciones del mercado cambian, pero tener la financiación lista significa que estás listo para actuar cuando surja la oportunidad — {link} para posicionarte antes.",
  ],
  "property-management": [
    "Una buena gestión de propiedad protege tu flujo de caja, pero la estructura hipotecaria correcta es la que lo crea — {link} para que tu financiación trabaje tan duro como tu administrador.",
  ],
};

const FUNNEL_STAGE_TEMPLATES_ES: Record<string, string[]> = {
  "awareness": [
    "Si apenas estás explorando tus opciones, {link} — es gratis y sin compromiso.",
    "¿No sabes por dónde empezar? {link} y te ayudamos a definir el primer paso.",
  ],
  "consideration": [
    "Comparar opciones es inteligente — {link} y te ayudaremos a ver qué camino de financiación encaja mejor.",
  ],
  "decision": [
    "Ya sabes lo que necesitas — {link} y asegura tu financiación.",
    "¿Listo para actuar? {link} y aceleramos tu preaprobación.",
  ],
};

// ============================================
// French template bank
// ============================================

const SMART_CTA_TEMPLATES_FR: Record<string, string[]> = {
  "mortgage-financing": [
    "Avant de vous engager sur un produit hypothécaire, prenez une seconde opinion — {link} pour voir quelles options correspondent réellement à votre situation financière.",
    "La situation de chaque emprunteur est différente, et la mauvaise structure hypothécaire peut vous coûter des milliers — {link} pour vous assurer d'être bien positionné.",
    "Les règles hypothécaires changent souvent — ce qui fonctionnait l'an dernier peut ne plus s'appliquer — {link} pour obtenir des conseils actuels et personnalisés.",
    "Choisir le mauvais prêteur ou terme peut éroder discrètement vos rendements — {link} et nous examinerons les chiffres avec vous.",
  ],
  "investing-fundamentals": [
    "Réussir votre stratégie de financement dès le départ évite les erreurs coûteuses — {link} avant votre prochaine opération.",
    "La différence entre une bonne affaire et une excellente tient souvent à la façon dont elle est financée — {link} et analysons les chiffres ensemble.",
    "Que ce soit votre premier locatif ou votre dixième, la bonne structure hypothécaire compte — {link} pour bâtir un plan qui évolue avec vous.",
    "Beaucoup d'investisseurs laissent de l'argent sur la table en n'explorant pas toutes leurs options — {link} et nous vous montrerons ce qui est disponible.",
  ],
  "scaling-portfolio": [
    "Passer au-delà de quelques propriétés demande une stratégie de financement que la plupart des investisseurs ignorent — {link} et nous vous montrerons comment ça marche.",
    "Les prêteurs traditionnels finiront par vous couper — mais il existe des solutions — {link} pour apprendre comment d'autres continuent de croître leur portefeuille.",
    "La plus grosse erreur en phase de croissance est de ne pas planifier le financement deux ou trois transactions à l'avance — {link} pour construire cette feuille de route.",
  ],
  "partnerships-capital": [
    "Mal structurer une coentreprise peut vous coûter le partenariat et les profits — {link} et nous vous aiderons sur le volet financement.",
    "Lever du capital est une chose, s'assurer que la structure hypothécaire soutient le partenariat en est une autre — {link} pour aligner votre financement sur votre stratégie JV.",
    "Avant d'ajouter un partenaire, comprenez comment cela affecte votre capacité d'emprunt — {link} et cartographions-le ensemble.",
  ],
  "us-cross-border": [
    "L'investissement transfrontalier ajoute des couches de complexité à votre financement — {link} et nous vous expliquerons les options adaptées aux Canadiens.",
    "Les prêts DSCR et les programmes pour non-résidents ont des exigences que la plupart des courtiers ignorent — {link} pour travailler avec une équipe spécialisée.",
    "Investir aux États-Unis depuis le Canada est judicieux — à condition que le financement soit bien structuré — {link} pour éviter les pièges courants.",
  ],
  "personal-finance-mindset": [
    "Bâtir du patrimoine commence par connaître vos options — {link} et découvrez ce qui est possible pour vous.",
    "Les investisseurs qui réussissent sont ceux qui font le premier pas — {link} et traçons votre parcours ensemble.",
    "La clarté financière est la première étape vers la liberté financière — {link} pour comprendre vos options et commencer à planifier.",
  ],
};

const CLUSTER_CTA_OVERRIDES_FR: Partial<Record<TopicCluster, string[]>> = {
  "mortgage-basics": [
    "Comprendre les hypothèques est la première étape — obtenir la bonne est la seconde. {link} et nous vous associerons au bon produit.",
  ],
  "brrrr-flipping": [
    "L'étape de refinancement BRRRR est où la plupart trébuchent — {link} pour verrouiller votre sortie avant de démarrer le projet.",
  ],
  "multifamily-investing": [
    "Le financement multi-logements obéit à des règles différentes du résidentiel — {link} et nous vous montrerons exactement ce à quoi vous qualifiez sous SCHL ou conventionnel.",
  ],
  "refinancing-strategies": [
    "Refinancer au mauvais moment ou avec le mauvais prêteur peut piéger votre valeur nette — {link} pour que votre refinancement vous fasse vraiment avancer.",
  ],
  "commercial-lending": [
    "La qualification hypothécaire commerciale fonctionne différemment du résidentiel — {link} pour comprendre vos options avant de faire une offre.",
  ],
  "dscr-foreign-national": [
    "Les prêts DSCR vous permettent de qualifier sur les revenus de la propriété, pas les vôtres — {link} pour voir si un programme DSCR convient à votre prochaine opération.",
    "Les programmes DSCR et pour non-résidents ont des exigences spécifiques que peu de courtiers gèrent — {link} pour travailler avec une équipe spécialisée.",
  ],
  "us-investing-basics": [
    "Acheter aux États-Unis depuis le Canada implique des étapes fiscales, juridiques et de financement que beaucoup manquent — {link} et nous vous guiderons.",
  ],
  "cross-border-tax-legal": [
    "Les erreurs de structure fiscale et juridique transfrontalière peuvent coûter cher — {link} pour bien configurer votre financement dès le départ.",
  ],
  "portfolio-scaling": [
    "Croître au-delà de quelques propriétés demande une stratégie de financement peu connue — {link} et nous vous montrerons comment.",
  ],
  "joint-ventures-partnerships": [
    "Mal structurer une JV peut vous coûter le partenariat et les profits — {link} et nous vous aiderons côté financement.",
  ],
  "short-term-rentals": [
    "Les locations à court terme génèrent un bon flux, mais les prêteurs les évaluent différemment — {link} pour comprendre vos options STR.",
  ],
  "mortgage-qualification": [
    "Votre qualification dépend de plus que votre revenu — ratios de dette, type de propriété et prêteur choisi comptent. {link} et nous vous situerons précisément.",
  ],
  "getting-started": [
    "Le plus dur en investissement immobilier, c'est de démarrer — et le bon financement simplifie tout — {link} pour savoir à quoi vous qualifiez aujourd'hui.",
  ],
  "rental-property-analysis": [
    "Les chiffres d'un locatif ne tiennent que si le financement est bien structuré — {link} et nous ferons les vrais calculs avant que vous ne vous engagiez.",
  ],
  "capital-raising": [
    "Lever du capital est plus facile quand vous montrez un plan de financement solide — {link} et nous vous aiderons à l'élaborer.",
  ],
  "investor-mindset": [
    "Votre mentalité est la fondation — un plan de financement transforme l'ambition en action. {link} et bâtissons ce plan ensemble.",
  ],
  "success-stories": [
    "Chaque investisseur prospère a commencé par une transaction et la bonne équipe — {link} et voyons à quoi ressemble votre prochaine.",
  ],
  "team-building": [
    "Votre courtier hypothécaire est l'une des personnes les plus importantes de votre équipe — {link} pour travailler avec quelqu'un qui maîtrise les opérations d'investisseurs.",
  ],
  "market-analysis": [
    "Les conditions de marché changent — avoir le bon financement en place signifie être prêt quand l'occasion se présente — {link} pour vous positionner à l'avance.",
  ],
  "property-management": [
    "Une bonne gestion protège votre flux de trésorerie — la bonne structure hypothécaire le crée. {link} pour que votre financement travaille aussi fort que votre gestionnaire.",
  ],
};

const FUNNEL_STAGE_TEMPLATES_FR: Record<string, string[]> = {
  "awareness": [
    "Si vous commencez à explorer vos options, {link} — c'est gratuit et sans engagement.",
    "Vous ne savez pas par où commencer ? {link} et nous vous aiderons à définir la première étape.",
  ],
  "consideration": [
    "Comparer vos options est une bonne idée — {link} et nous vous aiderons à identifier le bon chemin de financement.",
  ],
  "decision": [
    "Vous savez ce qu'il vous faut — {link} et verrouillons votre financement.",
    "Prêt à agir ? {link} et nous accélérerons votre préapprobation.",
  ],
};

export function stripSmartCTAs(content: string): string {
  const escapedUrl = BOOKING_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `[^\\n]*\\[[^\\]]+\\]\\(${escapedUrl}[^)]*\\)[^\\n]*`,
    "g"
  );
  let result = content.replace(pattern, "");
  // Clean up leftover triple+ blank lines
  result = result.replace(/\n{3,}/g, "\n\n");
  return result;
}

// ============================================
// Glossary inline CTAs
// ============================================

const GLOSSARY_CTA_SIGNALS: Record<string, string[]> = {
  dscr: ["dscr", "debt service", "coverage ratio", "debt coverage"],
  mli: ["cmhc", "mli", "multifamily", "multi-family", "apartment"],
  heloc: ["heloc", "home equity", "equity line"],
  flip: ["flip", "brrrr", "rehab", "arv"],
  commercial: ["commercial", "noi", "cap rate", "triple net"],
  crossBorder: ["cross-border", "foreign national", "llc", "u.s.", "usa"],
};

const GLOSSARY_CTA_TEMPLATES: Record<string, Record<string, string>> = {
  en: {
    dscr: "Understanding {term} is the first step — {link} and we'll show you if your property qualifies on rental income alone. Or {calc} to run the numbers yourself.",
    mli: "Now that you know what {term} means, {link} to see how CMHC programs can maximize your multifamily financing. {calc} to model your deal.",
    heloc: "{term} can unlock capital for your next investment — {link} to explore how a HELOC fits your portfolio strategy.",
    flip: "Whether you're flipping or doing BRRRR, {term} affects your financing — {link} before you commit to the project.",
    commercial: "Commercial deals hinge on metrics like {term} — {link} and we'll help you structure financing that matches the numbers.",
    crossBorder: "Cross-border investing makes terms like {term} especially important — {link} to work with a team that specializes in Canadian-to-U.S. deals.",
    default: "Need help applying {term} to your next deal? {link} — it's free and there's no obligation.",
  },
  es: {
    dscr: "Entender {term} es el primer paso — {link} y le mostraremos si su propiedad califica según los ingresos de alquiler. O {calc} para calcular usted mismo.",
    mli: "Ahora que sabe qué significa {term}, {link} para ver cómo los programas CMHC pueden maximizar su financiación multifamiliar. {calc} para modelar su operación.",
    heloc: "{term} puede liberar capital para su próxima inversión — {link} para explorar cómo encaja un HELOC en su estrategia.",
    flip: "Ya sea flip o BRRRR, {term} afecta su financiación — {link} antes de comprometerse con el proyecto.",
    commercial: "Las operaciones comerciales dependen de métricas como {term} — {link} y le ayudaremos a estructurar la financiación.",
    crossBorder: "La inversión transfronteriza hace que términos como {term} sean especialmente importantes — {link} para trabajar con un equipo especializado.",
    default: "¿Necesita ayuda aplicando {term} a su próxima operación? {link} — es gratis y sin compromiso.",
  },
  fr: {
    dscr: "Comprendre {term} est la première étape — {link} et nous vous montrerons si votre propriété qualifie sur les revenus locatifs. Ou {calc} pour faire les calculs vous-même.",
    mli: "Maintenant que vous savez ce que signifie {term}, {link} pour voir comment les programmes SCHL peuvent maximiser votre financement multifamilial. {calc} pour modéliser votre opération.",
    heloc: "{term} peut libérer du capital pour votre prochain investissement — {link} pour explorer comment un HELOC s'intègre à votre stratégie.",
    flip: "Que ce soit un flip ou du BRRRR, {term} affecte votre financement — {link} avant de vous engager sur le projet.",
    commercial: "Les opérations commerciales reposent sur des métriques comme {term} — {link} et nous vous aiderons à structurer le financement.",
    crossBorder: "L'investissement transfrontalier rend des termes comme {term} particulièrement importants — {link} pour travailler avec une équipe spécialisée.",
    default: "Besoin d'aide pour appliquer {term} à votre prochaine opération ? {link} — c'est gratuit et sans engagement.",
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

/**
 * Insert a contextual inline CTA into glossary term body content.
 */
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
    dscr: "/tools/dscr-loan-calculator/",
    mli: "/tools/cmhc-mli-max-loan-calculator/",
  };
  const calcPath = calcPaths[topic];
  const calcLink = calcPath ? glossaryCalcLink(lang, calcPath) : glossaryLinkText(lang);

  let cta = template
    .replace(/\{term\}/g, term)
    .replace("{link}", glossaryLinkText(lang))
    .replace("{calc}", calcLink);

  const trimmed = content.trim();
  if (!trimmed) return cta + "\n";
  return trimmed + "\n\n" + cta + "\n";
}

/**
 * Strip glossary inline CTAs (booking links).
 */
export function stripGlossaryCTAs(content: string): string {
  return stripSmartCTAs(content);
}

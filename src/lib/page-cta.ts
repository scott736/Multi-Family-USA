export type CtaActionType = "book-call" | "deal-review" | "calculator" | "guide";

export interface CtaAction {
  type: CtaActionType;
  label: string;
  href: string;
}

export interface PageCtaConfig {
  title: string;
  description: string;
  primary: CtaAction;
  secondary: CtaAction;
}

type Lang = "en" | "es";

interface LocalizedStrings {
  bookCall: string;
  dealReview: string;
  tryCalculator: string;
  readGuide: string;
  exploreTools: string;
}

const STRINGS: Record<Lang, LocalizedStrings> = {
  en: {
    bookCall: "Book a Free Strategy Call",
    dealReview: "Get a Free Deal Review",
    tryCalculator: "Try the Calculator",
    readGuide: "Read the Guide",
    exploreTools: "Explore Calculators",
  },
  es: {
    bookCall: "Reservar una llamada estratégica",
    dealReview: "Obtener revisión de operación",
    tryCalculator: "Probar la calculadora",
    readGuide: "Leer la guía",
    exploreTools: "Explorar calculadoras",
  },
};

const BOOK_CALL: Record<Lang, string> = {
  en: "/book-strategy-call/",
  es: "/es/book-strategy-call/",
};

const DEAL_REVIEW: Record<Lang, string> = {
  en: "/deal-review/",
  es: "/es/deal-review/",
};

function prefixPath(lang: Lang, path: string): string {
  if (lang === "en") return path;
  return `/es${path}`;
}

function bookCall(lang: Lang): CtaAction {
  return { type: "book-call", label: STRINGS[lang].bookCall, href: BOOK_CALL[lang] };
}

function dealReview(lang: Lang): CtaAction {
  return {
    type: "deal-review",
    label: STRINGS[lang].dealReview,
    href: DEAL_REVIEW[lang],
  };
}

function calculator(lang: Lang, path: string, label?: string): CtaAction {
  return {
    type: "calculator",
    label: label || STRINGS[lang].tryCalculator,
    href: prefixPath(lang, path),
  };
}

function guide(lang: Lang, path: string, label?: string): CtaAction {
  return {
    type: "guide",
    label: label || STRINGS[lang].readGuide,
    href: prefixPath(lang, path),
  };
}

/** Normalize pathname: strip trailing slash, extract lang and path without locale prefix. */
export function parsePagePath(pathname: string): { lang: Lang; path: string } {
  let path = pathname.replace(/\/$/, "") || "/";
  let lang: Lang = "en";

  if (path.startsWith("/es/") || path === "/es") {
    lang = "es";
    path = path === "/es" ? "/" : path.slice(3) || "/";
  }

  if (!path.startsWith("/")) path = `/${path}`;
  return { lang, path };
}

function defaultPageCta(lang: Lang): PageCtaConfig {
  return {
    title:
      lang === "es"
        ? "¿Listo para estructurar su próxima operación multifamiliar?"
        : "Ready to Structure Your Next Multifamily Deal?",
    description:
      lang === "es"
        ? "Multi-Family USA ayuda a sponsors a elegir el camino de deuda correcto — agency, bridge, bank, CMBS o FHA — y revisar el underwriting."
        : "Multi-Family USA helps sponsors choose the right debt path — agency, bridge, bank, CMBS, or FHA — and pressure-test underwriting.",
    primary: bookCall(lang),
    secondary: dealReview(lang),
  };
}

/**
 * Contextual bottom-of-page CTA for hub and tool pages.
 */
export function getPageCta(pathname: string): PageCtaConfig {
  const { lang, path } = parsePagePath(pathname);

  if (path === "/loan-types" || path.startsWith("/loan-types/")) {
    return {
      title:
        lang === "es"
          ? "¿Cuál ejecución de deuda encaja con su activo?"
          : "Which Debt Execution Fits Your Asset?",
      description:
        lang === "es"
          ? "Compare agency, bridge, bank, CMBS y FHA con un especialista y obtenga una lectura de lender-fit."
          : "Compare agency, bridge, bank, CMBS, and FHA with a specialist and get a lender-fit read.",
      primary: bookCall(lang),
      secondary: dealReview(lang),
    };
  }

  if (path === "/property-types" || path.startsWith("/property-types/")) {
    return {
      title:
        lang === "es"
          ? "¿Cómo financia este tipo de activo?"
          : "How Does This Asset Type Finance?",
      description:
        lang === "es"
          ? "Garden, mid-rise, suburban y value-add se underwritean distinto. Revisemos leverage y lender appetite."
          : "Garden, mid-rise, suburban, and value-add underwrite differently. Let's review leverage and lender appetite.",
      primary: bookCall(lang),
      secondary: guide(lang, "/learn/multifamily-underwriting-basics/"),
    };
  }

  if (path === "/learn" || path.startsWith("/learn/")) {
    return {
      title:
        lang === "es"
          ? "¿Listo para aplicar esta guía a su operación?"
          : "Ready to Apply This Guide to Your Deal?",
      description:
        lang === "es"
          ? "Pase de la teoría al underwriting — reserve una llamada o envíe su operación para revisión."
          : "Move from theory to underwriting — book a call or send your deal for review.",
      primary: bookCall(lang),
      secondary: dealReview(lang),
    };
  }

  if (path === "/tools" || path.startsWith("/tools/")) {
    const toolSecondary =
      path.includes("debt-yield")
        ? calculator(lang, "/tools/debt-yield-calculator/")
        : path.includes("cap-rate")
          ? calculator(lang, "/tools/cap-rate-noi-calculator/")
          : path.includes("loan-sizing")
            ? calculator(lang, "/tools/loan-sizing-calculator/")
            : path.includes("cash-on-cash")
              ? calculator(lang, "/tools/cash-on-cash-calculator/")
              : calculator(lang, "/tools/commercial-dscr-calculator/");

    return {
      title:
        lang === "es"
          ? "¿Los números se ven bien — y ahora?"
          : "Numbers Look Right — What's Next?",
      description:
        lang === "es"
          ? "Convierta el output de la calculadora en una estructura de deuda y un lender match."
          : "Turn calculator output into a debt structure and lender match.",
      primary: bookCall(lang),
      secondary: toolSecondary.type === "calculator" && path !== "/tools"
        ? dealReview(lang)
        : calculator(lang, "/tools/commercial-dscr-calculator/", STRINGS[lang].exploreTools),
    };
  }

  if (path === "/states" || path.startsWith("/states/")) {
    return {
      title:
        lang === "es"
          ? "¿Financiando multifamiliar en este estado?"
          : "Financing Multifamily in This State?",
      description:
        lang === "es"
          ? "Impuestos, rent control y foreclosure timing cambian el lender fit. Revisemos su mercado."
          : "Taxes, rent control, and foreclosure timing change lender fit. Let's review your market.",
      primary: bookCall(lang),
      secondary: dealReview(lang),
    };
  }

  if (path === "/cities" || path.startsWith("/cities/")) {
    return {
      title:
        lang === "es"
          ? "¿Estructurando una operación en este mercado?"
          : "Structuring a Deal in This Market?",
      description:
        lang === "es"
          ? "Rents, price-per-unit y lender appetite varían por ciudad. Obtenga una lectura de underwriting."
          : "Rents, price-per-unit, and lender appetite vary by city. Get an underwriting read.",
      primary: bookCall(lang),
      secondary: dealReview(lang),
    };
  }

  if (path === "/compare" || path.startsWith("/compare/")) {
    return {
      title:
        lang === "es"
          ? "¿Necesita ayuda eligiendo el camino de capital?"
          : "Need Help Choosing the Capital Path?",
      description:
        lang === "es"
          ? "Agency vs bridge, bank vs debt fund, fixed vs floating — mapemos la decisión a su activo."
          : "Agency vs bridge, bank vs debt fund, fixed vs floating — map the decision to your asset.",
      primary: bookCall(lang),
      secondary: guide(lang, "/loan-types/"),
    };
  }

  if (path === "/invest" || path.startsWith("/invest/")) {
    return {
      title:
        lang === "es"
          ? "¿Qué playbook de capital encaja con su perfil?"
          : "Which Capital Playbook Fits Your Profile?",
      description:
        lang === "es"
          ? "First-time, value-add, portfolio u institutional — estructuremos la deuda alrededor de su estrategia."
          : "First-time, value-add, portfolio, or institutional — let's structure debt around your strategy.",
      primary: bookCall(lang),
      secondary: dealReview(lang),
    };
  }

  if (path === "/checklists" || path.startsWith("/checklists/")) {
    return {
      title:
        lang === "es"
          ? "¿Listo para preparar su paquete de prestamista?"
          : "Ready to Package Your Lender File?",
      description:
        lang === "es"
          ? "Use las checklists y luego revise el underwriting con un especialista antes de enviar."
          : "Use the checklists, then pressure-test underwriting with a specialist before you submit.",
      primary: bookCall(lang),
      secondary: dealReview(lang),
    };
  }

  if (path === "/rates") {
    return {
      title:
        lang === "es"
          ? "¿Quiere all-in cost para su ejecución?"
          : "Want All-In Cost for Your Execution?",
      description:
        lang === "es"
          ? "Spreads y product path cambian el costo real. Revisemos agency, bridge y bank en su deal."
          : "Spreads and product path change true cost. Let's review agency, bridge, and bank on your deal.",
      primary: bookCall(lang),
      secondary: calculator(lang, "/tools/loan-sizing-calculator/"),
    };
  }

  if (path === "/blog" || path.startsWith("/blog/")) {
    return {
      title:
        lang === "es"
          ? "¿Listo para llevar esto a su operación?"
          : "Ready to Take This to Your Deal?",
      description:
        lang === "es"
          ? "Reserve una llamada estratégica o envíe su operación multifamiliar para una revisión gratuita."
          : "Book a strategy call or send your multifamily deal for a free review.",
      primary: bookCall(lang),
      secondary: dealReview(lang),
    };
  }

  return defaultPageCta(lang);
}

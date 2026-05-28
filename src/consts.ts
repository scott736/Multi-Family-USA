export const SITE_TITLE = "Multi-Family USA — Commercial Multifamily Financing Resource";
export const SITE_SHORT_NAME = "Multi-Family USA";
export const SITE_DESCRIPTION =
  "Independent US commercial multifamily financing resource for 5+ unit properties. Learn underwriting, run calculators, compare capital options, and request a free deal review.";
export const SITE_URL = "https://multifamily-usa.com";
export const SITE_LAST_REVIEWED = "2026-05-24";

export const LEAD_INBOX = ["scott@lendcity.ca", "aya@lendcity.ca"] as const;

const DEFAULT_SITE_PHONE = "(989) 662-1099";
const DEFAULT_SITE_PHONE_HREF = "tel:+19896621099";

export const SITE_PHONE =
  (import.meta.env.PUBLIC_SITE_PHONE as string | undefined)?.trim() ||
  DEFAULT_SITE_PHONE;
export const SITE_PHONE_HREF =
  (import.meta.env.PUBLIC_SITE_PHONE_HREF as string | undefined)?.trim() ||
  DEFAULT_SITE_PHONE_HREF;

export const PILLARS = [
  {
    slug: "learn",
    title: "Learn",
    tagline: "Multifamily financing fundamentals",
    description:
      "Plain-English guidance for agency, bridge, debt fund, and bank multifamily execution.",
  },
  {
    slug: "tools",
    title: "Tools",
    tagline: "Underwriting calculators",
    description:
      "Analyze NOI, cap rate, DSCR, debt yield, cash-on-cash, and loan sizing in minutes.",
  },
  {
    slug: "markets",
    title: "Markets",
    tagline: "State and city coverage",
    description:
      "51-state multifamily financing overviews plus city-level market snapshots.",
  },
  {
    slug: "compare",
    title: "Compare",
    tagline: "Capital stack decisions",
    description:
      "Compare loan products and execution paths by cost of capital, proceeds, and flexibility.",
  },
  {
    slug: "invest",
    title: "Invest",
    tagline: "Operator playbooks",
    description:
      "Profiles and decision frameworks for first-time and institutional multifamily operators.",
  },
] as const;

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

const SCHEMA_IDS = {
  organization: ORG_ID,
  website: WEBSITE_ID,
  publisher: ORG_ID,
};

export const SITE_METADATA = {
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_SHORT_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "multifamily financing",
    "commercial real estate loan",
    "multifamily dscr",
    "commercial dscr loan",
    "debt yield calculator",
    "cap rate calculator",
    "dscr calculator",
    "multifamily loan calculator",
    "multifamily underwriting",
    "apartment building loan",
    "apartment loan rates",
    "fannie mae multifamily loan",
    "multifamily lending rates",
    "bridge loan multifamily",
    "agency multifamily loan",
  ],
  authors: [{ name: "Multi-Family USA Editorial Team", url: `${SITE_URL}/about/` }],
  creator: SITE_SHORT_NAME,
  publisher: SITE_SHORT_NAME,
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "48x48" },
      { url: "/favicon/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [{ url: "/favicon/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: [{ url: "/favicon/favicon.ico" }],
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: SITE_SHORT_NAME,
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Multi-Family USA — Commercial Multifamily Financing Resource",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
    creator: "@multifamilyusa",
    site: "@multifamilyusa",
  },
};

export function getBaseSchemas() {
  return [
    {
      "@context": "https://schema.org",
      "@type": ["Organization", "FinancialService"],
      "@id": ORG_ID,
      name: SITE_SHORT_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      areaServed: { "@type": "Country", name: "United States" },
      telephone: SITE_PHONE,
      contactPoint: [
        {
          "@type": "ContactPoint",
          telephone: SITE_PHONE,
          contactType: "customer support",
          areaServed: "US",
        },
      ],
      sameAs: ["https://www.linkedin.com/company/lendcity"],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      url: SITE_URL,
      name: SITE_SHORT_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "en-US",
      publisher: { "@id": ORG_ID },
    },
  ];
}

export function buildFaqSchema(items: { q: string; a: string }[]) {
  if (items.length === 0) return null;
  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: stripHtml(item.a),
      },
    })),
  };
}

function buildBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
}

export function buildCollectionPageSchema(opts: {
  name: string;
  description: string;
  url: string;
  items: { name: string; url: string; description?: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    description: opts.description,
    url: opts.url,
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: opts.items.length,
      itemListElement: opts.items.map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "CreativeWork",
          name: it.name,
          url: it.url.startsWith("http") ? it.url : `${SITE_URL}${it.url}`,
          ...(it.description ? { description: it.description } : {}),
        },
      })),
    },
  };
}

export function buildArticleSchema(opts: {
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  authorName?: string;
  keywords?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.headline,
    description: opts.description,
    mainEntityOfPage: opts.url,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified ?? opts.datePublished,
    author: {
      "@type": "Organization",
      name: opts.authorName ?? "Multi-Family USA Editorial Team",
      url: `${SITE_URL}/about/`,
    },
    publisher: { "@id": ORG_ID },
    ...(opts.keywords?.length ? { keywords: opts.keywords.join(", ") } : {}),
  };
}

export function buildServiceSchema(opts: {
  name: string;
  description: string;
  url: string;
  serviceType?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: opts.name,
    description: opts.description,
    url: opts.url,
    serviceType: opts.serviceType ?? "Commercial multifamily financing advisory",
    provider: { "@id": ORG_ID },
    areaServed: { "@type": "Country", name: "United States" },
  };
}

export function buildWebPageSchema(opts: {
  name: string;
  description: string;
  url: string;
  about?: string;
  inLanguage?: string;
  dateModified?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: opts.name,
    description: opts.description,
    url: opts.url,
    inLanguage: opts.inLanguage ?? "en-US",
    isPartOf: { "@id": WEBSITE_ID },
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
    ...(opts.about ? { about: { "@type": "Thing", name: opts.about } } : {}),
  };
}

export function buildFinancialProductSchema(opts: {
  name: string;
  description: string;
  url: string;
  category?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    name: opts.name,
    description: opts.description,
    url: opts.url,
    category: opts.category ?? "Commercial multifamily loan",
    provider: { "@id": ORG_ID },
    areaServed: { "@type": "Country", name: "United States" },
  };
}

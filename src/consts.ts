import { INDEXNOW_KEY, SITE_URL } from "../scripts/site-config.mjs";

export const SITE_TITLE = "Multi-Family USA — Commercial Multifamily Financing Resource";
export const SITE_SHORT_NAME = "Multi-Family USA";
export const SITE_DESCRIPTION =
  "Independent US commercial multifamily financing resource for 5+ unit properties. Learn underwriting, run calculators, compare capital options, and request a free deal review.";
export { INDEXNOW_KEY, SITE_URL };
export const SITE_LAST_REVIEWED = "2026-07-05";
export const SITE_FOUNDING_DATE = "2026-01-15";
export const SITE_LOGO = `${SITE_URL}/favicon/apple-touch-icon.png`;
export const SITE_DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

export const NETWORK_SITES = {
  lendcity: "https://lendcity.ca",
  dscrAuthority: "https://dscrauthority.com",
} as const;

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
      alternateName: ["Multi-Family USA", "Multifamily USA", "multifamily-usa.com"],
      disambiguatingDescription:
        "Independent editorial resource at multifamily-usa.com for US commercial multifamily financing on 5+ unit properties. Not a loan originator or commercial brokerage.",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: SITE_LOGO,
        width: 180,
        height: 180,
      },
      description: SITE_DESCRIPTION,
      foundingDate: SITE_FOUNDING_DATE,
      dateModified: SITE_LAST_REVIEWED,
      founders: [
        {
          "@type": "Person",
          name: "Scott Dillingham",
          url: `${SITE_URL}/team/scott-dillingham/`,
          sameAs: [
            "https://lendcity.ca/team/scott-dillingham/",
            "https://www.linkedin.com/in/scottdillingham/",
          ],
        },
      ],
      parentOrganization: {
        "@type": "Organization",
        name: "LendCity Mortgages",
        url: NETWORK_SITES.lendcity,
        sameAs: [
          NETWORK_SITES.lendcity,
          "https://www.linkedin.com/company/lendcity",
        ],
      },
      areaServed: { "@type": "Country", name: "United States" },
      telephone: SITE_PHONE,
      contactPoint: [
        {
          "@type": "ContactPoint",
          telephone: SITE_PHONE,
          contactType: "customer support",
          areaServed: "US",
          availableLanguage: ["English", "Spanish"],
        },
      ],
      knowsAbout: [
        "Commercial multifamily financing",
        "Agency multifamily loans",
        "Bridge multifamily debt",
        "Commercial DSCR underwriting",
        "FHA HUD multifamily programs",
        "Multifamily debt yield",
        "US apartment building loans",
      ],
      publishingPrinciples: `${SITE_URL}/editorial-standards/`,
      sameAs: [
        NETWORK_SITES.lendcity,
        NETWORK_SITES.dscrAuthority,
        "https://www.linkedin.com/company/lendcity",
      ],
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

export function buildPersonSchema(opts: {
  slug: string;
  name: string;
  title: string;
  bio: string;
  photo?: string;
  credentials?: string[];
  knowsAbout?: string[];
  sameAs?: string[];
}) {
  const personUrl = `${SITE_URL}/team/${opts.slug}/`;
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${personUrl}#person`,
    name: opts.name,
    jobTitle: opts.title,
    description: opts.bio,
    url: personUrl,
    ...(opts.photo ? { image: opts.photo.startsWith("http") ? opts.photo : `${SITE_URL}${opts.photo}` } : {}),
    ...(opts.credentials?.length
      ? {
          hasCredential: opts.credentials.map((name) => ({
            "@type": "EducationalOccupationalCredential",
            name,
          })),
        }
      : {}),
    ...(opts.knowsAbout?.length ? { knowsAbout: opts.knowsAbout } : {}),
    ...(opts.sameAs?.length ? { sameAs: opts.sameAs } : {}),
    worksFor: { "@id": ORG_ID },
  };
}

function buildSchemaAuthorRef(authorName?: string, authorId?: string) {
  if (authorId) return { "@id": authorId };
  return {
    "@type": "Organization",
    name: authorName ?? "Multi-Family USA Editorial Team",
    url: `${SITE_URL}/about/`,
  };
}

export function buildArticleSchema(opts: {
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  authorName?: string;
  authorId?: string;
  reviewerName?: string;
  reviewerId?: string;
  keywords?: string[];
  image?: string;
  inLanguage?: string;
  articleSection?: string;
  articleType?: "Article" | "BlogPosting";
  speakable?: boolean;
}) {
  const pageUrl = opts.url.startsWith("http") ? opts.url : `${SITE_URL}${opts.url}`;
  const imageUrl = opts.image
    ? opts.image.startsWith("http")
      ? opts.image
      : `${SITE_URL}${opts.image}`
    : undefined;

  return {
    "@context": "https://schema.org",
    "@type": opts.articleType ?? "Article",
    headline: opts.headline,
    description: opts.description,
    mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
    datePublished: opts.datePublished,
    dateModified: opts.dateModified ?? opts.datePublished,
    author: buildSchemaAuthorRef(opts.authorName, opts.authorId),
    ...(opts.reviewerId || opts.reviewerName
      ? {
          reviewedBy: buildSchemaAuthorRef(opts.reviewerName, opts.reviewerId),
        }
      : {}),
    publisher: { "@id": ORG_ID },
    ...(imageUrl ? { image: [imageUrl] } : {}),
    ...(opts.inLanguage ? { inLanguage: opts.inLanguage } : {}),
    ...(opts.articleSection ? { articleSection: opts.articleSection } : {}),
    ...(opts.keywords?.length ? { keywords: opts.keywords.join(", ") } : {}),
    ...(opts.speakable !== false
      ? {
          speakable: {
            "@type": "SpeakableSpecification",
            cssSelector: ["[data-speakable]", "article h1"],
          },
        }
      : {}),
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

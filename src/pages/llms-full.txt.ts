import { getCollection } from "astro:content";

import {
  NETWORK_SITES,
  SITE_DESCRIPTION,
  SITE_FOUNDING_DATE,
  SITE_LAST_REVIEWED,
  SITE_URL,
} from "@/consts";
import { filterPublished } from "@/lib/scheduled-publish";

type LlmsEntry = {
  id: string;
  data: {
    title?: string;
    description?: string;
    stateName?: string;
    cityName?: string;
    avgCapRate?: number;
    stateCode?: string;
  };
};

function sectionLines(entries: LlmsEntry[], basePath: string) {
  return entries.flatMap((entry) => {
    const slug = entry.id.replace(/\.mdx$/, "");
    const title = entry.data.title ?? entry.data.stateName ?? entry.data.cityName ?? slug;
    const url = `${SITE_URL}${basePath}/${slug}/`;
    const extra =
      entry.data.stateCode && entry.data.avgCapRate != null
        ? ` (${entry.data.stateCode}; avg cap rate ${entry.data.avgCapRate.toFixed(1)}%)`
        : "";
    return [
      `### ${title}${extra}`,
      `URL: ${url}`,
      `Description: ${entry.data.description ?? ""}`,
      "",
    ];
  });
}

export async function GET() {
  const [guides, states, cities, loanTypes, propertyTypes, comparisons, profiles, blog] =
    await Promise.all([
      getCollection("guides"),
      getCollection("states"),
      getCollection("cities"),
      getCollection("loanTypes"),
      getCollection("propertyTypes"),
      getCollection("comparisons"),
      getCollection("investorProfiles"),
      getCollection("blog"),
    ]);

  const publishedBlog = filterPublished(blog);

  const sections = [
    "# Multi-Family USA — Full Content Index",
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    "## Site metadata",
    "",
    `- Domain: ${SITE_URL}`,
    `- Founding date: ${SITE_FOUNDING_DATE}`,
    `- Last reviewed: ${SITE_LAST_REVIEWED}`,
    `- Scope: US commercial multifamily (5+ units)`,
    `- Network: LendCity (${NETWORK_SITES.lendcity}) · DSCR Authority (${NETWORK_SITES.dscrAuthority})`,
    `- Compact index: ${SITE_URL}/llms.txt`,
    "",
    "## Core pages",
    "",
    `- Home: ${SITE_URL}/`,
    `- Deal review: ${SITE_URL}/deal-review/`,
    `- Strategy call: ${SITE_URL}/book-strategy-call/`,
    `- FAQ: ${SITE_URL}/faq/`,
    `- Rates: ${SITE_URL}/rates/`,
    `- About: ${SITE_URL}/about/`,
    `- Editorial standards: ${SITE_URL}/editorial-standards/`,
    `- Contact: ${SITE_URL}/contact/`,
    "",
    "## Tools",
    "",
    `- Cap Rate & NOI: ${SITE_URL}/tools/cap-rate-noi-calculator/`,
    `- Debt Yield: ${SITE_URL}/tools/debt-yield-calculator/`,
    `- Commercial DSCR: ${SITE_URL}/tools/commercial-dscr-calculator/`,
    `- Cash-on-Cash: ${SITE_URL}/tools/cash-on-cash-calculator/`,
    `- Loan Sizing: ${SITE_URL}/tools/loan-sizing-calculator/`,
    "",
    "## Network cross-links",
    "",
    `- DSCR Authority (1–4 unit US DSCR): ${NETWORK_SITES.dscrAuthority}/`,
    `- LendCity multifamily & CMHC MLI: ${NETWORK_SITES.lendcity}/multifamily-mortgage-financing/`,
    `- LendCity cross-border: ${NETWORK_SITES.lendcity}/cross-border-mortgage-financing/`,
    "",
    "## Guides",
    "",
    ...sectionLines(guides, "/learn"),
    "## Comparisons",
    "",
    ...sectionLines(comparisons, "/compare"),
    "## Loan types",
    "",
    ...sectionLines(loanTypes, "/loan-types"),
    "## Property types",
    "",
    ...sectionLines(propertyTypes, "/property-types"),
    "## Investor profiles",
    "",
    ...sectionLines(profiles, "/invest"),
    "## States",
    "",
    ...sectionLines(states, "/states"),
    "## Cities",
    "",
    ...sectionLines(cities, "/cities"),
    "## Blog",
    "",
    ...sectionLines(publishedBlog, "/blog"),
    "## Discovery",
    "",
    `- Sitemap: ${SITE_URL}/sitemap-index.xml`,
    `- robots.txt: ${SITE_URL}/robots.txt`,
    `- AI policy: ${SITE_URL}/.well-known/ai.txt`,
  ];

  return new Response(sections.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}

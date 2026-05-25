import { getCollection } from "astro:content";

import { SITE_LAST_REVIEWED,SITE_URL } from "@/consts";
import { filterPublished } from "@/lib/scheduled-publish";

export async function GET() {
  const [guides, states, cities, compare, loanTypes, propertyTypes, profiles, blog] = await Promise.all([
    getCollection("guides"),
    getCollection("states"),
    getCollection("cities"),
    getCollection("comparisons"),
    getCollection("loanTypes"),
    getCollection("propertyTypes"),
    getCollection("investorProfiles"),
    getCollection("blog"),
  ]);

  const publishedBlog = filterPublished(blog);

  const tools = [
    { title: "Cap Rate Calculator for Multifamily", url: "/tools/cap-rate-noi-calculator/" },
    { title: "Debt Yield Calculator", url: "/tools/debt-yield-calculator/" },
    { title: "Commercial DSCR Calculator", url: "/tools/commercial-dscr-calculator/" },
    { title: "Multifamily Cash-on-Cash Calculator", url: "/tools/cash-on-cash-calculator/" },
    { title: "Multifamily Loan Sizing Calculator", url: "/tools/loan-sizing-calculator/" },
  ];

  const featuredGuides = [
    "apartment-building-loan-guide",
    "fha-hud-multifamily-financing",
    "multifamily-construction-financing",
    "commercial-dscr-explained",
  ];

  const lines = [
    "# Multi-Family USA",
    "",
    `> Last reviewed: ${SITE_LAST_REVIEWED}`,
    "> Scope: US commercial multifamily financing (5+ units)",
    "",
    "## Key pages",
    `- Home: ${SITE_URL}/`,
    `- FAQ: ${SITE_URL}/faq/`,
    `- Rates: ${SITE_URL}/rates/`,
    `- Free Deal Review: ${SITE_URL}/deal-review/`,
    `- Learn: ${SITE_URL}/learn/`,
    `- Tools: ${SITE_URL}/tools/`,
    `- Compare: ${SITE_URL}/compare/`,
    `- States: ${SITE_URL}/states/`,
    `- Cities: ${SITE_URL}/cities/`,
    `- Blog: ${SITE_URL}/blog/`,
    `- AI policy: ${SITE_URL}/.well-known/ai.txt`,
    "",
    "## Tools",
    ...tools.map((tool) => `- ${tool.title}: ${SITE_URL}${tool.url}`),
    "",
    "## Featured guides",
    ...featuredGuides.map((slug) => {
      const entry = guides.find((g) => g.id.replace(/\.mdx$/, "") === slug);
      return entry
        ? `- ${entry.data.title}: ${SITE_URL}/learn/${slug}/`
        : `- ${slug}: ${SITE_URL}/learn/${slug}/`;
    }),
    "",
    "## All guides",
    ...guides.map((entry) => `- ${entry.data.title}: ${SITE_URL}/learn/${entry.id.replace(/\.mdx$/, "")}/`),
    "",
    "## Comparisons",
    ...compare.map((entry) => `- ${entry.data.title}: ${SITE_URL}/compare/${entry.id.replace(/\.mdx$/, "")}/`),
    "",
    "## Blog",
    ...publishedBlog.map((entry) => `- ${entry.data.title}: ${SITE_URL}/blog/${entry.id.replace(/\.mdx$/, "")}/`),
    "",
    "## States",
    ...states.map((entry) => `- ${entry.data.stateName}: ${SITE_URL}/states/${entry.id.replace(/\.mdx$/, "")}/`),
    "",
    "## Cities",
    ...cities.map((entry) => `- ${entry.data.cityName}: ${SITE_URL}/cities/${entry.id.replace(/\.mdx$/, "")}/`),
    "",
    "## Loan types",
    ...loanTypes.map((entry) => `- ${entry.data.title}: ${SITE_URL}/loan-types/${entry.id.replace(/\.mdx$/, "")}/`),
    "",
    "## Property types",
    ...propertyTypes.map((entry) => `- ${entry.data.title}: ${SITE_URL}/property-types/${entry.id.replace(/\.mdx$/, "")}/`),
    "",
    "## Investor profiles",
    ...profiles.map((entry) => `- ${entry.data.title}: ${SITE_URL}/invest/${entry.id.replace(/\.mdx$/, "")}/`),
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

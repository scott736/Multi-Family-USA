import { getCollection } from "astro:content";

import { SITE_LAST_REVIEWED,SITE_URL } from "@/consts";

export async function GET() {
  const [guides, states, cities, compare, loanTypes, propertyTypes, profiles] = await Promise.all([
    getCollection("guides"),
    getCollection("states"),
    getCollection("cities"),
    getCollection("comparisons"),
    getCollection("loanTypes"),
    getCollection("propertyTypes"),
    getCollection("investorProfiles"),
  ]);

  const tools = [
    { title: "Cap Rate & NOI Calculator", url: "/tools/cap-rate-noi-calculator/" },
    { title: "Debt Yield Calculator", url: "/tools/debt-yield-calculator/" },
    { title: "Commercial DSCR Calculator", url: "/tools/commercial-dscr-calculator/" },
    { title: "Cash-on-Cash Calculator", url: "/tools/cash-on-cash-calculator/" },
    { title: "Loan Sizing Calculator", url: "/tools/loan-sizing-calculator/" },
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
    `- Free Deal Review: ${SITE_URL}/deal-review/`,
    `- Learn: ${SITE_URL}/learn/`,
    `- Tools: ${SITE_URL}/tools/`,
    `- States: ${SITE_URL}/states/`,
    `- Cities: ${SITE_URL}/cities/`,
    `- AI policy: ${SITE_URL}/.well-known/ai.txt`,
    "",
    "## Tools",
    ...tools.map((tool) => `- ${tool.title}: ${SITE_URL}${tool.url}`),
    "",
    "## Guides",
    ...guides.map((entry) => `- ${entry.data.title}: ${SITE_URL}/learn/${entry.id.replace(/\.mdx$/, "")}/`),
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
    "## Compare",
    ...compare.map((entry) => `- ${entry.data.title}: ${SITE_URL}/compare/${entry.id.replace(/\.mdx$/, "")}/`),
    "",
    "## Investor profiles",
    ...profiles.map((entry) => `- ${entry.data.title}: ${SITE_URL}/invest/${entry.id.replace(/\.mdx$/, "")}/`),
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

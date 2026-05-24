import { getCollection } from "astro:content";

import { SITE_LAST_REVIEWED,SITE_URL } from "@/consts";

export async function GET() {
  const [guides, tools, states, compare] = await Promise.all([
    getCollection("guides"),
    Promise.resolve([
      { title: "Cap Rate & NOI Calculator", url: "/tools/cap-rate-noi-calculator/" },
      { title: "Debt Yield Calculator", url: "/tools/debt-yield-calculator/" },
      { title: "Commercial DSCR Calculator", url: "/tools/commercial-dscr-calculator/" },
      { title: "Cash-on-Cash Calculator", url: "/tools/cash-on-cash-calculator/" },
      { title: "Loan Sizing Calculator", url: "/tools/loan-sizing-calculator/" },
    ]),
    getCollection("states"),
    getCollection("comparisons"),
  ]);

  const lines = [
    "# Multi-Family USA",
    "",
    `> Last reviewed: ${SITE_LAST_REVIEWED}`,
    "> Scope: US commercial multifamily financing (5+ units)",
    "",
    "## Key pages",
    `- Home: ${SITE_URL}/`,
    `- Free Deal Review: ${SITE_URL}/deal-review/`,
    `- Tools: ${SITE_URL}/tools/`,
    "",
    "## Tools",
    ...tools.map((tool) => `- ${tool.title}: ${SITE_URL}${tool.url}`),
    "",
    "## Guides",
    ...guides.slice(0, 10).map((entry) => `- ${entry.data.title}: ${SITE_URL}/learn/${entry.id.replace(/\.mdx$/, "")}/`),
    "",
    "## States",
    ...states.slice(0, 15).map((entry) => `- ${entry.data.stateName}: ${SITE_URL}/states/${entry.id.replace(/\.mdx$/, "")}/`),
    "",
    "## Compare",
    ...compare.map((entry) => `- ${entry.data.title}: ${SITE_URL}/compare/${entry.id.replace(/\.mdx$/, "")}/`),
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

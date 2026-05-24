import { getCollection } from "astro:content";

import { SITE_URL } from "@/consts";

function linesFor(collection: Awaited<ReturnType<typeof getCollection>>, basePath: string) {
  return collection.map((entry) => {
    const slug = entry.id.replace(/\.mdx$/, "");
    return [
      `### ${entry.data.title}`,
      `URL: ${SITE_URL}${basePath}/${slug}/`,
      `Description: ${entry.data.description}`,
      "",
    ].join("\n");
  });
}

export async function GET() {
  const [guides, states, cities, loanTypes, propertyTypes, comparisons, profiles, blog] = await Promise.all([
    getCollection("guides"),
    getCollection("states"),
    getCollection("cities"),
    getCollection("loanTypes"),
    getCollection("propertyTypes"),
    getCollection("comparisons"),
    getCollection("investorProfiles"),
    getCollection("blog"),
  ]);

  const sections = [
    "# Multi-Family USA Full Content Index",
    "",
    "## Guides",
    ...linesFor(guides, "/learn"),
    "## States",
    ...linesFor(states, "/states"),
    "## Cities",
    ...linesFor(cities, "/cities"),
    "## Loan Types",
    ...linesFor(loanTypes, "/loan-types"),
    "## Property Types",
    ...linesFor(propertyTypes, "/property-types"),
    "## Comparisons",
    ...linesFor(comparisons, "/compare"),
    "## Investor Profiles",
    ...linesFor(profiles, "/invest"),
    "## Blog",
    ...linesFor(blog, "/blog"),
  ];

  return new Response(sections.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

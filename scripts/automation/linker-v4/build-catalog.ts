// ============================================
// Smart Linker v4 — Build Page Catalog
// ============================================
// Discovers all linkable pages from source files and builds:
// 1. Raw catalog data (deterministic, no API)
// 2. Compact catalog markdown (for use in link prompts)
// 3. An enrichment prompt for an agent to generate purpose cards
//
// After running this, ask an agent to read the enrichment prompt
// and generate the enriched page-catalog.json.

import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import type { CLIOptions } from "../types";
import type { RawPageData } from "./types";
import { loadMarkdownFiles, extractExcerpt, BLOG_DIR, QUEUE_DIR } from "./parse";
import { CATEGORY_LABELS } from "./catalog-utils";

// ----------------
// Inputs Hash (skip-when-up-to-date)
// ----------------
//
// The catalog build is expensive (reads hundreds of blog posts, rebuilds the
// link graph + semantic index + OpenAI embedding index). Three GitHub Actions
// workflows invoke it per article publish cycle (article-scheduler.yml,
// podcast-publisher.yml, smart-linker.yml). To avoid redundant OpenAI embedding
// API calls, we fingerprint the set of inputs and skip the build early when
// the stored fingerprint matches.
//
// Inputs hashed: sorted list of [slug, mtimeMs] for every file that contributes
// to the catalog — blog posts, queue drafts, glossary terms — plus the mtime
// of this source file itself (so edits to the hard-coded PILLAR_PAGES list
// invalidate the cache). Full file contents are NOT hashed (too slow).

const INPUTS_HASH_VERSION = 1;

async function collectDirEntries(
  dir: string
): Promise<Array<{ slug: string; mtimeMs: number }>> {
  const absDir = path.resolve(dir);
  let entries: string[];
  try {
    entries = await fs.readdir(absDir);
  } catch {
    return [];
  }
  const mdFiles = entries.filter((f) => /\.mdx?$/.test(f));
  const results = await Promise.all(
    mdFiles.map(async (file) => {
      const stat = await fs.stat(path.join(absDir, file));
      return { slug: file.replace(/\.mdx?$/, ""), mtimeMs: stat.mtimeMs };
    })
  );
  results.sort((a, b) => a.slug.localeCompare(b.slug));
  return results;
}

async function computeInputsHash(): Promise<string> {
  const [blog, queue, loanTypes, guides, propertyTypes, comparisons] = await Promise.all([
    collectDirEntries(BLOG_DIR),
    collectDirEntries(QUEUE_DIR),
    collectDirEntries("src/content/loan-types"),
    collectDirEntries("src/content/guides"),
    collectDirEntries("src/content/property-types"),
    collectDirEntries("src/content/comparisons"),
  ]);

  // Fingerprint this source file too, so edits to the hard-coded page lists
  // (PILLAR_PAGES/TOOL_PAGES/OTHER_PAGES) invalidate the cache.
  let selfMtime = 0;
  try {
    const stat = await fs.stat(new URL(import.meta.url));
    selfMtime = stat.mtimeMs;
  } catch {
    // URL form may fail in some runtimes; fall back to the known relative path.
    try {
      const stat = await fs.stat(
        path.resolve("scripts/automation/linker-v4/build-catalog.ts")
      );
      selfMtime = stat.mtimeMs;
    } catch {
      // give up — hash still reflects content changes
    }
  }

  const payload = JSON.stringify({
    v: INPUTS_HASH_VERSION,
    blog,
    queue,
    loanTypes,
    guides,
    propertyTypes,
    comparisons,
    selfMtime,
  });
  return createHash("sha256").update(payload).digest("hex");
}

async function readStoredInputsHash(
  rawCatalogPath: string
): Promise<string | null> {
  try {
    const raw = await fs.readFile(rawCatalogPath, "utf-8");
    const parsed = JSON.parse(raw) as { _inputsHash?: string };
    return parsed._inputsHash ?? null;
  } catch {
    return null;
  }
}


// ----------------
// Known Pages (Multi-Family USA site structure)
// ----------------

const PILLAR_PAGES: RawPageData[] = [
  {
    slug: "loan-types",
    url: "/loan-types/",
    title: "Multifamily Loan Types",
    type: "pillar",
    description:
      "Compare agency, bridge, bank, CMBS, debt fund, FHA/HUD, and Freddie Mac Optigo multifamily loan executions for US 5+ unit properties.",
    category: "capital-markets",
    tags: ["multifamily", "commercial-financing", "agency", "bridge"],
    region: "usa",
  },
  {
    slug: "property-types",
    url: "/property-types/",
    title: "Multifamily Property Types",
    type: "pillar",
    description:
      "Financing and underwriting guides for garden-style, mid-rise, suburban, and value-add C-class multifamily assets.",
    category: "fundamentals",
    tags: ["multifamily", "property-types"],
    region: "usa",
  },
  {
    slug: "learn",
    url: "/learn/",
    title: "Multifamily Financing Guides",
    type: "pillar",
    description:
      "Plain-English guides covering commercial DSCR, debt yield, NOI normalization, agency vs bridge, and closing checklists.",
    category: "fundamentals",
    tags: ["education", "underwriting", "multifamily"],
    region: "usa",
  },
  {
    slug: "tools",
    url: "/tools/",
    title: "Multifamily Underwriting Calculators",
    type: "pillar",
    description:
      "Free commercial DSCR, cap rate / NOI, debt yield, cash-on-cash, and loan sizing calculators for multifamily sponsors.",
    category: "underwriting",
    tags: ["tools", "dscr-loans", "underwriting"],
    region: "usa",
  },
  {
    slug: "states",
    url: "/states/",
    title: "Multifamily Financing by State",
    type: "pillar",
    description:
      "State-by-state multifamily financing overviews covering tax, foreclosure, rent control, and capital market context.",
    category: "fundamentals",
    tags: ["markets", "states"],
    region: "usa",
  },
  {
    slug: "cities",
    url: "/cities/",
    title: "Multifamily Financing by City",
    type: "pillar",
    description:
      "City-level multifamily market snapshots with pricing, rents, and financing implications for US apartment investors.",
    category: "fundamentals",
    tags: ["markets", "cities"],
    region: "usa",
  },
  {
    slug: "compare",
    url: "/compare/",
    title: "Compare Multifamily Capital Options",
    type: "pillar",
    description:
      "Side-by-side comparisons of agency vs bridge, bank vs debt fund, fixed vs floating, recourse, CMBS, and FHA paths.",
    category: "capital-markets",
    tags: ["compare", "capital-stack"],
    region: "usa",
  },
  {
    slug: "invest",
    url: "/invest/",
    title: "Investor Playbooks",
    type: "pillar",
    description:
      "Capital strategy playbooks for first-time buyers, value-add sponsors, small portfolio operators, and institutional growth.",
    category: "fundamentals",
    tags: ["investing", "sponsors"],
    region: "usa",
  },
  {
    slug: "checklists",
    url: "/checklists/",
    title: "Multifamily Financing Checklists",
    type: "pillar",
    description:
      "Due diligence, lender document, and pro forma checklists for commercial multifamily debt execution.",
    category: "execution",
    tags: ["checklists", "execution"],
    region: "usa",
  },
  {
    slug: "rates",
    url: "/rates/",
    title: "Multifamily Rate Context",
    type: "pillar",
    description:
      "Current multifamily rate and spread context for agency, bridge, and bank executions.",
    category: "rates",
    tags: ["rates", "spreads"],
    region: "usa",
  },
  {
    slug: "book-strategy-call",
    url: "/book-strategy-call/",
    title: "Book a Strategy Call",
    type: "pillar",
    description:
      "Book a free multifamily strategy call with Multi-Family USA to review debt structure and lender fit.",
    category: "execution",
    tags: ["booking"],
    region: "usa",
  },
  {
    slug: "deal-review",
    url: "/deal-review/",
    title: "Free Multifamily Deal Review",
    type: "pillar",
    description:
      "Submit a multifamily deal for a free lender-fit and underwriting review.",
    category: "execution",
    tags: ["deal-review"],
    region: "usa",
  },
];

const TOOL_PAGES: RawPageData[] = [
  {
    slug: "tools/commercial-dscr-calculator",
    url: "/tools/commercial-dscr-calculator/",
    title: "Commercial DSCR Calculator",
    type: "page",
    description:
      "Calculate commercial debt service coverage ratio for US multifamily (5+ unit) deals.",
    category: "underwriting",
    tags: ["dscr-loans", "tools", "underwriting"],
    region: "usa",
  },
  {
    slug: "tools/cap-rate-noi-calculator",
    url: "/tools/cap-rate-noi-calculator/",
    title: "Cap Rate & NOI Calculator",
    type: "page",
    description:
      "Calculate cap rate and net operating income for multifamily acquisitions and refinances.",
    category: "underwriting",
    tags: ["cap-rate", "noi", "tools"],
    region: "usa",
  },
  {
    slug: "tools/debt-yield-calculator",
    url: "/tools/debt-yield-calculator/",
    title: "Debt Yield Calculator",
    type: "page",
    description:
      "Calculate debt yield — the binding constraint on many agency and CMBS multifamily term sheets.",
    category: "underwriting",
    tags: ["debt-yield", "tools", "underwriting"],
    region: "usa",
  },
  {
    slug: "tools/loan-sizing-calculator",
    url: "/tools/loan-sizing-calculator/",
    title: "Loan Sizing Calculator",
    type: "page",
    description:
      "Size multifamily loan proceeds using DSCR, debt yield, and LTV constraints.",
    category: "qualification",
    tags: ["loan-sizing", "tools", "underwriting"],
    region: "usa",
  },
  {
    slug: "tools/cash-on-cash-calculator",
    url: "/tools/cash-on-cash-calculator/",
    title: "Cash-on-Cash Calculator",
    type: "page",
    description:
      "Calculate cash-on-cash return for leveraged multifamily investments.",
    category: "underwriting",
    tags: ["cash-on-cash", "tools"],
    region: "usa",
  },
];

const OTHER_PAGES: RawPageData[] = [
  {
    slug: "checklists/due-diligence-checklist",
    url: "/checklists/due-diligence-checklist/",
    title: "Multifamily Due Diligence Checklist",
    type: "page",
    description: "Due diligence checklist for US commercial multifamily acquisitions.",
    category: "execution",
    tags: ["checklists", "due-diligence"],
    region: "usa",
  },
  {
    slug: "checklists/lender-document-checklist",
    url: "/checklists/lender-document-checklist/",
    title: "Lender Document Checklist",
    type: "page",
    description: "Document package checklist lenders expect for multifamily debt.",
    category: "execution",
    tags: ["checklists", "lender-docs"],
    region: "usa",
  },
  {
    slug: "checklists/pro-forma-template",
    url: "/checklists/pro-forma-template/",
    title: "Multifamily Pro Forma Template",
    type: "page",
    description: "Pro forma structure lenders expect for multifamily underwriting.",
    category: "execution",
    tags: ["checklists", "pro-forma"],
    region: "usa",
  },
  {
    slug: "glossary",
    url: "/glossary/",
    title: "Multifamily Financing Glossary",
    type: "page",
    description: "Definitions for commercial multifamily financing and underwriting terms.",
    category: "fundamentals",
    tags: ["education", "glossary"],
    region: "usa",
  },
  {
    slug: "about",
    url: "/about/",
    title: "About Multi-Family USA",
    type: "page",
    description: "About Multi-Family USA — commercial multifamily financing resource.",
    category: "fundamentals",
    tags: [],
    region: "usa",
  },
];

const CONTENT_COLLECTIONS: Array<{
  dir: string;
  urlPrefix: string;
  type: "page";
  category: string;
  defaultTags: string[];
}> = [
  {
    dir: "src/content/loan-types",
    urlPrefix: "/loan-types",
    type: "page",
    category: "capital-markets",
    defaultTags: ["loan-types", "multifamily"],
  },
  {
    dir: "src/content/property-types",
    urlPrefix: "/property-types",
    type: "page",
    category: "fundamentals",
    defaultTags: ["property-types", "multifamily"],
  },
  {
    dir: "src/content/guides",
    urlPrefix: "/learn",
    type: "page",
    category: "fundamentals",
    defaultTags: ["guides", "education"],
  },
  {
    dir: "src/content/comparisons",
    urlPrefix: "/compare",
    type: "page",
    category: "capital-markets",
    defaultTags: ["compare"],
  },
  {
    dir: "src/content/investor-profiles",
    urlPrefix: "/invest",
    type: "page",
    category: "fundamentals",
    defaultTags: ["invest", "sponsors"],
  },
];

async function discoverContentCollection(
  coll: (typeof CONTENT_COLLECTIONS)[number]
): Promise<RawPageData[]> {
  const absDir = path.resolve(coll.dir);
  let entries: string[];
  try {
    entries = await fs.readdir(absDir);
  } catch {
    return [];
  }

  const pages: RawPageData[] = [];
  for (const file of entries.filter((f) => /\.mdx?$/.test(f))) {
    const filePath = path.join(absDir, file);
    const raw = await fs.readFile(filePath, "utf-8");
    let data: Record<string, unknown>;
    try {
      ({ data } = await import("gray-matter").then((m) => m.default(raw)));
    } catch {
      console.warn(`⚠ Skipping ${coll.dir}/${file}: YAML parse error`);
      continue;
    }
    const slug = file.replace(/\.mdx?$/, "");
    const title = String(data.title || slug);
    if (!title) continue;
    pages.push({
      slug: `${coll.urlPrefix.replace(/^\//, "")}/${slug}`,
      url: `${coll.urlPrefix}/${slug}/`,
      title,
      type: coll.type,
      description: String(data.description || ""),
      category: String(data.category || coll.category),
      tags: [...coll.defaultTags, ...((data.keywords as string[]) || [])].slice(0, 8),
      region: "usa",
    });
  }
  return pages;
}

async function discoverAllContentPages(): Promise<RawPageData[]> {
  const batches = await Promise.all(CONTENT_COLLECTIONS.map(discoverContentCollection));
  return batches.flat();
}

// ----------------
// Glossary Discovery (optional — MFUSA uses a single glossary page)
// ----------------

async function discoverGlossaryTerms(): Promise<RawPageData[]> {
  return [];
}

// ----------------
// Blog & Queue Discovery
// ----------------

function articleToRawPage(
  article: Awaited<ReturnType<typeof loadMarkdownFiles>>[0],
  type: "post" | "queue"
): RawPageData {
  const fm = article.frontmatter;
  return {
    slug: article.slug,
    url: `/blog/${article.slug}/`,
    title: String(fm.title || article.slug),
    type,
    description: String(fm.description || ""),
    category: String(fm.category || "fundamentals"),
    tags: (fm.tags as string[]) || [],
    region: String(fm.region || "usa"),
    excerpt: extractExcerpt(article.body, 2),
  };
}

// ----------------
// Main Function
// ----------------

export async function buildCatalog(options: CLIOptions): Promise<void> {
  console.log("Building page catalog from source files...\n");

  // Step 0: Fingerprint inputs — skip early if unchanged (unless --force).
  // This is the fast-path for the three workflows that all build the catalog
  // on every publish cycle; only the first call in a given commit does work.
  const dataDir = path.resolve("src/data/linker-v4");
  const rawCatalogPath = path.join(dataDir, "raw-catalog.json");
  const inputsHash = await computeInputsHash();

  if (!options.force) {
    const stored = await readStoredInputsHash(rawCatalogPath);
    if (stored && stored === inputsHash) {
      console.log(
        `Catalog up-to-date (inputs hash ${inputsHash.slice(0, 12)}) — skipping build.`
      );
      console.log(`  Use --force to rebuild anyway.`);
      return;
    }
    if (stored) {
      console.log(
        `Inputs changed (old: ${stored.slice(0, 12)} → new: ${inputsHash.slice(0, 12)}) — rebuilding.`
      );
    }
  } else {
    console.log(`--force: rebuilding catalog regardless of inputs hash.`);
  }

  // Step 1: Collect all pages
  const blogPosts = await loadMarkdownFiles(BLOG_DIR);
  const queueArticles = await loadMarkdownFiles(QUEUE_DIR);
  const contentPages = await discoverAllContentPages();
  const glossaryTerms = await discoverGlossaryTerms();

  console.log(`  Blog posts: ${blogPosts.length}`);
  console.log(`  Queue articles: ${queueArticles.length}`);
  console.log(`  Content collection pages: ${contentPages.length}`);
  console.log(`  Glossary terms: ${glossaryTerms.length}`);
  console.log(`  Pillar/service pages: ${PILLAR_PAGES.length}`);
  console.log(`  Tool pages: ${TOOL_PAGES.length}`);
  console.log(`  Other pages: ${OTHER_PAGES.length}`);

  // Convert to raw page data
  const allPages: RawPageData[] = [
    ...PILLAR_PAGES,
    ...TOOL_PAGES,
    ...OTHER_PAGES,
    ...contentPages,
    ...glossaryTerms,
    ...blogPosts.map((p) => articleToRawPage(p, "post")),
    ...queueArticles.map((p) => articleToRawPage(p, "queue")),
  ];

  const totalPages = allPages.length;
  console.log(`\n  Total linkable pages: ${totalPages}`);

  // Step 2: Write raw catalog data (tagged with inputs hash so subsequent
  // runs in the same commit can short-circuit the build).
  await fs.mkdir(dataDir, { recursive: true });

  await fs.writeFile(
    rawCatalogPath,
    JSON.stringify(
      {
        _inputsHash: inputsHash,
        generatedAt: new Date().toISOString(),
        totalPages,
        pages: allPages,
      },
      null,
      2
    )
  );
  console.log(`\n  Raw catalog: ${rawCatalogPath}`);

  // Step 2b: Enrich catalog with pillar intent + blog frontmatter heuristics
  const { enrichPageCatalog } = await import("./enrich-catalog");
  await enrichPageCatalog();

  // Step 3: Build compact catalogs (for use in link prompts)
  // Full catalog (includes queue) — used for reference only
  const compactCatalogFull = buildCompactCatalog(allPages);
  const compactFullPath = path.join(dataDir, "compact-catalog-full.md");
  await fs.writeFile(compactFullPath, compactCatalogFull);
  console.log(`  Full compact catalog: ${compactFullPath}`);

  // Published-only catalog — used in link prompts (smaller, no queue articles)
  const publishedPages = allPages.filter((p) => p.type !== "queue");
  const compactCatalog = buildCompactCatalog(publishedPages);
  const compactPath = path.join(dataDir, "compact-catalog.md");
  await fs.writeFile(compactPath, compactCatalog);
  console.log(`  Link prompt catalog: ${compactPath} (${publishedPages.length} pages — no queue)`);

  // Step 4: Write the enrichment prompt for an agent
  const promptDir = path.join(dataDir, "prompts");
  await fs.mkdir(promptDir, { recursive: true });
  const promptPath = path.join(promptDir, "catalog-build-prompt.md");
  const enrichmentPrompt = buildEnrichmentPrompt(allPages);
  await fs.writeFile(promptPath, enrichmentPrompt);
  console.log(`  Enrichment prompt: ${promptPath}`);

  console.log(`\nCatalog build complete.`);
  console.log(`  Enriched catalog: ${path.join(dataDir, "page-catalog.json")}`);

  // Auto-build link graph
  console.log("\nBuilding link graph...");
  const { buildLinkGraph } = await import("./link-graph");
  await buildLinkGraph();

  // Auto-build semantic index
  console.log("\nBuilding semantic index...");
  const { buildSemanticIndex } = await import("./semantic-filter");
  await buildSemanticIndex();

  // Auto-build embedding index (GitHub Actions / explicit API only)
  if (!options.noApi && process.env.OPENAI_API_KEY) {
    console.log("\nBuilding embedding index...");
    const { buildEmbeddingIndex } = await import("./embeddings");
    await buildEmbeddingIndex();
  } else {
    console.log("\n  Skipping embedding index (local/no-api — TF-IDF retrieval only)");
  }
}

// ----------------
// Compact Catalog Builder
// ----------------

function buildCompactCatalog(pages: RawPageData[]): string {
  const lines: string[] = [];
  lines.push("# Multi-Family USA Site — All Linkable Pages");
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push(`# Total: ${pages.length} pages\n`);

  // Group pages by type
  const pillarPages = pages.filter(
    (p) =>
      p.type === "pillar" ||
      (p.type === "page" && !p.slug.startsWith("glossary/"))
  );
  const blogPages = pages.filter((p) => p.type === "post");
  const queuePages = pages.filter((p) => p.type === "queue");
  const glossaryPages = pages.filter(
    (p) => p.type === "page" && p.slug.startsWith("glossary/")
  );

  // Service & Financing Pages
  lines.push("## Service & Financing Pages");
  for (const p of pillarPages) {
    lines.push(`- ${p.title} (${p.url}) — ${p.description}${p.tags?.length ? ` [${p.tags.join(", ")}]` : ""}`);
  }

  // Blog posts grouped by category
  const blogByCategory = groupByCategory(blogPages);
  for (const [category, catPages] of Object.entries(blogByCategory)) {
    const label = CATEGORY_LABELS[category] || category;
    lines.push(`\n## ${label} Articles`);
    for (const p of catPages) {
      lines.push(`- ${p.title} (${p.url}) — ${p.description}${p.tags?.length ? ` [${p.tags.join(", ")}]` : ""}`);
    }
  }

  // Queue articles grouped by category
  if (queuePages.length > 0) {
    const queueByCategory = groupByCategory(queuePages);
    for (const [category, catPages] of Object.entries(queueByCategory)) {
      const label = CATEGORY_LABELS[category] || category;
      lines.push(`\n## Upcoming: ${label}`);
      for (const p of catPages) {
        lines.push(`- ${p.title} (${p.url}) — ${p.description}${p.tags?.length ? ` [${p.tags.join(", ")}]` : ""}`);
      }
    }
  }

  // Glossary terms
  if (glossaryPages.length > 0) {
    lines.push(`\n## Glossary Terms`);
    for (const p of glossaryPages) {
      lines.push(`- ${p.title} (${p.url}) — ${p.description}${p.tags?.length ? ` [${p.tags.join(", ")}]` : ""}`);
    }
  }

  return lines.join("\n");
}

function groupByCategory(
  pages: RawPageData[]
): Record<string, RawPageData[]> {
  const groups: Record<string, RawPageData[]> = {};
  for (const page of pages) {
    const cat = page.category || "other";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(page);
  }
  return groups;
}

// ----------------
// Enrichment Prompt Builder
// ----------------

function buildEnrichmentPrompt(pages: RawPageData[]): string {
  // Only pillar and tool pages need enrichment
  const pagesNeedingEnrichment = pages.filter(
    (p) =>
      p.type === "pillar" ||
      (p.type === "page" && !p.slug.startsWith("glossary/"))
  );

  const lines: string[] = [];
  lines.push("# Page Catalog Enrichment Task\n");
  lines.push(
    "You are helping build a page catalog for an internal linking system."
  );
  lines.push(
    "For each page below, generate a **purpose card** that describes what the page delivers to readers.\n"
  );
  lines.push("## Output Format\n");
  lines.push(
    "Return a JSON array of objects with this structure for each page:"
  );
  lines.push("```json");
  lines.push(`{
  "slug": "the-page-slug",
  "readerPromise": "One sentence: what the reader gets by visiting this page",
  "topicsCovered": ["topic1", "topic2", "topic3"],
  "questionsAnswered": ["What is X?", "How do I Y?"],
  "linkWhen": ["when the article discusses X", "when the reader needs help with Y"],
  "doNotLinkWhen": ["when the article only mentions X in passing", "when the context is about Z not Y"]
}`);
  lines.push("```\n");
  lines.push("## Guidelines\n");
  lines.push(
    "- **readerPromise**: Be specific about what the READER gets, not what the PAGE contains."
  );
  lines.push(
    "  Example: 'Learn how DSCR loans let you qualify for US rentals using property income instead of personal income'"
  );
  lines.push("- **topicsCovered**: 5-8 specific topics covered in depth");
  lines.push(
    "- **questionsAnswered**: 3-5 real questions a reader can get answered"
  );
  lines.push(
    "- **linkWhen**: 3-5 contexts in a blog post where linking helps the reader"
  );
  lines.push(
    "- **doNotLinkWhen**: 2-4 contexts where linking would mislead the reader"
  );
  lines.push(
    "  Example: linking to DSCR page when the article is about Canadian conventional mortgages"
  );
  lines.push("\n## Pages to Enrich\n");

  for (const page of pagesNeedingEnrichment) {
    lines.push(`### ${page.title}`);
    lines.push(`- **URL**: ${page.url}`);
    lines.push(`- **Type**: ${page.type}`);
    lines.push(`- **Description**: ${page.description}`);
    lines.push(`- **Region**: ${page.region}`);
    lines.push(`- **Tags**: ${page.tags.join(", ") || "none"}`);
    lines.push("");
  }

  return lines.join("\n");
}

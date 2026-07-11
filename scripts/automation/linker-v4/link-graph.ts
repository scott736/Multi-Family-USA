// ============================================
// Smart Linker v4 — Link Graph Intelligence
// ============================================
// Builds a directed graph of internal links across blog posts and pages.
// Includes PageRank, near-orphan detection, link density scoring,
// and auto-focus page generation.

import fs from "fs/promises";
import path from "path";
import { loadMarkdownFiles, parseBody, BLOG_DIR, BLOG_LANGS } from "./parse";
import { normalizeUrl } from "./catalog-utils";
import type {
  LinkGraphNode,
  LinkGraphData,
  LinkHealthReport,
  RawPageData,
  FocusPagesConfig,
  FocusPageEntry,
} from "./types";

// ----------------
// Constants
// ----------------

const DATA_DIR = "src/data/linker-v4";
const GRAPH_PATH = path.join(DATA_DIR, "link-graph.json");
const FOCUS_PAGES_PATH = path.join(DATA_DIR, "focus-pages.json");

// Density thresholds (links per 500 words)
const OVER_LINKED_DENSITY = 5.0;
const UNDER_LINKED_DENSITY = 0.5;

// Manual focus page reasons — preserved during auto-generation
const MANUAL_REASONS = new Set(["manual", "seo-target", "high-value"]);

// ----------------
// Link Extraction
// ----------------

function extractInternalLinks(body: string): string[] {
  const urls: string[] = [];

  // Markdown links: [text](url)
  const mdRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = mdRegex.exec(body)) !== null) {
    const url = match[2];
    if (url.startsWith("/")) {
      urls.push(normalizeUrl(url.split("#")[0].split("?")[0]));
    }
  }

  // HTML links: <a href="url">
  const htmlRegex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>/gi;
  while ((match = htmlRegex.exec(body)) !== null) {
    const url = match[1];
    if (url.startsWith("/")) {
      urls.push(normalizeUrl(url.split("#")[0].split("?")[0]));
    }
  }

  // Deduplicate per-page
  return [...new Set(urls)];
}

// ----------------
// Word Count
// ----------------

function countWords(markdown: string): number {
  // Strip markdown syntax for a rough word count
  const stripped = markdown
    .replace(/```[\s\S]*?```/g, "")    // code blocks
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[[^\]]*\]\([^)]*\)/g, (m) => m.replace(/\[([^\]]*)\]\([^)]*\)/, "$1")) // keep link text
    .replace(/<[^>]+>/g, "")            // HTML tags
    .replace(/#{1,6}\s/g, "")           // heading markers
    .replace(/[*_~`>|]/g, "")           // inline formatting
    .replace(/---/g, "");               // horizontal rules
  return stripped.split(/\s+/).filter((w) => w.length > 0).length;
}

// ----------------
// Scan .astro Pages
// ----------------

async function scanAstroPages(): Promise<Map<string, string[]>> {
  const astroDir = path.resolve("src/pages");
  const pageLinks = new Map<string, string[]>();

  // Read top-level .astro files (pillar/service pages)
  const files = await fs.readdir(astroDir);
  for (const file of files) {
    if (!file.endsWith(".astro")) continue;
    const filePath = path.join(astroDir, file);
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) continue;

    const content = await fs.readFile(filePath, "utf-8");
    const slug = file.replace(".astro", "");
    const url = normalizeUrl(`/${slug}`);

    // Extract internal links from the .astro template content
    const links = extractInternalLinks(content);
    if (links.length > 0) {
      pageLinks.set(url, links);
    }
  }

  return pageLinks;
}

// ----------------
// PageRank
// ----------------

function computePageRank(
  nodes: Record<string, LinkGraphNode>,
  dampingFactor = 0.85,
  maxIterations = 100,
  convergenceThreshold = 0.0001
): void {
  const urls = Object.keys(nodes);
  const n = urls.length;
  if (n === 0) return;

  // Initialize all nodes with PR = 1/N
  const pr: Record<string, number> = {};
  for (const url of urls) {
    pr[url] = 1 / n;
  }

  // Build reverse adjacency (who links TO each node)
  const inbound: Record<string, string[]> = {};
  for (const url of urls) {
    inbound[url] = nodes[url].inboundFrom;
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    const newPr: Record<string, number> = {};
    let maxDelta = 0;

    // Collect dangling node rank (nodes with 0 outbound)
    let danglingRank = 0;
    for (const url of urls) {
      if (nodes[url].outboundCount === 0) {
        danglingRank += pr[url];
      }
    }

    for (const url of urls) {
      // Base: uniform distribution from random jumps + dangling node redistribution
      let rank = (1 - dampingFactor) / n + (dampingFactor * danglingRank) / n;

      // Sum contributions from inbound links
      for (const sourceUrl of inbound[url]) {
        const sourceNode = nodes[sourceUrl];
        if (sourceNode && sourceNode.outboundCount > 0) {
          rank += (dampingFactor * pr[sourceUrl]) / sourceNode.outboundCount;
        }
      }

      newPr[url] = rank;
      const delta = Math.abs(rank - pr[url]);
      if (delta > maxDelta) maxDelta = delta;
    }

    // Update PR values
    for (const url of urls) {
      pr[url] = newPr[url];
    }

    // Check convergence
    if (maxDelta < convergenceThreshold) {
      console.log(`  PageRank converged after ${iter + 1} iterations`);
      break;
    }
  }

  // Normalize so they sum to 1
  const total = Object.values(pr).reduce((sum, v) => sum + v, 0);
  for (const url of urls) {
    nodes[url].pageRank = Math.round((pr[url] / total) * 1e6) / 1e6;
  }
}

// ----------------
// Link Density Scoring
// ----------------

async function computeLinkDensity(
  nodes: Record<string, LinkGraphNode>,
  blogPosts: Array<{ slug: string; rawContent: string }>
): Promise<void> {
  // Build a map of slug -> raw content for quick lookup
  const postContentMap = new Map<string, string>();
  for (const post of blogPosts) {
    postContentMap.set(post.slug, post.rawContent);
  }

  for (const node of Object.values(nodes)) {
    if (node.type !== "post") continue;

    const rawContent = postContentMap.get(node.slug);
    if (!rawContent) continue;

    const body = parseBody(rawContent);
    const words = countWords(body);
    node.wordCount = words;

    if (words > 0) {
      node.outboundDensity = Math.round((node.outboundCount / words) * 500 * 100) / 100;
      node.isOverLinked = node.outboundDensity > OVER_LINKED_DENSITY;
      node.isUnderLinked = node.outboundDensity < UNDER_LINKED_DENSITY;
    }
  }
}

// ----------------
// Auto-Focus Page Generation
// ----------------

async function autoGenerateFocusPages(graph: LinkGraphData): Promise<void> {
  const focusPath = path.resolve(FOCUS_PAGES_PATH);
  let existingConfig: FocusPagesConfig | null = null;

  try {
    const raw = await fs.readFile(focusPath, "utf-8");
    existingConfig = JSON.parse(raw) as FocusPagesConfig;
  } catch {
    // No existing file — start fresh
  }

  // Keep manually-added entries
  const manualEntries: FocusPageEntry[] = [];
  if (existingConfig?.pages) {
    for (const entry of existingConfig.pages) {
      if (MANUAL_REASONS.has(entry.reason)) {
        manualEntries.push(entry);
      }
    }
  }

  // Track URLs already in the list
  const seen = new Set(manualEntries.map((e) => normalizeUrl(e.url)));
  const autoEntries: FocusPageEntry[] = [];
  const now = new Date().toISOString();

  const nodeValues = Object.values(graph.nodes);

  // Orphans (0 inbound, excluding pillar pages)
  for (const node of nodeValues) {
    if (node.inboundCount === 0 && node.type !== "pillar") {
      const url = node.url;
      if (!seen.has(normalizeUrl(url))) {
        seen.add(normalizeUrl(url));
        autoEntries.push({ url, reason: "orphan", addedAt: now, addedBy: "link-graph" });
      }
    }
  }

  // Near-orphans (1-2 inbound)
  for (const node of nodeValues) {
    if (node.inboundCount >= 1 && node.inboundCount <= 2) {
      const url = node.url;
      if (!seen.has(normalizeUrl(url))) {
        seen.add(normalizeUrl(url));
        autoEntries.push({ url, reason: "low-inbound", addedAt: now, addedBy: "link-graph" });
      }
    }
  }

  // Fragile pages (all inbound from single source, inbound > 0)
  for (const node of nodeValues) {
    if (node.inboundCount > 0) {
      const sources = new Set(node.inboundFrom);
      if (sources.size === 1) {
        const url = node.url;
        if (!seen.has(normalizeUrl(url))) {
          seen.add(normalizeUrl(url));
          autoEntries.push({ url, reason: "fragile", addedAt: now, addedBy: "link-graph" });
        }
      }
    }
  }

  const allPages = [...manualEntries, ...autoEntries];

  const config: FocusPagesConfig = {
    updatedAt: now,
    description:
      "Pages that should receive priority inbound links. Manual entries (high-value, seo-target, manual) are preserved across rebuilds. Auto entries (orphan, low-inbound, fragile) are regenerated from the link graph.",
    pages: allPages,
  };

  await fs.writeFile(focusPath, JSON.stringify(config, null, 2));
  console.log(`  Focus pages written: ${allPages.length} (${manualEntries.length} manual, ${autoEntries.length} auto)`);
}

// ----------------
// Build Link Graph
// ----------------

export async function buildLinkGraph(): Promise<LinkGraphData> {
  console.log("Building link graph...\n");

  // Load blog posts (all locales — same slug shares one graph node)
  const blogPosts = await loadMarkdownFiles(BLOG_DIR);
  const postsByLang: Array<{ lang: string; posts: Awaited<ReturnType<typeof loadMarkdownFiles>> }> = [];
  for (const lang of BLOG_LANGS) {
    postsByLang.push({ lang, posts: await loadMarkdownFiles(undefined, { lang }) });
  }
  console.log(`  Blog posts loaded: ${blogPosts.length} (en) + ${postsByLang.reduce((n, x) => n + (x.lang === "en" ? 0 : x.posts.length), 0)} localized`);

  // Load catalog for pillar/service/tool pages (non-queue, non-tooltip-only)
  const rawCatalogPath = path.resolve(DATA_DIR, "raw-catalog.json");
  let catalogPages: RawPageData[] = [];
  try {
    const catalog = JSON.parse(await fs.readFile(rawCatalogPath, "utf-8")) as {
      pages: RawPageData[];
    };
    catalogPages = catalog.pages.filter(
      (p) => p.type !== "queue" && !(p.type === "page" && p.isTooltipOnly)
    );
  } catch {
    console.log("  Warning: raw-catalog.json not found, using blog posts only");
  }

  // Build nodes map — start with catalog pages (pillar, page, post from catalog)
  const nodes: Record<string, LinkGraphNode> = {};

  // Add catalog pages as nodes
  for (const page of catalogPages) {
    const url = normalizeUrl(page.url);
    if (!nodes[url]) {
      nodes[url] = {
        slug: page.slug,
        url,
        title: page.title,
        type: page.type,
        inboundCount: 0,
        outboundCount: 0,
        inboundFrom: [],
        outboundTo: [],
      };
    }
  }

  // Add blog posts as nodes (may overlap with catalog posts — prefer existing)
  for (const post of blogPosts) {
    const url = normalizeUrl(`/blog/${post.slug}`);
    if (!nodes[url]) {
      nodes[url] = {
        slug: post.slug,
        url,
        title: String(post.frontmatter.title || post.slug),
        type: "post",
        inboundCount: 0,
        outboundCount: 0,
        inboundFrom: [],
        outboundTo: [],
      };
    }
  }

  console.log(`  Total nodes: ${Object.keys(nodes).length}`);

  // Extract links from all locale variants and build edges
  let totalEdges = 0;

  for (const { posts } of postsByLang) {
  for (const post of posts) {
    const sourceUrl = normalizeUrl(`/blog/${post.slug}`);
    const body = parseBody(post.rawContent);
    const targetUrls = extractInternalLinks(body);

    for (const targetUrl of targetUrls) {
      // Only count links to known pages
      if (!nodes[targetUrl]) continue;

      // Update source outbound
      const sourceNode = nodes[sourceUrl];
      if (sourceNode && !sourceNode.outboundTo.includes(targetUrl)) {
        sourceNode.outboundTo.push(targetUrl);
        sourceNode.outboundCount++;
      }

      // Update target inbound
      const targetNode = nodes[targetUrl];
      if (targetNode && !targetNode.inboundFrom.includes(sourceUrl)) {
        targetNode.inboundFrom.push(sourceUrl);
        targetNode.inboundCount++;
      }

      totalEdges++;
    }
  }
  }

  // Also scan .astro pillar/service pages for outbound links
  const astroLinks = await scanAstroPages();
  for (const [sourceUrl, targetUrls] of astroLinks) {
    for (const targetUrl of targetUrls) {
      if (!nodes[targetUrl]) continue;
      // Only update target inbound (source .astro pages are already nodes from catalog)
      const targetNode = nodes[targetUrl];
      if (targetNode && !targetNode.inboundFrom.includes(sourceUrl)) {
        targetNode.inboundFrom.push(sourceUrl);
        targetNode.inboundCount++;
        totalEdges++;
      }
      // Update source outbound if it's a known node
      const sourceNode = nodes[sourceUrl];
      if (sourceNode && !sourceNode.outboundTo.includes(targetUrl)) {
        sourceNode.outboundTo.push(targetUrl);
        sourceNode.outboundCount++;
      }
    }
  }

  // Compute PageRank
  console.log("\n  Computing PageRank...");
  computePageRank(nodes);

  // Compute link density for blog posts
  console.log("  Computing link density...");
  await computeLinkDensity(nodes, blogPosts);

  // Identify orphan pages (0 inbound, excluding pillar pages)
  const orphanPages = Object.values(nodes)
    .filter((n) => n.inboundCount === 0 && n.type !== "pillar")
    .map((n) => n.url);

  // Identify over-linked pages (20+ inbound)
  const overLinkedPages = Object.values(nodes)
    .filter((n) => n.inboundCount >= 20)
    .map((n) => n.url);

  const graphData: LinkGraphData = {
    generatedAt: new Date().toISOString(),
    totalNodes: Object.keys(nodes).length,
    totalEdges,
    nodes,
    orphanPages,
    overLinkedPages,
  };

  // Write graph to disk
  const graphPath = path.resolve(GRAPH_PATH);
  await fs.mkdir(path.dirname(graphPath), { recursive: true });
  await fs.writeFile(graphPath, JSON.stringify(graphData, null, 2));

  console.log(`\n  Total edges: ${totalEdges}`);
  console.log(`  Orphan pages: ${orphanPages.length}`);
  console.log(`  Over-linked pages: ${overLinkedPages.length}`);
  console.log(`  Graph written to: ${graphPath}`);

  // Auto-generate focus pages
  console.log("\n  Generating focus pages...");
  await autoGenerateFocusPages(graphData);

  return graphData;
}

// ----------------
// Load Link Graph
// ----------------

export async function loadLinkGraph(): Promise<LinkGraphData | null> {
  try {
    const graphPath = path.resolve(GRAPH_PATH);
    const data = await fs.readFile(graphPath, "utf-8");
    return JSON.parse(data) as LinkGraphData;
  } catch {
    return null;
  }
}

// ----------------
// Health Report
// ----------------

export function generateLinkHealthReport(graph: LinkGraphData): LinkHealthReport {
  const nodeValues = Object.values(graph.nodes);
  const totalNodes = nodeValues.length;
  const totalEdges = graph.totalEdges;

  // Orphan pages (0 inbound, excluding pillar pages)
  const orphanPages = nodeValues
    .filter((n) => n.inboundCount === 0 && n.type !== "pillar")
    .map((n) => ({ url: n.url, title: n.title }));

  // Over-linked pages (20+ inbound)
  const overLinkedPages = nodeValues
    .filter((n) => n.inboundCount >= 20)
    .sort((a, b) => b.inboundCount - a.inboundCount)
    .map((n) => ({ url: n.url, title: n.title, inboundCount: n.inboundCount }));

  // Top 10 linked pages
  const topLinkedPages = [...nodeValues]
    .sort((a, b) => b.inboundCount - a.inboundCount)
    .slice(0, 10)
    .map((n) => ({ url: n.url, title: n.title, inboundCount: n.inboundCount }));

  // Near-orphans (1-2 inbound)
  const nearOrphans = nodeValues
    .filter((n) => n.inboundCount >= 1 && n.inboundCount <= 2)
    .map((n) => n.url);

  // Fragile pages (all inbound from a single source, inbound > 0)
  const fragilePages = nodeValues
    .filter((n) => {
      if (n.inboundCount === 0) return false;
      const sources = new Set(n.inboundFrom);
      return sources.size === 1;
    })
    .map((n) => n.url);

  // Over-linked articles by density
  const overLinkedArticles = nodeValues
    .filter((n) => n.isOverLinked === true)
    .map((n) => n.url);

  // Under-linked articles by density
  const underLinkedArticles = nodeValues
    .filter((n) => n.isUnderLinked === true)
    .map((n) => n.url);

  // Averages
  const totalInbound = nodeValues.reduce((sum, n) => sum + n.inboundCount, 0);
  const totalOutbound = nodeValues.reduce((sum, n) => sum + n.outboundCount, 0);
  const averageInbound = totalNodes > 0 ? totalInbound / totalNodes : 0;
  const averageOutbound = totalNodes > 0 ? totalOutbound / totalNodes : 0;

  return {
    totalNodes,
    totalEdges,
    orphanCount: orphanPages.length,
    overLinkedCount: overLinkedPages.length,
    averageInbound: Math.round(averageInbound * 100) / 100,
    averageOutbound: Math.round(averageOutbound * 100) / 100,
    orphanPages,
    overLinkedPages,
    topLinkedPages,
    nearOrphans,
    fragilePages,
    overLinkedArticles,
    underLinkedArticles,
  };
}

// ----------------
// Pretty Print Report
// ----------------

export function printLinkHealthReport(report: LinkHealthReport): void {
  console.log("\n========================================");
  console.log("  Link Graph Health Report");
  console.log("========================================\n");

  console.log(`  Total pages:            ${report.totalNodes}`);
  console.log(`  Total link edges:       ${report.totalEdges}`);
  console.log(`  Avg inbound links:      ${report.averageInbound}`);
  console.log(`  Avg outbound links:     ${report.averageOutbound}`);
  console.log(`  Orphan pages:           ${report.orphanCount}`);
  console.log(`  Near-orphan pages:      ${report.nearOrphans.length}`);
  console.log(`  Fragile pages:          ${report.fragilePages.length}`);
  console.log(`  Over-linked (inbound):  ${report.overLinkedCount}`);
  console.log(`  Over-linked (density):  ${report.overLinkedArticles.length}`);
  console.log(`  Under-linked (density): ${report.underLinkedArticles.length}`);

  if (report.topLinkedPages.length > 0) {
    console.log("\n  Top 10 Most-Linked Pages:");
    for (const page of report.topLinkedPages) {
      console.log(`    ${page.inboundCount} inbound -- ${page.title} (${page.url})`);
    }
  }

  if (report.overLinkedPages.length > 0) {
    console.log("\n  Over-Linked Pages (20+ inbound):");
    for (const page of report.overLinkedPages) {
      console.log(`    ${page.inboundCount} inbound -- ${page.title} (${page.url})`);
    }
  }

  if (report.orphanPages.length > 0) {
    console.log(`\n  Orphan Pages (0 inbound, ${report.orphanCount} total):`);
    const shown = report.orphanPages.slice(0, 20);
    for (const page of shown) {
      console.log(`    ${page.title} (${page.url})`);
    }
    if (report.orphanPages.length > 20) {
      console.log(`    ... and ${report.orphanPages.length - 20} more`);
    }
  }

  if (report.nearOrphans.length > 0) {
    console.log(`\n  Near-Orphan Pages (1-2 inbound, ${report.nearOrphans.length} total):`);
    const shown = report.nearOrphans.slice(0, 15);
    for (const url of shown) {
      console.log(`    ${url}`);
    }
    if (report.nearOrphans.length > 15) {
      console.log(`    ... and ${report.nearOrphans.length - 15} more`);
    }
  }

  if (report.fragilePages.length > 0) {
    console.log(`\n  Fragile Pages (single source, ${report.fragilePages.length} total):`);
    const shown = report.fragilePages.slice(0, 15);
    for (const url of shown) {
      console.log(`    ${url}`);
    }
    if (report.fragilePages.length > 15) {
      console.log(`    ... and ${report.fragilePages.length - 15} more`);
    }
  }

  if (report.overLinkedArticles.length > 0) {
    console.log(`\n  Over-Linked Articles (density > ${OVER_LINKED_DENSITY}, ${report.overLinkedArticles.length} total):`);
    const shown = report.overLinkedArticles.slice(0, 10);
    for (const url of shown) {
      console.log(`    ${url}`);
    }
    if (report.overLinkedArticles.length > 10) {
      console.log(`    ... and ${report.overLinkedArticles.length - 10} more`);
    }
  }

  if (report.underLinkedArticles.length > 0) {
    console.log(`\n  Under-Linked Articles (density < ${UNDER_LINKED_DENSITY}, ${report.underLinkedArticles.length} total):`);
    const shown = report.underLinkedArticles.slice(0, 10);
    for (const url of shown) {
      console.log(`    ${url}`);
    }
    if (report.underLinkedArticles.length > 10) {
      console.log(`    ... and ${report.underLinkedArticles.length - 10} more`);
    }
  }

  console.log("\n========================================\n");
}

// ----------------
// PageRank Report (called separately with graph data)
// ----------------

export function printPageRankTop10(graph: LinkGraphData): void {
  const nodeValues = Object.values(graph.nodes);
  const withPR = nodeValues.filter((n) => n.pageRank !== undefined);

  if (withPR.length === 0) {
    console.log("  No PageRank data available.");
    return;
  }

  const top10 = [...withPR]
    .sort((a, b) => (b.pageRank ?? 0) - (a.pageRank ?? 0))
    .slice(0, 10);

  console.log("  Top 10 PageRank Pages:");
  for (const node of top10) {
    console.log(`    PR ${node.pageRank?.toFixed(6)} -- ${node.title} (${node.url})`);
  }
}

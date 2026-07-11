// ============================================
// Smart Linker — Quality Score (not just orphan count)
// ============================================
//   npx tsx scripts/automation -f linker-v4 -m quality-score
//   npx tsx scripts/automation -f linker-v4 -m quality-score --strict

import fs from "fs/promises";
import path from "path";
import type { CLIOptions } from "../types";
import { buildLinkGraph, loadLinkGraph } from "./link-graph";
import { loadBlogAndCatalog } from "./intent-placement";
import { parseBody } from "./parse";
import { countInternalLinks, normalizeUrl } from "./catalog-utils";
import {
  LEGACY_FORCE_BRIDGE_PATTERNS,
  LINKER_SITE,
} from "./linker-site-config";

export const QUALITY_SCORE_PATH = "src/data/linker-v4/quality-score.json";

export type QualityGrade = "A" | "B" | "C" | "D" | "F";

export interface QualityScoreReport {
  generatedAt: string;
  brand: string;
  grade: QualityGrade;
  scores: {
    orphanRate: number;
    forceBridgeRate: number;
    avgOutboundPerPost: number;
    postsWithZeroOutbound: number;
    postsWithZeroInbound: number;
    forceBridgeParagraphs: number;
    totalBlogPosts: number;
    catalogNodes: number;
    catalogOrphans: number;
    totalEdges: number;
  };
  flags: string[];
  recommendations: string[];
}

function gradeFrom(report: Omit<QualityScoreReport, "grade">): QualityGrade {
  const { scores, flags } = report;
  let pts = 100;
  // Orphans still hurt, but a small residual is normal for new hubs
  pts -= Math.min(35, scores.orphanRate * 100 * 1.5);
  // Marked force-bridges are a safety net — light tax only when dense
  pts -= Math.min(15, Math.max(0, scores.forceBridgeRate - 0.25) * 40);
  if (scores.postsWithZeroOutbound > 0) pts -= Math.min(20, scores.postsWithZeroOutbound * 4);
  if (scores.postsWithZeroInbound > 0) pts -= Math.min(20, scores.postsWithZeroInbound * 4);
  if (scores.avgOutboundPerPost < 2) pts -= 10;
  if (scores.avgOutboundPerPost >= 3 && scores.avgOutboundPerPost <= 10) pts += 5;
  if (scores.catalogOrphans === 0 && scores.postsWithZeroOutbound === 0) pts += 5;
  pts -= Math.min(8, flags.filter((f) => f.includes("orphans remain") || f.includes("zero")).length * 2);
  if (pts >= 90) return "A";
  if (pts >= 80) return "B";
  if (pts >= 70) return "C";
  if (pts >= 55) return "D";
  return "F";
}

function isForceBridgeParagraph(text: string): boolean {
  if (text.includes(LINKER_SITE.forceBridgeMarker)) return true;
  return LEGACY_FORCE_BRIDGE_PATTERNS.some((re) => {
    re.lastIndex = 0;
    return re.test(text);
  });
}

export async function runQualityScore(options: CLIOptions): Promise<QualityScoreReport> {
  let graph = await loadLinkGraph();
  if (!graph) graph = await buildLinkGraph();

  const { posts, catalog } = await loadBlogAndCatalog();
  const catalogByUrl = new Map(catalog.map((p) => [normalizeUrl(p.url), p]));

  const orphanUrls = graph.orphanPages || [];
  const catalogOrphans = orphanUrls.filter((u) => catalogByUrl.has(normalizeUrl(u))).length;

  // Inbound counts from graph nodes when available
  const nodes = graph.nodes || {};
  const blogUrls = new Set(
    posts.map((p) => {
      const cat = catalog.find((c) => c.slug === p.slug);
      return normalizeUrl(cat?.url || `/blog/${p.slug}/`);
    })
  );

  let postsWithZeroInbound = 0;
  let postsWithZeroOutbound = 0;
  let outboundSum = 0;
  let forceBridgeParagraphs = 0;

  for (const post of posts) {
    const body = parseBody(post.rawContent);
    const outbound = countInternalLinks(body);
    outboundSum += outbound;
    if (outbound === 0) postsWithZeroOutbound++;

    const cat = catalog.find((c) => c.slug === post.slug);
    const url = normalizeUrl(cat?.url || `/blog/${post.slug}/`);
    const node = nodes[url] || nodes[url.replace(/\/$/, "")] || nodes[`/blog/${post.slug}`];
    const inbound =
      typeof node?.inboundCount === "number"
        ? node.inboundCount
        : orphanUrls.some((o) => normalizeUrl(o) === url)
          ? 0
          : // if not in orphan list and graph has edges, treat as having inbound
            graph.totalEdges > 0 && !orphanUrls.map(normalizeUrl).includes(url)
            ? 1
            : 0;
    if (inbound === 0) postsWithZeroInbound++;

    // Count force-bridge paragraphs in body
    for (const block of body.split(/\n\n+/)) {
      if (isForceBridgeParagraph(block)) forceBridgeParagraphs++;
    }
  }

  const totalBlogPosts = posts.length || 1;
  const catalogNodes = graph.totalNodes || Object.keys(nodes).length || catalog.length;
  const orphanRate = catalogNodes > 0 ? catalogOrphans / catalogNodes : 0;
  const forceBridgeRate = forceBridgeParagraphs / totalBlogPosts;

  const flags: string[] = [];
  if (catalogOrphans > 0) flags.push(`${catalogOrphans} catalog orphans remain`);
  if (postsWithZeroOutbound > 0) flags.push(`${postsWithZeroOutbound} posts have zero outbound links`);
  if (postsWithZeroInbound > 0) flags.push(`${postsWithZeroInbound} posts have zero inbound links`);
  if (forceBridgeParagraphs > totalBlogPosts * 0.5) {
    flags.push(`high force-bridge density (${forceBridgeParagraphs} paragraphs)`);
  }
  if (forceBridgeParagraphs > 0) {
    const unmarked = forceBridgeParagraphs; // legacy counted in same bucket
    flags.push(`force/legacy bridges present — run upgrade-force-bridges when refining`);
    void unmarked;
  }

  const recommendations: string[] = [];
  if (catalogOrphans > 0) {
    recommendations.push(
      "Prefer draft-orphan-inbound with XAI_API_KEY (exact + LLM bridges) over force-orphan-inbound."
    );
  }
  if (forceBridgeParagraphs > 0) {
    recommendations.push(
      "Upgrade marked/legacy force bridges via: npx tsx scripts/automation/linker-v4/upgrade-force-bridges.ts"
    );
  }
  if (postsWithZeroOutbound > 0) {
    recommendations.push("Run GHA smart-linker or local generate --use-api for zero-outbound posts.");
  }
  recommendations.push(
    "Treat quality grade as the north star; orphan count=0 alone is not enough."
  );

  const partial = {
    generatedAt: new Date().toISOString(),
    brand: LINKER_SITE.brand,
    scores: {
      orphanRate,
      forceBridgeRate,
      avgOutboundPerPost: outboundSum / totalBlogPosts,
      postsWithZeroOutbound,
      postsWithZeroInbound,
      forceBridgeParagraphs,
      totalBlogPosts: posts.length,
      catalogNodes,
      catalogOrphans,
      totalEdges: graph.totalEdges || 0,
    },
    flags,
    recommendations,
  };

  const report: QualityScoreReport = {
    ...partial,
    grade: gradeFrom(partial),
  };

  const outPath = path.resolve(QUALITY_SCORE_PATH);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(report, null, 2));

  console.log("═══════════════════════════════════════════════");
  console.log(`  Smart Linker Quality Score — ${report.brand}`);
  console.log(`  Grade: ${report.grade}`);
  console.log("═══════════════════════════════════════════════");
  console.log(`  Catalog orphans:     ${report.scores.catalogOrphans} (${(orphanRate * 100).toFixed(1)}%)`);
  console.log(`  Force-bridge paras:  ${report.scores.forceBridgeParagraphs}`);
  console.log(`  Avg outbound/post:   ${report.scores.avgOutboundPerPost.toFixed(2)}`);
  console.log(`  Zero outbound posts: ${report.scores.postsWithZeroOutbound}`);
  console.log(`  Zero inbound posts:  ${report.scores.postsWithZeroInbound}`);
  console.log(`  Edges / nodes:       ${report.scores.totalEdges} / ${report.scores.catalogNodes}`);
  if (flags.length) {
    console.log("\n  Flags:");
    for (const f of flags) console.log(`    - ${f}`);
  }
  console.log(`\n  Wrote ${QUALITY_SCORE_PATH}`);
  console.log("═══════════════════════════════════════════════\n");

  if (options.strict && (report.grade === "D" || report.grade === "F")) {
    console.error(`Quality grade ${report.grade} fails --strict`);
    process.exitCode = 1;
  }

  return report;
}

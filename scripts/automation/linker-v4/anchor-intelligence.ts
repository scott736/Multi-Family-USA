// ============================================
// Smart Linker v4 — Anchor Text Intelligence
// ============================================
// Tracks anchor text diversity per target URL, detects cannibalization
// (same anchor pointing to multiple targets), and enriches AI prompts
// with existing anchor distribution to encourage variety.

import fs from "fs/promises";
import path from "path";
import type { LinkTracker, TrackedLink } from "./types";
import { normalizeUrl } from "./catalog-utils";

// ----------------
// Types
// ----------------

export interface AnchorUsage {
  text: string;
  sourceSlug: string;
  appliedAt: string;
}

export interface TargetAnchorProfile {
  anchors: AnchorUsage[];
  uniqueCount: number;
  totalCount: number;
  diversityScore: number; // uniqueCount / totalCount (1.0 = perfect)
}

export interface AnchorDiversityIndex {
  [targetUrl: string]: TargetAnchorProfile;
}

export interface AnchorCannibalization {
  anchorText: string;
  targets: { url: string; sourceSlug: string }[];
}

export interface AnchorIntelligenceReport {
  totalTargets: number;
  averageDiversity: number;
  lowDiversityTargets: { url: string; score: number; topAnchor: string; count: number }[];
  singleAnchorTargets: { url: string; anchor: string; usedIn: number }[];
  cannibalizations: AnchorCannibalization[];
}

// ----------------
// Constants
// ----------------

const DEFAULT_TRACKER_PATH = "src/data/linker-v4/link-tracker.json";

// ----------------
// Core Functions
// ----------------

/**
 * Build an anchor diversity index from link-tracker.json.
 * Groups all tracked links by normalized target URL, collects anchor texts,
 * and calculates diversity scores.
 */
export async function buildAnchorDiversityIndex(
  trackerPath?: string
): Promise<AnchorDiversityIndex> {
  const resolvedPath = path.resolve(trackerPath || DEFAULT_TRACKER_PATH);

  let tracker: LinkTracker;
  try {
    const content = await fs.readFile(resolvedPath, "utf-8");
    tracker = JSON.parse(content);
  } catch {
    // No tracker file — return empty index
    return {};
  }

  const index: AnchorDiversityIndex = {};

  for (const link of tracker.links) {
    const targetUrl = normalizeUrl(link.toUrl);
    if (!index[targetUrl]) {
      index[targetUrl] = {
        anchors: [],
        uniqueCount: 0,
        totalCount: 0,
        diversityScore: 1.0,
      };
    }

    index[targetUrl].anchors.push({
      text: link.anchor,
      sourceSlug: link.from,
      appliedAt: link.appliedAt,
    });
  }

  // Calculate diversity scores
  for (const profile of Object.values(index)) {
    profile.totalCount = profile.anchors.length;
    const uniqueAnchors = new Set(
      profile.anchors.map((a) => a.text.toLowerCase().trim())
    );
    profile.uniqueCount = uniqueAnchors.size;
    profile.diversityScore =
      profile.totalCount > 0 ? profile.uniqueCount / profile.totalCount : 1.0;
  }

  return index;
}

/**
 * Detect anchor cannibalization: the same anchor text pointing to 2+ different targets.
 * This confuses search engines about which page should rank for that phrase.
 */
export function detectAnchorCannibalization(
  index: AnchorDiversityIndex
): AnchorCannibalization[] {
  // Invert: group by normalized anchor text
  const anchorToTargets = new Map<string, { url: string; sourceSlug: string }[]>();

  for (const [targetUrl, profile] of Object.entries(index)) {
    for (const anchor of profile.anchors) {
      const normalizedAnchor = anchor.text.toLowerCase().trim();
      if (!anchorToTargets.has(normalizedAnchor)) {
        anchorToTargets.set(normalizedAnchor, []);
      }
      anchorToTargets.get(normalizedAnchor)!.push({
        url: targetUrl,
        sourceSlug: anchor.sourceSlug,
      });
    }
  }

  // Find anchors pointing to multiple distinct targets
  const cannibalizations: AnchorCannibalization[] = [];

  for (const [anchorText, targets] of anchorToTargets) {
    const uniqueTargetUrls = new Set(targets.map((t) => t.url));
    if (uniqueTargetUrls.size >= 2) {
      // Deduplicate targets by URL
      const deduped: { url: string; sourceSlug: string }[] = [];
      const seen = new Set<string>();
      for (const t of targets) {
        const key = `${t.url}|${t.sourceSlug}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(t);
        }
      }

      cannibalizations.push({
        anchorText,
        targets: deduped,
      });
    }
  }

  // Sort by number of conflicting targets (descending)
  cannibalizations.sort((a, b) => {
    const aUrls = new Set(a.targets.map((t) => t.url)).size;
    const bUrls = new Set(b.targets.map((t) => t.url)).size;
    return bUrls - aUrls;
  });

  return cannibalizations;
}

/**
 * Generate a full anchor intelligence report.
 */
export async function generateAnchorIntelligenceReport(): Promise<AnchorIntelligenceReport> {
  const index = await buildAnchorDiversityIndex();
  const cannibalizations = detectAnchorCannibalization(index);

  const entries = Object.entries(index);
  const totalTargets = entries.length;

  // Average diversity
  const averageDiversity =
    totalTargets > 0
      ? entries.reduce((sum, [, p]) => sum + p.diversityScore, 0) / totalTargets
      : 1.0;

  // Low diversity targets (score < 0.5 and more than 1 link)
  const lowDiversityTargets = entries
    .filter(([, p]) => p.diversityScore < 0.5 && p.totalCount > 1)
    .map(([url, p]) => {
      // Find the most-used anchor
      const anchorCounts = new Map<string, number>();
      for (const a of p.anchors) {
        const key = a.text.toLowerCase().trim();
        anchorCounts.set(key, (anchorCounts.get(key) || 0) + 1);
      }
      let topAnchor = "";
      let topCount = 0;
      for (const [anchor, count] of anchorCounts) {
        if (count > topCount) {
          topAnchor = anchor;
          topCount = count;
        }
      }
      return { url, score: p.diversityScore, topAnchor, count: topCount };
    })
    .sort((a, b) => a.score - b.score);

  // Single-anchor targets (only 1 unique anchor text, used in 2+ articles)
  const singleAnchorTargets = entries
    .filter(([, p]) => p.uniqueCount === 1 && p.totalCount >= 2)
    .map(([url, p]) => ({
      url,
      anchor: p.anchors[0].text,
      usedIn: p.totalCount,
    }))
    .sort((a, b) => b.usedIn - a.usedIn);

  return {
    totalTargets,
    averageDiversity,
    lowDiversityTargets,
    singleAnchorTargets,
    cannibalizations,
  };
}

/**
 * Get all unique anchor texts currently used for a given target URL.
 */
export function getExistingAnchorsForTarget(
  targetUrl: string,
  index: AnchorDiversityIndex
): string[] {
  const normalized = normalizeUrl(targetUrl);
  const profile = index[normalized];
  if (!profile) return [];

  const unique = new Set<string>();
  for (const a of profile.anchors) {
    unique.add(a.text.toLowerCase().trim());
  }
  return [...unique];
}

/**
 * Format anchor distribution info for inclusion in AI prompts.
 * Returns a string like:
 *   [EXISTING ANCHORS: "mortgage pre-approval process" (2x), "getting pre-approved" (1x) -- USE DIFFERENT ANCHOR TEXT]
 * Returns empty string if no existing anchors.
 */
export function formatAnchorDistributionForPrompt(
  targetUrl: string,
  index: AnchorDiversityIndex
): string {
  const normalized = normalizeUrl(targetUrl);
  const profile = index[normalized];
  if (!profile || profile.anchors.length === 0) return "";

  // Count occurrences of each anchor
  const anchorCounts = new Map<string, number>();
  for (const a of profile.anchors) {
    const key = a.text.toLowerCase().trim();
    anchorCounts.set(key, (anchorCounts.get(key) || 0) + 1);
  }

  // Sort by count descending
  const sorted = [...anchorCounts.entries()].sort((a, b) => b[1] - a[1]);

  const parts = sorted.map(([text, count]) => `"${text}" (${count}x)`);
  return `[EXISTING ANCHORS: ${parts.join(", ")} -- USE DIFFERENT ANCHOR TEXT]`;
}

/**
 * Pretty-print the anchor intelligence report to console.
 */
export function printAnchorIntelligenceReport(
  report: AnchorIntelligenceReport
): void {
  console.log("\n========================================");
  console.log("  Anchor Text Intelligence Report");
  console.log("========================================\n");

  console.log(`  Total target URLs tracked: ${report.totalTargets}`);
  console.log(`  Average diversity score: ${report.averageDiversity.toFixed(2)}`);
  console.log("");

  // Low diversity targets
  if (report.lowDiversityTargets.length > 0) {
    console.log(`  Low Diversity Targets (score < 0.5):`);
    console.log(`  ${"URL".padEnd(60)} ${"Score".padEnd(8)} ${"Top Anchor".padEnd(40)} Count`);
    console.log(`  ${"---".padEnd(60)} ${"-----".padEnd(8)} ${"----------".padEnd(40)} -----`);
    for (const t of report.lowDiversityTargets) {
      const urlShort = t.url.length > 58 ? t.url.slice(0, 55) + "..." : t.url;
      const anchorShort =
        t.topAnchor.length > 38 ? t.topAnchor.slice(0, 35) + "..." : t.topAnchor;
      console.log(
        `  ${urlShort.padEnd(60)} ${t.score.toFixed(2).padEnd(8)} ${anchorShort.padEnd(40)} ${t.count}`
      );
    }
    console.log("");
  } else {
    console.log("  No low-diversity targets found.\n");
  }

  // Single-anchor targets
  if (report.singleAnchorTargets.length > 0) {
    console.log(`  Single-Anchor Targets (1 unique anchor, 2+ uses):`);
    console.log(`  ${"URL".padEnd(60)} ${"Anchor".padEnd(40)} Uses`);
    console.log(`  ${"---".padEnd(60)} ${"------".padEnd(40)} ----`);
    for (const t of report.singleAnchorTargets) {
      const urlShort = t.url.length > 58 ? t.url.slice(0, 55) + "..." : t.url;
      const anchorShort =
        t.anchor.length > 38 ? t.anchor.slice(0, 35) + "..." : t.anchor;
      console.log(
        `  ${urlShort.padEnd(60)} ${anchorShort.padEnd(40)} ${t.usedIn}`
      );
    }
    console.log("");
  } else {
    console.log("  No single-anchor targets found.\n");
  }

  // Cannibalization alerts
  if (report.cannibalizations.length > 0) {
    console.log(`  Anchor Cannibalization Alerts (${report.cannibalizations.length}):`);
    for (const c of report.cannibalizations) {
      const uniqueUrls = new Set(c.targets.map((t) => t.url));
      console.log(`\n    "${c.anchorText}" -> ${uniqueUrls.size} different targets:`);
      for (const t of c.targets) {
        console.log(`      ${t.url} (from: ${t.sourceSlug})`);
      }
    }
    console.log("");
  } else {
    console.log("  No anchor cannibalization detected.\n");
  }

  console.log("========================================\n");
}

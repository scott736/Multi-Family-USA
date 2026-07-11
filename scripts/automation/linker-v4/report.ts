// ============================================
// Smart Linker v4 — Dry-Run Reporting
// ============================================
// Generates an aggregate report across all suggestion files.
// Shows what would be applied, rejection stats, and quality metrics.
// Saves report to src/data/linker-v4/reports/ as markdown.

import fs from "fs/promises";
import { mkdirSync } from "fs";
import path from "path";
import type { CLIOptions } from "../types";
import type { SuggestionFile } from "./types";

// ----------------
// Constants
// ----------------

const REPORTS_DIR = "src/data/linker-v4/reports";

// ----------------
// Main Function
// ----------------

export async function generateReport(options: CLIOptions): Promise<void> {
  const { slug, all } = options;

  console.log("Generating link suggestion report...\n");

  const suggestionsDir = path.resolve("src/data/linker-v4/suggestions");

  let files: string[];
  try {
    files = (await fs.readdir(suggestionsDir)).filter((f) =>
      f.endsWith(".json")
    );
  } catch {
    console.error("No suggestions directory found.");
    return;
  }

  if (slug) {
    files = files.filter((f) => f === `${slug}.json`);
  } else if (!all) {
    console.error("Please specify --slug or --all");
    return;
  }

  if (files.length === 0) {
    console.log("No suggestion files found.");
    return;
  }

  // Aggregate stats
  let totalArticles = 0;
  let totalRaw = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalConfidence = 0;
  let confidenceCount = 0;
  const rejectionReasons: Record<string, number> = {};
  const targetUrlCounts: Record<string, number> = {};
  const articlesWithNoLinks: string[] = [];

  for (const file of files) {
    const filePath = path.join(suggestionsDir, file);
    const content = await fs.readFile(filePath, "utf-8");
    let sf: SuggestionFile;

    try {
      sf = JSON.parse(content);
    } catch {
      continue;
    }

    totalArticles++;
    totalRaw += sf.raw.length;

    // Track confidence
    for (const s of sf.raw) {
      totalConfidence += s.confidence;
      confidenceCount++;
    }

    const passed = (sf.validated || []).filter((v) => v.passed);
    const failed = (sf.validated || []).filter((v) => !v.passed);

    totalPassed += passed.length;
    totalFailed += failed.length;

    if (passed.length === 0) {
      articlesWithNoLinks.push(sf.sourceSlug);
    }

    // Track rejection reasons
    for (const v of failed) {
      const reason = (v.rejectionReason || "unknown").split(":")[0];
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
    }

    // Track target URL frequency
    for (const v of passed) {
      const url = v.suggestion.targetUrl;
      targetUrlCounts[url] = (targetUrlCounts[url] || 0) + 1;
    }
  }

  // Build report lines (used for both console output and markdown file)
  const lines: string[] = [];

  lines.push("=== LINK SUGGESTION REPORT ===");
  lines.push("");
  lines.push(`Articles processed: ${totalArticles}`);
  lines.push(`Total suggestions: ${totalRaw}`);
  lines.push(`  Passed validation: ${totalPassed}`);
  lines.push(`  Rejected: ${totalFailed}`);
  lines.push(
    `  Pass rate: ${totalRaw > 0 ? ((totalPassed / totalRaw) * 100).toFixed(1) : 0}%`
  );
  lines.push(
    `  Avg confidence: ${confidenceCount > 0 ? (totalConfidence / confidenceCount).toFixed(2) : "N/A"}`
  );
  lines.push(
    `  Avg links per article: ${totalArticles > 0 ? (totalPassed / totalArticles).toFixed(1) : 0}`
  );

  if (Object.keys(rejectionReasons).length > 0) {
    lines.push("");
    lines.push("Rejection breakdown:");
    const sorted = Object.entries(rejectionReasons).sort(
      ([, a], [, b]) => b - a
    );

    const TECHNICAL_REASONS = [
      "anchor-not-found",
      "duplicate-target",
      "in-skip-zone",
      "too-close-to-other-link",
      "not-at-word-boundary",
      "unpublished-target",
      "tooltip-only-target",
    ];

    const techTotal = sorted
      .filter(([r]) => TECHNICAL_REASONS.includes(r))
      .reduce((sum, [, c]) => sum + c, 0);
    const qualityTotal = totalFailed - techTotal;

    lines.push(`  - Technical rejections: ${techTotal}`);
    lines.push(`  - Quality rejections: ${qualityTotal}`);
    lines.push("");

    for (const [reason, count] of sorted) {
      const pct = ((count / totalFailed) * 100).toFixed(0);
      lines.push(`    ${reason}: ${count} (${pct}%)`);
    }
  }

  // Most linked targets
  const topTargets = Object.entries(targetUrlCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  if (topTargets.length > 0) {
    lines.push("");
    lines.push("Most linked targets:");
    for (const [url, count] of topTargets) {
      lines.push(`  ${url}: ${count} links`);
    }
  }

  if (articlesWithNoLinks.length > 0) {
    lines.push("");
    lines.push(
      `Articles with 0 valid links (${articlesWithNoLinks.length}):`
    );
    for (const s of articlesWithNoLinks.slice(0, 10)) {
      lines.push(`  - ${s}`);
    }
    if (articlesWithNoLinks.length > 10) {
      lines.push(`  ... and ${articlesWithNoLinks.length - 10} more`);
    }
  }

  lines.push("");
  lines.push("=== END REPORT ===");

  // Print to console
  for (const line of lines) {
    console.log(line);
  }

  // Save as markdown
  const mdLines: string[] = [];
  mdLines.push(`# Linker Suggestion Report`);
  mdLines.push(`Generated: ${new Date().toISOString()}\n`);
  mdLines.push(`## Summary\n`);
  mdLines.push(`- Articles processed: ${totalArticles}`);
  mdLines.push(`- Total suggestions: ${totalRaw}`);
  mdLines.push(`- Passed validation: ${totalPassed}`);
  mdLines.push(`- Rejected: ${totalFailed}`);
  mdLines.push(`- Pass rate: ${totalRaw > 0 ? ((totalPassed / totalRaw) * 100).toFixed(1) : 0}%`);
  mdLines.push(`- Avg confidence: ${confidenceCount > 0 ? (totalConfidence / confidenceCount).toFixed(2) : "N/A"}`);
  mdLines.push(`- Avg links per article: ${totalArticles > 0 ? (totalPassed / totalArticles).toFixed(1) : 0}`);

  if (Object.keys(rejectionReasons).length > 0) {
    mdLines.push(`\n## Rejection Breakdown\n`);
    const sorted = Object.entries(rejectionReasons).sort(([, a], [, b]) => b - a);
    for (const [reason, count] of sorted) {
      const pct = ((count / totalFailed) * 100).toFixed(0);
      mdLines.push(`- ${reason}: ${count} (${pct}%)`);
    }
  }

  if (topTargets.length > 0) {
    mdLines.push(`\n## Most Linked Targets\n`);
    for (const [url, count] of topTargets) {
      mdLines.push(`- ${url}: ${count} links`);
    }
  }

  if (articlesWithNoLinks.length > 0) {
    mdLines.push(`\n## Articles with 0 Valid Links (${articlesWithNoLinks.length})\n`);
    for (const s of articlesWithNoLinks) {
      mdLines.push(`- ${s}`);
    }
  }

  const reportsDir = path.resolve(REPORTS_DIR);
  mkdirSync(reportsDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(reportsDir, `linker-report-${date}.md`);
  await fs.writeFile(reportPath, mdLines.join("\n"));
  console.log(`\nReport saved to: ${reportPath}`);
}

// ============================================
// Smart Linker v9 — Full Local Relink
// ============================================
// Intent Placement generation + optional LLM judge + orphan inbound drafting.

import fs from "fs/promises";
import path from "path";
import type { CLIOptions } from "../types";

const SUGGESTIONS_DIR = "src/data/linker-v4/suggestions";

export async function relinkLocal(options: CLIOptions): Promise<void> {
  const dryRun = options.dryRun === true;
  const useJudge = options.useApi === true || process.env.LINKER_USE_JUDGE === "1";

  console.log("═══════════════════════════════════════════════");
  console.log("  Smart Linker v9 — Full Local Relink");
  console.log(`  Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`  Semantic judge: ${useJudge && process.env.XAI_API_KEY ? "ON" : "OFF"}`);
  console.log("  Locales: en (generate) → en/es/fr (apply)");
  console.log("═══════════════════════════════════════════════\n");

  // Step 1: Strip non-CTA internal links (all locales)
  console.log("Step 1/10: Strip non-CTA internal links (all locales)...\n");
  const { stripLinks } = await import("./strip");
  await stripLinks({ ...options, all: true, preserveCta: true, locale: "all", dryRun });

  if (dryRun) {
    console.log("\n[DRY RUN] Stopping before catalog rebuild.");
    return;
  }

  // Step 2: Clear stale suggestion files
  console.log("\nStep 2/10: Clear stale suggestion files...\n");
  const suggPath = path.resolve(SUGGESTIONS_DIR);
  try {
    const files = (await fs.readdir(suggPath)).filter((f) => f.endsWith(".json"));
    await Promise.all(files.map((f) => fs.unlink(path.join(suggPath, f))));
    console.log(`  Removed ${files.length} stale suggestion files`);
  } catch {
    console.log("  No existing suggestions to clear");
  }

  // Step 3: Rebuild raw catalog + semantic index
  console.log("\nStep 3/10: Build raw catalog + semantic index...\n");
  const { buildCatalog } = await import("./build-catalog");
  await buildCatalog({ ...options, force: true, noApi: true });

  // Step 4: Enrich page catalog (purpose cards + concept tags)
  console.log("\nStep 4/10: Enrich page catalog (purpose cards)...\n");
  const { enrichPageCatalog } = await import("./enrich-catalog");
  await enrichPageCatalog();

  // Step 5: Intent Placement generation (EN only)
  console.log("\nStep 5/10: Generate suggestions (Intent Placement v9, EN)...\n");
  if (process.env.XAI_API_KEY && options.noApi !== true) {
    const { generateIntent } = await import("./generate-intent");
    await generateIntent({ ...options, all: true, force: true, locale: "en" });
  } else {
    console.log("  No XAI_API_KEY (or --no-api) — using deterministic v8 fallback\n");
    const { generateDeterministic } = await import("./generate-deterministic");
    await generateDeterministic({ ...options, all: true, force: true, locale: "en" });
  }

  // Step 6: Validate
  console.log("\nStep 6/10: Validate suggestions...\n");
  const { validateSuggestions } = await import("./validate");
  await validateSuggestions({ all: true });

  // Step 7: LLM semantic judge (optional)
  if (useJudge && process.env.XAI_API_KEY) {
    console.log("\nStep 7/10: LLM semantic judge (batch)...\n");
    const { semanticJudgeAll } = await import("./semantic-judge");
    await semanticJudgeAll({ verbose: false, allowLocal: true });
  } else {
    console.log("\nStep 7/10: LLM semantic judge skipped (set XAI_API_KEY + --use-api)\n");
  }

  // Step 8: Apply (EN + localized es/fr)
  console.log("\nStep 8/10: Apply validated links (all locales)...\n");
  const { applyLinks } = await import("./apply");
  await applyLinks({ all: true, highConfidenceOnly: false, locale: "all" });

  // Step 9: Orphan inbound — exact links + bridge drafts for zero-inbound pages
  console.log("\nStep 9/10: Orphan inbound coverage (exact + bridge drafts)...\n");
  const { draftOrphanInbound, applyOrphanDrafts } = await import("./orphan-inbound");
  await draftOrphanInbound({
    ...options,
    maxPosts: options.maxPosts || 80,
  });
  // Re-validate/apply any exact orphan inbound suggestions merged into suggestion files
  await validateSuggestions({ all: true });
  await applyLinks({ all: true, highConfidenceOnly: false, locale: "all" });
  await applyOrphanDrafts({ ...options });

  // Step 10: Graph + report
  console.log("\nStep 10/10: Link graph + report...\n");
  const { buildLinkGraph, loadLinkGraph, generateLinkHealthReport, printLinkHealthReport } =
    await import("./link-graph");
  await buildLinkGraph();
  const graph = await loadLinkGraph();
  if (graph) {
    printLinkHealthReport(generateLinkHealthReport(graph));
  }

  const { generateReport } = await import("./report");
  await generateReport({ all: true });

  await printLocaleParityReport();

  console.log("\n═══════════════════════════════════════════════");
  console.log("  Local relink complete (v9 Intent Placement)");
  console.log("═══════════════════════════════════════════════\n");
}

async function printLocaleParityReport(): Promise<void> {
  const { loadMarkdownFiles, parseBody, BLOG_DIR } = await import("./parse");
  const { countInternalLinks } = await import("./catalog-utils");

  const langs = ["en", "es", "fr"] as const;
  const bySlug = new Map<string, Record<string, number>>();
  const totals: Record<string, number> = { en: 0, es: 0, fr: 0 };
  const postsWithLinks = { en: 0, es: 0, fr: 0 };

  for (const lang of langs) {
    const posts = await loadMarkdownFiles(BLOG_DIR, lang);
    for (const post of posts) {
      const n = countInternalLinks(parseBody(post.rawContent));
      totals[lang] += n;
      if (n > 0) postsWithLinks[lang]++;
      if (!bySlug.has(post.slug)) bySlug.set(post.slug, {});
      bySlug.get(post.slug)![lang] = n;
    }
  }

  let mismatched = 0;
  for (const [, counts] of bySlug) {
    const en = counts.en ?? 0;
    const es = counts.es ?? 0;
    const fr = counts.fr ?? 0;
    if (en !== es || en !== fr) mismatched++;
  }

  console.log("\nLocale parity summary:");
  for (const lang of langs) {
    console.log(
      `  ${lang}: ${totals[lang]} total links across ${postsWithLinks[lang]} posts`
    );
  }
  console.log(
    `  Slugs with mismatched link counts (en≠es or en≠fr): ${mismatched} / ${bySlug.size}`
  );
}

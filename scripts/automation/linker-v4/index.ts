// ============================================
// Smart Linker v4 — CLI Router
// ============================================
// Self-contained module. Routes CLI modes to their implementations.

import type { CLIOptions } from "../types";

export async function runLinkerV4(options: CLIOptions): Promise<void> {
  const { mode } = options;

  switch (mode) {
    // Step 1: Build page catalog from source files
    case "build-catalog": {
      const { buildCatalog } = await import("./build-catalog");
      await buildCatalog(options);
      break;
    }

    // Step 2: Generate suggestions (Intent Placement v9 by default)
    case "generate": {
      if (options.noApi) {
        const { generateDeterministic } = await import("./generate-deterministic");
        if (options.all || options.slug) {
          await generateDeterministic(options);
        } else {
          const { buildPrompt } = await import("./build-prompt");
          await buildPrompt(options);
        }
      } else if (options.useApi || process.env.XAI_API_KEY) {
        // Intent Placement is the default semantic generator (API or local with key)
        const { generateIntent } = await import("./generate-intent");
        if (options.all || options.slug) {
          await generateIntent(options);
        } else {
          console.error("Specify --slug or --all for Intent Placement generate");
        }
      } else {
        const { generateDeterministic } = await import("./generate-deterministic");
        if (options.all || options.slug) {
          await generateDeterministic(options);
        } else {
          const { buildPrompt } = await import("./build-prompt");
          await buildPrompt(options);
        }
      }
      break;
    }

    // Step 3: Validate suggestions (deterministic rules)
    case "validate": {
      const { validateSuggestions } = await import("./validate");
      await validateSuggestions(options);
      break;
    }

    // Step 4: Apply validated links to markdown files
    case "apply": {
      const { applyLinks } = await import("./apply");
      await applyLinks(options);
      break;
    }

    // Strip all internal links from posts (clean slate before re-linking)
    case "strip": {
      const { stripLinks } = await import("./strip");
      await stripLinks(options);
      break;
    }

    // Dry-run report
    case "report": {
      const { generateReport } = await import("./report");
      await generateReport(options);
      break;
    }

    case "review": {
      const { runLocalReview } = await import("./review");
      await runLocalReview(options);
      break;
    }

    // Monthly audit via xAI Grok API (GitHub Actions)
    case "audit": {
      const { auditLinks } = await import("./audit");
      await auditLinks(options);
      break;
    }

    // Semantic link audit (deterministic rules)
    case "semantic-audit": {
      const { auditSemanticLinks } = await import("./semantic-audit");
      await auditSemanticLinks(options);
      break;
    }

    // Build link graph and print health report
    case "graph": {
      const { buildLinkGraph, loadLinkGraph, generateLinkHealthReport, printLinkHealthReport, printPageRankTop10 } = await import("./link-graph");
      await buildLinkGraph();
      const graph = await loadLinkGraph();
      if (graph) {
        const report = generateLinkHealthReport(graph);
        printLinkHealthReport(report);
        printPageRankTop10(graph);
      }
      break;
    }

    // Anchor text intelligence report
    case "anchor-report": {
      const { generateAnchorIntelligenceReport, printAnchorIntelligenceReport } = await import("./anchor-intelligence");
      const report = await generateAnchorIntelligenceReport();
      printAnchorIntelligenceReport(report);
      break;
    }

    // Applied-link quality feedback report
    case "quality-report": {
      const { printQualityReport } = await import("./quality-tracker");
      await printQualityReport();
      break;
    }

    // Full-site local relink (v6) — strip all locales, EN generate, apply all
    case "relink-local": {
      const { relinkLocal } = await import("./relink-local");
      await relinkLocal(options);
      break;
    }

    case "semantic-judge": {
      const { semanticJudgeAll } = await import("./semantic-judge");
      await semanticJudgeAll({
        slug: options.slug,
        model: options.model,
        verbose: options.verbose,
      });
      break;
    }

    case "rerank": {
      const { rerankAllValidatedSuggestions, rerankValidatedSuggestionFile } = await import("./generate-api");
      const LlmClient = (await import("../shared/llm")).default;
      const { MODELS } = await import("../config");
      const { loadMarkdownFiles, BLOG_DIR } = await import("./parse");
      if (!process.env.XAI_API_KEY) {
        console.error("XAI_API_KEY required for rerank.");
        break;
      }
      const modelId = options.model === "sonnet" ? "grok-4.5" : "grok-4.5";
      if (options.slug) {
        const posts = await loadMarkdownFiles(BLOG_DIR);
        const article = posts.find((p) => p.slug === options.slug);
        if (!article) {
          console.error(`Article not found: ${options.slug}`);
          break;
        }
        const client = new LlmClient();
        await rerankValidatedSuggestionFile(client, modelId, options.slug, article, options.verbose);
      } else if (options.all) {
        await rerankAllValidatedSuggestions({ verbose: options.verbose, model: options.model });
      } else {
        console.error("Specify --slug or --all");
      }
      break;
    }

    // Reader-paths ingestion (Vercel Analytics CSV) — scaffold
    case "reader-paths": {
      const { runReaderPathsMode } = await import("./reader-paths");
      await runReaderPathsMode();
      break;
    }

    // Detect pillar pages from link graph + catalog and cache results
    case "detect-pillars": {
      const { loadLinkGraph, buildLinkGraph } = await import("./link-graph");
      const { detectPillars, writeDetectedPillars, FALLBACK_CATEGORY_PILLARS } =
        await import("./cluster-enforcement");

      let graph = await loadLinkGraph();
      if (!graph) {
        console.log("Link graph not found — building it first...\n");
        graph = await buildLinkGraph();
      }

      const { cache, skipped } = await detectPillars(graph);
      const outPath = await writeDetectedPillars(cache);

      console.log("\n========================================");
      console.log("  Detected Pillars");
      console.log("========================================\n");

      const categories = Object.keys(cache.pillarsByCategory).sort();
      if (categories.length === 0) {
        console.log("  No categories cleared the minimum score threshold.");
      }

      for (const category of categories) {
        const entries = cache.pillarsByCategory[category];
        console.log(`  ${category} (${entries.length} pillar${entries.length === 1 ? "" : "s"})`);
        console.log(`    score  PR        in   coh    url`);
        for (const e of entries) {
          const score = e.score.toFixed(3).padStart(5);
          const pr = e.pageRank.toFixed(6).padStart(8);
          const inb = String(e.inbound).padStart(3);
          const coh = e.coherence.toFixed(2).padStart(4);
          console.log(`    ${score}  ${pr}  ${inb}  ${coh}   ${e.url}`);
        }
        console.log("");
      }

      if (skipped.length > 0) {
        console.log("  Categories skipped (below threshold):");
        for (const s of skipped) {
          console.log(`    ${s.category} — ${s.reason}`);
        }
        console.log("");
      }

      const detectedSet = new Set(categories);
      const missing = Object.keys(FALLBACK_CATEGORY_PILLARS).filter(
        (c) => !detectedSet.has(c)
      );
      if (missing.length > 0) {
        console.log(`  Categories using fallback only: ${missing.join(", ")}`);
        console.log("");
      }

      console.log(`  Cache written to: ${outPath}`);
      console.log("========================================\n");
      break;
    }

    case "draft-orphan-inbound": {
      const { draftOrphanInbound } = await import("./orphan-inbound");
      await draftOrphanInbound(options);
      break;
    }

    case "apply-orphan-drafts": {
      const { applyOrphanDrafts } = await import("./orphan-inbound");
      await applyOrphanDrafts(options);
      break;
    }

    case "quality-score": {
      const { runQualityScore } = await import("./quality-score");
      await runQualityScore(options);
      break;
    }

    default:
      console.error(`Unknown linker-v4 mode: ${mode}`);
      console.log(
        `\nValid modes: build-catalog, generate, validate, apply, strip, report, audit, semantic-audit, graph, anchor-report, quality-report, quality-score, reader-paths, detect-pillars, relink-local, semantic-judge, rerank, draft-orphan-inbound, apply-orphan-drafts`
      );
      console.log(
        `\nMultilingual: use --locale en|es|fr|all on strip/apply; relink-local processes all locales automatically.`
      );
      process.exit(1);
  }
}

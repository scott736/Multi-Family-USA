// ============================================
// Smart Linker v9 — Intent Placement Generator
// ============================================
// Default generate path when XAI_API_KEY is available.

import fs from "fs/promises";
import path from "path";
import type { CLIOptions } from "../types";
import type { SuggestionFile } from "./types";
import LlmClient from "../shared/llm";
import { MODELS } from "../config";
import {
  generateIntentLinksForArticle,
  loadBlogAndCatalog,
  type IntentLink,
} from "./intent-placement";
import { loadLinkGraph } from "./link-graph";
import { normalizeUrl } from "./catalog-utils";

const SUGGESTIONS_DIR = "src/data/linker-v4/suggestions";

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  const n = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

function toSuggestion(link: IntentLink) {
  const { paragraphText: _p, ...rest } = link;
  return rest;
}

export async function generateIntent(options: CLIOptions): Promise<void> {
  const { slug, all, dryRun, force, concurrency } = options;

  if (!process.env.XAI_API_KEY) {
    console.error("XAI_API_KEY required for Intent Placement generate.");
    console.error("Fall back: npx tsx scripts/automation -f linker-v4 -m generate --no-api --slug …");
    return;
  }

  console.log("Generating link suggestions (Intent Placement v9)...\n");

  const { posts, catalog } = await loadBlogAndCatalog();
  let articles = posts;

  if (slug) {
    articles = posts.filter((a) => a.slug === slug);
    if (articles.length === 0) {
      console.error(`Article not found: ${slug}`);
      return;
    }
  } else if (!all) {
    console.error("Please specify --slug or --all");
    return;
  }

  const suggestionsDir = path.resolve(SUGGESTIONS_DIR);
  await fs.mkdir(suggestionsDir, { recursive: true });

  // Prefer orphan destinations when ranking candidates.
  let preferTargets = new Set<string>();
  try {
    const graph = await loadLinkGraph();
    if (graph?.orphanPages?.length) {
      preferTargets = new Set(graph.orphanPages.map((u) => normalizeUrl(u)));
      console.log(`  Orphan boost targets: ${preferTargets.size}\n`);
    }
  } catch {
    // graph optional
  }

  const client = new LlmClient();
  const modelId = MODELS.ANALYSIS;
  const pool = Math.max(1, Math.min(concurrency || 3, 6));

  let processed = 0;
  let totalSuggestions = 0;
  let zeroOutbound = 0;

  await mapPool(articles, pool, async (article) => {
    if (!force && !slug) {
      try {
        await fs.access(path.join(suggestionsDir, `${article.slug}.json`));
        return;
      } catch {
        // generate
      }
    }

    try {
      const { suggestions, contentHash, catalogSize } =
        await generateIntentLinksForArticle({
          article,
          catalog,
          client,
          modelId,
          preferTargetUrls: preferTargets,
        });

      processed++;
      totalSuggestions += suggestions.length;
      if (suggestions.length === 0) zeroOutbound++;

      if (dryRun) {
        console.log(`  ${article.slug}: ${suggestions.length} suggestions (v9)`);
        return;
      }

      const suggestionFile: SuggestionFile = {
        sourceSlug: article.slug,
        sourceContentHash: contentHash,
        generatedAt: new Date().toISOString(),
        model: "intent-placement-v9",
        catalogSize,
        raw: suggestions.map(toSuggestion),
        validated: [],
      };

      await fs.writeFile(
        path.join(suggestionsDir, `${article.slug}.json`),
        JSON.stringify(suggestionFile, null, 2)
      );

      if (processed % 10 === 0 || suggestions.length === 0) {
        console.log(
          `  [${processed}/${articles.length}] ${article.slug}: ${suggestions.length} links`
        );
      }
    } catch (err) {
      console.error(`  ERROR ${article.slug}: ${(err as Error).message}`);
    }
  });

  console.log(`\nIntent Placement generation complete:`);
  console.log(`  Articles processed: ${processed}`);
  console.log(`  Total suggestions: ${totalSuggestions}`);
  console.log(`  Zero-outbound after coverage: ${zeroOutbound}`);
}

/** Convenience used by GHA / generate --use-api */
export async function generateIntentForSlugs(
  slugs: string[],
  options: CLIOptions = {}
): Promise<void> {
  for (const slug of slugs) {
    await generateIntent({ ...options, slug, force: true });
  }
}

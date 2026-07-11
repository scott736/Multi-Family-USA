#!/usr/bin/env npx tsx
// Force inbound links to orphan pages via contextual bridge paragraphs.
// No external API. Uses linker-site-config for brand voice + quality thresholds.
//
//   npx tsx scripts/automation/linker-v4/force-orphan-inbound.ts
//   npx tsx scripts/automation/linker-v4/force-orphan-inbound.ts --max 200 --all

import fs from "fs/promises";
import {
  loadBlogAndCatalog,
  intentOverlapScore,
  purposeText,
} from "./intent-placement";
import {
  numberParagraphs,
  parseBody,
  extractRawFrontmatter,
} from "./parse";
import { normalizeUrl } from "./catalog-utils";
import { loadLinkGraph, buildLinkGraph } from "./link-graph";
import { LINKER_SITE } from "./linker-site-config";

function parseArgs(argv: string[]) {
  const maxIdx = argv.indexOf("--max");
  const dryRun = argv.includes("--dry-run");
  const all = argv.includes("--all");
  return {
    max: maxIdx >= 0 ? parseInt(argv[maxIdx + 1], 10) : 150,
    dryRun,
    all,
  };
}

async function main() {
  const { max, dryRun, all } = parseArgs(process.argv.slice(2));
  let graph = await loadLinkGraph();
  if (!graph) graph = await buildLinkGraph();

  const { posts, catalog } = await loadBlogAndCatalog();
  const byUrl = new Map(catalog.map((p) => [normalizeUrl(p.url), p]));
  const skip = new Set(LINKER_SITE.skipForceOrphanUrls.map(normalizeUrl));

  const orphans = (graph.orphanPages || [])
    .map((u) => byUrl.get(normalizeUrl(u)))
    .filter((p): p is NonNullable<typeof p> => {
      if (!p) return false;
      if (skip.has(normalizeUrl(p.url))) return false;
      if (!all && p.type !== "post") return false;
      return true;
    })
    .slice(0, max);

  console.log(
    `Processing ${orphans.length} ${all ? "catalog" : "blog"} orphans (min overlap ${LINKER_SITE.minForceOverlap})...\n`
  );

  const sourceInserts = new Map<string, number>();
  let inserted = 0;
  let skipped = 0;

  for (const orphan of orphans) {
    const orphanNorm = normalizeUrl(orphan.url);
    const orphanPurpose = purposeText(orphan);

    const ranked = posts
      .filter((a) => a.slug !== orphan.slug)
      .map((a) => {
        const body = parseBody(a.rawContent);
        if (
          body.includes(orphanNorm) ||
          body.includes(orphan.url) ||
          body.includes(`${orphanNorm}/`)
        ) {
          return null;
        }
        const cat = catalog.find((c) => c.slug === a.slug);
        const score = intentOverlapScore(
          orphanPurpose,
          cat
            ? purposeText(cat)
            : `${a.frontmatter.title} ${a.frontmatter.description || ""}`
        );
        return { article: a, score };
      })
      .filter(
        (x): x is { article: (typeof posts)[0]; score: number } =>
          Boolean(x) && x!.score >= LINKER_SITE.minForceOverlap
      )
      .sort((a, b) => b.score - a.score);

    let placed = false;
    for (const { article, score } of ranked.slice(0, 24)) {
      const used = sourceInserts.get(article.slug) || 0;
      if (used >= LINKER_SITE.maxForceBridgesPerSource) continue;

      const body = parseBody(article.rawContent);
      const paragraphs = numberParagraphs(body).filter((p) => p.isContent);
      const mid =
        paragraphs[Math.floor(paragraphs.length * 0.55)] || paragraphs[3];
      if (!mid) continue;

      const bridge = LINKER_SITE.buildForceBridge({
        title: orphan.title,
        url: orphan.url,
        type: orphan.type,
      });

      const insertAt = mid.offset + mid.text.length;
      const newBody =
        body.slice(0, insertAt) + `\n\n${bridge}\n` + body.slice(insertAt);
      const rawFrontmatter = extractRawFrontmatter(article.rawContent);
      const newContent = rawFrontmatter + newBody;

      const label = orphan.slug || orphanNorm;
      console.log(
        `${dryRun ? "[dry] " : ""}${label} ← ${article.slug} (score ${score.toFixed(2)})`
      );
      if (!dryRun) {
        await fs.writeFile(article.filePath, newContent, "utf-8");
        article.rawContent = newContent;
      }
      sourceInserts.set(article.slug, used + 1);
      inserted++;
      placed = true;
      break;
    }

    if (!placed) {
      skipped++;
      console.log(`  skip ${orphan.slug || orphanNorm}: no suitable source`);
    }
  }

  console.log(`\nOrphan inbound bridges: ${inserted}, skipped: ${skipped}`);
  console.log(
    `Tip: prefer API draft-orphan-inbound for better bridges; force bridges are a safety net.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

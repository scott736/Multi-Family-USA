#!/usr/bin/env npx tsx
// Force inbound links to orphan blog posts by inserting a bridge paragraph
// into the best related source article. No external API.
//
//   npx tsx scripts/automation/linker-v4/force-orphan-inbound.ts
//   npx tsx scripts/automation/linker-v4/force-orphan-inbound.ts --max 120

import fs from "fs/promises";
import path from "path";
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

function parseArgs(argv: string[]) {
  const maxIdx = argv.indexOf("--max");
  const dryRun = argv.includes("--dry-run");
  return {
    max: maxIdx >= 0 ? parseInt(argv[maxIdx + 1], 10) : 150,
    dryRun,
  };
}

async function main() {
  const { max, dryRun } = parseArgs(process.argv.slice(2));
  let graph = await loadLinkGraph();
  if (!graph) graph = await buildLinkGraph();

  const { posts, catalog } = await loadBlogAndCatalog();
  const byUrl = new Map(catalog.map((p) => [normalizeUrl(p.url), p]));
  const bySlug = new Map(posts.map((p) => [p.slug, p]));

  const orphans = (graph.orphanPages || [])
    .map((u) => byUrl.get(normalizeUrl(u)))
    .filter((p): p is NonNullable<typeof p> => Boolean(p) && p.type === "post")
    .slice(0, max);

  console.log(`Processing ${orphans.length} blog orphans...\n`);

  // Track how many bridges we've inserted into each source (cap 2)
  const sourceInserts = new Map<string, number>();
  let inserted = 0;
  let skipped = 0;

  for (const orphan of orphans) {
    const orphanNorm = normalizeUrl(orphan.url);
    const orphanPurpose = purposeText(orphan);

    // Rank potential sources
    const ranked = posts
      .filter((a) => a.slug !== orphan.slug)
      .map((a) => {
        const body = parseBody(a.rawContent);
        if (body.includes(orphanNorm) || body.includes(orphan.url)) return null;
        const cat = catalog.find((c) => c.slug === a.slug);
        const score = intentOverlapScore(
          orphanPurpose,
          cat ? purposeText(cat) : `${a.frontmatter.title} ${a.frontmatter.description || ""}`
        );
        return { article: a, score };
      })
      .filter((x): x is { article: (typeof posts)[0]; score: number } => Boolean(x) && x!.score >= 0.08)
      .sort((a, b) => b.score - a.score);

    let placed = false;
    for (const { article, score } of ranked.slice(0, 12)) {
      const used = sourceInserts.get(article.slug) || 0;
      if (used >= 2) continue;

      const body = parseBody(article.rawContent);
      const paragraphs = numberParagraphs(body).filter((p) => p.isContent);
      const mid = paragraphs[Math.floor(paragraphs.length * 0.55)] || paragraphs[3];
      if (!mid) continue;

      const url = orphan.url.endsWith("/") ? orphan.url : `${orphan.url}/`;
      const anchor = orphan.title.replace(/[\[\]]/g, "").slice(0, 80);
      const bridge = `If you're exploring this further, our guide to [${anchor}](${url}) covers the details.`;

      const insertAt = mid.offset + mid.text.length;
      const newBody =
        body.slice(0, insertAt) + `\n\n${bridge}\n` + body.slice(insertAt);
      const rawFrontmatter = extractRawFrontmatter(article.rawContent);
      const newContent = rawFrontmatter + newBody;

      console.log(
        `${dryRun ? "[dry] " : ""}${orphan.slug} ← ${article.slug} (score ${score.toFixed(2)})`
      );
      if (!dryRun) {
        await fs.writeFile(article.filePath, newContent, "utf-8");
      }
      sourceInserts.set(article.slug, used + 1);
      inserted++;
      placed = true;
      break;
    }

    if (!placed) {
      skipped++;
      console.log(`  skip ${orphan.slug}: no suitable source`);
    }
  }

  console.log(`\nOrphan inbound bridges: ${inserted}, skipped: ${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

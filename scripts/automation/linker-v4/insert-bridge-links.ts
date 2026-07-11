#!/usr/bin/env npx tsx
// Insert a short mid-article bridge paragraph with one internal link.
// Used for posts where exact-substring Intent Placement found nothing.
// No external API.
//
//   npx tsx scripts/automation/linker-v4/insert-bridge-links.ts --slugs-file /tmp/lc-uncovered.txt

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
import { normalizeUrl, isPreservedInternalLink } from "./catalog-utils";
import { FALLBACK_CATEGORY_PILLARS } from "./cluster-enforcement";
import { passesRegionGate } from "./semantic-gate";

function parseArgs(argv: string[]) {
  const idx = argv.indexOf("--slugs-file");
  const dryRun = argv.includes("--dry-run");
  return { slugsFile: idx >= 0 ? argv[idx + 1] : undefined, dryRun };
}

function hasContentLink(body: string): boolean {
  for (const m of body.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    if (!m[2].startsWith("/")) continue;
    if (!isPreservedInternalLink(m[2], m[1])) return true;
  }
  return false;
}

async function main() {
  const { slugsFile, dryRun } = parseArgs(process.argv.slice(2));
  if (!slugsFile) {
    console.error("Need --slugs-file");
    process.exit(1);
  }
  const slugs = (await fs.readFile(slugsFile, "utf-8"))
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const { posts, catalog } = await loadBlogAndCatalog();
  const bySlug = new Map(posts.map((p) => [p.slug, p]));

  let inserted = 0;
  let skipped = 0;

  for (const slug of slugs) {
    const article = bySlug.get(slug);
    if (!article) {
      skipped++;
      continue;
    }
    const body = parseBody(article.rawContent);
    if (hasContentLink(body)) {
      skipped++;
      continue;
    }

    const category = String(article.frontmatter.category || "investing-fundamentals");
    const region = String(article.frontmatter.region || "both");
    const tags = (article.frontmatter.tags as string[]) || [];

    const pillarSet = new Set(
      (FALLBACK_CATEGORY_PILLARS[category] || []).map((u) => normalizeUrl(u))
    );

    const ranked = catalog
      .filter((p) => {
        if (p.slug === slug) return false;
        if (p.url.includes("book-strategy-call") || p.url.startsWith("/glossary/"))
          return false;
        if (!passesRegionGate(region, category, tags, p.region || "both")) return false;
        return true;
      })
      .map((p) => {
        const overlap = intentOverlapScore(
          `${article.frontmatter.title} ${article.frontmatter.description || ""}`,
          purposeText(p)
        );
        const pillarBoost = pillarSet.has(normalizeUrl(p.url)) ? 0.2 : 0;
        return { p, score: overlap + pillarBoost };
      })
      .sort((a, b) => b.score - a.score);

    const best = ranked[0]?.p;
    if (!best) {
      skipped++;
      continue;
    }

    const url = best.url.endsWith("/") ? best.url : `${best.url}/`;
    const anchor =
      (best.title || "related financing guide").replace(/[\[\]]/g, "").slice(0, 80);
    const bridge = `For a deeper look at the financing angle behind this topic, see our guide to [${anchor}](${url}).`;

    const paragraphs = numberParagraphs(body).filter((p) => p.isContent);
    const mid = paragraphs[Math.floor(paragraphs.length * 0.45)] || paragraphs[2];
    if (!mid) {
      skipped++;
      continue;
    }

    const insertAt = mid.offset + mid.text.length;
    const newBody = body.slice(0, insertAt) + `\n\n${bridge}\n` + body.slice(insertAt);
    const rawFrontmatter = extractRawFrontmatter(article.rawContent);
    const newContent = rawFrontmatter + newBody;

    console.log(
      `${dryRun ? "[dry] " : ""}${slug} → ${url}`
    );
    if (!dryRun) {
      await fs.writeFile(article.filePath, newContent, "utf-8");
    }
    inserted++;
  }

  console.log(`\nBridge inserts: ${inserted}, skipped: ${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

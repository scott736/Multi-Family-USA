#!/usr/bin/env npx tsx
// Export compact Intent Placement packets for Cursor agents (no external API).
// Usage: npx tsx scripts/automation/linker-v4/export-agent-packets.ts
//        npx tsx scripts/automation/linker-v4/export-agent-packets.ts --slugs a,b

import fs from "fs/promises";
import path from "path";
import {
  loadBlogAndCatalog,
  sampleContentParagraphs,
  targetLinkBudget,
} from "./intent-placement";
import { numberParagraphs, parseBody } from "./parse";
import {
  extractExistingInternalLinks,
  normalizeUrl,
} from "./catalog-utils";
import { rankPagesByRelevance } from "./semantic-filter";

const OUT_DIR = "scripts/automation/linker-v4/.agent-packets";

async function main() {
  const slugArg = process.argv.find((a) => a.startsWith("--slugs="));
  const only = slugArg
    ? new Set(
        slugArg
          .slice("--slugs=".length)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    : null;

  const { posts, catalog } = await loadBlogAndCatalog();
  await fs.mkdir(path.resolve(OUT_DIR), { recursive: true });

  let n = 0;
  for (const article of posts) {
    if (only && !only.has(article.slug)) continue;

    const body = parseBody(article.rawContent);
    const title = String(article.frontmatter.title || article.slug);
    const category = String(article.frontmatter.category || "investing-fundamentals");
    const region = String(article.frontmatter.region || "both");
    const paragraphs = numberParagraphs(body);
    const existing = extractExistingInternalLinks(body);
    const budget = targetLinkBudget(body, existing.size);
    const sampled = sampleContentParagraphs(paragraphs, 14);

    const ranked = await rankPagesByRelevance(body, title, article.slug, 35);
    const candidates = ranked
      .filter((p) => {
        if (normalizeUrl(p.url) === normalizeUrl(`/blog/${article.slug}`)) return false;
        if (p.url.includes("book-strategy-call")) return false;
        if (p.url.startsWith("/glossary/")) return false;
        if (existing.has(normalizeUrl(p.url))) return false;
        return true;
      })
      .slice(0, 28)
      .map((p) => {
        const full = catalog.find((c) => normalizeUrl(c.url) === normalizeUrl(p.url));
        return {
          url: full?.url || p.url,
          title: full?.title || p.title,
          readerPromise: full?.readerPromise || p.description,
          questionsAnswered: (full?.questionsAnswered || []).slice(0, 3),
          doNotLinkWhen: (full?.doNotLinkWhen || []).slice(0, 2),
          assetTypes: full?.assetTypes || [],
          category: full?.category || p.category,
        };
      });

    const packet = {
      slug: article.slug,
      title,
      category,
      region,
      budget,
      paragraphs: sampled.map((p) => ({
        index: p.index,
        text: p.text.replace(/\s+/g, " ").slice(0, 450),
      })),
      candidates,
    };

    await fs.writeFile(
      path.join(path.resolve(OUT_DIR), `${article.slug}.json`),
      JSON.stringify(packet, null, 2)
    );
    n++;
    if (n % 50 === 0) console.log(`  exported ${n}...`);
  }

  console.log(`Exported ${n} packets → ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

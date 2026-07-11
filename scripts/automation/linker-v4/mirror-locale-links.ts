#!/usr/bin/env npx tsx
// Mirror EN content-link targets into es/fr posts as localized bridge paragraphs
// when exact-anchor apply could not place them. No external API.
//
//   npx tsx scripts/automation/linker-v4/mirror-locale-links.ts
//   npx tsx scripts/automation/linker-v4/mirror-locale-links.ts --dry-run

import fs from "fs/promises";
import {
  loadMarkdownFiles,
  parseBody,
  numberParagraphs,
  extractRawFrontmatter,
  BLOG_DIR,
} from "./parse";
import { normalizeUrl, isPreservedInternalLink, loadMergedCatalog } from "./catalog-utils";
import { buildLocalizedCatalogTargetIndex } from "./localized-apply";

const BRIDGE: Record<"es" | "fr", (anchor: string, url: string) => string> = {
  es: (anchor, url) =>
    `Para profundizar en este tema, consulta nuestra guía sobre [${anchor}](${url}).`,
  fr: (anchor, url) =>
    `Pour approfondir ce sujet, consultez notre guide sur [${anchor}](${url}).`,
};

function contentUrls(body: string): Set<string> {
  const out = new Set<string>();
  for (const m of body.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    if (!m[2].startsWith("/")) continue;
    if (isPreservedInternalLink(m[2], m[1])) continue;
    out.add(normalizeUrl(m[2]));
  }
  return out;
}

function ensureTrailingSlash(url: string): string {
  const n = normalizeUrl(url);
  return n.endsWith("/") ? n : `${n}/`;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const enPosts = await loadMarkdownFiles(BLOG_DIR, "en");
  const { pages } = await loadMergedCatalog();
  const catalogTitle = new Map(
    pages.map((p) => [normalizeUrl(p.url), p.title || "related guide"])
  );

  let inserted = 0;
  let skippedPosts = 0;

  for (const lang of ["es", "fr"] as const) {
    const posts = await loadMarkdownFiles(BLOG_DIR, lang);
    const bySlug = new Map(posts.map((p) => [p.slug, p]));
    const catalogByUrl = await buildLocalizedCatalogTargetIndex(lang);
    const bridgeFn = BRIDGE[lang];

    for (const en of enPosts) {
      const article = bySlug.get(en.slug);
      if (!article) {
        skippedPosts++;
        continue;
      }

      const enUrls = contentUrls(parseBody(en.rawContent));
      if (enUrls.size === 0) continue;

      let body = parseBody(article.rawContent);
      const existing = contentUrls(body);
      const missing = [...enUrls].filter((u) => !existing.has(u));
      if (missing.length === 0) continue;

      const paragraphs = numberParagraphs(body).filter((p) => p.isContent);
      if (paragraphs.length === 0) continue;

      let changed = false;
      // Spread bridges through the article instead of stacking at one spot
      let slot = Math.floor(paragraphs.length * 0.4);

      for (const urlNorm of missing) {
        const meta = catalogByUrl.get(urlNorm);
        const anchor = (meta?.title || catalogTitle.get(urlNorm) || "related guide")
          .replace(/[\[\]]/g, "")
          .slice(0, 80);
        const url = ensureTrailingSlash(meta?.url || urlNorm);
        const bridge = bridgeFn(anchor, url);

        const para = paragraphs[Math.min(slot, paragraphs.length - 1)];
        const insertAt = para.offset + para.text.length;
        body = body.slice(0, insertAt) + `\n\n${bridge}\n` + body.slice(insertAt);
        // Re-number after mutation for subsequent inserts
        const refreshed = numberParagraphs(body).filter((p) => p.isContent);
        paragraphs.length = 0;
        paragraphs.push(...refreshed);
        slot = Math.min(slot + 2, Math.max(paragraphs.length - 1, 0));
        changed = true;
        inserted++;
        console.log(
          `${dryRun ? "[dry] " : ""}${lang}/${en.slug} → ${url}`
        );
      }

      if (changed && !dryRun) {
        const rawFrontmatter = extractRawFrontmatter(article.rawContent);
        await fs.writeFile(article.filePath, rawFrontmatter + body, "utf-8");
      }
    }
  }

  console.log(
    `\nMirrored bridge inserts: ${inserted}${dryRun ? " (dry-run)" : ""}; posts without locale twin skipped: ${skippedPosts}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

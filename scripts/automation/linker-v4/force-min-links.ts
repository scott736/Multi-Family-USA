#!/usr/bin/env npx tsx
// Force at least 1–2 validating content links for posts that only have CTAs.
// No external API.
//
//   npx tsx scripts/automation/linker-v4/force-min-links.ts --slugs-file /tmp/lc-need-coverage.txt

import fs from "fs/promises";
import path from "path";
import type { SuggestionFile } from "./types";
import {
  loadBlogAndCatalog,
  resolveAnchor,
  buildAnchorMeta,
  buildTargetMeta,
  intentOverlapScore,
  purposeText,
  type IntentLink,
} from "./intent-placement";
import { numberParagraphs, parseBody, computeContentHash } from "./parse";
import {
  extractExistingInternalLinks,
  isPillarUrl,
  isPreservedInternalLink,
  normalizeUrl,
} from "./catalog-utils";
import { findSkipZones, isInSkipZone } from "./skip-zones";
import { validateAnchorQuality, fragmentAnchorReason } from "./anchor-quality";
import {
  isNumericDataAnchor,
  passesRegionGate,
  validateSemanticGates,
} from "./semantic-gate";
import { FALLBACK_CATEGORY_PILLARS } from "./cluster-enforcement";

const SUGGESTIONS_DIR = "src/data/linker-v4/suggestions";
const MIN_LINKS = 2;

function parseArgs(argv: string[]) {
  const idx = argv.indexOf("--slugs-file");
  return { slugsFile: idx >= 0 ? argv[idx + 1] : undefined };
}

async function main() {
  const { slugsFile } = parseArgs(process.argv.slice(2));
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

  let fixed = 0;
  let stillZero = 0;

  for (const slug of slugs) {
    const article = bySlug.get(slug);
    if (!article) continue;

    const body = parseBody(article.rawContent);
    const category = String(article.frontmatter.category || "investing-fundamentals");
    const region = String(article.frontmatter.region || "both");
    const tags = (article.frontmatter.tags as string[]) || [];
    const paragraphs = numberParagraphs(body).filter((p) => p.isContent && p.index !== 1);
    const skipZones = findSkipZones(body);
    const existing = extractExistingInternalLinks(body);

    // Prefer category pillars, then high purpose overlap posts
    const pillarUrls = (FALLBACK_CATEGORY_PILLARS[category] || []).map((u) =>
      normalizeUrl(u)
    );
    const preferred = [
      ...catalog.filter((p) => pillarUrls.includes(normalizeUrl(p.url))),
      ...catalog
        .map((p) => ({
          p,
          s: intentOverlapScore(
            `${article.frontmatter.title} ${article.frontmatter.description || ""}`,
            purposeText(p)
          ),
        }))
        .filter((x) => x.s >= 0.1)
        .sort((a, b) => b.s - a.s)
        .slice(0, 40)
        .map((x) => x.p),
    ];

    const seen = new Set<string>();
    const targets = [];
    for (const t of preferred) {
      const n = normalizeUrl(t.url);
      if (seen.has(n) || t.slug === slug) continue;
      if (existing.has(n)) continue;
      if (t.url.includes("book-strategy-call") || t.url.startsWith("/glossary/")) continue;
      if (!passesRegionGate(region, category, tags, t.region || "both")) continue;
      seen.add(n);
      targets.push(t);
    }

    const usedTargets = new Set<string>();
    const usedParas = new Set<number>();
    const suggestions: IntentLink[] = [];

    for (const target of targets) {
      if (suggestions.length >= MIN_LINKS) break;
      for (const para of paragraphs) {
        if (suggestions.length >= MIN_LINKS) break;
        if (usedParas.has(para.index)) continue;
        if (usedTargets.has(normalizeUrl(target.url))) continue;

        const exact = resolveAnchor(para.text, target);
        if (!exact || isNumericDataAnchor(exact) || fragmentAnchorReason(exact)) continue;
        // skip negation-y anchors
        if (/\b(instead of|rather than|never|don't|do not|avoid|without)\b/i.test(exact))
          continue;
        if (/\b(instead of|rather than|never|don't|do not|avoid)\b/i.test(para.text))
          continue;
        if (!validateAnchorQuality(exact, buildAnchorMeta(target)).ok) continue;

        const gate = validateSemanticGates(
          exact,
          para.text,
          buildTargetMeta(target),
          region,
          category,
          tags,
          isPillarUrl(target.url)
        );
        if (!gate.passed) continue;

        const anchorPos = para.text.toLowerCase().indexOf(exact.toLowerCase());
        if (anchorPos === -1) continue;
        if (isInSkipZone(para.offset + anchorPos, exact.length, skipZones)) continue;

        suggestions.push({
          paragraphIndex: para.index,
          anchorText: exact,
          targetUrl: target.url.endsWith("/") ? target.url : `${target.url}/`,
          readerNeed: target.readerPromise || target.title,
          expectation: target.readerPromise || target.description,
          semanticIntent: "force-min-links coverage",
          confidence: 0.82,
        });
        usedTargets.add(normalizeUrl(target.url));
        usedParas.add(para.index);
      }
    }

    if (suggestions.length === 0) {
      stillZero++;
      continue;
    }

    // Merge with any existing raw that already passed, or replace
    const file: SuggestionFile = {
      sourceSlug: slug,
      sourceContentHash: computeContentHash(body),
      generatedAt: new Date().toISOString(),
      model: "intent-placement-v9-force-min",
      catalogSize: targets.length,
      raw: suggestions,
      validated: [],
    };
    await fs.writeFile(
      path.join(path.resolve(SUGGESTIONS_DIR), `${slug}.json`),
      JSON.stringify(file, null, 2)
    );
    fixed++;
  }

  console.log(`Force-min wrote ${fixed} suggestion files; still zero: ${stillZero}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

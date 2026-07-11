#!/usr/bin/env npx tsx
// ============================================
// Cursor-agent Intent Placement helper (no external API)
// ============================================
// Agents decide intents + destinations; this script resolves exact anchors,
// applies semantic gates, coverage guarantee, and writes suggestion JSON.
//
// Usage:
//   npx tsx scripts/automation/linker-v4/finalize-intent-decisions.ts \
//     --slug my-article --decisions /path/to/decisions.json
//
// decisions.json:
// { "decisions": [ { "paragraphIndex": 12, "intent": "...", "targetUrl": "/blog/foo/" } ] }

import fs from "fs/promises";
import path from "path";
import type { SuggestionFile } from "./types";
import {
  loadBlogAndCatalog,
  resolveAnchor,
  buildAnchorMeta,
  buildTargetMeta,
  ensureOutboundCoverage,
  targetLinkBudget,
  type IntentLink,
  MAX_SERVICE_PILLAR,
} from "./intent-placement";
import { numberParagraphs, parseBody, computeContentHash } from "./parse";
import {
  extractExistingInternalLinks,
  isPillarUrl,
  normalizeUrl,
} from "./catalog-utils";
import { findSkipZones, isInSkipZone } from "./skip-zones";
import { validateAnchorQuality, fragmentAnchorReason } from "./anchor-quality";
import {
  isNumericDataAnchor,
  passesRegionGate,
  validateSemanticGates,
} from "./semantic-gate";

const SUGGESTIONS_DIR = "src/data/linker-v4/suggestions";

interface Decision {
  paragraphIndex: number;
  intent: string;
  targetUrl: string;
  confidence?: number;
}

function parseArgs(argv: string[]) {
  const slugIdx = argv.indexOf("--slug");
  const decIdx = argv.indexOf("--decisions");
  return {
    slug: slugIdx >= 0 ? argv[slugIdx + 1] : undefined,
    decisionsPath: decIdx >= 0 ? argv[decIdx + 1] : undefined,
  };
}

async function main() {
  const { slug, decisionsPath } = parseArgs(process.argv.slice(2));
  if (!slug || !decisionsPath) {
    console.error(
      "Usage: finalize-intent-decisions.ts --slug <slug> --decisions <file.json>"
    );
    process.exit(1);
  }

  const raw = JSON.parse(await fs.readFile(path.resolve(decisionsPath), "utf-8"));
  const decisions: Decision[] = raw.decisions || raw;
  if (!Array.isArray(decisions)) {
    console.error("decisions must be an array or { decisions: [] }");
    process.exit(1);
  }

  const { posts, catalog } = await loadBlogAndCatalog();
  const article = posts.find((p) => p.slug === slug);
  if (!article) {
    console.error(`Article not found: ${slug}`);
    process.exit(1);
  }

  const body = parseBody(article.rawContent);
  const category = String(article.frontmatter.category || "investing-fundamentals");
  const region = String(article.frontmatter.region || "both");
  const tags = (article.frontmatter.tags as string[]) || [];
  const paragraphs = numberParagraphs(body);
  const skipZones = findSkipZones(body);
  const existingLinks = extractExistingInternalLinks(body);
  const budget = targetLinkBudget(body, existingLinks.size);
  const paraFull = new Map(paragraphs.map((p) => [p.index, p]));
  const byUrl = new Map(catalog.map((p) => [normalizeUrl(p.url), p]));

  const usedTargets = new Set<string>();
  const usedParas = new Set<number>();
  let pillarCount = 0;
  const suggestions: IntentLink[] = [];

  for (const d of decisions) {
    if (suggestions.length >= budget) break;
    const para = paraFull.get(d.paragraphIndex);
    if (!para || !para.isContent || para.index === 1) continue;
    const target = byUrl.get(normalizeUrl(d.targetUrl));
    if (!target) continue;
    if (existingLinks.has(normalizeUrl(target.url))) continue;
    if (!passesRegionGate(region, category, tags, target.region || "both")) continue;
    if (usedTargets.has(normalizeUrl(target.url))) continue;
    if (usedParas.has(para.index)) continue;
    if (isPillarUrl(target.url) && pillarCount >= MAX_SERVICE_PILLAR) continue;

    const exact = resolveAnchor(para.text, target);
    if (!exact || isNumericDataAnchor(exact) || fragmentAnchorReason(exact)) continue;
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
      readerNeed: d.intent,
      expectation: target.readerPromise || target.description,
      semanticIntent: `cursor-agent intent: ${d.intent}`,
      confidence: Math.min(0.95, Math.max(0.78, d.confidence ?? 0.88)),
    });
    usedTargets.add(normalizeUrl(target.url));
    usedParas.add(para.index);
    if (isPillarUrl(target.url)) pillarCount++;
  }

  const withCoverage = await ensureOutboundCoverage({
    article,
    existing: suggestions,
    catalog,
    minLinks: Math.min(2, budget),
  });
  const finalLinks = withCoverage.slice(0, Math.max(budget, 0));

  const outDir = path.resolve(SUGGESTIONS_DIR);
  await fs.mkdir(outDir, { recursive: true });
  const file: SuggestionFile = {
    sourceSlug: slug,
    sourceContentHash: computeContentHash(body),
    generatedAt: new Date().toISOString(),
    model: "intent-placement-v9-cursor-agent",
    catalogSize: decisions.length,
    raw: finalLinks.map(({ paragraphText: _p, ...rest }) => rest),
    validated: [],
  };
  await fs.writeFile(path.join(outDir, `${slug}.json`), JSON.stringify(file, null, 2));
  console.log(
    `${slug}: wrote ${file.raw.length} suggestions (${suggestions.length} from agent + coverage)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

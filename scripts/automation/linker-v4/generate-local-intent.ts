#!/usr/bin/env npx tsx
// ============================================
// Local Intent Placement (no external API)
// ============================================
// Uses exported agent packets (top candidates) + purpose/concept scoring.
// Safe to run fully offline / Cursor-local.
//
//   npx tsx scripts/automation/linker-v4/generate-local-intent.ts
//   npx tsx scripts/automation/linker-v4/generate-local-intent.ts --force
//   npx tsx scripts/automation/linker-v4/generate-local-intent.ts --slugs=a,b

import fs from "fs/promises";
import path from "path";
import type { SuggestionFile } from "./types";
import {
  loadBlogAndCatalog,
  resolveAnchor,
  buildAnchorMeta,
  buildTargetMeta,
  ensureOutboundCoverage,
  intentOverlapScore,
  purposeText,
  type CatalogPage,
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
import { inferConcepts } from "./concept-taxonomy";

const SUGGESTIONS_DIR = "src/data/linker-v4/suggestions";
const PACKET_DIR = "scripts/automation/linker-v4/.agent-packets";

interface Packet {
  slug: string;
  budget: number;
  paragraphs: Array<{ index: number; text: string }>;
  candidates: Array<{ url: string; title: string }>;
}

function parseArgs(argv: string[]) {
  const force = argv.includes("--force");
  const slugArg = argv.find((a) => a.startsWith("--slugs="));
  const only = slugArg
    ? new Set(
        slugArg
          .slice("--slugs=".length)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    : null;
  return { force, only };
}

async function main() {
  const { force, only } = parseArgs(process.argv.slice(2));
  const { posts, catalog } = await loadBlogAndCatalog();
  const byUrl = new Map(catalog.map((p) => [normalizeUrl(p.url), p]));
  const bySlug = new Map(posts.map((p) => [p.slug, p]));

  await fs.mkdir(path.resolve(SUGGESTIONS_DIR), { recursive: true });
  const packetFiles = (await fs.readdir(path.resolve(PACKET_DIR))).filter((f) =>
    f.endsWith(".json")
  );

  let processed = 0;
  let totalLinks = 0;
  let zeros = 0;
  let skipped = 0;

  for (const file of packetFiles) {
    const slug = file.replace(/\.json$/, "");
    if (only && !only.has(slug)) continue;

    const outPath = path.join(path.resolve(SUGGESTIONS_DIR), `${slug}.json`);
    if (!force) {
      try {
        await fs.access(outPath);
        skipped++;
        continue;
      } catch {
        // generate
      }
    }

    const article = bySlug.get(slug);
    if (!article) continue;

    const packet = JSON.parse(
      await fs.readFile(path.join(path.resolve(PACKET_DIR), file), "utf-8")
    ) as Packet;

    const body = parseBody(article.rawContent);
    const category = String(article.frontmatter.category || "investing-fundamentals");
    const region = String(article.frontmatter.region || "both");
    const tags = (article.frontmatter.tags as string[]) || [];
    const paragraphs = numberParagraphs(body);
    const paraFull = new Map(paragraphs.map((p) => [p.index, p]));
    const skipZones = findSkipZones(body);
    const existingLinks = extractExistingInternalLinks(body);
    const budget = packet.budget;

    if (budget <= 0) {
      processed++;
      zeros++;
      continue;
    }

    const targets: CatalogPage[] = [];
    for (const c of packet.candidates) {
      const page = byUrl.get(normalizeUrl(c.url));
      if (!page) continue;
      if (existingLinks.has(normalizeUrl(page.url))) continue;
      if (!passesRegionGate(region, category, tags, page.region || "both")) continue;
      targets.push(page);
    }

    const scored: Array<{
      paraIndex: number;
      target: CatalogPage;
      score: number;
      intent: string;
    }> = [];

    for (const p of packet.paragraphs) {
      const para = paraFull.get(p.index);
      if (!para) continue;
      const concepts = inferConcepts(para.text);
      for (const target of targets) {
        let score = intentOverlapScore(para.text, purposeText(target));
        const tConcepts = (target.financingConcepts || []) as string[];
        if (concepts.length && tConcepts.length) {
          const hit = concepts.filter((c) => (tConcepts as string[]).includes(c)).length;
          score += (hit / Math.max(tConcepts.length, 1)) * 0.25;
        }
        for (const q of target.questionsAnswered || []) {
          score += intentOverlapScore(para.text, q) * 0.15;
        }
        if (score < 0.14) continue;
        scored.push({
          paraIndex: p.index,
          target,
          score,
          intent:
            (target.questionsAnswered || [])[0] ||
            target.readerPromise ||
            `Learn more about ${target.title}`,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    const usedTargets = new Set<string>();
    const usedParas = new Set<number>();
    let pillarCount = 0;
    const suggestions: IntentLink[] = [];

    for (const c of scored) {
      if (suggestions.length >= budget) break;
      const para = paraFull.get(c.paraIndex);
      if (!para) continue;
      const norm = normalizeUrl(c.target.url);
      if (usedTargets.has(norm) || usedParas.has(para.index)) continue;
      if (isPillarUrl(c.target.url) && pillarCount >= MAX_SERVICE_PILLAR) continue;

      const exact = resolveAnchor(para.text, c.target);
      if (!exact || isNumericDataAnchor(exact) || fragmentAnchorReason(exact)) continue;
      if (!validateAnchorQuality(exact, buildAnchorMeta(c.target)).ok) continue;

      const gate = validateSemanticGates(
        exact,
        para.text,
        buildTargetMeta(c.target),
        region,
        category,
        tags,
        isPillarUrl(c.target.url)
      );
      if (!gate.passed) continue;

      const anchorPos = para.text.toLowerCase().indexOf(exact.toLowerCase());
      if (anchorPos === -1) continue;
      if (isInSkipZone(para.offset + anchorPos, exact.length, skipZones)) continue;

      suggestions.push({
        paragraphIndex: para.index,
        anchorText: exact,
        targetUrl: c.target.url.endsWith("/") ? c.target.url : `${c.target.url}/`,
        readerNeed: c.intent,
        expectation: c.target.readerPromise || c.target.description,
        semanticIntent: `local-intent score ${c.score.toFixed(2)}`,
        confidence: Math.min(0.95, 0.75 + c.score * 0.35),
      });
      usedTargets.add(norm);
      usedParas.add(para.index);
      if (isPillarUrl(c.target.url)) pillarCount++;
    }

    const withCoverage = await ensureOutboundCoverage({
      article,
      existing: suggestions,
      catalog,
      minLinks: Math.min(2, budget),
    });
    const finalLinks = withCoverage.slice(0, budget);

    const suggestionFile: SuggestionFile = {
      sourceSlug: slug,
      sourceContentHash: computeContentHash(body),
      generatedAt: new Date().toISOString(),
      model: "intent-placement-v9-local-cursor",
      catalogSize: targets.length,
      raw: finalLinks.map(({ paragraphText: _p, ...rest }) => rest),
      validated: [],
    };
    await fs.writeFile(outPath, JSON.stringify(suggestionFile, null, 2));

    processed++;
    totalLinks += finalLinks.length;
    if (finalLinks.length === 0) zeros++;
    if (processed % 50 === 0) {
      console.log(`  ${processed} written, ${totalLinks} links, zeros=${zeros}, skipped=${skipped}`);
    }
  }

  console.log(
    `\nLocal intent complete: wrote ${processed}, skipped ${skipped}, links ${totalLinks}, zeros ${zeros}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

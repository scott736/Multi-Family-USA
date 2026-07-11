// ============================================
// Smart Linker v8 — Deterministic Local Generation
// ============================================
// TF-IDF retrieval + concept/asset/reader-intent semantic gates.

import fs from "fs/promises";
import path from "path";
import type { CLIOptions } from "../types";
import type { V3Suggestion, SuggestionFile, RankedPage } from "./types";
import {
  loadMarkdownFiles,
  numberParagraphs,
  parseBody,
  computeContentHash,
  BLOG_DIR,
} from "./parse";
import { rankPagesByRelevance } from "./semantic-filter";
import {
  loadMergedCatalog,
  extractExistingInternalLinks,
  isPillarUrl,
  normalizeUrl,
} from "./catalog-utils";
import { findSkipZones, isInSkipZone } from "./skip-zones";
import { extractAnchorFromParagraph } from "./anchor-extract";
import {
  passesRegionGate,
  validateSemanticGates,
  scoreSemanticCandidate,
  type TargetMeta,
} from "./semantic-gate";
import { loadLinkGraph } from "./link-graph";

const SUGGESTIONS_DIR = "src/data/linker-v4/suggestions";
const MAX_SERVICE_PILLAR = 2;
const MIN_CANDIDATE_SCORE = 0.26;
const MIN_CONFIDENCE = 0.75;
const MAX_LINKS_PER_ARTICLE = 8;
const WORDS_PER_LINK = 200;

interface ScoredCandidate {
  paragraphIndex: number;
  paragraphText: string;
  target: RankedPage;
  anchor: string;
  score: number;
}

function buildTargetMeta(target: RankedPage): TargetMeta {
  return {
    title: target.title,
    description: target.description,
    tags: target.tags,
    url: target.url,
    linkWhen: target.linkWhen,
    doNotLinkWhen: target.doNotLinkWhen,
    region: target.region,
    category: target.category,
    readerPromise: target.readerPromise,
    questionsAnswered: target.questionsAnswered,
    topicsCovered: target.topicsCovered,
    topicsExcluded: target.topicsExcluded,
    financingConcepts: target.financingConcepts,
    assetTypes: target.assetTypes,
  };
}

function buildAnchorMeta(target: RankedPage) {
  return {
    title: target.title,
    description: target.description,
    tags: target.tags,
    url: target.url,
    readerPromise: target.readerPromise,
    questionsAnswered: target.questionsAnswered,
    linkWhen: target.linkWhen,
    topicsCovered: target.topicsCovered,
    financingConcepts: target.financingConcepts,
  };
}

export async function generateDeterministic(options: CLIOptions): Promise<void> {
  const { slug, all, dryRun, force } = options;

  console.log("Generating link suggestions (deterministic v8 / semantic accuracy)...\n");

  const { pages: catalogPages, enrichedCount } = await loadMergedCatalog();
  console.log(`  Purpose cards loaded: ${enrichedCount} enriched pages\n`);

  const blogPosts = await loadMarkdownFiles(BLOG_DIR);
  let articles = blogPosts;

  if (slug) {
    articles = blogPosts.filter((a) => a.slug === slug);
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

  void catalogPages;
  void loadLinkGraph();

  let totalSuggestions = 0;
  let processed = 0;

  for (const article of articles) {
    if (!slug && !force) {
      const existingPath = path.join(suggestionsDir, `${article.slug}.json`);
      try {
        await fs.access(existingPath);
        continue;
      } catch {
        // generate
      }
    }

    const body = parseBody(article.rawContent);
    const title = String(article.frontmatter.title || article.slug);
    const category = String(article.frontmatter.category || "investing-fundamentals");
    const region = String(article.frontmatter.region || "both");
    const tags = (article.frontmatter.tags as string[]) || [];
    const paragraphs = numberParagraphs(body);
    const skipZones = findSkipZones(body);
    const existingLinks = extractExistingInternalLinks(body);

    const wordCount = body.split(/\s+/).filter(Boolean).length;
    const targetCount = Math.max(
      0,
      Math.min(Math.max(2, Math.round(wordCount / WORDS_PER_LINK)), MAX_LINKS_PER_ARTICLE) -
        existingLinks.size
    );

    if (targetCount === 0) {
      processed++;
      continue;
    }

    const ranked = await rankPagesByRelevance(body, title, article.slug, 40);
    const candidates: ScoredCandidate[] = [];

    const contentParagraphs = paragraphs.filter((p) => p.isContent);
    const maxSampled = 40;
    const sampledParas =
      contentParagraphs.length <= maxSampled
        ? contentParagraphs
        : contentParagraphs.filter(
            (_, i) => i % Math.ceil(contentParagraphs.length / maxSampled) === 0
          );

    for (const target of ranked) {
      if (target.url.includes("book-strategy-call")) continue;
      if (existingLinks.has(target.url.replace(/\/$/, ""))) continue;
      if (!passesRegionGate(region, category, tags, target.region || "both")) continue;

      const meta = buildTargetMeta(target);
      const isPillar = isPillarUrl(target.url);

      for (const para of sampledParas) {
        if (para.index === 1) continue;

        const anchor = extractAnchorFromParagraph(para.text, buildAnchorMeta(target), 0.26);
        if (!anchor) continue;

        const anchorPos = para.text.toLowerCase().indexOf(anchor.toLowerCase());
        if (anchorPos === -1) continue;
        const bodyPos = para.offset + anchorPos;
        if (isInSkipZone(bodyPos, anchor.length, skipZones)) continue;

        const gate = validateSemanticGates(
          anchor,
          para.text,
          meta,
          region,
          category,
          tags,
          isPillar
        );
        if (!gate.passed) continue;

        const score = scoreSemanticCandidate(
          anchor,
          para.text,
          meta,
          target.finalScore || 0
        );

        if (score < MIN_CANDIDATE_SCORE) continue;

        candidates.push({
          paragraphIndex: para.index,
          paragraphText: para.text,
          target,
          anchor,
          score,
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    const usedTargets = new Set<string>();
    const usedParagraphs = new Set<number>();
    let pillarCount = 0;
    const suggestions: V3Suggestion[] = [];

    for (const c of candidates) {
      if (suggestions.length >= targetCount) break;

      const normUrl = normalizeUrl(c.target.url);
      if (usedTargets.has(normUrl)) continue;
      if (usedParagraphs.has(c.paragraphIndex)) continue;

      if (isPillarUrl(c.target.url) && pillarCount >= MAX_SERVICE_PILLAR) continue;

      const confidence = Math.min(0.95, 0.7 + c.score * 0.55);
      if (confidence < MIN_CONFIDENCE) continue;

      suggestions.push({
        paragraphIndex: c.paragraphIndex,
        anchorText: c.anchor,
        targetUrl: c.target.url,
        readerNeed: c.target.readerPromise || `Reader would benefit from depth on ${c.target.title}`,
        expectation: c.target.readerPromise || c.target.description,
        semanticIntent: `v8 semantic match: score ${c.score.toFixed(2)}`,
        confidence: Math.round(confidence * 100) / 100,
      });

      usedTargets.add(normUrl);
      usedParagraphs.add(c.paragraphIndex);
      if (isPillarUrl(c.target.url)) pillarCount++;
    }

    totalSuggestions += suggestions.length;
    processed++;

    if (dryRun) {
      console.log(`  ${article.slug}: ${suggestions.length} suggestions (v8)`);
      continue;
    }

    if (suggestions.length > 0 || force) {
      const suggestionFile: SuggestionFile = {
        sourceSlug: article.slug,
        sourceContentHash: computeContentHash(body),
        generatedAt: new Date().toISOString(),
        model: "deterministic-v8",
        catalogSize: ranked.length,
        raw: suggestions,
        validated: [],
      };
      await fs.writeFile(
        path.join(suggestionsDir, `${article.slug}.json`),
        JSON.stringify(suggestionFile, null, 2)
      );
    }

    if (processed % 25 === 0) {
      console.log(`  Processed ${processed}/${articles.length}...`);
    }
  }

  console.log(`\nDeterministic generation complete:`);
  console.log(`  Articles processed: ${processed}`);
  console.log(`  Total suggestions: ${totalSuggestions}`);
}

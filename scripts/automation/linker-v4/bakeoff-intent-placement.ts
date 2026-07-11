#!/usr/bin/env npx tsx
// ============================================
// Bakeoff: deterministic-v8 vs Intent Placement (v9 prototype)
// ============================================
// Writes ONLY to scripts/automation/linker-v4/.bakeoff/ — never touches
// production suggestions/ or markdown.
//
// Usage:
//   npx tsx scripts/automation/linker-v4/bakeoff-intent-placement.ts
//   npx tsx scripts/automation/linker-v4/bakeoff-intent-placement.ts --slugs a,b
//   npx tsx scripts/automation/linker-v4/bakeoff-intent-placement.ts --skip-judge

import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import LlmClient from "../shared/llm";
import { MODELS } from "../config";
import type { PagePurpose, RankedPage } from "./types";

/** Catalog page with purpose fields used by the v9 prototype. */
type CatalogPage = RankedPage &
  Pick<PagePurpose, "assetTypes" | "unitRange" | "questionsAnswered">;
import {
  loadMarkdownFiles,
  numberParagraphs,
  parseBody,
  BLOG_DIR,
} from "./parse";
import { rankPagesByRelevance, tokenize } from "./semantic-filter";
import {
  extractExistingInternalLinks,
  isPillarUrl,
  loadMergedCatalog,
  normalizeUrl,
} from "./catalog-utils";
import { findSkipZones, isInSkipZone } from "./skip-zones";
import { extractAnchorFromParagraph } from "./anchor-extract";
import {
  fragmentAnchorReason,
  validateAnchorQuality,
} from "./anchor-quality";
import {
  isNumericDataAnchor,
  passesRegionGate,
  scoreSemanticCandidate,
  validateSemanticGates,
  type TargetMeta,
} from "./semantic-gate";

const OUT_DIR = path.resolve("scripts/automation/linker-v4/.bakeoff");
const DEFAULT_SLUGS = [
  "dscr-mortgage-qualifying-guide",
  "commercial-bridge-financing-canada-guide",
  "hamilton-ontario-real-estate-investment-guide",
  "joint-venture-real-estate-how-to-scale-to-150-doors",
  "how-to-refinance-commercial-property-canada",
  "canadian-investing-us-real-estate-pros-cons",
  "multifamily-investing-beginners-guide",
  "debt-ratios-explained-get-approved-for-more",
];

const MAX_SERVICE_PILLAR = 2;
const MIN_CANDIDATE_SCORE = 0.26;
const MIN_CONFIDENCE = 0.75;
const MAX_LINKS_PER_ARTICLE = 8;
const WORDS_PER_LINK = 200;
const MAX_SAMPLED_PARAS = 16;
const CANDIDATES_PER_INTENT = 6;

interface BakeoffLink {
  paragraphIndex: number;
  paragraphText: string;
  anchorText: string;
  targetUrl: string;
  targetTitle: string;
  readerPromise: string;
  confidence: number;
  method: "v8" | "v9";
  intent?: string;
  reason?: string;
}

interface ArticleResult {
  slug: string;
  title: string;
  v8: BakeoffLink[];
  v9: BakeoffLink[];
}

interface MetricRow {
  system: "v8" | "v9";
  links: number;
  fragmentRate: number;
  numericRate: number;
  avgAnchorWords: number;
  avgConfidence: number;
  judgeKeepRate?: number;
  judgeKept?: number;
  judgeTotal?: number;
}

interface JudgeVerdict {
  system: "v8" | "v9";
  index: number;
  keep: boolean;
  reason: string;
  score: number;
}

function parseArgs(argv: string[]) {
  const skipJudge = argv.includes("--skip-judge");
  const slugArg = argv.find((a) => a.startsWith("--slugs="));
  const slugs = slugArg
    ? slugArg
        .slice("--slugs=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : DEFAULT_SLUGS;
  return { skipJudge, slugs };
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

function purposeText(p: {
  title: string;
  description?: string;
  readerPromise?: string;
  questionsAnswered?: string[];
  topicsCovered?: string[];
  linkWhen?: string[];
  tags?: string[];
}): string {
  return [
    p.title,
    p.description || "",
    p.readerPromise || "",
    (p.questionsAnswered || []).join(" "),
    (p.topicsCovered || []).join(" "),
    (p.linkWhen || []).join(" "),
    (p.tags || []).join(" "),
  ].join(" ");
}

function intentOverlapScore(intent: string, pagePurpose: string): number {
  const a = new Set(tokenize(intent));
  const b = new Set(tokenize(pagePurpose));
  if (a.size === 0 || b.size === 0) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit++;
  return hit / Math.sqrt(a.size * b.size);
}

function findExactAnchor(paragraph: string, proposed: string): string | null {
  const cleanPara = paragraph.replace(/\*\*|__|\*|_|~~/g, "");
  const needle = proposed.trim();
  if (!needle) return null;
  const idx = cleanPara.toLowerCase().indexOf(needle.toLowerCase());
  if (idx === -1) return null;
  return cleanPara.slice(idx, idx + needle.length);
}

/** Prefer extractor; fall back to longest purpose-card phrase present in the paragraph. */
function resolveAnchor(paragraph: string, target: CatalogPage): string | null {
  const extracted = extractAnchorFromParagraph(paragraph, buildAnchorMeta(target), 0.18);
  if (extracted) return extracted;

  const phrases = [
    ...(target.questionsAnswered || []),
    ...(target.linkWhen || []),
    target.readerPromise || "",
    target.title,
  ]
    .map((p) => p.replace(/^when the article (discusses|mentions)\s+/i, "").trim())
    .filter((p) => p.split(/\s+/).length >= 5 && p.split(/\s+/).length <= 14)
    .sort((a, b) => b.length - a.length);

  for (const phrase of phrases) {
    const hit = findExactAnchor(paragraph, phrase);
    if (!hit) continue;
    if (fragmentAnchorReason(hit)) continue;
    if (isNumericDataAnchor(hit)) continue;
    return hit;
  }
  return null;
}

function sampleContentParagraphs(
  paragraphs: ReturnType<typeof numberParagraphs>,
  max = MAX_SAMPLED_PARAS
) {
  const content = paragraphs.filter((p) => p.isContent && p.index !== 1);
  if (content.length <= max) return content;
  const step = Math.ceil(content.length / max);
  return content.filter((_, i) => i % step === 0).slice(0, max);
}

function targetLinkBudget(body: string, existingCount: number): number {
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  return Math.max(
    0,
    Math.min(Math.max(2, Math.round(wordCount / WORDS_PER_LINK)), MAX_LINKS_PER_ARTICLE) -
      existingCount
  );
}

async function generateV8(
  article: Awaited<ReturnType<typeof loadMarkdownFiles>>[number]
): Promise<BakeoffLink[]> {
  const body = parseBody(article.rawContent);
  const title = String(article.frontmatter.title || article.slug);
  const category = String(article.frontmatter.category || "investing-fundamentals");
  const region = String(article.frontmatter.region || "both");
  const tags = (article.frontmatter.tags as string[]) || [];
  const paragraphs = numberParagraphs(body);
  const skipZones = findSkipZones(body);
  const existingLinks = extractExistingInternalLinks(body);
  const budget = targetLinkBudget(body, existingLinks.size);
  if (budget === 0) return [];

  const ranked = await rankPagesByRelevance(body, title, article.slug, 40);
  const sampled = sampleContentParagraphs(paragraphs, 40);
  const candidates: Array<{
    paragraphIndex: number;
    paragraphText: string;
    target: RankedPage;
    anchor: string;
    score: number;
  }> = [];

  for (const target of ranked) {
    if (target.url.includes("book-strategy-call")) continue;
    if (existingLinks.has(target.url.replace(/\/$/, ""))) continue;
    if (!passesRegionGate(region, category, tags, target.region || "both")) continue;

    const meta = buildTargetMeta(target);
    const isPillar = isPillarUrl(target.url);

    for (const para of sampled) {
      const anchor = extractAnchorFromParagraph(para.text, buildAnchorMeta(target), 0.26);
      if (!anchor) continue;

      const anchorPos = para.text.toLowerCase().indexOf(anchor.toLowerCase());
      if (anchorPos === -1) continue;
      if (isInSkipZone(para.offset + anchorPos, anchor.length, skipZones)) continue;

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
  const usedParas = new Set<number>();
  let pillarCount = 0;
  const out: BakeoffLink[] = [];

  for (const c of candidates) {
    if (out.length >= budget) break;
    const norm = normalizeUrl(c.target.url);
    if (usedTargets.has(norm) || usedParas.has(c.paragraphIndex)) continue;
    if (isPillarUrl(c.target.url) && pillarCount >= MAX_SERVICE_PILLAR) continue;

    const confidence = Math.min(0.95, 0.7 + c.score * 0.55);
    if (confidence < MIN_CONFIDENCE) continue;

    out.push({
      paragraphIndex: c.paragraphIndex,
      paragraphText: c.paragraphText.slice(0, 280),
      anchorText: c.anchor,
      targetUrl: c.target.url,
      targetTitle: c.target.title,
      readerPromise: c.target.readerPromise || c.target.description,
      confidence: Math.round(confidence * 100) / 100,
      method: "v8",
      reason: `v8 score ${c.score.toFixed(2)}`,
    });
    usedTargets.add(norm);
    usedParas.add(c.paragraphIndex);
    if (isPillarUrl(c.target.url)) pillarCount++;
  }

  return out;
}

async function extractIntents(
  client: LlmClient,
  modelId: string,
  title: string,
  paragraphs: Array<{ index: number; text: string }>
): Promise<Array<{ paragraphIndex: number; intent: string }>> {
  const lines = paragraphs.map(
    (p) => `[P${p.index}] ${p.text.replace(/\s+/g, " ").slice(0, 420)}`
  );

  const prompt = [
    "You extract reader intents from a mortgage/real estate article.",
    "For each paragraph, decide if a curious reader would have a specific follow-up question that another page on this site could answer.",
    "Only emit intents that are financing/investing questions — not vague curiosity.",
    "Skip paragraphs that are pure storytelling, CTAs, or already fully self-contained.",
    "Return at most 8 intents total. Prefer distinct questions.",
    "",
    `Article: ${title}`,
    "",
    "Paragraphs:",
    lines.join("\n\n"),
    "",
    "Use the extract_intents tool.",
  ].join("\n");

  const response = await client.messages.create({
    model: modelId,
    max_tokens: 1800,
    messages: [{ role: "user", content: prompt }],
    tools: [
      {
        name: "extract_intents",
        description: "Reader intents implied by paragraphs",
        input_schema: {
          type: "object",
          properties: {
            intents: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  paragraphIndex: { type: "number" },
                  intent: { type: "string" },
                },
                required: ["paragraphIndex", "intent"],
              },
            },
          },
          required: ["intents"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "extract_intents" },
  });

  const tool = response.content.find((b) => b.type === "tool_use") as
    | { type: "tool_use"; input: { intents?: Array<{ paragraphIndex: number; intent: string }> } }
    | undefined;

  const intents = tool?.input?.intents || [];
  const allowed = new Set(paragraphs.map((p) => p.index));
  return intents
    .filter((i) => allowed.has(i.paragraphIndex) && i.intent?.trim())
    .slice(0, 8);
}

async function placeLinksForIntents(
  client: LlmClient,
  modelId: string,
  title: string,
  placements: Array<{
    paragraphIndex: number;
    paragraphText: string;
    intent: string;
    candidates: Array<{
      url: string;
      title: string;
      readerPromise: string;
      questionsAnswered: string[];
      doNotLinkWhen: string[];
      assetTypes: string[];
    }>;
  }>
): Promise<
  Array<{
    paragraphIndex: number;
    intent: string;
    keep: boolean;
    targetUrl: string;
    reason: string;
    confidence: number;
  }>
> {
  if (placements.length === 0) return [];

  const blocks = placements.map((p, i) => {
    const cands = p.candidates
      .map(
        (c, j) =>
          `  (${j}) ${c.url}\n      title: ${c.title}\n      promise: ${c.readerPromise}\n      answers: ${(c.questionsAnswered || []).slice(0, 3).join("; ")}\n      doNotLinkWhen: ${(c.doNotLinkWhen || []).slice(0, 2).join("; ") || "n/a"}`
      )
      .join("\n");
    return [
      `[${i}] P${p.paragraphIndex}`,
      `intent: ${p.intent}`,
      `paragraph: ${p.paragraphText.replace(/\s+/g, " ").slice(0, 500)}`,
      `candidates:\n${cands}`,
    ].join("\n");
  });

  const prompt = [
    "You select internal-link destinations using Intent Placement rules.",
    "For each item, keep=true ONLY if one candidate page clearly answers the stated intent.",
    "REJECT if vocabulary overlaps but the page answers a different question.",
    "REJECT wrong asset class / region mismatches.",
    "If keep=true, targetUrl must be exactly one of the candidate URLs.",
    "Do NOT invent anchors — destination selection only.",
    "Prefer fewer high-quality links over many weak ones.",
    "",
    `Article: ${title}`,
    "",
    blocks.join("\n\n"),
    "",
    "Use the place_links tool. Return a verdict for EVERY index.",
  ].join("\n");

  const response = await client.messages.create({
    model: modelId,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
    tools: [
      {
        name: "place_links",
        description: "Intent-placement destination keep/reject",
        input_schema: {
          type: "object",
          properties: {
            verdicts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  index: { type: "number" },
                  keep: { type: "boolean" },
                  targetUrl: { type: "string" },
                  reason: { type: "string" },
                  confidence: { type: "number" },
                },
                required: ["index", "keep", "reason"],
              },
            },
          },
          required: ["verdicts"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "place_links" },
  });

  const tool = response.content.find((b) => b.type === "tool_use") as
    | {
        type: "tool_use";
        input: {
          verdicts?: Array<{
            index: number;
            keep: boolean;
            targetUrl?: string;
            reason: string;
            confidence?: number;
          }>;
        };
      }
    | undefined;

  const verdicts = tool?.input?.verdicts || [];
  return verdicts.map((v) => {
    const placement = placements[v.index];
    return {
      paragraphIndex: placement?.paragraphIndex ?? -1,
      intent: placement?.intent || "",
      keep: Boolean(v.keep),
      targetUrl: v.targetUrl || "",
      reason: v.reason || "",
      confidence: typeof v.confidence === "number" ? v.confidence : 0.8,
    };
  });
}

async function generateV9(
  client: LlmClient,
  modelId: string,
  article: Awaited<ReturnType<typeof loadMarkdownFiles>>[number],
  catalogPages: CatalogPage[]
): Promise<BakeoffLink[]> {
  const body = parseBody(article.rawContent);
  const title = String(article.frontmatter.title || article.slug);
  const category = String(article.frontmatter.category || "investing-fundamentals");
  const region = String(article.frontmatter.region || "both");
  const tags = (article.frontmatter.tags as string[]) || [];
  const paragraphs = numberParagraphs(body);
  const skipZones = findSkipZones(body);
  const existingLinks = extractExistingInternalLinks(body);
  const budget = targetLinkBudget(body, existingLinks.size);
  if (budget === 0) return [];

  const sampled = sampleContentParagraphs(paragraphs, MAX_SAMPLED_PARAS);
  const intents = await extractIntents(
    client,
    modelId,
    title,
    sampled.map((p) => ({ index: p.index, text: p.text }))
  );
  console.log(`    intents: ${intents.length}`);

  const paraByIndex = new Map(sampled.map((p) => [p.index, p]));
  const eligibleCatalog = catalogPages.filter((p) => {
    if (p.slug === article.slug) return false;
    if (p.url.includes("book-strategy-call")) return false;
    if (p.url.startsWith("/glossary/")) return false;
    if (existingLinks.has(p.url.replace(/\/$/, ""))) return false;
    if (!passesRegionGate(region, category, tags, p.region || "both")) return false;
    return true;
  });

  const dropReasons: Record<string, number> = {};
  const bump = (reason: string) => {
    dropReasons[reason] = (dropReasons[reason] || 0) + 1;
  };

  const placements: Array<{
    paragraphIndex: number;
    paragraphText: string;
    intent: string;
    candidates: Array<{
      url: string;
      title: string;
      readerPromise: string;
      questionsAnswered: string[];
      doNotLinkWhen: string[];
      assetTypes: string[];
    }>;
    candidatePages: CatalogPage[];
  }> = [];

  for (const intent of intents) {
    const para = paraByIndex.get(intent.paragraphIndex);
    if (!para) {
      bump("missing-paragraph");
      continue;
    }

    // Blend purpose-card overlap with article-level TF-IDF ranking of the intent.
    const rankedForIntent = await rankPagesByRelevance(
      intent.intent,
      intent.intent,
      article.slug,
      25
    );
    const rankBoost = new Map(
      rankedForIntent.map((p, i) => [normalizeUrl(p.url), 1 - i / Math.max(1, rankedForIntent.length)])
    );

    const scored = eligibleCatalog
      .map((page) => {
        const overlap = intentOverlapScore(intent.intent, purposeText(page));
        const boost = rankBoost.get(normalizeUrl(page.url)) || 0;
        return { page, score: overlap * 0.65 + boost * 0.35 };
      })
      .filter((x) => x.score >= 0.05)
      .sort((a, b) => b.score - a.score)
      .slice(0, CANDIDATES_PER_INTENT);

    if (scored.length === 0) {
      bump("no-candidates");
      continue;
    }

    placements.push({
      paragraphIndex: para.index,
      paragraphText: para.text,
      intent: intent.intent,
      candidates: scored.map(({ page }) => ({
        url: page.url,
        title: page.title,
        readerPromise: page.readerPromise || page.description,
        questionsAnswered: page.questionsAnswered || [],
        doNotLinkWhen: page.doNotLinkWhen || [],
        assetTypes: page.assetTypes || [],
      })),
      candidatePages: scored.map((s) => s.page),
    });
  }

  const verdicts = await placeLinksForIntents(
    client,
    modelId,
    title,
    placements.map(({ candidatePages: _c, ...rest }) => rest)
  );
  console.log(
    `    llm kept: ${verdicts.filter((v) => v.keep).length}/${verdicts.length}`
  );

  const pageByUrl = new Map(
    placements.flatMap((p) => p.candidatePages.map((c) => [normalizeUrl(c.url), c] as const))
  );
  const paraFull = new Map(paragraphs.map((p) => [p.index, p]));

  const usedTargets = new Set<string>();
  const usedParas = new Set<number>();
  let pillarCount = 0;
  const out: BakeoffLink[] = [];

  for (const v of verdicts) {
    if (!v.keep) {
      bump("llm-reject");
      continue;
    }
    if (out.length >= budget) {
      bump("budget");
      continue;
    }
    if (v.paragraphIndex < 0) {
      bump("bad-index");
      continue;
    }
    if (usedParas.has(v.paragraphIndex)) {
      bump("dup-para");
      continue;
    }

    const para = paraFull.get(v.paragraphIndex);
    if (!para) {
      bump("missing-para");
      continue;
    }

    const norm = normalizeUrl(v.targetUrl);
    const target = pageByUrl.get(norm);
    if (!target) {
      bump("target-not-in-candidates");
      continue;
    }
    if (usedTargets.has(norm)) {
      bump("dup-target");
      continue;
    }
    if (isPillarUrl(target.url) && pillarCount >= MAX_SERVICE_PILLAR) {
      bump("pillar-cap");
      continue;
    }

    // Local exact-substring anchor extraction (do not trust LLM phrasing).
    const exact = resolveAnchor(para.text, target);
    if (!exact) {
      bump("no-exact-anchor");
      continue;
    }
    if (isNumericDataAnchor(exact)) {
      bump("numeric-anchor");
      continue;
    }

    const quality = validateAnchorQuality(exact, buildAnchorMeta(target));
    if (!quality.ok) {
      bump(quality.reason || "anchor-quality");
      continue;
    }

    // Soft gate for v9: region already checked; skip heavy concept gates that
    // fight the LLM entailment decision. Still reject clear doNotLinkWhen hits.
    const meta = buildTargetMeta(target);
    if (meta.doNotLinkWhen?.length) {
      const gate = validateSemanticGates(
        exact,
        para.text,
        meta,
        region,
        category,
        tags,
        isPillarUrl(target.url)
      );
      if (!gate.passed && gate.reason === "do-not-link-when") {
        bump("do-not-link-when");
        continue;
      }
    }

    const anchorPos = para.text.toLowerCase().indexOf(exact.toLowerCase());
    if (anchorPos === -1) {
      bump("anchor-not-in-para");
      continue;
    }
    if (isInSkipZone(para.offset + anchorPos, exact.length, skipZones)) {
      bump("skip-zone");
      continue;
    }

    const confidence = Math.min(0.95, Math.max(0.75, v.confidence || 0.85));
    out.push({
      paragraphIndex: v.paragraphIndex,
      paragraphText: para.text.slice(0, 280),
      anchorText: exact,
      targetUrl: target.url,
      targetTitle: target.title,
      readerPromise: target.readerPromise || target.description,
      confidence,
      method: "v9",
      intent: v.intent,
      reason: v.reason,
    });

    usedTargets.add(norm);
    usedParas.add(v.paragraphIndex);
    if (isPillarUrl(target.url)) pillarCount++;
  }

  const topDrops = Object.entries(dropReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, n]) => `${k}:${n}`)
    .join(", ");
  if (topDrops) console.log(`    drops: ${topDrops}`);

  return out;
}

function metricsFor(links: BakeoffLink[], system: "v8" | "v9"): MetricRow {
  const n = links.length || 1;
  const fragments = links.filter((l) => fragmentAnchorReason(l.anchorText)).length;
  const numeric = links.filter((l) => isNumericDataAnchor(l.anchorText)).length;
  const words =
    links.reduce((sum, l) => sum + l.anchorText.trim().split(/\s+/).filter(Boolean).length, 0) /
    n;
  const conf = links.reduce((sum, l) => sum + l.confidence, 0) / n;
  return {
    system,
    links: links.length,
    fragmentRate: links.length ? fragments / links.length : 0,
    numericRate: links.length ? numeric / links.length : 0,
    avgAnchorWords: Math.round(words * 10) / 10,
    avgConfidence: Math.round(conf * 100) / 100,
  };
}

async function judgeAll(
  client: LlmClient,
  modelId: string,
  results: ArticleResult[]
): Promise<JudgeVerdict[]> {
  const all: Array<{
    system: "v8" | "v9";
    index: number;
    slug: string;
    title: string;
    link: BakeoffLink;
  }> = [];

  for (const r of results) {
    r.v8.forEach((link, i) =>
      all.push({ system: "v8", index: all.length, slug: r.slug, title: r.title, link })
    );
    r.v9.forEach((link) =>
      all.push({ system: "v9", index: all.length, slug: r.slug, title: r.title, link })
    );
  }

  if (all.length === 0) return [];

  // Batch in chunks of 12 to keep prompts tight
  const verdicts: JudgeVerdict[] = [];
  for (let start = 0; start < all.length; start += 12) {
    const chunk = all.slice(start, start + 12);
    const lines = chunk.map((item, i) =>
      [
        `[${i}]`,
        `  article: ${item.title}`,
        `  system: ${item.system}`,
        `  intent: ${item.link.intent || "(none — substring match)"}`,
        `  anchor: "${item.link.anchorText}"`,
        `  target: ${item.link.targetTitle}`,
        `  promise: ${item.link.readerPromise}`,
        `  context: ${item.link.paragraphText}`,
      ].join("\n")
    );

    const prompt = [
      "You are a strict semantic judge for internal links.",
      "Score whether clicking the anchor would deliver what a careful reader expects.",
      "keep=true only when destination answers the implied question and anchor is a complete, non-misleading phrase.",
      "score is 0–10 (10 = perfect semantic fit).",
      "Reject fragments, wrong asset class, topic bait-and-switch, and numeric data anchors.",
      "",
      lines.join("\n\n"),
      "",
      "Use judge_batch for EVERY index.",
    ].join("\n");

    const response = await client.messages.create({
      model: modelId,
      max_tokens: 2200,
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          name: "judge_batch",
          description: "Semantic keep/reject for bakeoff links",
          input_schema: {
            type: "object",
            properties: {
              verdicts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "number" },
                    keep: { type: "boolean" },
                    score: { type: "number" },
                    reason: { type: "string" },
                  },
                  required: ["index", "keep", "score", "reason"],
                },
              },
            },
            required: ["verdicts"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "judge_batch" },
    });

    const tool = response.content.find((b) => b.type === "tool_use") as
      | {
          type: "tool_use";
          input: {
            verdicts?: Array<{
              index: number;
              keep: boolean;
              score: number;
              reason: string;
            }>;
          };
        }
      | undefined;

    for (const v of tool?.input?.verdicts || []) {
      const item = chunk[v.index];
      if (!item) continue;
      verdicts.push({
        system: item.system,
        index: item.index,
        keep: v.keep,
        reason: v.reason,
        score: v.score,
      });
    }
  }

  return verdicts;
}

function printTable(rows: MetricRow[]) {
  console.log("\n=== Bakeoff metrics ===");
  console.log(
    "system | links | fragment% | numeric% | avgWords | conf | judgeKeep% | avgJudge"
  );
  for (const r of rows) {
    console.log(
      [
        r.system.padEnd(6),
        String(r.links).padStart(5),
        `${Math.round(r.fragmentRate * 100)}%`.padStart(9),
        `${Math.round(r.numericRate * 100)}%`.padStart(8),
        String(r.avgAnchorWords).padStart(8),
        String(r.avgConfidence).padStart(4),
        r.judgeKeepRate == null
          ? "     n/a"
          : `${Math.round(r.judgeKeepRate * 100)}%`.padStart(9),
        r.judgeKept == null ? "" : `${r.judgeKept}/${r.judgeTotal}`,
      ].join(" | ")
    );
  }
}

async function main() {
  const { skipJudge, slugs } = parseArgs(process.argv.slice(2));

  if (!process.env.XAI_API_KEY) {
    console.error("XAI_API_KEY required for v9 + judge.");
    process.exit(1);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log(`Bakeoff output: ${OUT_DIR}`);
  console.log(`Slugs (${slugs.length}): ${slugs.join(", ")}\n`);

  const posts = await loadMarkdownFiles(BLOG_DIR);
  const { pages } = await loadMergedCatalog();
  const catalogAsRanked: CatalogPage[] = pages.map((p) => {
    const purpose = p as PagePurpose;
    return {
      slug: purpose.slug,
      url: purpose.url,
      type: purpose.type,
      title: purpose.title,
      description: purpose.description,
      category: purpose.category,
      region: purpose.region,
      tags: purpose.tags || [],
      similarityScore: 0,
      graphBoost: 0,
      finalScore: 0,
      readerPromise: purpose.readerPromise,
      linkWhen: purpose.linkWhen,
      doNotLinkWhen: purpose.doNotLinkWhen,
      questionsAnswered: purpose.questionsAnswered,
      topicsCovered: purpose.topicsCovered,
      topicsExcluded: purpose.topicsExcluded,
      financingConcepts: purpose.financingConcepts,
      assetTypes: purpose.assetTypes,
      unitRange: purpose.unitRange,
    };
  });

  const client = new LlmClient();
  const modelId = MODELS.ANALYSIS;
  const results: ArticleResult[] = [];

  for (const slug of slugs) {
    const article = posts.find((p) => p.slug === slug);
    if (!article) {
      console.warn(`  skip missing slug: ${slug}`);
      continue;
    }
    const title = String(article.frontmatter.title || slug);
    console.log(`→ ${slug}`);

    console.log("  v8 deterministic...");
    const v8 = await generateV8(article);
    console.log(`    ${v8.length} links`);

    console.log("  v9 intent placement...");
    const v9 = await generateV9(client, modelId, article, catalogAsRanked);
    console.log(`    ${v9.length} links`);

    results.push({ slug, title, v8, v9 });
  }

  let verdicts: JudgeVerdict[] = [];
  if (!skipJudge) {
    console.log("\nJudging all candidates...");
    verdicts = await judgeAll(client, modelId, results);
  }

  const v8All = results.flatMap((r) => r.v8);
  const v9All = results.flatMap((r) => r.v9);
  const m8 = metricsFor(v8All, "v8");
  const m9 = metricsFor(v9All, "v9");

  if (verdicts.length) {
    const bySys = (sys: "v8" | "v9") => verdicts.filter((v) => v.system === sys);
    const applyJudge = (m: MetricRow, sys: "v8" | "v9") => {
      const vs = bySys(sys);
      m.judgeTotal = vs.length;
      m.judgeKept = vs.filter((v) => v.keep).length;
      m.judgeKeepRate = vs.length ? m.judgeKept / vs.length : 0;
      return m;
    };
    applyJudge(m8, "v8");
    applyJudge(m9, "v9");
  }

  printTable([m8, m9]);

  // Side-by-side examples
  console.log("\n=== Sample comparisons (first 3 articles) ===");
  for (const r of results.slice(0, 3)) {
    console.log(`\n# ${r.slug}`);
    console.log("v8:");
    for (const l of r.v8.slice(0, 3)) {
      console.log(`  - "${l.anchorText}" → ${l.targetUrl}`);
    }
    if (!r.v8.length) console.log("  (none)");
    console.log("v9:");
    for (const l of r.v9.slice(0, 3)) {
      console.log(`  - [${l.intent}]`);
      console.log(`    "${l.anchorText}" → ${l.targetUrl}`);
    }
    if (!r.v9.length) console.log("  (none)");
  }

  const report = {
    generatedAt: new Date().toISOString(),
    slugs,
    metrics: { v8: m8, v9: m9 },
    results,
    verdicts,
  };
  const reportPath = path.join(OUT_DIR, "report.json");
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${reportPath}`);

  // Verdict heuristic
  const v8Keep = m8.judgeKeepRate ?? 0;
  const v9Keep = m9.judgeKeepRate ?? 0;
  const v8Frag = m8.fragmentRate;
  const v9Frag = m9.fragmentRate;
  console.log("\n=== Verdict ===");
  if (verdicts.length === 0) {
    console.log("Judge skipped. Compare fragment rates and sample anchors manually.");
  } else if (v9Keep > v8Keep + 0.08 && v9Frag <= v8Frag + 0.05) {
    console.log("Intent Placement (v9) wins on semantic keep-rate with similar/better anchors.");
  } else if (v8Keep > v9Keep + 0.08) {
    console.log("Current v8 still wins on judged keep-rate — refine v9 retrieval/placement.");
  } else {
    console.log("Mixed / close. Inspect report.json samples before committing to a rewrite.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

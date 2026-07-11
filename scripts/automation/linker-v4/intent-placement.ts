// ============================================
// Smart Linker v9 — Intent Placement Core
// ============================================
// LLM extracts reader intents → selects destinations that answer them →
// local code extracts exact substring anchors.

import LlmClient from "../shared/llm";
import type { PagePurpose, RankedPage, ParsedArticle } from "./types";
import {
  loadMarkdownFiles,
  numberParagraphs,
  parseBody,
  computeContentHash,
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
  validateSemanticGates,
  type TargetMeta,
} from "./semantic-gate";
import { FALLBACK_CATEGORY_PILLARS } from "./cluster-enforcement";

export type CatalogPage = RankedPage &
  Pick<PagePurpose, "assetTypes" | "unitRange" | "questionsAnswered">;

export const MAX_SERVICE_PILLAR = 2;
export const MAX_LINKS_PER_ARTICLE = 8;
export const WORDS_PER_LINK = 200;
export const MAX_SAMPLED_PARAS = 16;
export const CANDIDATES_PER_INTENT = 6;
/** Minimum outbound links we try to guarantee per article (when body allows). */
export const MIN_OUTBOUND_LINKS = 2;

export interface IntentLink {
  paragraphIndex: number;
  anchorText: string;
  targetUrl: string;
  readerNeed: string;
  expectation: string;
  semanticIntent: string;
  confidence: number;
  paragraphText?: string;
}

export function toCatalogPages(
  pages: Awaited<ReturnType<typeof loadMergedCatalog>>["pages"]
): CatalogPage[] {
  return pages.map((p) => {
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
}

export function buildTargetMeta(target: CatalogPage): TargetMeta {
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

export function buildAnchorMeta(target: CatalogPage) {
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

export function purposeText(p: {
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

export function intentOverlapScore(intent: string, pagePurpose: string): number {
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
export function resolveAnchor(paragraph: string, target: CatalogPage): string | null {
  const extracted = extractAnchorFromParagraph(paragraph, buildAnchorMeta(target), 0.18);
  if (extracted) return extracted;

  const phrases = [
    ...(target.questionsAnswered || []),
    ...(target.linkWhen || []),
    target.readerPromise || "",
    target.title,
  ]
    .map((p) => p.replace(/^when the article (discusses|mentions)\s+/i, "").trim())
    .filter((p) => {
      const n = p.split(/\s+/).length;
      return n >= 5 && n <= 14;
    })
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

export function sampleContentParagraphs(
  paragraphs: ReturnType<typeof numberParagraphs>,
  max = MAX_SAMPLED_PARAS
) {
  const content = paragraphs.filter((p) => p.isContent && p.index !== 1);
  if (content.length <= max) return content;
  const step = Math.ceil(content.length / max);
  return content.filter((_, i) => i % step === 0).slice(0, max);
}

export function targetLinkBudget(body: string, existingCount: number): number {
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  return Math.max(
    0,
    Math.min(Math.max(2, Math.round(wordCount / WORDS_PER_LINK)), MAX_LINKS_PER_ARTICLE) -
      existingCount
  );
}

export async function extractIntents(
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

async function placeDestinations(
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

  return (tool?.input?.verdicts || []).map((v) => {
    const placement = placements[v.index];
    return {
      paragraphIndex: placement?.paragraphIndex ?? -1,
      intent: placement?.intent || "",
      keep: Boolean(v.keep),
      targetUrl: v.targetUrl || "",
      reason: v.reason || "",
      confidence: typeof v.confidence === "number" ? v.confidence : 0.85,
    };
  });
}

async function rankCandidatesForIntent(
  intent: string,
  articleSlug: string,
  eligible: CatalogPage[]
): Promise<CatalogPage[]> {
  const rankedForIntent = await rankPagesByRelevance(intent, intent, articleSlug, 25);
  const rankBoost = new Map(
    rankedForIntent.map((p, i) => [
      normalizeUrl(p.url),
      1 - i / Math.max(1, rankedForIntent.length),
    ])
  );

  return eligible
    .map((page) => {
      const overlap = intentOverlapScore(intent, purposeText(page));
      const boost = Number(rankBoost.get(normalizeUrl(page.url)) || 0);
      return { page, score: overlap * 0.65 + boost * 0.35 };
    })
    .filter((x) => x.score >= 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATES_PER_INTENT)
    .map((x) => x.page);
}

const NEGATION_PATTERNS: RegExp[] = [
  /\bnever\b/i,
  /\bdon'?t\b/i,
  /\bdo not\b/i,
  /\bavoid\b/i,
  /\bnot recommended\b/i,
  /\bshouldn'?t\b/i,
  /\bshould not\b/i,
  /\binstead of\b/i,
  /\brather than\b/i,
  /\bunlike\b/i,
  /\bexcept\b/i,
  /\bwithout\b/i,
];

function hasNegativeContext(text: string): boolean {
  return NEGATION_PATTERNS.some((p) => p.test(text));
}

function tryAcceptLink(args: {
  para: { index: number; text: string; offset: number };
  target: CatalogPage;
  intent: string;
  reason: string;
  confidence: number;
  region: string;
  category: string;
  tags: string[];
  skipZones: ReturnType<typeof findSkipZones>;
  usedTargets: Set<string>;
  usedParas: Set<number>;
  pillarCount: number;
}): IntentLink | null {
  const {
    para,
    target,
    intent,
    reason,
    confidence,
    region,
    category,
    tags,
    skipZones,
    usedTargets,
    usedParas,
    pillarCount,
  } = args;

  const norm = normalizeUrl(target.url);
  if (usedTargets.has(norm) || usedParas.has(para.index)) return null;
  if (isPillarUrl(target.url) && pillarCount >= MAX_SERVICE_PILLAR) return null;

  const exact = resolveAnchor(para.text, target);
  if (!exact || isNumericDataAnchor(exact)) return null;
  if (hasNegativeContext(exact) || hasNegativeContext(para.text)) return null;

  const quality = validateAnchorQuality(exact, buildAnchorMeta(target));
  if (!quality.ok) return null;

  const meta = buildTargetMeta(target);
  const gate = validateSemanticGates(
    exact,
    para.text,
    meta,
    region,
    category,
    tags,
    isPillarUrl(target.url)
  );
  if (!gate.passed) return null;

  const anchorPos = para.text.toLowerCase().indexOf(exact.toLowerCase());
  if (anchorPos === -1) return null;
  if (isInSkipZone(para.offset + anchorPos, exact.length, skipZones)) return null;

  return {
    paragraphIndex: para.index,
    anchorText: exact,
    targetUrl: target.url.endsWith("/") ? target.url : `${target.url}/`,
    readerNeed: intent || target.readerPromise || `Reader needs depth on ${target.title}`,
    expectation: target.readerPromise || target.description,
    semanticIntent: reason || `v9 intent placement: ${intent}`,
    confidence: Math.min(0.95, Math.max(0.75, confidence)),
    paragraphText: para.text.slice(0, 280),
  };
}

/** Coverage fill: add category pillar / highly overlapping destinations until min outbound. */
export async function ensureOutboundCoverage(args: {
  article: ParsedArticle;
  existing: IntentLink[];
  catalog: CatalogPage[];
  minLinks?: number;
}): Promise<IntentLink[]> {
  const { article, catalog } = args;
  const minLinks = args.minLinks ?? MIN_OUTBOUND_LINKS;
  const out = [...args.existing];
  if (out.length >= minLinks) return out;

  const body = parseBody(article.rawContent);
  const category = String(article.frontmatter.category || "investing-fundamentals");
  const region = String(article.frontmatter.region || "both");
  const tags = (article.frontmatter.tags as string[]) || [];
  const paragraphs = numberParagraphs(body);
  const skipZones = findSkipZones(body);
  const existingLinks = extractExistingInternalLinks(body);
  const budget = targetLinkBudget(body, existingLinks.size);
  const goal = Math.min(Math.max(minLinks, out.length), budget);
  if (goal <= out.length) return out;

  const usedTargets = new Set(out.map((l) => normalizeUrl(l.targetUrl)));
  const usedParas = new Set(out.map((l) => l.paragraphIndex));
  let pillarCount = out.filter((l) => isPillarUrl(l.targetUrl)).length;

  const pillarUrls = new Set(
    (FALLBACK_CATEGORY_PILLARS[category] || []).map((u) => normalizeUrl(u))
  );

  const preferred = catalog
    .filter((p) => {
      if (p.slug === article.slug) return false;
      if (existingLinks.has(normalizeUrl(p.url))) return false;
      if (!passesRegionGate(region, category, tags, p.region || "both")) return false;
      return true;
    })
    .map((p) => {
      const overlap = intentOverlapScore(
        `${article.frontmatter.title || ""} ${article.frontmatter.description || ""}`,
        purposeText(p)
      );
      const pillarBoost = pillarUrls.has(normalizeUrl(p.url)) ? 0.15 : 0;
      return { page: p, score: overlap + pillarBoost };
    })
    .sort((a, b) => b.score - a.score);

  const sampled = sampleContentParagraphs(paragraphs, 24);

  for (const { page } of preferred) {
    if (out.length >= goal) break;
    for (const para of sampled) {
      if (out.length >= goal) break;
      const link = tryAcceptLink({
        para,
        target: page,
        intent: `Coverage guarantee: related to ${page.title}`,
        reason: "v9 coverage-guarantee",
        confidence: 0.78,
        region,
        category,
        tags,
        skipZones,
        usedTargets,
        usedParas,
        pillarCount,
      });
      if (!link) continue;
      out.push(link);
      usedTargets.add(normalizeUrl(link.targetUrl));
      usedParas.add(link.paragraphIndex);
      if (isPillarUrl(link.targetUrl)) pillarCount++;
      break;
    }
  }

  return out;
}

/**
 * Generate Intent Placement links for one article.
 * Requires XAI_API_KEY via LlmClient.
 */
export async function generateIntentLinksForArticle(args: {
  article: ParsedArticle;
  catalog: CatalogPage[];
  client: LlmClient;
  modelId: string;
  /** Prefer linking TO these URLs when they answer an intent (orphan boost). */
  preferTargetUrls?: Set<string>;
}): Promise<{ suggestions: IntentLink[]; contentHash: string; catalogSize: number }> {
  const { article, catalog, client, modelId, preferTargetUrls } = args;
  const body = parseBody(article.rawContent);
  const title = String(article.frontmatter.title || article.slug);
  const category = String(article.frontmatter.category || "investing-fundamentals");
  const region = String(article.frontmatter.region || "both");
  const tags = (article.frontmatter.tags as string[]) || [];
  const paragraphs = numberParagraphs(body);
  const skipZones = findSkipZones(body);
  const existingLinks = extractExistingInternalLinks(body);
  const budget = targetLinkBudget(body, existingLinks.size);
  const contentHash = computeContentHash(body);

  if (budget === 0) {
    return { suggestions: [], contentHash, catalogSize: 0 };
  }

  const sampled = sampleContentParagraphs(paragraphs);
  const intents = await extractIntents(
    client,
    modelId,
    title,
    sampled.map((p) => ({ index: p.index, text: p.text }))
  );

  const paraByIndex = new Map(sampled.map((p) => [p.index, p]));
  const eligible = catalog.filter((p) => {
    if (p.slug === article.slug) return false;
    if (p.url.includes("book-strategy-call")) return false;
    if (p.url.startsWith("/glossary/")) return false;
    if (existingLinks.has(normalizeUrl(p.url))) return false;
    if (!passesRegionGate(region, category, tags, p.region || "both")) return false;
    return true;
  });

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
    if (!para) continue;

    let scored = await rankCandidatesForIntent(intent.intent, article.slug, eligible);

    // Boost preferred orphan targets into the candidate list when relevant.
    if (preferTargetUrls && preferTargetUrls.size > 0) {
      const preferred = eligible
        .filter((p) => preferTargetUrls.has(normalizeUrl(p.url)))
        .map((p) => ({
          page: p,
          score: intentOverlapScore(intent.intent, purposeText(p)),
        }))
        .filter((x) => x.score >= 0.06)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .map((x) => x.page);

      const seen = new Set(scored.map((p) => normalizeUrl(p.url)));
      for (const p of preferred) {
        const n = normalizeUrl(p.url);
        if (!seen.has(n)) {
          scored = [p, ...scored].slice(0, CANDIDATES_PER_INTENT);
          seen.add(n);
        }
      }
    }

    if (scored.length === 0) continue;

    placements.push({
      paragraphIndex: para.index,
      paragraphText: para.text,
      intent: intent.intent,
      candidates: scored.map((page) => ({
        url: page.url,
        title: page.title,
        readerPromise: page.readerPromise || page.description,
        questionsAnswered: page.questionsAnswered || [],
        doNotLinkWhen: page.doNotLinkWhen || [],
        assetTypes: page.assetTypes || [],
      })),
      candidatePages: scored,
    });
  }

  const verdicts = await placeDestinations(
    client,
    modelId,
    title,
    placements.map(({ candidatePages: _c, ...rest }) => rest)
  );

  const pageByUrl = new Map(
    placements.flatMap((p) =>
      p.candidatePages.map((c) => [normalizeUrl(c.url), c] as const)
    )
  );
  // Also index full catalog for coverage of LLM URL variants
  for (const p of eligible) {
    const n = normalizeUrl(p.url);
    if (!pageByUrl.has(n)) pageByUrl.set(n, p);
  }

  const paraFull = new Map(paragraphs.map((p) => [p.index, p]));
  const usedTargets = new Set<string>();
  const usedParas = new Set<number>();
  let pillarCount = 0;
  const suggestions: IntentLink[] = [];

  for (const v of verdicts) {
    if (!v.keep || suggestions.length >= budget) continue;
    const para = paraFull.get(v.paragraphIndex);
    if (!para) continue;

    const placement = placements.find((p) => p.paragraphIndex === v.paragraphIndex);
    const preferred = pageByUrl.get(normalizeUrl(v.targetUrl));
    const tryOrder = [
      preferred,
      ...((placement?.candidatePages || []).filter(
        (p) => normalizeUrl(p.url) !== normalizeUrl(v.targetUrl || "")
      ) || []),
    ].filter(Boolean) as CatalogPage[];

    let accepted: IntentLink | null = null;
    for (const target of tryOrder) {
      const link = tryAcceptLink({
        para,
        target,
        intent: v.intent,
        reason: v.reason,
        confidence: v.confidence,
        region,
        category,
        tags,
        skipZones,
        usedTargets,
        usedParas,
        pillarCount,
      });
      if (link) {
        accepted = link;
        break;
      }
    }
    if (!accepted) continue;

    suggestions.push(accepted);
    usedTargets.add(normalizeUrl(accepted.targetUrl));
    usedParas.add(accepted.paragraphIndex);
    if (isPillarUrl(accepted.targetUrl)) pillarCount++;
  }

  const withCoverage = await ensureOutboundCoverage({
    article,
    existing: suggestions,
    catalog,
    minLinks: Math.min(MIN_OUTBOUND_LINKS, budget),
  });

  return {
    suggestions: withCoverage.slice(0, budget),
    contentHash,
    catalogSize: placements.length,
  };
}

/** Find best source articles that could link to a target orphan. */
export async function findInboundSourceCandidates(args: {
  orphan: CatalogPage;
  catalog: CatalogPage[];
  blogPosts: ParsedArticle[];
  maxSources?: number;
}): Promise<Array<{ article: ParsedArticle; score: number }>> {
  const { orphan, catalog, blogPosts, maxSources = 8 } = args;
  const orphanPurpose = purposeText(orphan);
  const orphanNorm = normalizeUrl(orphan.url);

  const scored: Array<{ article: ParsedArticle; score: number }> = [];

  for (const article of blogPosts) {
    if (article.slug === orphan.slug) continue;
    const body = parseBody(article.rawContent);
    const existing = extractExistingInternalLinks(body);
    if (existing.has(orphanNorm)) continue;

    const catPage = catalog.find((p) => p.slug === article.slug);
    const sourcePurpose = catPage
      ? purposeText(catPage)
      : `${article.frontmatter.title} ${article.frontmatter.description || ""}`;

    const score = intentOverlapScore(orphanPurpose, sourcePurpose);
    if (score < 0.08) continue;
    scored.push({ article, score });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, maxSources);
}

/** Try to place a link TO orphan inside a source article (exact substring only). */
export function tryLinkToOrphanInSource(args: {
  source: ParsedArticle;
  orphan: CatalogPage;
}): IntentLink | null {
  const { source, orphan } = args;
  const body = parseBody(source.rawContent);
  const category = String(source.frontmatter.category || "investing-fundamentals");
  const region = String(source.frontmatter.region || "both");
  const tags = (source.frontmatter.tags as string[]) || [];
  const paragraphs = numberParagraphs(body);
  const skipZones = findSkipZones(body);
  const sampled = sampleContentParagraphs(paragraphs, 30);

  const usedTargets = new Set<string>();
  const usedParas = new Set<number>();

  for (const para of sampled) {
    const paraOverlap = intentOverlapScore(para.text, purposeText(orphan));
    if (paraOverlap < 0.12) continue;

    const link = tryAcceptLink({
      para,
      target: orphan,
      intent: `Inbound for orphan: ${orphan.title}`,
      reason: "v9 orphan-inbound exact match",
      confidence: 0.88,
      region,
      category,
      tags,
      skipZones,
      usedTargets,
      usedParas,
      pillarCount: 0,
    });
    if (link) return link;
  }
  return null;
}

export async function loadBlogAndCatalog(): Promise<{
  posts: ParsedArticle[];
  catalog: CatalogPage[];
}> {
  const posts = await loadMarkdownFiles(BLOG_DIR);
  const { pages } = await loadMergedCatalog();
  return { posts, catalog: toCatalogPages(pages) };
}

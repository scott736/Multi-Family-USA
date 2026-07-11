// ============================================
// Smart Linker v4 — Validate Suggestions
// ============================================
// Deterministic validation rules. Pass/fail, no scoring.
// Reads suggestion files and validates each link against 10 hard rules.

import fs from "fs/promises";
import path from "path";
import type { CLIOptions } from "../types";
import type {
  V3Suggestion,
  ValidatedLink,
  SuggestionFile,
  RawPageData,
  PagePurpose,
  SkipZone,
  PositionBucket,
  PositionDistribution,
} from "./types";
import {
  loadMarkdownFiles,
  numberParagraphs,
  parseBody,
  computeContentHash,
  BLOG_DIR,
  QUEUE_DIR,
} from "./parse";
import { findSkipZones, isInSkipZone, hasNegativeContext } from "./skip-zones";
import { GENERIC_ANCHORS, PILLAR_URL_PATTERNS, normalizeUrl, isPillarUrl, loadMergedCatalog } from "./catalog-utils";
import { buildAnchorDiversityIndex, getExistingAnchorsForTarget, type AnchorDiversityIndex } from "./anchor-intelligence";
import {
  MIN_ANCHOR_WORDS,
  MAX_ANCHOR_WORDS,
  fragmentAnchorReason,
} from "./anchor-quality";
import { STOP_WORDS } from "./semantic-filter";
import { validateSemanticGates, isNumericDataAnchor, type TargetMeta } from "./semantic-gate";

// ----------------
// Local Types
// ----------------

/** Map of normalized target URL → full target metadata for semantic gates. */
type TargetMetaIndex = Map<string, TargetMeta>;

/** Range occupied by an H2-delimited section of the body (start is inclusive, end is exclusive). */
interface H2Section {
  start: number;
  end: number;
}

// Re-export normalizeUrl for backward compatibility (used by review.ts)
export { normalizeUrl } from "./catalog-utils";

// ----------------
// Constants
// ----------------

const MIN_CONFIDENCE = 0.75;
const MAX_PILLAR_LINKS = 3;
const MIN_LINK_SPACING = 100; // characters between links
const MAX_LINKS_PER_SECTION = 2;
const INTENT_KEYWORD_OVERLAP_THRESHOLD = 3;

/** Minimum accepted links before position-cluster rebalancing kicks in. */
const POSITION_CLUSTER_MIN_TOTAL = 5;
const POSITION_CLUSTER_MAX_PER_BUCKET = 2;

/** Abbreviations that end with "." but do not terminate a sentence. */
const SENTENCE_ABBREVIATIONS = [
  "mr.",
  "mrs.",
  "ms.",
  "dr.",
  "st.",
  "jr.",
  "sr.",
  "u.s.",
  "u.k.",
  "e.g.",
  "i.e.",
  "etc.",
  "vs.",
  "no.",
  "inc.",
  "ltd.",
  "co.",
];

/** Negation words / phrases used for sentence-level negative-context detection. */
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

// ----------------
// Main Function
// ----------------

export async function validateSuggestions(options: CLIOptions): Promise<void> {
  const { slug, all } = options;

  console.log("Validating link suggestions...\n");

  const suggestionsDir = path.resolve("src/data/linker-v4/suggestions");

  // Find suggestion files
  let files: string[];
  try {
    files = (await fs.readdir(suggestionsDir)).filter((f) =>
      f.endsWith(".json")
    );
  } catch {
    console.error("No suggestions directory found. Generate suggestions first.");
    return;
  }

  if (slug) {
    files = files.filter((f) => f === `${slug}.json`);
    if (files.length === 0) {
      console.error(`No suggestions found for: ${slug}`);
      return;
    }
  } else if (!all) {
    console.error("Please specify --slug or --all");
    return;
  }

  console.log(`Processing ${files.length} suggestion files\n`);

  // Load blog and queue posts for body content
  const blogPosts = await loadMarkdownFiles(BLOG_DIR);
  const queueArticles = await loadMarkdownFiles(QUEUE_DIR);
  const allArticles = [...blogPosts, ...queueArticles];
  const articleMap = new Map(allArticles.map((a) => [a.slug, a]));

  // Build set of valid published URLs (reject links to queue/unpublished pages)
  const { validUrls, tooltipOnlyUrls } = await buildValidUrlSets();

  // Build anchor diversity index for cross-article duplicate anchor detection
  const anchorDiversityIndex = await buildAnchorDiversityIndex();

  // Load merged catalog for intent + semantic gates.
  const targetMetaIndex = await buildTargetMetaIndex();

  // Article metadata maps for region gates
  const articleMetaMap = new Map(
    allArticles.map((a) => [
      a.slug,
      {
        region: String(a.frontmatter.region || "both"),
        category: String(a.frontmatter.category || "investing-fundamentals"),
        tags: (a.frontmatter.tags as string[]) || [],
      },
    ])
  );

  let totalRaw = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  const rejectionReasons: Record<string, number> = {};

  // Batch-read all suggestion files in parallel
  const loaded = await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(suggestionsDir, file);
      try {
        const content = await fs.readFile(filePath, "utf-8");
        return { file, filePath, content, error: null as null | string };
      } catch (err) {
        return { file, filePath, content: "", error: String(err) };
      }
    })
  );

  for (const { file, filePath, content, error } of loaded) {
    if (error) {
      console.error(`  Read failed: ${file}: ${error}`);
      continue;
    }
    let suggestionFile: SuggestionFile;

    try {
      suggestionFile = JSON.parse(content);
    } catch {
      console.error(`  Invalid JSON: ${file}`);
      continue;
    }

    const article = articleMap.get(suggestionFile.sourceSlug);
    if (!article) {
      console.error(
        `  Article not found for: ${suggestionFile.sourceSlug}`
      );
      continue;
    }

    const body = parseBody(article.rawContent);
    const paragraphs = numberParagraphs(body);
    const skipZones = findSkipZones(body);

    // Validate each suggestion
    const articleMeta = articleMetaMap.get(suggestionFile.sourceSlug) || {
      region: "both",
      category: "investing-fundamentals",
      tags: [] as string[],
    };

    const validated = validateAll(
      suggestionFile.raw,
      body,
      paragraphs,
      skipZones,
      validUrls,
      tooltipOnlyUrls,
      anchorDiversityIndex,
      targetMetaIndex,
      articleMeta
    );

    // Update the suggestion file
    suggestionFile.validated = validated;
    suggestionFile.sourceContentHash = computeContentHash(body);
    await fs.writeFile(filePath, JSON.stringify(suggestionFile, null, 2));

    const passed = validated.filter((v) => v.passed);
    const failed = validated.filter((v) => !v.passed);

    totalRaw += suggestionFile.raw.length;
    totalPassed += passed.length;
    totalFailed += failed.length;

    // Track rejection reasons
    for (const v of failed) {
      const reason = v.rejectionReason || "unknown";
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
    }

    console.log(
      `  ${suggestionFile.sourceSlug}: ${passed.length} passed, ${failed.length} rejected`
    );

    if (failed.length > 0 && (slug || files.length <= 5)) {
      for (const v of failed) {
        console.log(
          `    REJECTED: "${v.suggestion.anchorText}" → ${v.suggestion.targetUrl}`
        );
        console.log(`      Reason: ${v.rejectionReason}`);
      }
    }
  }

  console.log(`\nValidation complete:`);
  console.log(`  Total suggestions: ${totalRaw}`);
  console.log(`  Passed: ${totalPassed}`);
  console.log(`  Rejected: ${totalFailed}`);

  if (Object.keys(rejectionReasons).length > 0) {
    console.log(`\nRejection reasons:`);
    const sorted = Object.entries(rejectionReasons).sort(
      ([, a], [, b]) => b - a
    );
    for (const [reason, count] of sorted) {
      console.log(`  ${reason}: ${count}`);
    }
  }
}

// ----------------
// Validation Engine
// ----------------

function validateAll(
  suggestions: V3Suggestion[],
  body: string,
  paragraphs: ReturnType<typeof numberParagraphs>,
  skipZones: ReturnType<typeof findSkipZones>,
  validUrls: Set<string>,
  tooltipOnlyUrls: Set<string>,
  anchorDiversityIndex?: AnchorDiversityIndex,
  targetMetaIndex?: TargetMetaIndex,
  articleMeta?: { region: string; category: string; tags: string[] }
): ValidatedLink[] {
  const validated: ValidatedLink[] = [];
  const usedTargets = new Set<string>();
  const placedPositions: number[] = [];
  let pillarCount = 0;

  // Precompute H2 section ranges for the section-aware spacing rule.
  const sections = findH2Sections(body);
  const sectionCounts = new Map<number, number>(); // sectionIndex -> accepted count

  // Ordering strategy:
  //   1. Primary sort by paragraphIndex so the section-cap rule evaluates
  //      suggestions in document order (first-come wins the section slot).
  //   2. Secondary sort by confidence (higher wins ties within the same paragraph).
  const sorted = [...suggestions].sort((a, b) => {
    const pa = a.paragraphIndex ?? Number.MAX_SAFE_INTEGER;
    const pb = b.paragraphIndex ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return (b.confidence || 0) - (a.confidence || 0);
  });

  for (const suggestion of sorted) {
    const result = validateOne(
      suggestion,
      body,
      paragraphs,
      skipZones,
      usedTargets,
      placedPositions,
      pillarCount,
      validUrls,
      tooltipOnlyUrls,
      anchorDiversityIndex,
      targetMetaIndex,
      articleMeta,
      sections,
      sectionCounts
    );

    validated.push(result);

    if (result.passed) {
      usedTargets.add(normalizeUrl(suggestion.targetUrl));
      placedPositions.push(result.positionInBody);
      if (isPillarUrl(suggestion.targetUrl)) {
        pillarCount++;
      }
      const sectionIndex = findSectionIndex(result.positionInBody, sections);
      if (sectionIndex !== -1) {
        sectionCounts.set(sectionIndex, (sectionCounts.get(sectionIndex) || 0) + 1);
      }
    }
  }

  // Post-pass: position-cluster rebalancing.
  rebalancePositionClusters(validated, body.length);

  return validated;
}

function validateOne(
  suggestion: V3Suggestion,
  body: string,
  paragraphs: ReturnType<typeof numberParagraphs>,
  skipZones: ReturnType<typeof findSkipZones>,
  usedTargets: Set<string>,
  placedPositions: number[],
  pillarCount: number,
  validUrls: Set<string>,
  tooltipOnlyUrls: Set<string>,
  anchorDiversityIndex?: AnchorDiversityIndex,
  targetMetaIndex?: TargetMetaIndex,
  articleMeta?: { region: string; category: string; tags: string[] },
  sections?: H2Section[],
  sectionCounts?: Map<number, number>
): ValidatedLink {
  const { anchorText, targetUrl, confidence, paragraphIndex } = suggestion;

  // Rule 0a: Never link to glossary terms or tooltip-only pages
  const normalizedTarget = normalizeUrl(targetUrl);
  if (tooltipOnlyUrls.has(normalizedTarget)) {
    return fail(suggestion, -1, "tooltip-only-target: glossary terms are embedded via keyTerms, not inline links");
  }

  // Rule 0b: Target URL must be a published page (not queue/draft)
  if (validUrls.size > 0 && !validUrls.has(normalizedTarget)) {
    return fail(suggestion, -1, "unpublished-target: URL not found in published catalog");
  }

  // Rule 1: Anchor exists as exact substring
  const bodyLower = body.toLowerCase();
  const anchorLower = anchorText.toLowerCase().trim();
  let position = findAnchorInParagraph(
    body,
    bodyLower,
    anchorLower,
    paragraphIndex,
    paragraphs
  );

  if (position === -1) {
    // Attempt rescue: look for the anchor elsewhere in the body in a non-skip zone
    const altPosition = findAlternativePosition(body, bodyLower, anchorLower, skipZones);
    if (altPosition !== -1) {
      // Rescued! Update position and continue
      position = altPosition;
    } else {
      return fail(suggestion, -1, "anchor-not-found: exact substring not found in paragraph or safe zones");
    }
  }

  // Rule 2: Anchor quality — word count
  const words = anchorText.trim().split(/\s+/);
  if (words.length < MIN_ANCHOR_WORDS) {
    return fail(
      suggestion,
      position,
      `anchor-too-short: ${words.length} words (min ${MIN_ANCHOR_WORDS})`
    );
  }
  if (words.length > MAX_ANCHOR_WORDS) {
    return fail(
      suggestion,
      position,
      `anchor-too-long: ${words.length} words (max ${MAX_ANCHOR_WORDS})`
    );
  }

  // Rule 2b: Anchor quality — no brackets (auto-strip first)
  // Dollar amounts are allowed in anchors (e.g. "$100K less")
  if (/[\[\](){}]/.test(anchorText)) {
    // Auto-strip brackets and re-check anchor length
    const cleaned = anchorText.replace(/[\[\](){}]/g, "").trim();
    if (cleaned.split(/\s+/).length >= MIN_ANCHOR_WORDS) {
      // Update the suggestion's anchor in-place for apply step
      suggestion.anchorText = cleaned;
    } else {
      return fail(suggestion, position, "anchor-has-brackets");
    }
  }

  // Rule 3: Generic blocklist
  if (GENERIC_ANCHORS.some((g) => anchorLower === g.toLowerCase())) {
    return fail(suggestion, position, `generic-anchor: "${anchorText}"`);
  }

  // Rule 3b: Numeric data anchors (unit counts, dollar amounts, etc.)
  if (isNumericDataAnchor(anchorText)) {
    return fail(suggestion, position, "numeric-data-anchor");
  }

  // Rule 3c: Mid-clause fragments ("the mortgage and", "a property financed at")
  const fragmentReason = fragmentAnchorReason(anchorText);
  if (fragmentReason) {
    return fail(suggestion, position, fragmentReason);
  }

  // Rule 4: Skip zone check
  const zone = getTouchingZone(position, anchorText.length, skipZones);
  if (zone) {
    // Rescue attempt 1: exact match in a safe zone elsewhere
    let altPosition = findAlternativePosition(body, bodyLower, anchorLower, skipZones);

    // Rescue attempt 2: strip bold markers from anchor and search again
    if (altPosition === -1 && /\*\*/.test(anchorText)) {
      const strippedAnchor = anchorText.replace(/\*\*/g, "").trim().toLowerCase();
      altPosition = findAlternativePosition(body, bodyLower, strippedAnchor, skipZones);
    }

    // Rescue attempt 3: normalized (fuzzy) search is already built into findAlternativePosition

    if (altPosition !== -1) {
      position = altPosition;
    } else {
      return fail(suggestion, position, `in-skip-zone: ${zone.reason}`);
    }
  }

  // Rule 5: Negative context — sentence-level analysis.
  // Reject if the sentence containing the anchor has negation words.
  if (hasNegativeContextSentence(body, position, anchorText.length)) {
    return fail(suggestion, position, "negative-context");
  }

  // Rule 5b: Intent-aware matching against catalog doNotLinkWhen.
  if (targetMetaIndex) {
    const meta = targetMetaIndex.get(normalizedTarget);
    if (meta && meta.doNotLinkWhen.length > 0) {
      const contextSentences = extractSurroundingSentences(body, position, anchorText.length);
      const contextTokens = tokenizeForIntent(contextSentences);
      for (const clause of meta.doNotLinkWhen) {
        const clauseTokens = tokenizeForIntent(clause);
        if (countOverlap(contextTokens, clauseTokens) >= INTENT_KEYWORD_OVERLAP_THRESHOLD) {
          return fail(suggestion, position, "intent-mismatch");
        }
      }
    }
  }

  // Rule 5c: v5 semantic gates (region, anchor-target, linkWhen).
  if (targetMetaIndex && articleMeta) {
    const meta = targetMetaIndex.get(normalizedTarget);
    if (meta) {
      const contextSentences = extractSurroundingSentences(body, position, anchorText.length);
      const gate = validateSemanticGates(
        anchorText,
        contextSentences,
        meta,
        articleMeta.region,
        articleMeta.category,
        articleMeta.tags,
        isPillarUrl(targetUrl),
        true
      );
      if (!gate.passed) {
        return fail(suggestion, position, gate.reason || "semantic-mismatch");
      }
    }
  }

  // Rule 6: No duplicate targets
  if (usedTargets.has(normalizedTarget)) {
    return fail(suggestion, position, "duplicate-target");
  }

  // Rule 7: Minimum spacing
  const tooClose = placedPositions.some(
    (pos) => Math.abs(position - pos) < MIN_LINK_SPACING
  );
  if (tooClose) {
    return fail(suggestion, position, "too-close-to-other-link");
  }

  // Rule 8: Confidence gate
  if (confidence < MIN_CONFIDENCE) {
    return fail(
      suggestion,
      position,
      `low-confidence: ${confidence} (min ${MIN_CONFIDENCE})`
    );
  }

  // Rule 9: Pillar cap
  if (isPillarUrl(targetUrl) && pillarCount >= MAX_PILLAR_LINKS) {
    return fail(
      suggestion,
      position,
      `pillar-cap: already ${pillarCount} pillar links (max ${MAX_PILLAR_LINKS})`
    );
  }

  // Rule 9b: Section-aware spacing — at most MAX_LINKS_PER_SECTION per H2 section.
  if (sections && sections.length > 0 && sectionCounts) {
    const sectionIndex = findSectionIndex(position, sections);
    if (sectionIndex !== -1) {
      const current = sectionCounts.get(sectionIndex) || 0;
      if (current >= MAX_LINKS_PER_SECTION) {
        return fail(
          suggestion,
          position,
          `section-cap: section already has ${current} links (max ${MAX_LINKS_PER_SECTION})`
        );
      }
    }
  }

  // Rule 10: Word boundary check
  const charBefore = position > 0 ? body[position - 1] : " ";
  const charAfter =
    position + anchorText.length < body.length
      ? body[position + anchorText.length]
      : " ";
  const BOUNDARY = /[\s.,!?:;()\[\]"'\/\n\-\*\_\#\>\u2014\u2013\u2026\u2018\u2019\u201C\u201D]/;
  if (!BOUNDARY.test(charBefore) || !BOUNDARY.test(charAfter)) {
    return fail(suggestion, position, "not-at-word-boundary");
  }

  // Rule 11: Cross-article anchor duplication check
  if (anchorDiversityIndex) {
    const existingAnchors = getExistingAnchorsForTarget(targetUrl, anchorDiversityIndex);
    if (existingAnchors.some((a) => a === anchorLower)) {
      return fail(suggestion, position, "duplicate-anchor-cross-article");
    }
  }

  // Assign confidence tier
  const confidenceTier: "high" | "medium" | "low" =
    confidence >= 0.9 ? "high" : confidence >= 0.75 ? "medium" : "low";

  return {
    suggestion,
    positionInBody: position,
    passed: true,
    confidenceTier,
  };
}

// ----------------
// Helpers
// ----------------

function fail(
  suggestion: V3Suggestion,
  position: number,
  reason: string
): ValidatedLink {
  const confidence = suggestion.confidence || 0;
  const confidenceTier: "high" | "medium" | "low" =
    confidence >= 0.9 ? "high" : confidence >= 0.75 ? "medium" : "low";

  return {
    suggestion,
    positionInBody: position,
    passed: false,
    rejectionReason: reason,
    confidenceTier,
  };
}

/**
 * Normalize text for fuzzy matching: collapse whitespace, strip markdown
 * bold/italic/strikethrough markers, normalize smart quotes, trim.
 */
function normalizeForMatching(text: string): string {
  let result = text;
  // Strip markdown bold/italic/strikethrough markers
  result = result.replace(/\*\*|__|\*|_|~~/g, "");
  // Normalize smart quotes → straight
  result = result.replace(/[\u2018\u2019\u201A\u201B]/g, "'");
  result = result.replace(/[\u201C\u201D\u201E\u201F]/g, '"');
  // Collapse multiple whitespace to single space
  result = result.replace(/\s+/g, " ");
  return result.trim();
}

/**
 * Map a position in normalized text back to the corresponding position
 * in the original text. Walks both strings in parallel, skipping
 * characters that were stripped/collapsed during normalization.
 */
function mapNormalizedPosition(original: string, normalizedPos: number): number {
  let ni = 0; // position in normalized
  let oi = 0; // position in original

  while (oi < original.length && ni < normalizedPos) {
    const ch = original[oi];

    // Check for markdown markers to skip: **, __, ~~
    if (oi + 1 < original.length) {
      const two = original.slice(oi, oi + 2);
      if (two === "**" || two === "__" || two === "~~") {
        oi += 2;
        continue;
      }
    }
    // Single markers: * or _ (but not ** or __)
    if (ch === "*" || ch === "_") {
      oi++;
      continue;
    }

    // Smart quotes map to a single character in normalized
    if ("\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F".includes(ch)) {
      oi++;
      ni++;
      continue;
    }

    // Whitespace collapsing: consume all whitespace in original for one space in normalized
    if (/\s/.test(ch)) {
      while (oi < original.length && /\s/.test(original[oi])) {
        oi++;
      }
      ni++; // one collapsed space in normalized
      continue;
    }

    // Normal character
    oi++;
    ni++;
  }

  return oi;
}

/**
 * Find the anchor text within the specified paragraph.
 * Returns the character position in the full body, or -1 if not found.
 * Falls back to normalized (fuzzy) matching if exact match fails.
 */
function findAnchorInParagraph(
  body: string,
  bodyLower: string,
  anchorLower: string,
  paragraphIndex: number,
  paragraphs: ReturnType<typeof numberParagraphs>
): number {
  const paragraph = paragraphs.find((p) => p.index === paragraphIndex);
  if (!paragraph) return -1;

  // Search within the paragraph's range in the body
  const pStart = paragraph.offset;
  const pEnd = pStart + paragraph.text.length;

  // Exact match first
  const idx = bodyLower.indexOf(anchorLower, pStart);
  if (idx !== -1 && idx < pEnd) {
    return idx;
  }

  // Fuzzy fallback: normalize both body segment and anchor
  const bodySegment = body.slice(pStart, pEnd);
  const normalizedSegment = normalizeForMatching(bodySegment).toLowerCase();
  const normalizedAnchor = normalizeForMatching(anchorLower);

  const normalizedIdx = normalizedSegment.indexOf(normalizedAnchor);
  if (normalizedIdx !== -1) {
    // Map back to original position
    const originalOffset = mapNormalizedPosition(bodySegment, normalizedIdx);
    return pStart + originalOffset;
  }

  return -1;
}

/**
 * Find the first occurrence of an anchor that is NOT in a skip zone.
 * Falls back to normalized (fuzzy) matching if exact match fails.
 */
function findAlternativePosition(
  body: string,
  bodyLower: string,
  anchorLower: string,
  zones: SkipZone[]
): number {
  // Exact match first
  let searchPos = 0;
  while (searchPos < body.length) {
    const idx = bodyLower.indexOf(anchorLower, searchPos);
    if (idx === -1) break;

    if (!isInSkipZone(idx, anchorLower.length, zones)) {
      return idx; // Found a safe alternative!
    }
    searchPos = idx + 1;
  }

  // Fuzzy fallback: normalized matching
  const normalizedBody = normalizeForMatching(body).toLowerCase();
  const normalizedAnchor = normalizeForMatching(anchorLower);

  searchPos = 0;
  while (searchPos < normalizedBody.length) {
    const idx = normalizedBody.indexOf(normalizedAnchor, searchPos);
    if (idx === -1) break;

    // Map back to original body position
    const originalPos = mapNormalizedPosition(body, idx);
    if (!isInSkipZone(originalPos, anchorLower.length, zones)) {
      return originalPos;
    }
    searchPos = idx + 1;
  }

  return -1;
}

/**
 * Returns the zone if the range [position, position + length] touches any skip zone.
 */
function getTouchingZone(
  position: number,
  length: number,
  zones: SkipZone[]
): SkipZone | undefined {
  const end = position + length;
  return zones.find(
    (z) =>
      (position >= z.start && position < z.end) ||
      (end > z.start && end <= z.end) ||
      (position <= z.start && end >= z.end)
  );
}

/**
 * Sentence-level negative context detection.
 * Extracts the full sentence containing the anchor using an abbreviation-aware
 * tokenizer, then checks for negation words that would make a link misleading.
 */
function hasNegativeContextSentence(
  body: string,
  anchorStart: number,
  anchorLength: number
): boolean {
  const sentence = extractSentenceAt(body, anchorStart, anchorLength);
  return NEGATION_PATTERNS.some((pattern) => pattern.test(sentence));
}

/**
 * Extract the sentence that covers [anchorStart, anchorStart + anchorLength].
 * Walks outward from the anchor span, splitting on `.!?` but treating a
 * sentence-ending punctuation as non-terminal when it is part of a known
 * abbreviation or a decimal number (e.g. "U.S.", "Dr.", "3.5%").
 */
function extractSentenceAt(
  body: string,
  anchorStart: number,
  anchorLength: number
): string {
  const anchorEnd = anchorStart + anchorLength;

  // Walk backward from the anchor start to locate the sentence boundary.
  let start = 0;
  for (let i = anchorStart - 1; i >= 0; i--) {
    const ch = body[i];
    if (ch === "\n" && i > 0 && body[i - 1] === "\n") {
      start = i + 1;
      break;
    }
    if (ch === "." || ch === "!" || ch === "?") {
      if (isSentenceTerminator(body, i)) {
        start = i + 1;
        break;
      }
    }
  }

  // Walk forward from the anchor end to locate the trailing boundary.
  let end = body.length;
  for (let i = anchorEnd; i < body.length; i++) {
    const ch = body[i];
    if (ch === "\n" && i + 1 < body.length && body[i + 1] === "\n") {
      end = i;
      break;
    }
    if (ch === "." || ch === "!" || ch === "?") {
      if (isSentenceTerminator(body, i)) {
        end = i + 1;
        break;
      }
    }
  }

  return body.slice(start, end).trim();
}

/**
 * Returns true when the punctuation at `index` ends a sentence.
 * False when it's part of an abbreviation ("Mr.", "U.S.", "e.g.") or a
 * decimal number ("3.5").
 */
function isSentenceTerminator(body: string, index: number): boolean {
  const ch = body[index];
  if (ch !== "." && ch !== "!" && ch !== "?") return false;

  // `!` and `?` don't participate in the abbreviation/decimal exceptions.
  if (ch === "!" || ch === "?") {
    const next = body[index + 1] ?? " ";
    return /\s/.test(next) || next === "";
  }

  // Decimal number: digit on both sides (e.g. "3.5").
  const prev = body[index - 1];
  const next = body[index + 1];
  if (prev && /\d/.test(prev) && next && /\d/.test(next)) {
    return false;
  }

  // Abbreviation lookback: check the last token ending here (inclusive of ".")
  // against the known list. Capture up to 6 chars back for multi-dot cases.
  const lookback = body.slice(Math.max(0, index - 6), index + 1).toLowerCase();
  for (const abbr of SENTENCE_ABBREVIATIONS) {
    if (lookback.endsWith(abbr)) {
      // Must be preceded by a boundary so we don't match mid-word.
      const before = body[index - abbr.length];
      if (!before || /[\s(\[\-"']/.test(before)) {
        return false;
      }
    }
  }

  // Require whitespace or end-of-text after the period to count as terminator.
  const after = body[index + 1];
  if (after === undefined) return true;
  return /\s/.test(after);
}

/**
 * Return the sentence containing the anchor plus the one before and after
 * (±1 sentence window). Used for intent-mismatch context.
 */
function extractSurroundingSentences(
  body: string,
  anchorStart: number,
  anchorLength: number
): string {
  const current = extractSentenceAt(body, anchorStart, anchorLength);

  // Find the previous sentence by looking for text ending before `current`.
  // We locate `current` within the body via its starting offset.
  const currentOffset = body.indexOf(current, Math.max(0, anchorStart - current.length));
  const prevSliceEnd = currentOffset > 0 ? currentOffset - 1 : 0;
  const prevAnchorEstimate = Math.max(0, prevSliceEnd - 1);
  const prev =
    prevSliceEnd > 0
      ? extractSentenceAt(body, prevAnchorEstimate, 1)
      : "";

  const currentEnd = currentOffset >= 0 ? currentOffset + current.length : anchorStart + anchorLength;
  const nextAnchorEstimate = Math.min(body.length - 1, currentEnd + 1);
  const next =
    nextAnchorEstimate > currentEnd
      ? extractSentenceAt(body, nextAnchorEstimate, 1)
      : "";

  return [prev, current, next].filter(Boolean).join(" ").trim();
}

/**
 * Parse body into H2-delimited sections. Returns ordered ranges that together
 * cover the entire body. Content before the first H2 (intro) is its own section.
 */
function findH2Sections(body: string): H2Section[] {
  const headingRegex = /^##\s+.+$/gm;
  const starts: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(body)) !== null) {
    starts.push(match.index);
  }

  if (starts.length === 0) {
    return [{ start: 0, end: body.length }];
  }

  const sections: H2Section[] = [];
  if (starts[0] > 0) {
    sections.push({ start: 0, end: starts[0] });
  }
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : body.length;
    sections.push({ start, end });
  }
  return sections;
}

/** Locate which section a given offset falls into. Returns -1 if none. */
function findSectionIndex(position: number, sections: H2Section[]): number {
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    if (position >= s.start && position < s.end) return i;
  }
  return -1;
}

/**
 * Load merged catalog once and return a URL → metadata map for validation.
 */
async function buildTargetMetaIndex(): Promise<TargetMetaIndex> {
  const map: TargetMetaIndex = new Map();
  try {
    const { pages } = await loadMergedCatalog();
    for (const page of pages) {
      if (!page.url) continue;
      const p = page as PagePurpose & RawPageData;
      map.set(normalizeUrl(page.url), {
        title: page.title,
        description: page.description,
        tags: page.tags || [],
        region: page.region || "both",
        category: page.category || "",
        linkWhen: normalizeIntentField(p.linkWhen as unknown),
        doNotLinkWhen: normalizeIntentField(p.doNotLinkWhen as unknown),
        readerPromise: p.readerPromise,
        questionsAnswered: p.questionsAnswered,
        topicsCovered: p.topicsCovered,
        topicsExcluded: p.topicsExcluded,
        financingConcepts: p.financingConcepts,
        assetTypes: p.assetTypes,
        url: page.url,
      });
    }
  } catch {
    // empty map
  }
  return map;
}

function normalizeIntentField(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  }
  return [];
}

/** Tokenize text for intent comparison: lowercase, alphanumeric, drop stopwords + short tokens. */
function tokenizeForIntent(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3) continue;
    if (STOP_WORDS.has(raw)) continue;
    tokens.add(raw);
  }
  return tokens;
}

/** Count shared tokens between two sets. */
function countOverlap(a: Set<string>, b: Set<string>): number {
  let count = 0;
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const token of smaller) {
    if (larger.has(token)) count++;
  }
  return count;
}

/** Bucket a 0..1 normalized position into intro/body/conclusion. */
function bucketForPosition(positionInBody: number, bodyLength: number): PositionBucket {
  if (bodyLength <= 0) return "body";
  const ratio = positionInBody / bodyLength;
  if (ratio < 0.25) return "intro";
  if (ratio < 0.75) return "body";
  return "conclusion";
}

/**
 * Post-pass rebalancer: if 3+ accepted suggestions land in the same bucket
 * and there are ≥5 accepted total, demote the lowest-confidence ones in the
 * over-represented bucket until the bucket has ≤2 or total drops to 4.
 * Also stamps `positionBucket` + `positionDistribution` on every validated
 * entry for downstream reporting.
 */
function rebalancePositionClusters(
  validated: ValidatedLink[],
  bodyLength: number
): void {
  // Stamp bucket on every accepted link first.
  const accepted = validated.filter((v) => v.passed);
  for (const v of accepted) {
    v.positionBucket = bucketForPosition(v.positionInBody, bodyLength);
  }

  const bucketOf = (v: ValidatedLink): PositionBucket =>
    v.positionBucket ?? bucketForPosition(v.positionInBody, bodyLength);

  const recomputeDistribution = (): PositionDistribution => {
    const dist: PositionDistribution = { intro: 0, body: 0, conclusion: 0 };
    for (const v of validated) {
      if (!v.passed) continue;
      dist[bucketOf(v)]++;
    }
    return dist;
  };

  let distribution = recomputeDistribution();
  let total = distribution.intro + distribution.body + distribution.conclusion;

  if (total >= POSITION_CLUSTER_MIN_TOTAL) {
    // Demote lowest-confidence entries in over-represented buckets.
    // Stop when bucket drops to ≤2 OR total accepted drops to 4.
    while (total > 4) {
      const overBucket = (Object.keys(distribution) as PositionBucket[]).find(
        (b) => distribution[b] >= 3
      );
      if (!overBucket) break;

      const candidates = validated
        .filter((v) => v.passed && bucketOf(v) === overBucket)
        .sort((a, b) => (a.suggestion.confidence || 0) - (b.suggestion.confidence || 0));
      if (candidates.length === 0) break;

      const victim = candidates[0];
      victim.passed = false;
      victim.rejectionReason = "position-cluster";
      // Remove the bucket stamp from the demoted entry.
      victim.positionBucket = undefined;

      distribution = recomputeDistribution();
      total = distribution.intro + distribution.body + distribution.conclusion;
      if (distribution[overBucket] <= POSITION_CLUSTER_MAX_PER_BUCKET) continue;
    }
  }

  // Attach the final distribution snapshot to every entry for downstream use.
  for (const v of validated) {
    v.positionDistribution = distribution;
  }
}

/**
 * Build sets of valid (published) URLs and tooltip-only URLs from the raw catalog.
 */
async function buildValidUrlSets(): Promise<{ validUrls: Set<string>, tooltipOnlyUrls: Set<string> }> {
  const catalogPath = path.resolve("src/data/linker-v4/raw-catalog.json");
  try {
    const catalog: { pages: RawPageData[] } = JSON.parse(
      await fs.readFile(catalogPath, "utf-8")
    );
    const validUrls = new Set<string>();
    const tooltipOnlyUrls = new Set<string>();
    for (const page of catalog.pages) {
      const normalized = normalizeUrl(page.url);
      if (page.isTooltipOnly) {
        tooltipOnlyUrls.add(normalized);
      } else if (page.type !== "queue") {
        validUrls.add(normalized);
      }
    }
    return { validUrls, tooltipOnlyUrls };
  } catch {
    return { validUrls: new Set(), tooltipOnlyUrls: new Set() };
  }
}

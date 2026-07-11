// ============================================
// Smart Linker v7 — Anchor Quality Rules
// ============================================
// Rejects mid-clause fragments ("the mortgage and") and scores
// descriptive, click-worthy anchor phrases.

import { tokenize, STOP_WORDS } from "./semantic-filter";

export interface AnchorTargetMeta {
  title: string;
  description: string;
  tags?: string[];
  url?: string;
  readerPromise?: string;
  questionsAnswered?: string[];
  linkWhen?: string[];
  topicsCovered?: string[];
}

export const MIN_ANCHOR_WORDS = 5;
export const MAX_ANCHOR_WORDS = 14;
export const PREFERRED_MIN_WORDS = 6;

/** Words that must not start or end a link anchor. */
const EDGE_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "with", "for", "to", "in", "on", "at",
  "is", "are", "was", "were", "be", "been", "being", "am",
  "your", "their", "our", "my", "its", "it", "this", "that", "these", "those",
  "when", "if", "as", "of", "by", "from", "so", "than", "then", "also", "both",
  "each", "all", "any", "some", "such", "only", "just", "even", "still", "yet",
  "not", "no", "can", "will", "would", "could", "should", "may", "might",
  "has", "have", "had", "do", "does", "did", "we", "you", "they", "he", "she",
  "who", "which", "what", "where", "while", "because", "although", "though",
  "into", "onto", "upon", "about", "over", "under", "between", "through",
]);

/** Leading patterns that signal a truncated clause, not a reader promise. */
const FRAGMENT_START_RE =
  /^(the|a|an|and|or|but|with|for|to|in|on|at|is|are|was|were|your|their|our|my|it|its|that|this|when|if|as|of|by|from|so|than|then|also|both|each|all|any|some|such|only|just|even|still|yet|not|no|can|will|would|could|should|has|have|had|be|been|being|do|does|did|we|you|they)\b/i;

const FRAGMENT_END_RE =
  /\b(and|or|the|a|an|to|for|in|with|at|on|is|are|was|were|be|been|being|do|does|did|can|will|would|could|should|has|have|had|of|by|from|so|than|then|also|both|each|all|any|some|such|only|just|even|still|yet|not|no|we|you|they|it|its|that|this|when|if|as)$/i;

export function anchorWordCount(anchor: string): number {
  return anchor.trim().split(/\s+/).filter(Boolean).length;
}

export function isEdgeStopword(word: string): boolean {
  return EDGE_STOPWORDS.has(word.toLowerCase().replace(/[^\wàâäéèêëïîôùûüçœæ-]/gi, ""));
}

export function contentTokens(anchor: string): string[] {
  return tokenize(anchor);
}

export function stopwordRatio(anchor: string): number {
  const words = anchor.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  const stops = words.filter((w) => STOP_WORDS.has(w.toLowerCase()) || isEdgeStopword(w));
  return stops.length / words.length;
}

/** Returns rejection reason, or null if the anchor passes fragment checks. */
const WEAK_AND_START_RE =
  /^(the|a|an|mortgage|property|loan|lender|investment|time|deal|market|portfolio|rental|income|cash|rate|rates)\s+and\b/i;

const COMMA_NEW_CLAUSE_RE =
  /,\s*(you|we|they|I|he|she|it|contact|call|book|schedule|read|see|check|click)\b/i;

const TRAILING_THE_TOPIC_RE =
  /\bthe\s+(financing|mortgage|loan|deal|time|market|property|lender|investment)\s*\.?$/i;

const SUBJECT_AND_IT_RE =
  /\b(mortgage|loan|property|deal|rate|rates|income|cash)\s+and\s+(it|its|the|a|an|they)\b/i;

const WEAK_OPENER_RE =
  /^(whether|think|say|if|when|while|although|because|since|though)\b/i;

const EARLY_COMMA_RE = /^[^,]{1,22},/;

const IMPERATIVE_START_RE =
  /^(read|see|check|book|contact|schedule|click|learn|discover|explore|visit|take|run|form|get|use|make|start)\b/i;

export function fragmentAnchorReason(anchor: string): string | null {
  const trimmed = anchor.trim();
  const wc = anchorWordCount(trimmed);

  if (wc < MIN_ANCHOR_WORDS) {
    return `anchor-too-short: ${wc} words (min ${MIN_ANCHOR_WORDS})`;
  }
  if (wc > MAX_ANCHOR_WORDS) {
    return `anchor-too-long: ${wc} words (max ${MAX_ANCHOR_WORDS})`;
  }
  if (FRAGMENT_START_RE.test(trimmed)) {
    return "fragment-anchor: starts with function word";
  }
  if (FRAGMENT_END_RE.test(trimmed)) {
    return "fragment-anchor: ends with function word";
  }
  if (WEAK_AND_START_RE.test(trimmed)) {
    return "fragment-anchor: weak noun+and opener";
  }
  if (IMPERATIVE_START_RE.test(trimmed)) {
    return "fragment-anchor: starts with imperative verb";
  }
  if (WEAK_OPENER_RE.test(trimmed)) {
    return "fragment-anchor: starts with weak clause opener";
  }
  if (EARLY_COMMA_RE.test(trimmed)) {
    return "fragment-anchor: starts with comma-separated fragment";
  }
  if (SUBJECT_AND_IT_RE.test(trimmed)) {
    return "fragment-anchor: noun+and+pronoun pattern";
  }
  if (TRAILING_THE_TOPIC_RE.test(trimmed)) {
    return "fragment-anchor: ends on incomplete the+NOUN phrase";
  }
  if (COMMA_NEW_CLAUSE_RE.test(trimmed)) {
    return "fragment-anchor: crosses comma clause boundary";
  }
  if (/[.!?]\s+\S/.test(trimmed)) {
    return "fragment-anchor: crosses sentence boundary";
  }
  if (/[,;:—–-]\s*$/.test(trimmed)) {
    return "fragment-anchor: ends on clause break punctuation";
  }

  const ratio = stopwordRatio(trimmed);
  if (ratio > 0.55) {
    return "fragment-anchor: too many stop words";
  }

  const content = contentTokens(trimmed);
  if (content.length < 2) {
    return "fragment-anchor: fewer than 2 content words";
  }

  return null;
}

export function isFragmentAnchor(anchor: string): boolean {
  return fragmentAnchorReason(anchor) !== null;
}

/** Count content tokens in anchor that also appear in target metadata. */
export function targetContentOverlap(
  anchor: string,
  meta: AnchorTargetMeta
): number {
  const anchorSet = new Set(contentTokens(anchor));
  const targetText = [
    meta.title,
    meta.description,
    meta.readerPromise || "",
    (meta.questionsAnswered || []).join(" "),
    (meta.topicsCovered || []).join(" "),
    (meta.linkWhen || []).join(" "),
    (meta.tags || []).join(" "),
  ].join(" ");
  const targetSet = new Set(tokenize(targetText));

  let overlap = 0;
  for (const t of anchorSet) {
    if (targetSet.has(t)) overlap++;
  }
  return overlap;
}

export function validateAnchorQuality(
  anchor: string,
  meta?: AnchorTargetMeta
): { ok: boolean; reason?: string } {
  const fragment = fragmentAnchorReason(anchor);
  if (fragment) return { ok: false, reason: fragment };

  if (meta) {
    const overlap = targetContentOverlap(anchor, meta);
    if (overlap < 2) {
      return {
        ok: false,
        reason: "fragment-anchor: fewer than 2 target-topic content words",
      };
    }
  }

  return { ok: true };
}

/**
 * Score how descriptive and click-worthy an anchor is (0–1).
 * Higher = better reader promise in the link text.
 */
export function scoreDescriptiveAnchor(
  anchor: string,
  meta: AnchorTargetMeta
): number {
  const quality = validateAnchorQuality(anchor, meta);
  if (!quality.ok) return 0;

  const wc = anchorWordCount(anchor);
  const content = contentTokens(anchor);
  const overlap = targetContentOverlap(anchor, meta);
  const targetTokens = tokenize(
    `${meta.title} ${meta.description} ${(meta.questionsAnswered || []).join(" ")}`
  );

  let titleHits = 0;
  for (const t of content) {
    if (targetTokens.includes(t)) titleHits++;
  }
  const titleRatio =
    content.length > 0 ? titleHits / content.length : 0;

  const lengthBonus =
    wc >= PREFERRED_MIN_WORDS && wc <= 12
      ? Math.min(0.2, (wc - PREFERRED_MIN_WORDS) * 0.03)
      : wc > 12
        ? -0.08
        : 0;

  const overlapScore = Math.min(0.45, overlap * 0.12);
  const contentDensity = Math.min(0.25, content.length * 0.04);
  const stopPenalty = Math.max(0, stopwordRatio(anchor) - 0.35) * 0.4;

  const lower = anchor.toLowerCase();
  const promiseBoost =
    /^(how|what|why|when|where|financing|finance|mortgage|qualify|qualifying|using|building|investing)/i.test(
      lower
    )
      ? 0.08
      : 0;

  return Math.min(
    1,
    Math.max(
      0,
      overlapScore + titleRatio * 0.25 + contentDensity + lengthBonus + promiseBoost - stopPenalty
    )
  );
}

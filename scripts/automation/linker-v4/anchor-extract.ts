// ============================================
// Smart Linker v7 — Descriptive Anchor Extraction
// ============================================
// Finds exact 5–14 word phrases that read as complete thoughts,
// not arbitrary mid-clause fragments.

import { tokenize, STOP_WORDS } from "./semantic-filter";
import { GENERIC_ANCHORS } from "./catalog-utils";
import { isNumericDataAnchor } from "./semantic-gate";
import {
  MIN_ANCHOR_WORDS,
  MAX_ANCHOR_WORDS,
  isEdgeStopword,
  isFragmentAnchor,
  scoreDescriptiveAnchor,
  validateAnchorQuality,
  type AnchorTargetMeta,
} from "./anchor-quality";

export type { AnchorTargetMeta };

/** Distinctive terms from target metadata for scoring candidate phrases. */
function targetTerms(meta: AnchorTargetMeta): Set<string> {
  const text = [
    meta.title,
    meta.description,
    meta.readerPromise || "",
    (meta.questionsAnswered || []).join(" "),
    (meta.topicsCovered || []).join(" "),
    (meta.linkWhen || []).join(" "),
    (meta.tags || []).join(" "),
  ].join(" ");
  return new Set(tokenize(text));
}

function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function isGenericAnchor(anchor: string): boolean {
  const lower = anchor.toLowerCase().trim();
  return GENERIC_ANCHORS.some((g) => lower === g || lower.includes(g));
}

export function normalizeParagraphText(text: string): string {
  return text
    .replace(/\*\*|__|\*|_|~~/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Score how well a candidate anchor phrase aligns with target metadata.
 * Returns 0–1.
 */
export function scoreAnchorTargetAlignment(
  anchor: string,
  meta: AnchorTargetMeta
): number {
  const descriptive = scoreDescriptiveAnchor(anchor, meta);
  if (descriptive === 0) return 0;

  const anchorTokens = tokenize(anchor);
  if (anchorTokens.length === 0) return 0;

  const targets = targetTerms(meta);
  if (targets.size === 0) return descriptive * 0.5;

  let overlap = 0;
  for (const t of anchorTokens) {
    if (targets.has(t)) overlap++;
  }

  const overlapRatio = overlap / anchorTokens.length;
  const titleTokens = tokenize(meta.title);
  let titleHit = 0;
  for (const t of titleTokens) {
    if (anchorTokens.includes(t)) titleHit++;
  }
  const titleBonus =
    titleTokens.length > 0 ? (titleHit / titleTokens.length) * 0.25 : 0;

  return Math.min(1, descriptive * 0.55 + overlapRatio * 0.3 + titleBonus);
}

/** Valid phrase spans: start/end on content words, length within bounds. */
function enumeratePhraseSpans(wordList: string[]): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];

  for (let start = 0; start < wordList.length; start++) {
    if (isEdgeStopword(wordList[start])) continue;

    for (
      let end = start + MIN_ANCHOR_WORDS - 1;
      end < Math.min(wordList.length, start + MAX_ANCHOR_WORDS);
      end++
    ) {
      if (isEdgeStopword(wordList[end])) continue;
      spans.push({ start, end });
    }
  }

  return spans;
}

/** Split paragraph into clause-sized units for whole-clause candidates. */
function splitIntoClauses(plain: string): string[] {
  const units: string[] = [];

  const sentences = plain.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    const wc = anchorWordCountSafe(trimmed);
    if (wc >= MIN_ANCHOR_WORDS && wc <= MAX_ANCHOR_WORDS) {
      units.push(trimmed);
    }

    if (wc > MAX_ANCHOR_WORDS) {
      const clauses = trimmed.split(/\s*[,;:—–-]\s+/);
      for (const clause of clauses) {
        const c = clause.trim();
        if (c && anchorWordCountSafe(c) >= MIN_ANCHOR_WORDS && anchorWordCountSafe(c) <= MAX_ANCHOR_WORDS) {
          units.push(c);
        }
      }
    }
  }

  return units;
}

function anchorWordCountSafe(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function exactSubstring(plain: string, candidate: string): string | null {
  const idx = plain.toLowerCase().indexOf(candidate.toLowerCase());
  if (idx === -1) return null;
  return plain.slice(idx, idx + candidate.length);
}

function scoreCandidate(
  anchor: string,
  meta: AnchorTargetMeta,
  minScore: number
): number | null {
  if (isGenericAnchor(anchor)) return null;
  if (isNumericDataAnchor(anchor)) return null;
  if (isFragmentAnchor(anchor)) return null;

  const quality = validateAnchorQuality(anchor, meta);
  if (!quality.ok) return null;

  const score = scoreAnchorTargetAlignment(anchor, meta);
  if (score < minScore) return null;
  return score;
}

/**
 * Try matching a substantial phrase from purpose-card questions/topics in the paragraph.
 */
function extractFromPurposePhrases(
  plain: string,
  meta: AnchorTargetMeta,
  minScore: number
): string | null {
  const seeds = [
    ...(meta.questionsAnswered || []),
    ...(meta.topicsCovered || []).slice(0, 4),
  ];

  const wordList = words(plain);
  let best: { anchor: string; score: number } | null = null;

  for (const seed of seeds) {
    const seedWords = words(
      seed.replace(/[^\w\sàâäéèêëïîôùûüçœæ?,'-]/gi, " ")
    ).filter((w) => !STOP_WORDS.has(w.toLowerCase()) && w.length > 2);

    if (seedWords.length < 3) continue;

    for (let len = Math.min(MAX_ANCHOR_WORDS, seedWords.length); len >= MIN_ANCHOR_WORDS; len--) {
      for (let start = 0; start + len <= seedWords.length; start++) {
        const needle = seedWords.slice(start, start + len).join(" ");
        const idx = plain.toLowerCase().indexOf(needle.toLowerCase());
        if (idx === -1) continue;

        for (const span of enumeratePhraseSpans(wordList)) {
          const candidate = wordList.slice(span.start, span.end + 1).join(" ");
          if (!candidate.toLowerCase().includes(needle.toLowerCase())) continue;

          const exact = exactSubstring(plain, candidate);
          if (!exact) continue;

          const score = scoreCandidate(exact, meta, minScore);
          if (score === null) continue;

          if (!best || score > best.score || (score === best.score && exact.length < best.anchor.length)) {
            best = { anchor: exact, score };
          }
        }
      }
    }
  }

  return best?.anchor ?? null;
}

/**
 * Score whole clauses that appear verbatim in the paragraph.
 */
function extractFromClauses(
  plain: string,
  meta: AnchorTargetMeta,
  minScore: number
): string | null {
  let best: { anchor: string; score: number } | null = null;

  for (const clause of splitIntoClauses(plain)) {
    const wc = anchorWordCountSafe(clause);
    if (wc < MIN_ANCHOR_WORDS) continue;

    let candidate = clause;
    if (wc > MAX_ANCHOR_WORDS) {
      const clauseWords = words(clause);
      let localBest: { anchor: string; score: number } | null = null;

      for (const span of enumeratePhraseSpans(clauseWords)) {
        const phrase = clauseWords.slice(span.start, span.end + 1).join(" ");
        const exact = exactSubstring(plain, phrase);
        if (!exact) continue;
        const score = scoreCandidate(exact, meta, minScore);
        if (score === null) continue;
        if (!localBest || score > localBest.score) {
          localBest = { anchor: exact, score };
        }
      }

      if (!localBest) continue;
      candidate = localBest.anchor;
    } else {
      const exact = exactSubstring(plain, candidate);
      if (!exact) continue;
      candidate = exact;
    }

    const score = scoreCandidate(candidate, meta, minScore);
    if (score === null) continue;

    if (!best || score > best.score || (score === best.score && candidate.length < best.anchor.length)) {
      best = { anchor: candidate, score };
    }
  }

  return best?.anchor ?? null;
}

/**
 * Fallback: phrase-boundary windows only (never arbitrary 3-word fragments).
 */
function extractFromPhraseWindows(
  plain: string,
  meta: AnchorTargetMeta,
  minScore: number
): string | null {
  const wordList = words(plain).slice(0, 140);
  if (wordList.length < MIN_ANCHOR_WORDS) return null;

  const targetTokenList = Array.from(targetTerms(meta));
  let best: { anchor: string; score: number } | null = null;

  for (const span of enumeratePhraseSpans(wordList)) {
    const candidate = wordList.slice(span.start, span.end + 1).join(" ");
    const exact = exactSubstring(plain, candidate);
    if (!exact) continue;

    const candidateTokens = tokenize(exact);
    const hasTargetHit = candidateTokens.some((t) => targetTokenList.includes(t));
    if (!hasTargetHit) continue;

    const score = scoreCandidate(exact, meta, minScore);
    if (score === null) continue;

    if (!best || score > best.score || (score === best.score && exact.length < best.anchor.length)) {
      best = { anchor: exact, score };
    }
  }

  return best?.anchor ?? null;
}

/**
 * Extract the best exact anchor substring from paragraph text for a target page.
 * Returns null if no descriptive phrase is found — prefer no link over a bad link.
 */
export function extractAnchorFromParagraph(
  paragraphText: string,
  meta: AnchorTargetMeta,
  minScore = 0.28
): string | null {
  const plain = normalizeParagraphText(paragraphText);
  if (anchorWordCountSafe(plain) < MIN_ANCHOR_WORDS) return null;

  return (
    extractFromPurposePhrases(plain, meta, minScore) ||
    extractFromClauses(plain, meta, minScore) ||
    extractFromPhraseWindows(plain, meta, minScore)
  );
}

/**
 * After LLM suggests a target, resolve anchor: prefer extracted phrase, fall back to LLM anchor if valid.
 */
export function resolveAnchorText(
  paragraphText: string,
  meta: AnchorTargetMeta,
  llmAnchor?: string
): string | null {
  const extracted = extractAnchorFromParagraph(paragraphText, meta);
  if (extracted) return extracted;

  if (llmAnchor) {
    const cleaned = llmAnchor.replace(/\*\*/g, "").trim();
    const plain = normalizeParagraphText(paragraphText);
    if (
      anchorWordCountSafe(cleaned) >= MIN_ANCHOR_WORDS &&
      anchorWordCountSafe(cleaned) <= MAX_ANCHOR_WORDS &&
      plain.toLowerCase().includes(cleaned.toLowerCase()) &&
      !isGenericAnchor(cleaned) &&
      !isFragmentAnchor(cleaned) &&
      validateAnchorQuality(cleaned, meta).ok
    ) {
      const idx = plain.toLowerCase().indexOf(cleaned.toLowerCase());
      return plain.slice(idx, idx + cleaned.length);
    }
  }

  return null;
}

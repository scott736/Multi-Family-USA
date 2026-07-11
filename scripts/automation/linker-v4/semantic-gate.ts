// ============================================
// Smart Linker v8 — Semantic Gates
// ============================================
// Concept, asset-class, and reader-intent validation (not just token overlap).

import { tokenize } from "./semantic-filter";
import { scoreAnchorTargetAlignment, type AnchorTargetMeta } from "./anchor-extract";
import {
  inferConcepts,
  inferAssetClasses,
  conceptOverlap,
  hasConceptConflict,
  hasAssetConflict,
  hitsTopicsExcluded,
  scoreReaderIntentAlignment,
  type FinancingConcept,
} from "./concept-taxonomy";

export const MIN_ANCHOR_TARGET_SCORE = 0.20;
export const MIN_CONTEXT_TARGET_SCORE = 0.19;
export const MIN_LINKWHEN_OVERLAP = 3;

export const FINANCING_INTENT_TERMS = new Set([
  "mortgage",
  "mortgages",
  "finance",
  "financing",
  "lender",
  "lenders",
  "lending",
  "qualify",
  "qualification",
  "qualifying",
  "rates",
  "cmhc",
  "dscr",
  "refinance",
  "refinancing",
  "amortization",
  "pre-approval",
  "preapproval",
  "broker",
  "brokers",
  "loan",
  "loans",
  "underwriting",
  "underwrite",
  "ltv",
  "gds",
  "tds",
  "insured",
  "conventional",
  "funding",
  "approval",
  "approved",
]);

const NUMERIC_DATA_PATTERNS = [
  /\$\d[\d,]*(?:\.\d+)?[kKmMbB]?/,
  /\d[\d,]*(?:\.\d+)?%/,
  /\d+\s+(?:residential\s+)?units\b/i,
  /\d+\s+(?:bedroom|bed|bath|sq\.?\s*ft)\b/i,
  /\d{4,}/,
];

export interface TargetMeta extends AnchorTargetMeta {
  linkWhen?: string[];
  doNotLinkWhen?: string[];
  topicsExcluded?: string[];
  financingConcepts?: string[];
  assetTypes?: string[];
  region?: string;
  category?: string;
}

function tokenSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

function overlapCount(a: Set<string>, b: Set<string>): number {
  let n = 0;
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const t of smaller) {
    if (larger.has(t)) n++;
  }
  return n;
}

/** True when anchor is mostly numeric data (rates, unit counts, dollar amounts). */
export function isNumericDataAnchor(anchor: string): boolean {
  if (NUMERIC_DATA_PATTERNS.some((p) => p.test(anchor))) return true;

  const tokens = anchor.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  const numericTokens = tokens.filter((t) => /\d/.test(t) || /^\$/.test(t));
  return numericTokens.length / tokens.length > 0.4;
}

function hasFinancingIntent(text: string): boolean {
  const tokens = tokenize(text);
  return tokens.some((t) => FINANCING_INTENT_TERMS.has(t));
}

/** Surrounding sentence context vs target metadata. */
export function scoreContextTargetAlignment(context: string, meta: TargetMeta): number {
  const ctx = tokenSet(context);
  if (ctx.size === 0) return 0;

  const targetText = [
    meta.title,
    meta.description,
    (meta.tags || []).join(" "),
    meta.linkWhen?.join(" ") || "",
    meta.readerPromise || "",
    (meta.financingConcepts || []).join(" "),
    (meta.questionsAnswered || []).join(" "),
  ].join(" ");
  const target = tokenSet(targetText);
  if (target.size === 0) return 0;

  return overlapCount(ctx, target) / Math.sqrt(ctx.size * target.size);
}

/** Positive intent: linkWhen clauses should overlap context when defined. */
export function passesLinkWhenGate(context: string, meta: TargetMeta): boolean {
  const clauses = meta.linkWhen?.filter(Boolean) || [];
  if (clauses.length === 0) return true;

  const ctx = tokenSet(context);
  for (const clause of clauses) {
    const clauseTokens = tokenSet(clause);
    if (overlapCount(ctx, clauseTokens) >= MIN_LINKWHEN_OVERLAP) return true;
  }
  return false;
}

/** Reject when context overlaps doNotLinkWhen clauses. */
export function passesDoNotLinkWhen(context: string, meta: TargetMeta): boolean {
  const clauses = meta.doNotLinkWhen?.filter(Boolean) || [];
  if (clauses.length === 0) return true;

  const ctx = tokenSet(context);
  for (const clause of clauses) {
    const clauseTokens = tokenSet(clause);
    if (overlapCount(ctx, clauseTokens) >= MIN_LINKWHEN_OVERLAP) return false;
  }
  return true;
}

/** v8: hard-reject concept conflicts and excluded topics; overlap boosts score only. */
export function passesConceptGate(
  anchor: string,
  context: string,
  meta: TargetMeta
): { passed: boolean; reason?: string } {
  const combined = `${anchor} ${context}`;
  const contextConcepts = inferConcepts(combined);
  const targetConcepts = (meta.financingConcepts || []) as FinancingConcept[];

  if (hitsTopicsExcluded(anchor, context, meta.topicsExcluded)) {
    return { passed: false, reason: "topics-excluded" };
  }

  if (targetConcepts.length > 0 && hasConceptConflict(contextConcepts, targetConcepts)) {
    return { passed: false, reason: "concept-conflict" };
  }

  return { passed: true };
}

const SPECIALIZED_CONCEPT_TARGETS: Partial<
  Record<FinancingConcept, FinancingConcept[]>
> = {
  "self-storage-financing": [
    "self-storage-financing",
    "commercial-financing",
    "bridge-financing",
    "lender-selection",
  ],
  "development-ground-up": ["development-ground-up", "cmhc-programs", "bridge-financing"],
  "multifamily-investing": [
    "multifamily-investing",
    "commercial-financing",
    "cmhc-programs",
  ],
};

/** v8: specialized asset contexts require matching target concepts. */
export function passesSpecializedAssetGate(
  anchor: string,
  context: string,
  meta: TargetMeta
): { passed: boolean; reason?: string } {
  const combined = `${anchor} ${context}`;
  const contextConcepts = inferConcepts(combined);
  const targetConcepts = (meta.financingConcepts || []) as FinancingConcept[];
  const targetAssets = meta.assetTypes || [];

  if (/\bself[- ]storage\b/i.test(anchor)) {
    if (targetAssets.some((a) => a === "office")) {
      return { passed: false, reason: "specialized-asset-mismatch: self-storage to office" };
    }
    const ok =
      targetConcepts.includes("self-storage-financing") ||
      targetAssets.some((a) => a.includes("self-storage")) ||
      targetConcepts.some((c) =>
        SPECIALIZED_CONCEPT_TARGETS["self-storage-financing"]?.includes(c)
      );
    if (!ok) {
      return { passed: false, reason: "specialized-asset-mismatch: self-storage" };
    }
  }

  for (const [requiredContext, allowedTargets] of Object.entries(
    SPECIALIZED_CONCEPT_TARGETS
  ) as [FinancingConcept, FinancingConcept[]][]) {
    if (!contextConcepts.has(requiredContext)) continue;
    if (targetConcepts.length === 0) continue;
    const ok = targetConcepts.some((c) => allowedTargets.includes(c));
    if (!ok) {
      return {
        passed: false,
        reason: `specialized-asset-mismatch: ${requiredContext}`,
      };
    }
  }

  return { passed: true };
}
export function passesAssetClassGate(
  anchor: string,
  context: string,
  meta: TargetMeta
): { passed: boolean; reason?: string } {
  const combined = `${anchor} ${context}`;
  const contextAssets = inferAssetClasses(combined);

  if (hasAssetConflict(contextAssets, meta.assetTypes)) {
    return { passed: false, reason: "asset-class-mismatch" };
  }

  return { passed: true };
}

/** v8: reader-intent used in scoring; only hard-reject extreme mismatches. */
export function passesReaderIntentGate(
  anchor: string,
  context: string,
  meta: TargetMeta
): { passed: boolean; reason?: string } {
  const score = scoreReaderIntentAlignment(
    anchor,
    context,
    meta.questionsAnswered,
    meta.readerPromise
  );

  const hasQuestions = (meta.questionsAnswered?.length || 0) >= 2;
  if (hasQuestions && score < 0.05) {
    return {
      passed: false,
      reason: `reader-intent-mismatch: score ${score.toFixed(2)}`,
    };
  }

  return { passed: true };
}

/** Pillar pages require financing intent in anchor or surrounding context. */
export function passesFinancingIntentForPillar(
  anchor: string,
  context: string,
  isPillar: boolean
): boolean {
  if (!isPillar) return true;
  return hasFinancingIntent(anchor) || hasFinancingIntent(context);
}

/** All targets with linkWhen clauses must match at least one (v8: not pillar-only). */
export function passesMandatoryLinkWhen(context: string, meta: TargetMeta): boolean {
  const clauses = meta.linkWhen?.filter(Boolean) || [];
  if (clauses.length === 0) return true;
  return passesLinkWhenGate(context, meta);
}

/** Region gate: block obvious region mismatches. */
export function passesRegionGate(
  articleRegion: string,
  articleCategory: string,
  articleTags: string[],
  targetRegion: string
): boolean {
  const ar = (articleRegion || "both").toLowerCase();
  const tr = (targetRegion || "both").toLowerCase();

  if (tr === "both" || ar === "both") return true;
  if (ar === tr) return true;

  if (articleCategory === "us-cross-border") return true;
  const crossBorderTags = ["cross-border", "us-investing", "snowbird", "foreign-national", "dscr"];
  if (articleTags.some((t) => crossBorderTags.some((cb) => t.toLowerCase().includes(cb)))) {
    return true;
  }

  return false;
}

export function validateSemanticGates(
  anchorText: string,
  context: string,
  meta: TargetMeta,
  articleRegion: string,
  articleCategory: string,
  articleTags: string[],
  isPillar = false,
  _strict = false
): { passed: boolean; reason?: string } {
  if (!passesRegionGate(articleRegion, articleCategory, articleTags, meta.region || "both")) {
    return { passed: false, reason: "region-mismatch" };
  }

  const anchorScore = scoreAnchorTargetAlignment(anchorText, meta);
  if (anchorScore < MIN_ANCHOR_TARGET_SCORE) {
    return { passed: false, reason: `semantic-mismatch: anchor-target score ${anchorScore.toFixed(2)}` };
  }

  const ctxScore = scoreContextTargetAlignment(context, meta);
  if (ctxScore < MIN_CONTEXT_TARGET_SCORE) {
    return { passed: false, reason: `semantic-mismatch: context-target score ${ctxScore.toFixed(2)}` };
  }

  if (!passesDoNotLinkWhen(context, meta)) {
    return { passed: false, reason: "do-not-link-when" };
  }

  const conceptGate = passesConceptGate(anchorText, context, meta);
  if (!conceptGate.passed) return conceptGate;

  const assetGate = passesAssetClassGate(anchorText, context, meta);
  if (!assetGate.passed) return assetGate;

  const specializedGate = passesSpecializedAssetGate(anchorText, context, meta);
  if (!specializedGate.passed) return specializedGate;

  const intentGate = passesReaderIntentGate(anchorText, context, meta);
  if (!intentGate.passed) return intentGate;

  if (!passesFinancingIntentForPillar(anchorText, context, isPillar)) {
    return { passed: false, reason: "pillar-financing-intent" };
  }

  if (!passesMandatoryLinkWhen(context, meta)) {
    return { passed: false, reason: "linkwhen-mismatch" };
  }

  return { passed: true };
}

/** Combined v8 score for ranking candidates (contrastive, not TF-IDF alone). */
export function scoreSemanticCandidate(
  anchor: string,
  context: string,
  meta: TargetMeta,
  retrievalScore = 0
): number {
  const anchorScore = scoreAnchorTargetAlignment(anchor, meta);
  const ctxScore = scoreContextTargetAlignment(context, meta);
  const combined = `${anchor} ${context}`;
  const contextConcepts = inferConcepts(combined);
  const targetConcepts = (meta.financingConcepts || []) as FinancingConcept[];
  const conceptScore =
    targetConcepts.length > 0
      ? conceptOverlap(contextConcepts, targetConcepts) / targetConcepts.length
      : 0.3;
  const intentScore = scoreReaderIntentAlignment(
    anchor,
    context,
    meta.questionsAnswered,
    meta.readerPromise
  );

  return (
    anchorScore * 0.3 +
    ctxScore * 0.3 +
    conceptScore * 0.25 +
    intentScore * 0.15 +
    retrievalScore * 0.1
  );
}

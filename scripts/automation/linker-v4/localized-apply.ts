// ============================================
// Smart Linker v6 — Localized link application
// ============================================
// Applies EN-validated link targets to es/fr posts with locale-aware anchors.

import fs from "fs/promises";
import path from "path";
import type { NumberedParagraph } from "./types";
import { loadMarkdownFiles, parseBody, numberParagraphs, BLOG_DIR } from "./parse";
import { loadMergedCatalog, normalizeUrl } from "./catalog-utils";
import {
  extractAnchorFromParagraph,
  normalizeParagraphText,
  type AnchorTargetMeta,
} from "./anchor-extract";
import { validateAnchorQuality, MIN_ANCHOR_WORDS, MAX_ANCHOR_WORDS } from "./anchor-quality";
import { tokenize } from "./semantic-filter";
import type { TargetMeta } from "./semantic-gate";

const DATA_DIR = "src/data/linker-v4";

export type LocalizedTargetMeta = AnchorTargetMeta &
  Pick<TargetMeta, "linkWhen" | "doNotLinkWhen">;

/** Catalog target metadata with es/fr blog titles, descriptions, and keyTerms. */
export async function buildLocalizedCatalogTargetIndex(
  lang: string
): Promise<Map<string, LocalizedTargetMeta>> {
  const { pages } = await loadMergedCatalog();
  const localizedPosts = await loadMarkdownFiles(BLOG_DIR, lang);
  const postBySlug = new Map(localizedPosts.map((p) => [p.slug, p]));

  const purposeBySlug = new Map<
    string,
    {
      linkWhen?: string[];
      doNotLinkWhen?: string[];
      readerPromise?: string;
      questionsAnswered?: string[];
      topicsCovered?: string[];
    }
  >();
  try {
    const catalog = JSON.parse(
      await fs.readFile(path.resolve(DATA_DIR, "page-catalog.json"), "utf-8")
    ) as {
      pages: Array<{
        slug: string;
        linkWhen?: string[];
        doNotLinkWhen?: string[];
        readerPromise?: string;
        questionsAnswered?: string[];
        topicsCovered?: string[];
      }>;
    };
    for (const p of catalog.pages || []) {
      purposeBySlug.set(p.slug, {
        linkWhen: p.linkWhen,
        doNotLinkWhen: p.doNotLinkWhen,
        readerPromise: p.readerPromise,
        questionsAnswered: p.questionsAnswered,
        topicsCovered: p.topicsCovered,
      });
    }
  } catch {
    // optional
  }

  const index = new Map<string, LocalizedTargetMeta>();

  for (const page of pages) {
    const purpose = purposeBySlug.get(page.slug);
    let title = page.title;
    let description = page.description;
    let tags = [...(page.tags || [])];

    const blogMatch = page.url.match(/^\/blog\/([^/]+)\/?$/);
    if (blogMatch) {
      const lp = postBySlug.get(blogMatch[1]);
      if (lp) {
        title = String(lp.frontmatter.title || title);
        const seo = lp.frontmatter.seo as { description?: string } | undefined;
        description = String(
          lp.frontmatter.description || seo?.description || description
        );
        const keyTerms = (lp.frontmatter.keyTerms as string[]) || [];
        tags = [...new Set([...tags, ...keyTerms])];
      }
    }

    index.set(normalizeUrl(page.url), {
      title,
      description,
      tags,
      url: page.url,
      readerPromise: purpose?.readerPromise || description,
      linkWhen: purpose?.linkWhen,
      doNotLinkWhen: purpose?.doNotLinkWhen,
      questionsAnswered: purpose?.questionsAnswered,
      topicsCovered: purpose?.topicsCovered,
    });
  }

  return index;
}

/** Map EN paragraphIndex → same ordinal among content paragraphs (handles index drift). */
export function resolveLocalizedParagraph(
  paragraphs: NumberedParagraph[],
  paragraphIndex: number,
  contentOrdinal?: number
): NumberedParagraph | undefined {
  const byIndex = paragraphs.find((p) => p.index === paragraphIndex && p.isContent);
  if (byIndex) return byIndex;

  if (contentOrdinal !== undefined && contentOrdinal >= 0) {
    const content = paragraphs.filter((p) => p.isContent);
    if (contentOrdinal < content.length) return content[contentOrdinal];
  }

  return undefined;
}

export function getContentParagraphOrdinal(
  paragraphs: NumberedParagraph[],
  paragraphIndex: number
): number {
  const content = paragraphs.filter((p) => p.isContent);
  return content.findIndex((p) => p.index === paragraphIndex);
}

/**
 * Resolve a natural anchor in translated prose for the same target URL.
 */
export function resolveLocalizedAnchor(
  paragraphText: string,
  meta: LocalizedTargetMeta,
  enAnchor?: string,
  enParagraphText?: string
): string | null {
  const extracted = extractAnchorFromParagraph(paragraphText, meta, 0.22);
  if (extracted) return extracted;

  if (enAnchor && enParagraphText) {
    const positional = anchorByRelativePosition(
      paragraphText,
      enAnchor,
      enParagraphText,
      meta
    );
    if (positional) return positional;

    const overlap = extractByTokenOverlap(paragraphText, enAnchor, meta);
    if (overlap) return overlap;
  }

  const purposePhrase = extractFromPurposePhrases(paragraphText, meta);
  if (purposePhrase) return purposePhrase;

  const titlePhrase = extractAnchorFromTitlePhrase(paragraphText, meta.title);
  if (titlePhrase && validateAnchorQuality(titlePhrase, meta).ok) {
    return titlePhrase;
  }

  const tagPhrase = extractFromTags(paragraphText, meta);
  if (tagPhrase) return tagPhrase;

  return null;
}

/** Same relative position in paragraph as EN anchor (works well for aligned translations). */
function anchorByRelativePosition(
  paragraphText: string,
  enAnchor: string,
  enParagraphText: string,
  meta: LocalizedTargetMeta
): string | null {
  const enLower = enParagraphText.toLowerCase();
  const anchorLower = enAnchor.toLowerCase();
  const enStart = enLower.indexOf(anchorLower);
  if (enStart === -1) return null;

  const ratio = enStart / Math.max(enParagraphText.length, 1);
  const wordCount = enAnchor.split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_ANCHOR_WORDS) return null;

  const plain = normalizeParagraphText(paragraphText);
  const words = plain.split(/\s+/).filter(Boolean);
  if (words.length < wordCount) return null;

  const center = Math.floor(words.length * ratio);
  const searchStart = Math.max(0, center - 12);
  const searchEnd = Math.min(words.length, center + 12 + wordCount);

  let best: { anchor: string; dist: number } | null = null;

  for (let start = searchStart; start <= searchEnd - wordCount; start++) {
    for (
      let len = wordCount;
      len <= Math.min(wordCount + 2, MAX_ANCHOR_WORDS) && start + len <= words.length;
      len++
    ) {
      const candidate = words.slice(start, start + len).join(" ");
      const idx = plain.toLowerCase().indexOf(candidate.toLowerCase());
      if (idx === -1) continue;
      const exact = plain.slice(idx, idx + candidate.length);
      if (!validateAnchorQuality(exact, meta).ok) continue;
      const dist = Math.abs(start - center);
      if (!best || dist < best.dist) {
        best = { anchor: exact, dist };
      }
    }
  }

  return best?.anchor ?? null;
}

/** Find a 5–14 word span from the localized target title that appears verbatim in the paragraph. */
function extractAnchorFromTitlePhrase(
  paragraphText: string,
  title: string
): string | null {
  const plain = normalizeParagraphText(paragraphText);
  const titleWords = title
    .replace(/[^\w\sàâäéèêëïîôùûüçœæ-]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (titleWords.length < MIN_ANCHOR_WORDS) return null;

  const plainLower = plain.toLowerCase();

  for (let len = Math.min(MAX_ANCHOR_WORDS, titleWords.length); len >= MIN_ANCHOR_WORDS; len--) {
    for (let start = 0; start + len <= titleWords.length; start++) {
      const phrase = titleWords.slice(start, start + len).join(" ");
      const idx = plainLower.indexOf(phrase.toLowerCase());
      if (idx !== -1) {
        return plain.slice(idx, idx + phrase.length);
      }
    }
  }

  return null;
}

/** Best 5–14 word span in localized paragraph that overlaps EN anchor tokens. */
function extractByTokenOverlap(
  paragraphText: string,
  enAnchor: string,
  meta: LocalizedTargetMeta
): string | null {
  const plain = normalizeParagraphText(paragraphText);
  const words = plain.split(/\s+/).filter(Boolean);
  const enTokens = tokenize(enAnchor);
  if (enTokens.length === 0 || words.length < MIN_ANCHOR_WORDS) return null;

  let best: { anchor: string; score: number } | null = null;

  for (let len = MIN_ANCHOR_WORDS; len <= MAX_ANCHOR_WORDS && len <= words.length; len++) {
    for (let start = 0; start + len <= words.length; start++) {
      const candidate = words.slice(start, start + len).join(" ");
      const idx = plain.toLowerCase().indexOf(candidate.toLowerCase());
      if (idx === -1) continue;
      const exact = plain.slice(idx, idx + candidate.length);

      const candTokens = tokenize(exact);
      let overlap = 0;
      for (const t of enTokens) {
        if (candTokens.includes(t)) overlap++;
      }
      const overlapRatio = overlap / enTokens.length;
      if (overlapRatio < 0.28) continue;

      const quality = validateAnchorQuality(exact, meta);
      if (!quality.ok && overlapRatio < 0.42) continue;

      const score = overlapRatio + (quality.ok ? 0.15 : 0);
      if (!best || score > best.score) {
        best = { anchor: exact, score };
      }
    }
  }

  return best?.anchor ?? null;
}

/** Find anchor from localized linkWhen / questionsAnswered phrases in paragraph. */
function extractFromPurposePhrases(
  paragraphText: string,
  meta: LocalizedTargetMeta
): string | null {
  const sources = [
    ...(meta.linkWhen || []),
    ...(meta.questionsAnswered || []).slice(0, 4),
  ];
  const plain = normalizeParagraphText(paragraphText);
  const plainLower = plain.toLowerCase();

  for (const source of sources) {
    const sourceWords = source
      .replace(/[^\w\sàâäéèêëïîôùûüçœæ-]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);
    if (sourceWords.length < MIN_ANCHOR_WORDS) continue;

    for (
      let len = Math.min(MAX_ANCHOR_WORDS, sourceWords.length);
      len >= MIN_ANCHOR_WORDS;
      len--
    ) {
      for (let start = 0; start + len <= sourceWords.length; start++) {
        const phrase = sourceWords.slice(start, start + len).join(" ");
        const idx = plainLower.indexOf(phrase.toLowerCase());
        if (idx === -1) continue;
        const exact = plain.slice(idx, idx + phrase.length);
        if (validateAnchorQuality(exact, meta).ok) return exact;
      }
    }
  }

  return null;
}

/** Find multi-word tag phrase appearing in paragraph. */
function extractFromTags(
  paragraphText: string,
  meta: LocalizedTargetMeta
): string | null {
  const plain = normalizeParagraphText(paragraphText);
  const plainLower = plain.toLowerCase();

  for (const tag of meta.tags || []) {
    const tagWords = tag
      .replace(/-/g, " ")
      .replace(/[^\w\sàâäéèêëïîôùûüçœæ]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);
    if (tagWords.length < MIN_ANCHOR_WORDS) continue;

    const phrase = tagWords.join(" ");
    const idx = plainLower.indexOf(phrase.toLowerCase());
    if (idx === -1) continue;
    const exact = plain.slice(idx, idx + phrase.length);
    if (validateAnchorQuality(exact, meta).ok) return exact;
  }

  return null;
}

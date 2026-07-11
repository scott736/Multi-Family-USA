// ============================================
// Smart Linker v4 — Apply Links to Posts
// ============================================
// Reads validated suggestion files and inserts links into markdown content.
// Two-pass insertion: plan on original body, apply bottom-to-top.
// Tracks every link with reader-need rationale.

import fs from "fs/promises";
import path from "path";
import type { CLIOptions } from "../types";
import type { SuggestionFile, ValidatedLink, TrackedLink, LinkTracker, NumberedParagraph } from "./types";
import {
  loadMarkdownFiles,
  extractRawFrontmatter,
  parseBody,
  numberParagraphs,
  BLOG_DIR,
  BLOG_LANGS,
  QUEUE_DIR,
} from "./parse";
import { normalizeUrl } from "./catalog-utils";
import { type AnchorTargetMeta } from "./anchor-extract";
import {
  buildLocalizedCatalogTargetIndex,
  resolveLocalizedAnchor,
  resolveLocalizedParagraph,
  getContentParagraphOrdinal,
} from "./localized-apply";
import { recordAppliedLink, buildLinkId } from "./quality-tracker";

// ----------------
// Constants
// ----------------

const TRACKER_PATH = "src/data/linker-v4/link-tracker.json";

// ----------------
// Main Function
// ----------------

export async function applyLinks(options: CLIOptions): Promise<void> {
  const locale = (options.locale || "en").toLowerCase();

  if (locale === "all") {
    console.log("Applying validated links to posts (all locales)...\n");
    await applyEnglishLinks(options);
    for (const lang of BLOG_LANGS) {
      if (lang === "en") continue;
      console.log(`\nApplying localized links (${lang})...\n`);
      await applyAllLocalizedLinks(lang, options);
    }
    return;
  }

  if (locale === "en") {
    await applyEnglishLinks(options);
    return;
  }

  console.log(`Applying localized links (${locale})...\n`);
  await applyAllLocalizedLinks(locale, options);
}

async function applyEnglishLinks(options: CLIOptions): Promise<void> {
  const { slug, all, dryRun } = options;

  console.log("Applying validated links to posts...\n");

  const suggestionsDir = path.resolve("src/data/linker-v4/suggestions");

  // Find suggestion files
  let files: string[];
  try {
    files = (await fs.readdir(suggestionsDir)).filter((f) =>
      f.endsWith(".json")
    );
  } catch {
    console.error(
      "No suggestions directory found. Generate and validate suggestions first."
    );
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

  // Load articles for content
  const blogPosts = await loadMarkdownFiles(BLOG_DIR);
  const queueArticles = await loadMarkdownFiles(QUEUE_DIR);
  const allArticles = [...blogPosts, ...queueArticles];
  const articleMap = new Map(allArticles.map((a) => [a.slug, a]));

  // Load tracker
  const tracker = dryRun ? null : await loadTracker();

  let totalLinksApplied = 0;
  let postsModified = 0;

  for (const file of files) {
    const filePath = path.join(suggestionsDir, file);
    const content = await fs.readFile(filePath, "utf-8");
    let suggestionFile: SuggestionFile;

    try {
      suggestionFile = JSON.parse(content);
    } catch {
      console.error(`  Invalid JSON: ${file}`);
      continue;
    }

    // Only apply validated, passing links
    let passingLinks = (suggestionFile.validated || []).filter(
      (v) => v.passed
    );

    // Filter to high-confidence only if requested
    if (options.highConfidenceOnly) {
      passingLinks = passingLinks.filter(
        (v) => v.confidenceTier === "high"
      );
    }
    if (passingLinks.length === 0) {
      continue;
    }

    const article = articleMap.get(suggestionFile.sourceSlug);
    if (!article) {
      console.error(`  Article not found: ${suggestionFile.sourceSlug}`);
      continue;
    }

    // Apply links
    const rawFrontmatter = extractRawFrontmatter(article.rawContent);
    const body = parseBody(article.rawContent);
    const result = insertLinks(body, passingLinks);

    if (result.applied === 0) continue;

    // Build per-applied quality metadata aligned with result.appliedLinks order
    const qualityContext = result.appliedLinks.map((applied) => {
      const match = passingLinks.find(
        (v) =>
          v.suggestion.targetUrl === applied.toUrl &&
          v.suggestion.anchorText.toLowerCase() === applied.anchor.toLowerCase()
      );
      return {
        confidence: match?.suggestion.confidence ?? 0,
        paragraphIndex: match?.suggestion.paragraphIndex ?? 0,
        positionBucket: (match?.positionBucket || "body") as "intro" | "body" | "conclusion",
      };
    });

    totalLinksApplied += result.applied;
    postsModified++;

    if (dryRun) {
      console.log(
        `\n  [DRY RUN] ${suggestionFile.sourceSlug}: ${result.applied} links would be applied`
      );
      for (const link of result.appliedLinks) {
        console.log(`    "${link.anchor}" → ${link.toUrl}`);
        console.log(`    Reason: ${link.readerNeed}`);
      }
      continue;
    }

    // Write modified file
    const newContent = rawFrontmatter + result.newBody;
    await fs.writeFile(article.filePath, newContent, "utf-8");

    // Update suggestion file
    suggestionFile.appliedAt = new Date().toISOString();
    await fs.writeFile(filePath, JSON.stringify(suggestionFile, null, 2));

    // Track links
    if (tracker) {
      for (const link of result.appliedLinks) {
        link.from = suggestionFile.sourceSlug;
        tracker.links.push(link);
      }
    }

    // Best-effort quality-tracker record (do not fail apply if this errors)
    for (let qi = 0; qi < result.appliedLinks.length; qi++) {
      const link = result.appliedLinks[qi];
      const ctx = qualityContext[qi];
      try {
        await recordAppliedLink({
          id: buildLinkId(suggestionFile.sourceSlug, link.toUrl),
          sourceSlug: suggestionFile.sourceSlug,
          sourceUrl: `/blog/${suggestionFile.sourceSlug}/`,
          targetUrl: link.toUrl,
          anchorText: link.anchor,
          appliedAt: link.appliedAt,
          modelUsed: suggestionFile.model,
          confidence: ctx.confidence,
          paragraphIndex: ctx.paragraphIndex,
          positionBucket: ctx.positionBucket,
        });
      } catch (err) {
        console.warn(
          `  quality-tracker record failed for ${suggestionFile.sourceSlug} → ${link.toUrl}: ${(err as Error).message}`
        );
      }
    }

    console.log(
      `  ${suggestionFile.sourceSlug}: applied ${result.applied} links`
    );
  }

  // Save tracker
  if (tracker && totalLinksApplied > 0) {
    tracker.updatedAt = new Date().toISOString();
    await saveTracker(tracker);
    console.log(`\n  Link tracker updated with ${totalLinksApplied} new entries`);
  }

  console.log(
    `\n${dryRun ? "[DRY RUN] Would apply" : "Applied"} ${totalLinksApplied} links to ${postsModified} posts`
  );
}

/**
 * Apply validated EN suggestions to a translated post by re-extracting anchors
 * in the target locale using paragraphIndex + catalog target metadata.
 */
export async function applyLocalizedLinks(
  suggestionFile: SuggestionFile,
  lang: string,
  options: {
    dryRun?: boolean;
    highConfidenceOnly?: boolean;
    catalogByUrl?: Map<string, AnchorTargetMeta>;
  } = {}
): Promise<{ applied: number; appliedLinks: TrackedLink[]; articlePath?: string }> {
  let passingLinks = (suggestionFile.validated || []).filter((v) => v.passed);

  if (options.highConfidenceOnly) {
    passingLinks = passingLinks.filter((v) => v.confidenceTier === "high");
  }
  if (passingLinks.length === 0) {
    return { applied: 0, appliedLinks: [] };
  }

  const posts = await loadMarkdownFiles(BLOG_DIR, lang);
  const article = posts.find((p) => p.slug === suggestionFile.sourceSlug);
  if (!article) {
    return { applied: 0, appliedLinks: [] };
  }

  const enPosts = await loadMarkdownFiles(BLOG_DIR, "en");
  const enArticle = enPosts.find((p) => p.slug === suggestionFile.sourceSlug);
  const enParagraphs = enArticle
    ? numberParagraphs(parseBody(enArticle.rawContent))
    : [];

  const catalogByUrl =
    options.catalogByUrl ?? (await buildLocalizedCatalogTargetIndex(lang));

  const body = parseBody(article.rawContent);
  const paragraphs = numberParagraphs(body);
  const contentParagraphs = paragraphs.filter((p) => p.isContent);
  const localizedValidated: ValidatedLink[] = [];

  for (const validated of passingLinks) {
    const { suggestion } = validated;
    const contentOrdinal = enParagraphs.length
      ? getContentParagraphOrdinal(enParagraphs, suggestion.paragraphIndex)
      : -1;

    const targetMeta = catalogByUrl.get(normalizeUrl(suggestion.targetUrl));
    if (!targetMeta) continue;

    const enParagraph = enParagraphs.find((p) => p.index === suggestion.paragraphIndex);

    const paragraphCandidates: NumberedParagraph[] = [];
    const primary = resolveLocalizedParagraph(
      paragraphs,
      suggestion.paragraphIndex,
      contentOrdinal >= 0 ? contentOrdinal : undefined
    );
    if (primary) paragraphCandidates.push(primary);
    if (contentOrdinal >= 0) {
      for (const offset of [-1, 1, -2, 2]) {
        const neighbor = contentParagraphs[contentOrdinal + offset];
        if (neighbor && !paragraphCandidates.some((p) => p.index === neighbor.index)) {
          paragraphCandidates.push(neighbor);
        }
      }
    }

    let matched: { paragraph: NumberedParagraph; anchorText: string } | null = null;

    for (const paragraph of paragraphCandidates) {
      if (!paragraph.isContent) continue;

      const anchorText = resolveLocalizedAnchor(
        paragraph.text,
        targetMeta,
        suggestion.anchorText,
        enParagraph?.text
      );
      if (!anchorText) continue;

      const positionInBody = findAnchorPositionInParagraph(body, paragraph, anchorText);
      if (positionInBody === -1) continue;

      matched = { paragraph, anchorText };
      break;
    }

    if (!matched) {
      for (const paragraph of contentParagraphs) {
        if (paragraphCandidates.some((p) => p.index === paragraph.index)) continue;

        const anchorText = resolveLocalizedAnchor(
          paragraph.text,
          targetMeta,
          suggestion.anchorText,
          enParagraph?.text
        );
        if (!anchorText) continue;

        const positionInBody = findAnchorPositionInParagraph(body, paragraph, anchorText);
        if (positionInBody === -1) continue;

        matched = { paragraph, anchorText };
        break;
      }
    }

    if (!matched) continue;

    localizedValidated.push({
      suggestion: {
        ...suggestion,
        anchorText: matched.anchorText,
      },
      positionInBody: findAnchorPositionInParagraph(
        body,
        matched.paragraph,
        matched.anchorText
      ),
      passed: true,
      confidenceTier: validated.confidenceTier,
      positionBucket: validated.positionBucket,
    });
  }

  if (localizedValidated.length === 0) {
    return { applied: 0, appliedLinks: [], articlePath: article.filePath };
  }

  const result = insertLinks(body, localizedValidated);
  if (result.applied === 0) {
    return { applied: 0, appliedLinks: [], articlePath: article.filePath };
  }

  for (const link of result.appliedLinks) {
    link.from = suggestionFile.sourceSlug;
  }

  if (!options.dryRun) {
    const rawFrontmatter = extractRawFrontmatter(article.rawContent);
    await fs.writeFile(article.filePath, rawFrontmatter + result.newBody, "utf-8");
  }

  return {
    applied: result.applied,
    appliedLinks: result.appliedLinks,
    articlePath: article.filePath,
  };
}

async function applyAllLocalizedLinks(
  lang: string,
  options: CLIOptions
): Promise<void> {
  const { slug, all, dryRun } = options;
  const suggestionsDir = path.resolve("src/data/linker-v4/suggestions");

  let files: string[];
  try {
    files = (await fs.readdir(suggestionsDir)).filter((f) => f.endsWith(".json"));
  } catch {
    console.error(
      "No suggestions directory found. Generate and validate suggestions first."
    );
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

  const catalogByUrl = await buildLocalizedCatalogTargetIndex(lang);
  let totalLinksApplied = 0;
  let postsModified = 0;

  for (const file of files) {
    const filePath = path.join(suggestionsDir, file);
    const content = await fs.readFile(filePath, "utf-8");
    let suggestionFile: SuggestionFile;

    try {
      suggestionFile = JSON.parse(content);
    } catch {
      console.error(`  Invalid JSON: ${file}`);
      continue;
    }

    const result = await applyLocalizedLinks(suggestionFile, lang, {
      dryRun,
      highConfidenceOnly: options.highConfidenceOnly,
      catalogByUrl,
    });

    if (result.applied === 0) continue;

    totalLinksApplied += result.applied;
    postsModified++;

    if (dryRun) {
      console.log(
        `  [DRY RUN] ${suggestionFile.sourceSlug} (${lang}): ${result.applied} links would be applied`
      );
      for (const link of result.appliedLinks) {
        console.log(`    "${link.anchor}" → ${link.toUrl}`);
      }
      continue;
    }

    console.log(
      `  ${suggestionFile.sourceSlug} (${lang}): applied ${result.applied} links`
    );
  }

  console.log(
    `\n${dryRun ? "[DRY RUN] Would apply" : "Applied"} ${totalLinksApplied} localized (${lang}) links to ${postsModified} posts`
  );
}


function findAnchorPositionInParagraph(
  body: string,
  paragraph: NumberedParagraph,
  anchorText: string
): number {
  const pStart = paragraph.offset;
  const pEnd = pStart + paragraph.text.length;
  const bodyLower = body.toLowerCase();
  const anchorLower = anchorText.toLowerCase();
  const idx = bodyLower.indexOf(anchorLower, pStart);
  if (idx !== -1 && idx < pEnd) {
    return idx;
  }
  return -1;
}

// ----------------
// Two-Pass Insertion
// ----------------

interface InsertionResult {
  newBody: string;
  applied: number;
  appliedLinks: TrackedLink[];
}

function insertLinks(
  body: string,
  validatedLinks: ValidatedLink[]
): InsertionResult {
  // Sort by position descending — apply bottom-to-top so earlier positions remain valid
  const sorted = [...validatedLinks].sort(
    (a, b) => b.positionInBody - a.positionInBody
  );

  let modifiedBody = body;
  const appliedLinks: TrackedLink[] = [];

  for (const validated of sorted) {
    const { suggestion, positionInBody } = validated;
    const { anchorText, targetUrl, readerNeed } = suggestion;

    // Verify the anchor text is still at the expected position
    const actual = modifiedBody.substring(
      positionInBody,
      positionInBody + anchorText.length
    );
    if (actual.toLowerCase() !== anchorText.toLowerCase()) {
      // Position shifted due to prior insertions — skip
      continue;
    }

    // Insert the markdown link
    const markdownLink = `[${actual}](${targetUrl})`;
    modifiedBody =
      modifiedBody.substring(0, positionInBody) +
      markdownLink +
      modifiedBody.substring(positionInBody + anchorText.length);

    // Extract slug from target URL
    const targetSlug = targetUrl
      .replace(/^\/blog\//, "")
      .replace(/^\/glossary\//, "glossary/")
      .replace(/\/$/, "");

    appliedLinks.push({
      from: "", // Will be set by caller
      to: targetSlug,
      toUrl: targetUrl,
      anchor: actual,
      readerNeed: readerNeed || "",
      appliedAt: new Date().toISOString(),
    });
  }

  // Reverse so they're in document order (top-to-bottom)
  appliedLinks.reverse();

  return {
    newBody: modifiedBody,
    applied: appliedLinks.length,
    appliedLinks,
  };
}

// ----------------
// Link Tracker
// ----------------

async function loadTracker(): Promise<LinkTracker> {
  const trackerPath = path.resolve(TRACKER_PATH);
  try {
    const content = await fs.readFile(trackerPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {
      updatedAt: new Date().toISOString(),
      links: [],
    };
  }
}

async function saveTracker(tracker: LinkTracker): Promise<void> {
  const trackerPath = path.resolve(TRACKER_PATH);
  await fs.mkdir(path.dirname(trackerPath), { recursive: true });
  await fs.writeFile(trackerPath, JSON.stringify(tracker, null, 2));
}

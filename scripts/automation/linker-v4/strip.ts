// ============================================
// Smart Linker v4 — Strip Internal Links
// ============================================
// Removes all internal links from blog posts, leaving only the anchor text.
// Run this before applying new v3 links for a clean slate.

import fs from "fs/promises";
import path from "path";
import type { CLIOptions } from "../types";
import type { LinkTracker } from "./types";
import { loadMarkdownFiles, extractRawFrontmatter, parseBody, BLOG_DIR, BLOG_LANGS } from "./parse";
import { isPreservedInternalLink } from "./catalog-utils";

// ----------------
// Constants
// ----------------

/** Patterns that identify internal links (vs external) */
const INTERNAL_PREFIXES = ["/blog/", "/glossary/", "/"];
const TRACKER_PATH = "src/data/linker-v4/link-tracker.json";

/**
 * Check if a URL is internal (relative path or same-domain).
 * External links (https://...) are preserved.
 */
function isInternalUrl(url: string): boolean {
  // Absolute external URLs
  if (/^https?:\/\//i.test(url)) return false;
  // Protocol-relative
  if (url.startsWith("//")) return false;
  // Mailto, tel, etc.
  if (/^[a-zA-Z]+:/.test(url)) return false;
  // Fragment-only links
  if (url.startsWith("#")) return false;
  // Everything else is internal (starts with / or is relative)
  return true;
}

// ----------------
// Main Function
// ----------------

export async function stripLinks(options: CLIOptions): Promise<void> {
  const { slug, all, dryRun } = options;
  const preserveCta = options.preserveCta !== false; // default: keep CTA links
  const localeParam = (options.locale || "en").toLowerCase();
  const langs =
    localeParam === "all" ? [...BLOG_LANGS] : [localeParam];

  console.log("🔗 Stripping internal links from posts...\n");
  if (preserveCta) {
    console.log("  Preserving strategy-call / CTA links\n");
  }
  if (localeParam === "all") {
    console.log(`  Locales: ${langs.join(", ")}\n`);
  } else {
    console.log(`  Locale: ${localeParam}\n`);
  }

  // Load blog posts for requested locale(s)
  let posts: Awaited<ReturnType<typeof loadMarkdownFiles>> = [];
  for (const lang of langs) {
    const langPosts = await loadMarkdownFiles(BLOG_DIR, lang);
    posts = posts.concat(langPosts);
  }
  console.log(`Loaded ${posts.length} blog posts`);

  // Determine which posts to process
  let postsToProcess = posts;
  if (slug) {
    postsToProcess = posts.filter((p) => p.slug === slug);
    if (postsToProcess.length === 0) {
      console.error(`Post not found: ${slug}`);
      return;
    }
  } else if (!all) {
    console.error("Please specify --slug or --all");
    return;
  }

  console.log(`Processing ${postsToProcess.length} posts\n`);

  let totalLinksRemoved = 0;
  let postsModified = 0;

  for (const post of postsToProcess) {
    const rawFrontmatter = extractRawFrontmatter(post.rawContent);
    const body = parseBody(post.rawContent);

    const { newBody, linksRemoved, linksPreserved } = stripInternalLinks(body, preserveCta);

    if (linksRemoved === 0) continue;

    totalLinksRemoved += linksRemoved;
    postsModified++;

    if (dryRun) {
      const preservedNote = linksPreserved > 0 ? `, preserved ${linksPreserved} CTA links` : "";
      console.log(`  [DRY RUN] ${post.slug}: would remove ${linksRemoved} internal links${preservedNote}`);
      continue;
    }

    // Write the file with stripped content
    const newContent = rawFrontmatter + newBody;
    await fs.writeFile(post.filePath, newContent, "utf-8");
    console.log(`  ${post.slug}: removed ${linksRemoved} internal links`);
  }

  console.log(
    `\n${dryRun ? "[DRY RUN] Would remove" : "Removed"} ${totalLinksRemoved} internal links from ${postsModified} posts`
  );

  // Clean up link tracker entries for stripped articles
  if (!dryRun && postsModified > 0) {
    await cleanupTracker(postsToProcess.map((p) => p.slug));
  }
}

// ----------------
// Strip Logic
// ----------------

/**
 * Remove all internal markdown links from body text.
 * [anchor text](/blog/some-slug/) → anchor text
 * Preserves external links.
 */
function stripInternalLinks(
  body: string,
  preserveCta: boolean
): {
  newBody: string;
  linksRemoved: number;
  linksPreserved: number;
} {
  let linksRemoved = 0;
  let linksPreserved = 0;

  // Pass 1: Strip markdown links [text](url)
  let newBody = body.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (fullMatch, anchorText, url) => {
      if (!isInternalUrl(url)) return fullMatch;
      if (preserveCta && isPreservedInternalLink(url, anchorText)) {
        linksPreserved++;
        return fullMatch;
      }
      linksRemoved++;
      return anchorText;
    }
  );

  // Pass 2: Strip plain HTML content links <a href="url">text</a>
  // Preserve styled elements (CTAs, buttons) — only strip plain content links
  newBody = newBody.replace(
    /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (fullMatch, url, innerText) => {
      // Skip styled elements (CTAs, buttons, components)
      if (/\bclass\s*=/i.test(fullMatch) || /\bstyle\s*=/i.test(fullMatch)) {
        return fullMatch;
      }
      if (isInternalUrl(url)) {
        linksRemoved++;
        return innerText;
      }
      return fullMatch;
    }
  );

  return { newBody, linksRemoved, linksPreserved };
}

// ----------------
// Tracker Cleanup
// ----------------

/**
 * Remove link tracker entries for stripped articles.
 */
async function cleanupTracker(strippedSlugs: string[]): Promise<void> {
  const trackerPath = path.resolve(TRACKER_PATH);
  let tracker: LinkTracker;

  try {
    tracker = JSON.parse(await fs.readFile(trackerPath, "utf-8"));
  } catch {
    return; // No tracker file — nothing to clean
  }

  const slugSet = new Set(strippedSlugs);
  const before = tracker.links.length;
  tracker.links = tracker.links.filter((link) => !slugSet.has(link.from));
  const removed = before - tracker.links.length;

  if (removed > 0) {
    tracker.updatedAt = new Date().toISOString();
    await fs.writeFile(trackerPath, JSON.stringify(tracker, null, 2));
    console.log(`  Cleaned ${removed} entries from link-tracker.json`);
  }
}

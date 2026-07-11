// ============================================
// Frontmatter Parsing and Updating
// ============================================

import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import type { BlogPost, QueueArticle } from "../types";

/**
 * Sanitize YAML frontmatter to ensure string values are properly quoted.
 * Queue files and AI-generated content often contain unquoted strings with
 * colons (e.g., "title: BRRRR Strategy: Build a Portfolio"), which break
 * YAML parsing. This function quotes known string fields defensively.
 *
 * IMPORTANT: Skips multi-line values (where the next line is an indented
 * continuation) to avoid breaking YAML block scalars like descriptions.
 */
export function sanitizeYamlFrontmatter(yaml: string): string {
  const fieldPattern =
    /^(\s*(?:title|description|focusKeyphrase|authorName|authorImage|image|contentSummary)):\s*(.+)$/;
  const lines = yaml.split("\n");
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(fieldPattern);
    if (!match) {
      result.push(lines[i]);
      continue;
    }

    const [, key, value] = match;
    const trimmed = value.trim();

    // Already quoted — leave as is
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      result.push(lines[i]);
      continue;
    }

    // Skip multi-line values: if the next line is indented with content,
    // this is a YAML block scalar continuation and quoting would break it
    const nextLine = lines[i + 1];
    if (nextLine !== undefined && /^\s+\S/.test(nextLine)) {
      result.push(lines[i]);
      continue;
    }

    // Single-line value — wrap in double quotes
    const escaped = trimmed.replace(/"/g, '\\"');
    result.push(`${key}: "${escaped}"`);
  }

  return result.join("\n");
}

/**
 * Parse frontmatter from a markdown string.
 * Automatically sanitizes YAML to handle unquoted colons in string fields.
 */
export function parseFrontmatter<T = Record<string, any>>(
  content: string
): { frontmatter: T; body: string } {
  // Sanitize the YAML frontmatter block before parsing to prevent
  // YAMLException from unquoted colons in title/description fields
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (fmMatch) {
    const sanitized = sanitizeYamlFrontmatter(fmMatch[1]);
    const sanitizedContent = `---\n${sanitized}\n---\n${fmMatch[2]}`;
    const { data, content: body } = matter(sanitizedContent);
    return { frontmatter: data as T, body };
  }
  // No frontmatter block detected — fall back to gray-matter as-is
  const { data, content: body } = matter(content);
  return { frontmatter: data as T, body };
}

/**
 * Serialize frontmatter to YAML string
 */
function serializeFrontmatter(frontmatter: Record<string, any>): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else if (typeof value[0] === "object" && value[0] !== null && !Array.isArray(value[0])) {
        lines.push(`${key}:`);
        for (const item of value) {
          const entries = Object.entries(item as Record<string, unknown>)
            .map(([k, v]) => `${k}: "${String(v).replace(/"/g, '\\"')}"`)
            .join(", ");
          lines.push(`  - { ${entries} }`);
        }
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - "${String(item).replace(/"/g, '\\"')}"`);
        }
      }
    } else if (typeof value === "string") {
      // Quote strings that need it
      if (value.includes(":") || value.includes("#") || value.includes('"')) {
        lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${key}: "${value}"`);
      }
    } else if (typeof value === "boolean") {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === "number") {
      lines.push(`${key}: ${value}`);
    } else if (value instanceof Date) {
      lines.push(`${key}: "${value.toISOString().split("T")[0]}"`);
    } else {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }

  return lines.join("\n");
}

/**
 * Read a markdown file and parse its frontmatter
 */
async function readMarkdownFile<T = Record<string, any>>(
  filePath: string
): Promise<{ frontmatter: T; body: string; raw: string }> {
  const raw = await fs.readFile(filePath, "utf-8");
  const { frontmatter, body } = parseFrontmatter<T>(raw);
  return { frontmatter, body, raw };
}

// Required fields for blog posts - these must be preserved
const REQUIRED_BLOG_FIELDS = ["title", "description", "pubDate", "category", "tags"] as const;

/** Canonical blog frontmatter key order (matches src/content/blog/.template.md.example). */
const BLOG_FRONTMATTER_ORDER = [
  "title",
  "description",
  "pubDate",
  "updatedDate",
  "image",
  "authorImage",
  "authorName",
  "category",
  "tags",
  "topicCluster",
  "funnelStage",
  "targetPersona",
  "region",
  "keyTerms",
  "quickAnswer",
  "keyNumbers",
  "difficulty",
  "readingTime",
  "isEvergreen",
  "isPillar",
  "seasonalRelevance",
  "podcastEpisodeId",
  "podcastShowId",
  "podcastEmbed",
  "reviewedBy",
  "dateReviewed",
  "linkableTopics",
  "idealIncomingAnchors",
  "disclaimerCallouts",
  "seo",
  "focusKeyphrase",
  "extractedKeywords",
  "contentSummary",
  "qualityScore",
  "slug",
] as const;

/** pubDate must appear within this line of the YAML block (1-indexed). */
export const MAX_PUBDATE_FRONTMATTER_LINE = 8;

/**
 * Reorder blog frontmatter so pubDate and other core fields appear near the top.
 * Queue drafts often place pubDate after keyTerms; normalization keeps published
 * posts aligned with src/content/blog/.template.md.example.
 */
export function normalizeBlogFrontmatter(
  frontmatter: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const seen = new Set<string>();

  for (const key of BLOG_FRONTMATTER_ORDER) {
    const value = frontmatter[key];
    if (value !== undefined && value !== null) {
      result[key] = value;
      seen.add(key);
    }
  }

  for (const [key, value] of Object.entries(frontmatter)) {
    if (!seen.has(key) && value !== undefined && value !== null) {
      result[key] = value;
    }
  }

  return result;
}

/** Line number of pubDate inside the frontmatter block (1-indexed), or null. */
export function getPubDateFrontmatterLine(content: string): number | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const lines = match[1].split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/^pubDate:/.test(lines[i])) return i + 1;
  }
  return null;
}

/**
 * Ensure English blog posts keep pubDate near the top of frontmatter.
 * @throws Error when pubDate is buried too deep (queue publish regression guard)
 */
export function assertPubDateNearTop(content: string, filePath: string): void {
  if (!filePath.includes("/content/blog/")) return;

  const line = getPubDateFrontmatterLine(content);
  if (line === null) return;

  if (line > MAX_PUBDATE_FRONTMATTER_LINE) {
    throw new Error(
      `Blog file "${filePath}" has pubDate on frontmatter line ${line} (max ${MAX_PUBDATE_FRONTMATTER_LINE}). ` +
        "Use normalizeBlogFrontmatter() before writing scheduled publishes."
    );
  }
}

/**
 * Validate that required blog frontmatter fields are present
 * @throws Error if required fields are missing
 */
function validateBlogFrontmatter(
  frontmatter: Record<string, any>,
  filePath: string
): void {
  // Only validate blog content files
  if (!filePath.includes("/content/blog/")) return;

  const missingFields = REQUIRED_BLOG_FIELDS.filter(
    (field) => frontmatter[field] === undefined || frontmatter[field] === null
  );

  if (missingFields.length > 0) {
    throw new Error(
      `Cannot write blog file "${filePath}" - missing required fields: ${missingFields.join(", ")}. ` +
        `This would break the content schema. Ensure the original frontmatter is preserved.`
    );
  }
}

/**
 * Write a markdown file with frontmatter
 */
export async function writeMarkdownFile(
  filePath: string,
  frontmatter: Record<string, any>,
  body: string
): Promise<void> {
  // Validate required fields before writing
  validateBlogFrontmatter(frontmatter, filePath);

  const content = `---\n${serializeFrontmatter(frontmatter)}\n---\n${body}`;
  assertPubDateNearTop(content, filePath);
  await fs.writeFile(filePath, content, "utf-8");
}

/**
 * Update frontmatter in a markdown file
 * @throws Error if the file has no existing frontmatter (for blog posts)
 */
/**
 * Get all markdown files in a directory
 */
async function getMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".mdx"))) {
      files.push(path.join(dir, entry.name));
    }
  }

  return files;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  const workerCount = Math.min(Math.max(concurrency, 1), items.length || 1);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

/**
 * Load all blog posts
 */
export async function loadBlogPosts(contentDir: string): Promise<BlogPost[]> {
  const files = await getMarkdownFiles(contentDir);
  return mapWithConcurrency(files, 12, async (filePath) => {
    const { frontmatter, body } = await readMarkdownFile(filePath);
    return {
      slug: path.basename(filePath, path.extname(filePath)),
      frontmatter: frontmatter as any,
      content: body,
      filePath,
    } as BlogPost;
  });
}

/**
 * Load all queue articles
 */
export async function loadQueueArticles(queueDir: string): Promise<QueueArticle[]> {
  try {
    const files = await getMarkdownFiles(queueDir);
    return mapWithConcurrency(files, 12, async (filePath) => {
      const { frontmatter, body } = await readMarkdownFile(filePath);
      return {
        slug: path.basename(filePath, path.extname(filePath)),
        frontmatter: frontmatter as any,
        content: body,
        filePath,
      } as QueueArticle;
    });
  } catch {
    return [];
  }
}

/**
 * Extract slug from file path
 */
/**
 * Parse a date-like value, returning fallback if invalid.
 */
export function parseDateLike(value: unknown, fallback: Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

/**
 * Normalize a queue status string.
 */
export function normalizeStatus(value: unknown): "ready" | "merged" | "hold" {
  const status = String(value || "").toLowerCase();
  if (status === "ready" || status === "merged" || status === "hold") return status;
  return "ready";
}

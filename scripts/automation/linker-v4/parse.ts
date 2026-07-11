// ============================================
// Smart Linker v4 — Markdown/Frontmatter Parsing
// ============================================
// Multi-Family USA: flat MDX blogs (en: src/content/blog, es: src/content/es-blog)

import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import matter from "gray-matter";
import type { ParsedArticle, NumberedParagraph } from "./types";

// ----------------
// Directory Constants
// ----------------

export const BLOG_LANGS = ["en", "es"] as const;
export type BlogLang = (typeof BLOG_LANGS)[number];

const BLOG_EXT = /\.mdx?$/;

export function getBlogDir(lang: string): string {
  if (lang === "es") return "src/content/es-blog";
  return "src/content/blog";
}

export const BLOG_DIR = getBlogDir("en");
export const QUEUE_DIR = "src/drafts/queue";

export interface LoadMarkdownOptions {
  lang?: string;
}

// ----------------
// Frontmatter Parsing
// ----------------

function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const result = matter(content);
  return {
    frontmatter: result.data as Record<string, unknown>,
    body: result.content,
  };
}

/**
 * Extract just the body text (everything after frontmatter).
 */
export function parseBody(content: string): string {
  const match = content.match(/^---[\s\S]*?---\n/);
  return match ? content.slice(match[0].length) : content;
}

/**
 * Extract raw frontmatter string (including --- delimiters).
 */
export function extractRawFrontmatter(content: string): string {
  const match = content.match(/^(---[\s\S]*?---\n)/);
  return match ? match[1] : "";
}

// ----------------
// Paragraph Numbering
// ----------------

/**
 * Split body into numbered paragraphs.
 * Content blocks (regular text) are marked as isContent: true.
 * Non-content blocks (headings, images, HTML, code fences) are isContent: false.
 */
export function numberParagraphs(body: string): NumberedParagraph[] {
  const parts = body.split(/(\n\n+)/);
  const paragraphs: NumberedParagraph[] = [];

  let offset = 0;
  let index = 1;

  for (const part of parts) {
    if (/^\n\n+$/.test(part)) {
      offset += part.length;
      continue;
    }

    const trimmed = part.trim();
    if (!trimmed) {
      offset += part.length;
      continue;
    }

    const blockStart = offset + part.indexOf(trimmed);
    const isContent = isContentBlock(trimmed);

    paragraphs.push({
      index,
      text: trimmed,
      isContent,
      offset: blockStart,
    });

    index++;
    offset += part.length;
  }

  return paragraphs;
}

function isContentBlock(text: string): boolean {
  if (/^#{1,6}\s/.test(text)) return false;
  if (/^!\[/.test(text)) return false;
  if (/^```/.test(text)) return false;
  if (/^<[a-zA-Z]/.test(text)) return false;
  if (/^(---|\*\*\*|___)$/.test(text.trim())) return false;
  if (/^\|/.test(text)) return false;
  if (/^>/.test(text)) return false;
  return true;
}

// ----------------
// File Loading
// ----------------

/**
 * Load all markdown/MDX files from a directory.
 * Pass `options.lang` or a lang string as the second arg to load a blog locale dir.
 */
export async function loadMarkdownFiles(
  dir: string = BLOG_DIR,
  optionsOrLang?: LoadMarkdownOptions | string
): Promise<ParsedArticle[]> {
  let resolvedDir = dir;
  if (typeof optionsOrLang === "string") {
    resolvedDir = getBlogDir(optionsOrLang);
  } else if (optionsOrLang?.lang) {
    resolvedDir = getBlogDir(optionsOrLang.lang);
  }

  const absDir = path.resolve(resolvedDir);
  let entries: string[];

  try {
    entries = await fs.readdir(absDir);
  } catch {
    return [];
  }

  const mdFiles = entries.filter((f) => BLOG_EXT.test(f));

  const results = await Promise.all(
    mdFiles.map(async (file) => {
      const filePath = path.join(absDir, file);
      const rawContent = await fs.readFile(filePath, "utf-8");
      let frontmatter: Record<string, unknown>;
      let body: string;
      try {
        ({ frontmatter, body } = parseFrontmatter(rawContent));
      } catch (err) {
        console.warn(
          `⚠ Skipping ${file}: YAML parse error — ${(err as Error).message?.split("\n")[0]}`
        );
        return null;
      }

      if (!frontmatter.title) return null;

      const slug = file.replace(BLOG_EXT, "");

      return {
        slug,
        filePath,
        frontmatter,
        body,
        rawContent,
      } as ParsedArticle;
    })
  );

  return results.filter(Boolean) as ParsedArticle[];
}

/**
 * Load all published blog posts for a locale (default: en).
 */
export async function loadBlogPosts(lang?: string): Promise<ParsedArticle[]> {
  return lang ? loadMarkdownFiles(BLOG_DIR, lang) : loadMarkdownFiles(BLOG_DIR);
}

// ----------------
// Content Hashing
// ----------------

export function computeContentHash(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

// ----------------
// Excerpt Extraction
// ----------------

export function extractExcerpt(body: string, maxParagraphs = 3): string {
  const paragraphs = numberParagraphs(body);
  const contentParagraphs = paragraphs.filter((p) => p.isContent);

  return contentParagraphs
    .slice(0, maxParagraphs)
    .map((p) => p.text)
    .join("\n\n");
}

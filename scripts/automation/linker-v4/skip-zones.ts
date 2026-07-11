// ============================================
// Smart Linker v4 — Skip Zone Detection
// ============================================
// Self-contained. Identifies regions of markdown content where links
// should NOT be placed (headings, existing links, code, CTAs, etc.)

import type { SkipZone } from "./types";

// ----------------
// Main Function
// ----------------

/**
 * Find all zones in a markdown body where links should not be placed.
 * Returns array of { start, end, reason } ranges.
 */
export function findSkipZones(body: string): SkipZone[] {
  const zones: SkipZone[] = [];

  zones.push(...findHeadings(body));
  zones.push(...findFirstParagraph(body));
  zones.push(...findExistingLinks(body));
  zones.push(...findCodeBlocks(body));
  zones.push(...findInlineCode(body));
  zones.push(...findBlockquotes(body));
  zones.push(...findImages(body));
  zones.push(...findMarkdownTables(body));
  zones.push(...findHtmlBlocks(body));
  zones.push(...findFaqSections(body));
  zones.push(...findCtaElements(body));
  zones.push(...findListItems(body));
  return zones;
}

// ----------------
// Zone Check
// ----------------

/**
 * Check if a character position falls within any skip zone.
 */
export function isInSkipZone(
  position: number,
  anchorLength: number,
  zones: SkipZone[]
): boolean {
  const end = position + anchorLength;
  return zones.some(
    (z) =>
      // Anchor starts inside zone
      (position >= z.start && position < z.end) ||
      // Anchor ends inside zone
      (end > z.start && end <= z.end) ||
      // Anchor spans entire zone
      (position <= z.start && end >= z.end)
  );
}

// ----------------
// Negative Context Detection
// ----------------

/**
 * Check if surrounding text suggests the reader is being directed
 * AWAY from a topic (negation, warnings, "don't", "avoid", etc.)
 */
export function hasNegativeContext(text: string): boolean {
  const negativePatterns = [
    /\bdon['']?t\b/i,
    /\bavoid\b/i,
    /\bnever\b/i,
    /\bstay away\b/i,
    /\bwithout\b/i,
    /\bnot recommended\b/i,
    /\bbeware\b/i,
    /\bwarning\b/i,
    /\bdon['']t (?:use|try|do|go|buy|invest|rely)\b/i,
    /\bsteer clear\b/i,
    /\bwatch out\b/i,
  ];

  return negativePatterns.some((pattern) => pattern.test(text));
}

// ----------------
// Individual Zone Detectors
// ----------------

function findHeadings(body: string): SkipZone[] {
  const zones: SkipZone[] = [];
  const regex = /^#{1,6}\s+.+$/gm;
  let match;

  while ((match = regex.exec(body)) !== null) {
    zones.push({
      start: match.index,
      end: match.index + match[0].length,
      reason: "heading",
    });
  }

  return zones;
}

function findFirstParagraph(body: string): SkipZone[] {
  // Find the first block of content text (not a heading, image, or HTML)
  // Only block the first sentence, not the entire paragraph
  const parts = body.split(/(\n\n+)/);
  let offset = 0;

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

    // Skip non-content blocks
    if (
      /^#{1,6}\s/.test(trimmed) ||
      /^!\[/.test(trimmed) ||
      /^<[a-zA-Z]/.test(trimmed) ||
      /^```/.test(trimmed)
    ) {
      offset += part.length;
      continue;
    }

    // Found the first content paragraph — narrow to first sentence only
    const blockStart = offset + part.indexOf(trimmed);
    const sentenceEnd = trimmed.search(/[.!?](?:\s|\n|$)/);
    let zoneLength: number;
    if (sentenceEnd !== -1) {
      // Include the punctuation character itself
      zoneLength = sentenceEnd + 1;
    } else {
      // No sentence-ending punctuation found — cap at 150 chars
      zoneLength = Math.min(trimmed.length, 150);
    }

    return [
      {
        start: blockStart,
        end: blockStart + zoneLength,
        reason: "first-paragraph",
      },
    ];
  }

  return [];
}

function findExistingLinks(body: string): SkipZone[] {
  const zones: SkipZone[] = [];

  // Markdown links: [text](url)
  const mdLinkRegex = /\[[^\]]+\]\([^)]+\)/g;
  let match;
  while ((match = mdLinkRegex.exec(body)) !== null) {
    zones.push({
      start: match.index,
      end: match.index + match[0].length,
      reason: "existing-link",
    });
  }

  // HTML links: <a href="...">...</a>
  const htmlLinkRegex = /<a\s[^>]*>[\s\S]*?<\/a>/gi;
  while ((match = htmlLinkRegex.exec(body)) !== null) {
    zones.push({
      start: match.index,
      end: match.index + match[0].length,
      reason: "existing-link",
    });
  }

  return zones;
}

function findCodeBlocks(body: string): SkipZone[] {
  const zones: SkipZone[] = [];
  const regex = /```[\s\S]*?```/g;
  let match;

  while ((match = regex.exec(body)) !== null) {
    zones.push({
      start: match.index,
      end: match.index + match[0].length,
      reason: "code-block",
    });
  }

  return zones;
}

function findInlineCode(body: string): SkipZone[] {
  const zones: SkipZone[] = [];
  const regex = /`[^`]+`/g;
  let match;

  while ((match = regex.exec(body)) !== null) {
    zones.push({
      start: match.index,
      end: match.index + match[0].length,
      reason: "inline-code",
    });
  }

  return zones;
}

function findBlockquotes(body: string): SkipZone[] {
  const zones: SkipZone[] = [];
  // Match contiguous lines starting with >
  const regex = /^(?:>.*\n?)+/gm;
  let match;

  while ((match = regex.exec(body)) !== null) {
    zones.push({
      start: match.index,
      end: match.index + match[0].length,
      reason: "blockquote",
    });
  }

  return zones;
}

function findImages(body: string): SkipZone[] {
  const zones: SkipZone[] = [];

  // Markdown images: ![alt](src)
  const mdImgRegex = /!\[[^\]]*\]\([^)]+\)/g;
  let match;
  while ((match = mdImgRegex.exec(body)) !== null) {
    zones.push({
      start: match.index,
      end: match.index + match[0].length,
      reason: "image",
    });
  }

  // HTML images: <img ... />
  const htmlImgRegex = /<img\s[^>]*\/?>/gi;
  while ((match = htmlImgRegex.exec(body)) !== null) {
    zones.push({
      start: match.index,
      end: match.index + match[0].length,
      reason: "image",
    });
  }

  return zones;
}

function findMarkdownTables(body: string): SkipZone[] {
  const zones: SkipZone[] = [];
  // Match contiguous lines starting with |
  const regex = /^(?:\|.*\n?)+/gm;
  let match;

  while ((match = regex.exec(body)) !== null) {
    zones.push({
      start: match.index,
      end: match.index + match[0].length,
      reason: "table",
    });
  }

  return zones;
}

function findHtmlBlocks(body: string): SkipZone[] {
  const zones: SkipZone[] = [];

  // HTML elements with class attributes (components, CTAs, styled divs)
  const classRegex = /<[a-zA-Z][^>]*class\s*=\s*["'][^"']*["'][^>]*>[\s\S]*?<\/[a-zA-Z]+>/gi;
  let match;
  while ((match = classRegex.exec(body)) !== null) {
    zones.push({
      start: match.index,
      end: match.index + match[0].length,
      reason: "html-component",
    });
  }

  // Self-closing HTML components with class
  const selfClosingRegex = /<[a-zA-Z][^>]*class\s*=\s*["'][^"']*["'][^>]*\/>/gi;
  while ((match = selfClosingRegex.exec(body)) !== null) {
    zones.push({
      start: match.index,
      end: match.index + match[0].length,
      reason: "html-component",
    });
  }

  // Astro/JSX components (capitalized tags)
  const componentRegex = /<[A-Z][a-zA-Z]*[\s\S]*?(?:\/>|<\/[A-Z][a-zA-Z]*>)/g;
  while ((match = componentRegex.exec(body)) !== null) {
    zones.push({
      start: match.index,
      end: match.index + match[0].length,
      reason: "html-component",
    });
  }

  return zones;
}

function findFaqSections(body: string): SkipZone[] {
  const zones: SkipZone[] = [];

  // <details>...</details> blocks
  const detailsRegex = /<details[\s\S]*?<\/details>/gi;
  let match;
  while ((match = detailsRegex.exec(body)) !== null) {
    zones.push({
      start: match.index,
      end: match.index + match[0].length,
      reason: "faq-section",
    });
  }

  return zones;
}

function findListItems(body: string): SkipZone[] {
  const zones: SkipZone[] = [];

  const unorderedRegex = /^(\s*)[-*]\s+.+$/gm;
  const orderedRegex = /^(\s*)\d+\.\s+.+$/gm;
  let match;

  while ((match = unorderedRegex.exec(body)) !== null) {
    zones.push({
      start: match.index,
      end: match.index + match[0].length,
      reason: "list-item",
    });
  }

  while ((match = orderedRegex.exec(body)) !== null) {
    zones.push({
      start: match.index,
      end: match.index + match[0].length,
      reason: "list-item",
    });
  }

  return zones;
}

function findCtaElements(body: string): SkipZone[] {
  const zones: SkipZone[] = [];

  // Anchor tags that look like buttons (have class or style attributes)
  const ctaRegex = /<a\s[^>]*(?:class|style)\s*=\s*["'][^"']*["'][^>]*>[\s\S]*?<\/a>/gi;
  let match;
  while ((match = ctaRegex.exec(body)) !== null) {
    zones.push({
      start: match.index,
      end: match.index + match[0].length,
      reason: "cta-button",
    });
  }

  // Lines that are just markdown links (standalone CTA-like links)
  const standaloneLinkRegex = /^\[.+\]\(.+\)\s*$/gm;
  while ((match = standaloneLinkRegex.exec(body)) !== null) {
    zones.push({
      start: match.index,
      end: match.index + match[0].length,
      reason: "cta-button",
    });
  }

  return zones;
}


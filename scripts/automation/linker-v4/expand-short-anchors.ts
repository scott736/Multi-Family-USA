#!/usr/bin/env npx tsx
/**
 * Local short-anchor expander for Smart Linker v4 audit issues.
 * No external API calls — deterministic, per-URL canonical anchor map.
 *
 * Usage:
 *   npx tsx scripts/automation/linker-v4/expand-short-anchors.ts --dry-run
 *   npx tsx scripts/automation/linker-v4/expand-short-anchors.ts
 */

import fs from "fs";
import path from "path";

// City URLs get a pattern-based rewrite: the prose around the link is
// updated to "<preposition> the <City> real estate market" so the prose
// stays grammatical. These are handled separately from non-city URLs.
const CITY_URLS: Record<string, string> = {
  "/blog/calgary-real-estate-investing-guide": "Calgary real estate market",
  "/blog/edmonton-real-estate-investment-guide": "Edmonton real estate market",
  "/blog/hamilton-ontario-real-estate-investment-guide": "Hamilton Ontario real estate market",
  "/blog/kitchener-real-estate-investing-guide": "Kitchener real estate market",
  "/blog/london-ontario-real-estate-investing-guide": "London Ontario real estate market",
  "/blog/montreal-real-estate-investing-guide": "Montreal real estate market",
  "/blog/ottawa-real-estate-investment-guide": "Ottawa real estate market",
  "/blog/toronto-real-estate-investing-guide": "Toronto real estate market",
  "/blog/vancouver-real-estate-investment-guide": "Vancouver real estate market",
  "/blog/winnipeg-real-estate-investment-market-guide": "Winnipeg real estate market",
};

// Non-city URLs: simple anchor-only swap (URL → canonical 3–5 word anchor).
const CANONICAL_ANCHORS: Record<string, string> = {
  "/blog/70-percent-rule-house-flipping-guide": "70 percent rule guide",
  "/blog/a-lender-vs-b-lender-for-your-next-investment-deal": "A-lender versus B-lender options",
  "/blog/bridge-loans-investment-tool-guide": "bridge loans for investors",
  "/blog/brrrr-method-real-estate-investing-guide": "BRRRR method investing strategy",
  "/blog/cap-rate-calculation-guide-for-investment-decisions": "cap rate calculation guide",
  "/blog/cmhc-mli-select-multifamily-guide": "CMHC MLI Select program",
  "/blog/commercial-financing-options-guide": "commercial financing options guide",
  "/blog/commercial-mortgage-down-payment-canada": "commercial mortgage down payment",
  "/blog/debt-ratios-explained-get-approved-for-more": "debt ratios explained guide",
  "/blog/document-checklist-for-investment-property-mortgage": "mortgage document checklist guide",
  "/blog/estate-planning-for-real-estate-portfolio-growth": "estate planning for investors",
  "/blog/force-appreciation-in-multifamily-properties": "forced appreciation strategies guide",
  "/blog/how-to-buy-unlimited-rental-properties-in-canada": "unlimited rental properties framework",
  "/blog/how-to-flip-houses-lessons-from-30-property-deals": "house flipping lessons learned",
  "/blog/how-to-structure-your-real-estate-holdings-corporation-vs-personal": "corporation versus personal holdings",
  "/blog/office-building-investment-guide-for-beginners": "office building investment guide",
  "/blog/scaling-from-5-to-20-properties-the-financing-roadmap": "scaling rental portfolio roadmap",
  "/blog/short-term-rental-property-investment-guide": "short-term rental investment guide",
  "/blog/student-rental-investing-cash-flow-strategy-explained": "student rental investing guide",
  "/blog/the-three-types-of-mortgage-pre-approvals-explained": "mortgage pre-approval types explained",
  "/blog/using-virtual-assistants-to-scale-to-50-doors": "virtual assistants for investors",
  "/blog/what-is-a-dscr-loan": "DSCR loan basics explained",
  "/commercial-mortgage-canada": "commercial mortgage financing options",
  "/development-mortgage-financing": "development mortgage financing options",
  "/dscr-loans": "DSCR loans for investors",
  "/glossary/mortgage-broker": "licensed mortgage broker professional",
  "/investor-resources": "investor resources and education",
  "/mortgage-financing-for-canadians-in-canada": "Canadian mortgage financing options",
  "/mortgage-financing-for-canadians-in-canada/dscr-loans": "Canadian DSCR loan options",
  "/mortgage-financing-for-canadians-in-canada/first-time-buyer": "first-time buyer financing options",
  "/mortgage-financing-for-canadians-in-canada/self-employed": "self-employed mortgage financing",
  "/mortgage-financing-for-canadians-in-the-u-s-a": "U.S. mortgage financing options",
  "/multi-family-mortgage-financing": "multi-family mortgage financing",
  "/rates": "current mortgage rates",
  "/residential-mortgage-financing": "residential mortgage financing",
  "/tools/cmhc-mli-max-loan-calculator": "CMHC MLI Max calculator",
  "/tools/dscr-loan-calculator": "DSCR loan calculator tool",
  "/tools/dscr-loan-calculator-canada": "Canadian DSCR loan calculator",
};

const CITY_PREPOSITIONS = ["in", "to", "from", "into", "through", "across", "like", "of", "on", "around", "near", "throughout", "within", "at", "for"];

const DRY_RUN = process.argv.includes("--dry-run");
const AUDIT_PATH = "internal-links-audit-report.md";
const BLOG_DIR = "src/content/blog/en";

function wordCount(s: string): number {
  return s.trim().split(/\s+/).length;
}

// Parse audit report into { filename, anchor, url }[] for short-anchor issues.
interface AuditIssue {
  articlePath: string;
  anchor: string;
  url: string;
}

function parseAuditReport(reportText: string): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const lines = reportText.split("\n");
  let currentArticle: string | null = null;

  const articleHeader = /^### \[.+?\]\(file:\/\/.*\/src\/content\/blog\/(?:en\/)?([^/)]+\.md)\)/;
  const issueRow = /^\| \[([^\]]+)\]\((\/[^)]+)\)<br>\*\(Issues:.*?Anchor too short.*?\)\*/;

  for (const line of lines) {
    const m1 = articleHeader.exec(line);
    if (m1) {
      currentArticle = m1[1];
      continue;
    }
    const m2 = issueRow.exec(line);
    if (m2 && currentArticle) {
      issues.push({ articlePath: currentArticle, anchor: m2[1], url: m2[2] });
    }
  }
  return issues;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Replace the anchor text in a markdown link [old](url) with [new](url).
// Handles optional trailing slash differences and escapes regex metacharacters.
function replaceAnchor(content: string, oldAnchor: string, url: string, newAnchor: string): { content: string; replacements: number } {
  const urlNoSlash = url.replace(/\/$/, "");
  const urlWithSlash = urlNoSlash + "/";
  const escOld = escapeRegex(oldAnchor);
  const escUrl1 = escapeRegex(urlNoSlash);
  const escUrl2 = escapeRegex(urlWithSlash);

  const re = new RegExp(`\\[${escOld}\\]\\((?:${escUrl1}|${escUrl2})\\)`, "g");
  let replacements = 0;
  const out = content.replace(re, (match) => {
    replacements++;
    const trailingSlash = match.includes(urlWithSlash + ")");
    const finalUrl = trailingSlash ? urlWithSlash : urlNoSlash;
    return `[${newAnchor}](${finalUrl})`;
  });
  return { content: out, replacements };
}

// For city URLs, rewrite "<preposition> [City](url)" → "<preposition> the [City real estate market](url)".
// Leaves the link alone when not preceded by a recognized preposition (falls through to anchor-only swap).
function rewriteCityLink(content: string, oldAnchor: string, url: string, newAnchor: string): { content: string; replacements: number } {
  const urlNoSlash = url.replace(/\/$/, "");
  const urlWithSlash = urlNoSlash + "/";
  const escOld = escapeRegex(oldAnchor);
  const escUrl = `(?:${escapeRegex(urlNoSlash)}|${escapeRegex(urlWithSlash)})`;
  const prepAlt = CITY_PREPOSITIONS.join("|");

  // Prose already leading with "the" → just swap anchor without re-inserting "the".
  const reAlreadyThe = new RegExp(`\\b(?:the)\\s+\\[${escOld}\\]\\(${escUrl}\\)`, "g");
  // Prose with preposition (no "the" yet) → insert "the " + swapped anchor.
  const reWithPrep = new RegExp(`\\b(${prepAlt})\\s+\\[${escOld}\\]\\(${escUrl}\\)`, "gi");

  let replacements = 0;

  let out = content.replace(reAlreadyThe, (match) => {
    replacements++;
    const trailingSlash = match.endsWith(urlWithSlash + ")");
    const finalUrl = trailingSlash ? urlWithSlash : urlNoSlash;
    return `the [${newAnchor}](${finalUrl})`;
  });

  out = out.replace(reWithPrep, (_match, prep: string) => {
    replacements++;
    const trailingSlash = _match.endsWith(urlWithSlash + ")");
    const finalUrl = trailingSlash ? urlWithSlash : urlNoSlash;
    return `${prep} the [${newAnchor}](${finalUrl})`;
  });

  return { content: out, replacements };
}

function main(): void {
  const audit = fs.readFileSync(AUDIT_PATH, "utf8");
  const issues = parseAuditReport(audit);

  console.log(`Parsed ${issues.length} short-anchor issues from ${AUDIT_PATH}`);

  // Group by article for efficiency and clarity
  const byArticle = new Map<string, AuditIssue[]>();
  for (const issue of issues) {
    const list = byArticle.get(issue.articlePath) ?? [];
    list.push(issue);
    byArticle.set(issue.articlePath, list);
  }

  let totalReplaced = 0;
  let totalSkipped = 0;
  const skippedDetails: string[] = [];

  for (const [filename, articleIssues] of byArticle) {
    const filePath = path.join(BLOG_DIR, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`  [skip] Article not found: ${filePath}`);
      totalSkipped += articleIssues.length;
      continue;
    }

    let content = fs.readFileSync(filePath, "utf8");
    let fileReplacements = 0;

    for (const issue of articleIssues) {
      const cityCanonical = CITY_URLS[issue.url];
      const canonical = cityCanonical ?? CANONICAL_ANCHORS[issue.url];
      if (!canonical) {
        totalSkipped++;
        skippedDetails.push(`${filename}: [${issue.anchor}](${issue.url}) — no canonical`);
        continue;
      }
      if (wordCount(canonical) < 3) {
        totalSkipped++;
        skippedDetails.push(`${filename}: canonical "${canonical}" is <3 words`);
        continue;
      }

      let totalForIssue = 0;

      // Cities: first try the prose-aware rewrite (adds "the" before the anchor).
      if (cityCanonical) {
        const { content: next, replacements } = rewriteCityLink(content, issue.anchor, issue.url, canonical);
        content = next;
        totalForIssue += replacements;
      }

      // Fallback / non-city: anchor-only swap for any remaining occurrences.
      const { content: next2, replacements: r2 } = replaceAnchor(content, issue.anchor, issue.url, canonical);
      content = next2;
      totalForIssue += r2;

      if (totalForIssue === 0) {
        totalSkipped++;
        skippedDetails.push(`${filename}: [${issue.anchor}](${issue.url}) — anchor not found in source`);
        continue;
      }
      fileReplacements += totalForIssue;
      totalReplaced += totalForIssue;
    }

    if (fileReplacements > 0) {
      console.log(`  ${filename} — ${fileReplacements} replacement${fileReplacements === 1 ? "" : "s"}`);
      if (!DRY_RUN) fs.writeFileSync(filePath, content, "utf8");
    }
  }

  console.log(`\nTotal replacements: ${totalReplaced}`);
  console.log(`Skipped: ${totalSkipped}`);
  if (skippedDetails.length > 0) {
    console.log("\nSkipped details:");
    for (const d of skippedDetails.slice(0, 40)) console.log(`  - ${d}`);
    if (skippedDetails.length > 40) console.log(`  ... and ${skippedDetails.length - 40} more`);
  }
  if (DRY_RUN) console.log("\n(dry run — no files written)");
}

main();

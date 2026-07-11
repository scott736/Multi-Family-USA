// ============================================
// Smart Linker v4 — Local Review & Audit
// ============================================
// Performs deterministic analysis of existing links and identifies
// missed opportunities using the enriched catalog.
// Runs 100% locally without external APIs.

import fs from "fs/promises";
import path from "path";
import type { CLIOptions } from "../types";
import type { RawPageData, PageCatalog, PagePurpose } from "./types";
import { loadMarkdownFiles, parseBody, numberParagraphs, BLOG_DIR, QUEUE_DIR } from "./parse";
import { findSkipZones, isInSkipZone, hasNegativeContext } from "./skip-zones";
import { normalizeUrl } from "./validate";

const DATA_DIR = "src/data/linker-v4";
const REPORTS_DIR = "src/data/linker-v4/reports";

// ----------------
// Types
// ----------------

interface ArticleReviewResult {
    slug: string;
    existingLinkCount: number;
    deadLinks: string[];
    redundantLinks: string[];
    opportunities: string[];
}

// ----------------
// Main Function
// ----------------

export async function runLocalReview(options: CLIOptions): Promise<void> {
    const { slug, all } = options;

    if (!slug && !all) {
        console.error("Please specify --slug or --all to review.");
        return;
    }

    // Load Catalog
    const enrichedCatalogPath = path.resolve(DATA_DIR, "page-catalog.json");
    const rawCatalogPath = path.resolve(DATA_DIR, "raw-catalog.json");
    let catalog: (PagePurpose | RawPageData)[] = [];

    try {
        const data = JSON.parse(await fs.readFile(enrichedCatalogPath, "utf-8")) as PageCatalog;
        catalog = data.pages;
        console.log(`Loaded enriched catalog (${catalog.length} pages)`);
    } catch {
        try {
            const data = JSON.parse(await fs.readFile(rawCatalogPath, "utf-8")) as { pages: RawPageData[] };
            catalog = data.pages;
            console.log(`Using raw catalog (${catalog.length} pages) - no enrichment metadata`);
        } catch {
            console.error("No catalog found. Run build-catalog first.");
            return;
        }
    }

    // Load Articles
    const blogPosts = await loadMarkdownFiles(BLOG_DIR);
    const queueArticles = await loadMarkdownFiles(QUEUE_DIR);
    const allArticles = [...blogPosts, ...queueArticles];

    if (all) {
        // --all mode: review all blog posts and generate summary report
        console.log(`\nReviewing all ${blogPosts.length} blog posts...\n`);
        await runAllReview(blogPosts, catalog);
    } else if (slug) {
        // Single article review
        const article = allArticles.find((a) => a.slug === slug);
        if (!article) {
            console.error(`Article not found: ${slug}`);
            return;
        }
        console.log(`\nPerforming Local Review for: ${slug}\n`);
        await runSingleReview(article, catalog);
    }
}

// ----------------
// Single Article Review
// ----------------

async function runSingleReview(
    article: Awaited<ReturnType<typeof loadMarkdownFiles>>[0],
    catalog: (PagePurpose | RawPageData)[]
): Promise<void> {
    const body = parseBody(article.rawContent);

    // Extract Existing Links
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const existingLinks: { text: string; url: string }[] = [];
    let match;
    while ((match = linkRegex.exec(article.rawContent)) !== null) {
        existingLinks.push({ text: match[1], url: match[2] });
    }

    console.log(`Analyzed ${existingLinks.length} existing links.`);

    const findings: string[] = [];
    const validTargets = new Map(catalog.map(p => [normalizeUrl(p.url), p]));

    // Audit existing links
    console.log("\n--- Audit of Existing Links ---");
    for (const link of existingLinks) {
        const normalized = normalizeUrl(link.url);
        const target = validTargets.get(normalized);

        if (!target) {
            findings.push(`Dead or External Link: "${link.text}" -> ${link.url}`);
            continue;
        }

        if (target.isTooltipOnly) {
            findings.push(`Redundant Link: "${link.text}" targets "${target.title}" which is a Glossary term (should be a tooltip).`);
        }

        if (target.type === "pillar") {
            const p = target as PagePurpose;
            if (p.readerPromise) {
                findings.push(`Pillar Link: "${link.text}" -> ${target.title}. Promise: "${p.readerPromise}"`);
            }
        }
    }

    // Missed Opportunities
    console.log("\n--- Missed Opportunities (Deterministic) ---");
    const seenTargets = new Set(existingLinks.map(l => normalizeUrl(l.url)));
    const highValueTargets = catalog.filter(p => p.type === "pillar" || (p as PagePurpose).linkWhen?.length > 0);

    for (const target of highValueTargets) {
        if (seenTargets.has(normalizeUrl(target.url))) continue;
        const keywords = [target.title, ...((target as PagePurpose).topicsCovered || [])];
        for (const kw of keywords) {
            if (kw.length < 3) continue;
            const kwRegex = new RegExp(`\\b${kw}(s|es)?\\b`, "i");
            if (kwRegex.test(body)) {
                findings.push(`Opportunity: Found reference to "${kw}". Could link to "${target.title}" (${target.url})`);
                break;
            }
        }
    }

    if (findings.length === 0) {
        console.log("No specific findings for this article.");
    } else {
        findings.forEach(f => console.log(`  ${f}`));
    }

    console.log("\n=== Review Complete ===");
}

// ----------------
// All Articles Review
// ----------------

async function runAllReview(
    blogPosts: Awaited<ReturnType<typeof loadMarkdownFiles>>,
    catalog: (PagePurpose | RawPageData)[]
): Promise<void> {
    const validTargets = new Map(catalog.map(p => [normalizeUrl(p.url), p]));
    const highValueTargets = catalog.filter(p => p.type === "pillar" || (p as PagePurpose).linkWhen?.length > 0);

    const results: ArticleReviewResult[] = [];
    const missedTargetCounts: Record<string, number> = {};

    for (const post of blogPosts) {
        const body = parseBody(post.rawContent);

        // Extract existing links
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        const existingLinks: { text: string; url: string }[] = [];
        let match;
        while ((match = linkRegex.exec(post.rawContent)) !== null) {
            existingLinks.push({ text: match[1], url: match[2] });
        }

        const deadLinks: string[] = [];
        const redundantLinks: string[] = [];
        const opportunities: string[] = [];

        // Check existing links
        for (const link of existingLinks) {
            const normalized = normalizeUrl(link.url);
            const target = validTargets.get(normalized);
            if (!target && link.url.startsWith("/")) {
                deadLinks.push(link.url);
            }
            if (target?.isTooltipOnly) {
                redundantLinks.push(link.url);
            }
        }

        // Check missed opportunities
        const seenTargets = new Set(existingLinks.map(l => normalizeUrl(l.url)));
        for (const target of highValueTargets) {
            if (seenTargets.has(normalizeUrl(target.url))) continue;
            const keywords = [target.title, ...((target as PagePurpose).topicsCovered || [])];
            for (const kw of keywords) {
                if (kw.length < 3) continue;
                const kwRegex = new RegExp(`\\b${kw}(s|es)?\\b`, "i");
                if (kwRegex.test(body)) {
                    opportunities.push(target.url);
                    missedTargetCounts[target.url] = (missedTargetCounts[target.url] || 0) + 1;
                    break;
                }
            }
        }

        results.push({
            slug: post.slug,
            existingLinkCount: existingLinks.length,
            deadLinks,
            redundantLinks,
            opportunities,
        });
    }

    // Generate summary
    const articlesWithIssues = results.filter(
        r => r.deadLinks.length > 0 || r.redundantLinks.length > 0 || r.opportunities.length > 0
    );
    const totalOpportunities = results.reduce((sum, r) => sum + r.opportunities.length, 0);

    // Top 10 most-missed target URLs
    const topMissed = Object.entries(missedTargetCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

    // Print summary
    console.log("=== REVIEW SUMMARY ===\n");
    console.log(`Total articles reviewed: ${results.length}`);
    console.log(`Articles with issues: ${articlesWithIssues.length}`);
    console.log(`Total missed link opportunities: ${totalOpportunities}`);

    if (topMissed.length > 0) {
        console.log(`\nTop 10 Most-Missed Target URLs:`);
        for (const [url, count] of topMissed) {
            console.log(`  ${count}x missed — ${url}`);
        }
    }

    const articlesWithDead = results.filter(r => r.deadLinks.length > 0);
    if (articlesWithDead.length > 0) {
        console.log(`\nArticles with dead internal links (${articlesWithDead.length}):`);
        for (const r of articlesWithDead.slice(0, 20)) {
            console.log(`  ${r.slug}: ${r.deadLinks.join(", ")}`);
        }
        if (articlesWithDead.length > 20) {
            console.log(`  ... and ${articlesWithDead.length - 20} more`);
        }
    }

    const articlesWithRedundant = results.filter(r => r.redundantLinks.length > 0);
    if (articlesWithRedundant.length > 0) {
        console.log(`\nArticles with redundant glossary links (${articlesWithRedundant.length}):`);
        for (const r of articlesWithRedundant.slice(0, 20)) {
            console.log(`  ${r.slug}: ${r.redundantLinks.join(", ")}`);
        }
        if (articlesWithRedundant.length > 20) {
            console.log(`  ... and ${articlesWithRedundant.length - 20} more`);
        }
    }

    console.log("\n=== END REVIEW ===");

    // Save report to file
    const reportLines: string[] = [];
    reportLines.push(`# Link Review Report`);
    reportLines.push(`Generated: ${new Date().toISOString()}\n`);
    reportLines.push(`## Summary\n`);
    reportLines.push(`- Total articles reviewed: ${results.length}`);
    reportLines.push(`- Articles with issues: ${articlesWithIssues.length}`);
    reportLines.push(`- Total missed link opportunities: ${totalOpportunities}`);

    if (topMissed.length > 0) {
        reportLines.push(`\n## Top 10 Most-Missed Target URLs\n`);
        for (const [url, count] of topMissed) {
            reportLines.push(`- ${count}x missed — ${url}`);
        }
    }

    if (articlesWithDead.length > 0) {
        reportLines.push(`\n## Dead Internal Links (${articlesWithDead.length} articles)\n`);
        for (const r of articlesWithDead) {
            reportLines.push(`- **${r.slug}**: ${r.deadLinks.join(", ")}`);
        }
    }

    if (articlesWithRedundant.length > 0) {
        reportLines.push(`\n## Redundant Glossary Links (${articlesWithRedundant.length} articles)\n`);
        for (const r of articlesWithRedundant) {
            reportLines.push(`- **${r.slug}**: ${r.redundantLinks.join(", ")}`);
        }
    }

    const reportsDir = path.resolve(REPORTS_DIR);
    await fs.mkdir(reportsDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const reportPath = path.join(reportsDir, `review-report-${date}.md`);
    await fs.writeFile(reportPath, reportLines.join("\n"));
    console.log(`\nReport saved to: ${reportPath}`);
}

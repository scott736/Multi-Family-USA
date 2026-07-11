// ============================================
// Smart Linker v4 — Semantic Link Audit
// ============================================
// Analyzes existing links in blog articles for semantic correctness.
// Validates against criteria in LINKING-PLAN.md.

import fs from "fs/promises";
import path from "path";
import type { CLIOptions } from "../types";
import { loadBlogPosts, parseBody, BLOG_DIR } from "./parse";
import { GENERIC_ANCHORS, PILLAR_URL_PATTERNS } from "./catalog-utils";

// ----------------
// Constants
// ----------------

const REPORT_PATH = "internal-links-audit-report.md";
const ENRICHED_CATALOG_PATH = "src/data/linker-v4/page-catalog.json";
const RAW_CATALOG_PATH = "src/data/linker-v4/raw-catalog.json";

// Semantic audit uses the shared GENERIC_ANCHORS plus a few audit-specific ones
const AUDIT_GENERIC_ANCHORS = [
    ...GENERIC_ANCHORS,
    "work harder", "look more", "lead to",
    "property itself", "property's life"
];

const DELIBERATE_CTAS = [
    "book a free strategy call",
    "book a strategy call",
    "schedule a free strategy session",
    "book a call"
];

// ----------------
// Audit Logic
// ----------------

interface LinkAuditResult {
    articleSlug: string;
    articleTitle: string;
    anchorText: string;
    targetUrl: string;
    issues: string[];
    suggestedAnchor?: string;
}

export async function auditSemanticLinks(options: CLIOptions): Promise<void> {
    const { all, slug } = options;

    console.log("Analyzing internal links for semantic correctness...\n");

    const blogPosts = await loadBlogPosts();
    let postsToAudit = blogPosts;

    if (slug) {
        postsToAudit = blogPosts.filter((p) => p.slug === slug);
    } else if (!all) {
        console.error("Please specify --slug or --all");
        return;
    }

    // Load Catalog for Suggestions
    const catalogMap = new Map<string, string>();
    try {
        let catalogData;
        try {
            catalogData = JSON.parse(await fs.readFile(ENRICHED_CATALOG_PATH, "utf-8"));
        } catch {
            catalogData = JSON.parse(await fs.readFile(RAW_CATALOG_PATH, "utf-8"));
        }

        for (const page of catalogData.pages) {
            const url = page.url.replace(/\/$/, "");
            // Prefer readerPromise for suggestions if it's short, otherwise use title
            const suggestion = (page.readerPromise && page.readerPromise.length < 60)
                ? page.readerPromise
                : page.title;
            catalogMap.set(url, suggestion);
        }
    } catch (e) {
        console.warn("Could not load catalog for suggestions. Using generic logic.");
    }

    const results: LinkAuditResult[] = [];
    let totalLinks = 0;

    for (const post of postsToAudit) {
        const body = parseBody(post.rawContent);
        const links = extractInternalLinks(body);
        totalLinks += links.length;

        for (const link of links) {
            const issues = validateLink(link.text, link.url, post.frontmatter);
            if (issues.length > 0) {
                const suggestedAnchor = catalogMap.get(link.url);
                results.push({
                    articleSlug: post.slug,
                    articleTitle: String(post.frontmatter.title),
                    anchorText: link.text,
                    targetUrl: link.url,
                    issues,
                    suggestedAnchor
                });
            }
        }
    }

    await generateMarkdownReport(results, totalLinks, postsToAudit.length);
    console.log(`\nAudit complete. Report generated at ${REPORT_PATH}`);

    // Application logic - Triggered if NOT dryRun and either useApi or a specific signal is present
    // For this context, we'll use useApi as the "write" signal as is common in this codebase
    if (options.dryRun !== true && options.useApi && results.length > 0) {
        console.log(`\nApplying fixes to ${results.length} links...`);
        await applySemanticFixes(results, postsToAudit);
        console.log("Fixes applied successfully.");
    } else if (results.length > 0) {
        console.log("\n(Run with --use-api to apply these changes)");
    }
}

async function applySemanticFixes(results: LinkAuditResult[], posts: any[]): Promise<void> {
    // Group results by slug for efficient file processing
    const groupedResults = results.reduce((acc, r) => {
        if (!acc[r.articleSlug]) acc[r.articleSlug] = [];
        acc[r.articleSlug].push(r);
        return acc;
    }, {} as Record<string, LinkAuditResult[]>);

    for (const [slug, findings] of Object.entries(groupedResults)) {
        const post = posts.find(p => p.slug === slug);
        if (!post) continue;

        let content = post.rawContent;
        let modified = false;

        for (const finding of findings) {
            if (finding.suggestedAnchor) {
                // Escape special characters in anchor text for regex
                const escapedAnchor = finding.anchorText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const escapedUrl = finding.targetUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                // We match [anchor](url) precisely
                const linkRegex = new RegExp(`\\[${escapedAnchor}\\]\\(${escapedUrl}\\/?\\)`, 'g');
                const newLink = `[${finding.suggestedAnchor}](${finding.targetUrl})`;

                const newContent = content.replace(linkRegex, newLink);
                if (newContent !== content) {
                    content = newContent;
                    modified = true;
                }
            }
        }

        if (modified) {
            const filePath = path.join(process.cwd(), BLOG_DIR, `${slug}.mdx`);
            await fs.writeFile(filePath, content, "utf-8");
            console.log(`- Updated: ${slug}.mdx`);
        }
    }
}

function extractInternalLinks(body: string): { text: string; url: string }[] {
    const links: { text: string; url: string }[] = [];
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = regex.exec(body)) !== null) {
        const [_, text, url] = match;
        // Only internal links starting with /
        if (url.startsWith("/")) {
            links.push({ text, url: url.replace(/\/$/, "") });
        }
    }

    return links;
}

function validateLink(text: string, url: string, frontmatter: any): string[] {
    const issues: string[] = [];
    const words = text.trim().split(/\s+/);
    const textLower = text.toLowerCase();

    // 0. Skip Deliberate CTAs
    if (DELIBERATE_CTAS.some(cta => textLower.includes(cta))) {
        return [];
    }

    // 1. Generic Anchor Check (Strict match for short phrases, inclusive for very generic ones)
    const isGeneric = AUDIT_GENERIC_ANCHORS.some(g => {
        const genLower = g.toLowerCase();
        // If the generic phrase is short (e.g., "click here"), use inclusive match
        if (genLower.length < 15) return textLower.includes(genLower);
        // If longer, require exact match or very close
        return textLower === genLower;
    });
    if (isGeneric && words.length < 5) {
        issues.push(`Generic/Low-value anchor: "${text}"`);
    }

    // 2. Anchor Length
    if (words.length < 3) {
        // Exception for exact topic matches if we had a catalog, but here we just flag < 3 words
        issues.push(`Anchor too short: ${words.length} words (min 3)`);
    }
    if (words.length > 12) {
        issues.push(`Anchor too long: ${words.length} words (max 12)`);
    }

    // 3. CTA detection
    const isCallBook = textLower.includes("call") || textLower.includes("book");
    const isStrategyCTA = textLower.includes("strategy") && isCallBook;

    if (isCallBook || isStrategyCTA) {
        issues.push(`Likely CTA anchor: "${text}"`);
    }

    // 4. Fragmented phrases (heuristic)
    if (textLower.endsWith(" while") || textLower.endsWith(" lead to") || textLower.endsWith(" and")) {
        issues.push(`Fragmented anchor: "${text}"`);
    }

    return issues;
}

async function generateMarkdownReport(results: LinkAuditResult[], totalLinks: number, totalArticles: number): Promise<void> {
    let report = `# Internal Link Semantic Audit Report\n\n`;
    report += `**Generated on:** ${new Date().toLocaleString()}\n`;
    report += `**Articles Audited:** ${totalArticles}\n`;
    report += `**Total Internal Links Found:** ${totalLinks}\n`;
    report += `**Links with Issues:** ${results.length} (${((results.length / totalLinks) * 100).toFixed(1)}%)\n\n`;

    if (results.length === 0) {
        report += `✅ No semantic issues found in current internal links!\n`;
    } else {
        report += `## Summary of Issues\n\n`;

        const issueCounts: Record<string, number> = {};
        for (const r of results) {
            for (const issue of r.issues) {
                const type = issue.split(":")[0];
                issueCounts[type] = (issueCounts[type] || 0) + 1;
            }
        }

        report += `| Issue Type | Count |\n`;
        report += `|------------|-------|\n`;
        for (const [type, count] of Object.entries(issueCounts)) {
            report += `| ${type} | ${count} |\n`;
        }
        report += `\n---\n\n`;

        report += `## Detailed Findings\n\n`;

        // Group by article
        const grouped = results.reduce((acc, r) => {
            if (!acc[r.articleSlug]) acc[r.articleSlug] = [];
            acc[r.articleSlug].push(r);
            return acc;
        }, {} as Record<string, LinkAuditResult[]>);

        for (const [slug, findings] of Object.entries(grouped)) {
            report += `### [${findings[0].articleTitle}](file:///Users/scottdillingham/Documents/GitHub/lendcity-website/src/content/blog/${slug}.md)\n\n`;
            report += `| Original Link (Issues) | Suggested Change |\n`;
            report += `|------------------------|------------------|\n`;
            for (const f of findings) {
                const original = `[${f.anchorText}](${f.targetUrl})<br>*(Issues: ${f.issues.join(", ")})*`;
                const suggestion = f.suggestedAnchor
                    ? `[${f.suggestedAnchor}](${f.targetUrl})`
                    : `*N/A (Update manually)*`;
                report += `| ${original} | ${suggestion} |\n`;
            }
            report += `\n`;
        }
    }

    await fs.writeFile(REPORT_PATH, report);
}

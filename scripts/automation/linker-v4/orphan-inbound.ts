// ============================================
// Smart Linker v9 — Orphan Inbound Drafting
// ============================================
// For pages with 0 inbound links:
// 1) Try exact-substring links from related source articles
// 2) If none, draft bridge paragraphs that introduce a natural link
// 3) Optionally apply those drafts into source markdown

import fs from "fs/promises";
import path from "path";
import type { CLIOptions } from "../types";
import type { SuggestionFile, ParsedArticle } from "./types";
import LlmClient from "../shared/llm";
import { MODELS } from "../config";
import {
  loadMarkdownFiles,
  parseBody,
  numberParagraphs,
  extractRawFrontmatter,
  BLOG_DIR,
  computeContentHash,
} from "./parse";
import {
  findInboundSourceCandidates,
  tryLinkToOrphanInSource,
  loadBlogAndCatalog,
  type CatalogPage,
  type IntentLink,
} from "./intent-placement";
import { buildLinkGraph, loadLinkGraph } from "./link-graph";
import { normalizeUrl } from "./catalog-utils";

const DRAFTS_DIR = "src/data/linker-v4/orphan-inbound-drafts";
const SUGGESTIONS_DIR = "src/data/linker-v4/suggestions";

export interface OrphanBridgeDraft {
  orphanSlug: string;
  orphanUrl: string;
  orphanTitle: string;
  sourceSlug: string;
  insertAfterParagraph: number;
  markdown: string;
  anchorText: string;
  rationale: string;
  createdAt: string;
  appliedAt?: string;
}

export interface OrphanInboundReport {
  generatedAt: string;
  orphansConsidered: number;
  exactLinksAdded: number;
  bridgesDrafted: number;
  stillOrphaned: string[];
  exactByOrphan: Record<string, Array<{ sourceSlug: string; anchorText: string }>>;
  drafts: OrphanBridgeDraft[];
}

async function mergeSuggestionIntoSource(
  sourceSlug: string,
  link: IntentLink,
  model: string
): Promise<void> {
  const suggestionsDir = path.resolve(SUGGESTIONS_DIR);
  await fs.mkdir(suggestionsDir, { recursive: true });
  const filePath = path.join(suggestionsDir, `${sourceSlug}.json`);

  let file: SuggestionFile;
  try {
    file = JSON.parse(await fs.readFile(filePath, "utf-8"));
  } catch {
    const posts = await loadMarkdownFiles(BLOG_DIR);
    const article = posts.find((p) => p.slug === sourceSlug);
    const body = article ? parseBody(article.rawContent) : "";
    file = {
      sourceSlug,
      sourceContentHash: computeContentHash(body),
      generatedAt: new Date().toISOString(),
      model,
      catalogSize: 1,
      raw: [],
      validated: [],
    };
  }

  const norm = normalizeUrl(link.targetUrl);
  const already =
    (file.raw || []).some((r) => normalizeUrl(r.targetUrl) === norm) ||
    (file.validated || []).some(
      (v) => v.passed && normalizeUrl(v.suggestion.targetUrl) === norm
    );
  if (already) return;

  const { paragraphText: _p, ...suggestion } = link;
  file.raw = [...(file.raw || []), suggestion];
  // Leave validated empty — caller runs validate before apply
  file.validated = file.validated || [];
  file.model = model;
  file.generatedAt = new Date().toISOString();
  await fs.writeFile(filePath, JSON.stringify(file, null, 2));
}

async function draftBridgeParagraph(args: {
  client: LlmClient;
  modelId: string;
  orphan: CatalogPage;
  source: ParsedArticle;
}): Promise<OrphanBridgeDraft | null> {
  const { client, modelId, orphan, source } = args;
  const body = parseBody(source.rawContent);
  const paragraphs = numberParagraphs(body).filter((p) => p.isContent);
  if (paragraphs.length < 3) return null;

  // Insert in mid-body (avoid intro + conclusion)
  const mid = paragraphs[Math.floor(paragraphs.length * 0.45)] || paragraphs[2];
  const contextBefore = mid.text.slice(0, 400);

  const prompt = [
    "Draft ONE short bridge paragraph (2 sentences max) for a Canadian mortgage/real estate blog.",
    "It will be inserted into an existing article to create a natural internal link to an orphan page.",
    "Requirements:",
    "- Continuity with the surrounding topic",
    `- Include markdown link exactly once: [descriptive 5-12 word anchor](${orphan.url.endsWith("/") ? orphan.url : orphan.url + "/"})`,
    "- Anchor must describe what the reader will learn on the destination",
    "- No CTAs, no 'click here', no hype",
    "- Do not repeat the source article title",
    "",
    `Source article: ${source.frontmatter.title}`,
    `Paragraph before insert: ${contextBefore}`,
    `Orphan page title: ${orphan.title}`,
    `Orphan promise: ${orphan.readerPromise || orphan.description}`,
    `Orphan answers: ${(orphan.questionsAnswered || []).slice(0, 3).join("; ")}`,
    "",
    "Use draft_bridge tool.",
  ].join("\n");

  const response = await client.messages.create({
    model: modelId,
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
    tools: [
      {
        name: "draft_bridge",
        description: "Bridge paragraph with one internal markdown link",
        input_schema: {
          type: "object",
          properties: {
            markdown: { type: "string" },
            anchorText: { type: "string" },
            rationale: { type: "string" },
          },
          required: ["markdown", "anchorText", "rationale"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "draft_bridge" },
  });

  const tool = response.content.find((b) => b.type === "tool_use") as
    | {
        type: "tool_use";
        input: { markdown?: string; anchorText?: string; rationale?: string };
      }
    | undefined;

  const markdown = tool?.input?.markdown?.trim();
  const anchorText = tool?.input?.anchorText?.trim();
  if (!markdown || !anchorText) return null;
  if (!markdown.includes(`](${orphan.url}`) && !markdown.includes(normalizeUrl(orphan.url))) {
    // Require the orphan URL appears in the draft
    const url = orphan.url.endsWith("/") ? orphan.url : `${orphan.url}/`;
    if (!markdown.includes(url) && !markdown.includes(normalizeUrl(url))) return null;
  }

  return {
    orphanSlug: orphan.slug,
    orphanUrl: orphan.url.endsWith("/") ? orphan.url : `${orphan.url}/`,
    orphanTitle: orphan.title,
    sourceSlug: source.slug,
    insertAfterParagraph: mid.index,
    markdown,
    anchorText,
    rationale: tool?.input?.rationale || "orphan inbound bridge",
    createdAt: new Date().toISOString(),
  };
}

/**
 * Draft inbound coverage for orphan pages.
 * Writes exact-link suggestions + bridge draft JSON files.
 */
export async function draftOrphanInbound(options: CLIOptions): Promise<void> {
  const dryRun = options.dryRun === true;
  const maxPosts = options.maxPosts || 50;

  console.log("═══════════════════════════════════════════════");
  console.log("  Orphan Inbound — Exact links + bridge drafts");
  console.log(`  Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`  Max orphans: ${maxPosts}`);
  console.log("═══════════════════════════════════════════════\n");

  let graph = await loadLinkGraph();
  if (!graph) {
    console.log("Link graph missing — building...\n");
    graph = await buildLinkGraph();
  }

  const { posts, catalog } = await loadBlogAndCatalog();
  const catalogByUrl = new Map(catalog.map((p) => [normalizeUrl(p.url), p]));

  const blogOrphans = (graph.orphanPages || [])
    .map((u) => catalogByUrl.get(normalizeUrl(u)))
    .filter((p): p is CatalogPage => Boolean(p) && p.type === "post");

  const focused = options.slug
    ? blogOrphans.filter((p) => p.slug === options.slug).length
      ? blogOrphans.filter((p) => p.slug === options.slug)
      : catalog.filter((p) => p.slug === options.slug && p.type === "post")
    : blogOrphans.slice(0, maxPosts);

  console.log(`Blog orphans/targets to process: ${focused.length}\n`);

  if (!process.env.XAI_API_KEY) {
    console.warn("XAI_API_KEY missing — will only attempt exact-substring inbound links (no bridge drafts).\n");
  }

  const client = process.env.XAI_API_KEY ? new LlmClient() : null;
  const modelId = MODELS.ANALYSIS;
  const draftsDir = path.resolve(DRAFTS_DIR);
  await fs.mkdir(draftsDir, { recursive: true });

  const report: OrphanInboundReport = {
    generatedAt: new Date().toISOString(),
    orphansConsidered: focused.length,
    exactLinksAdded: 0,
    bridgesDrafted: 0,
    stillOrphaned: [],
    exactByOrphan: {},
    drafts: [],
  };

  for (const orphan of focused) {
    console.log(`→ ${orphan.slug}`);
    const sources = await findInboundSourceCandidates({
      orphan,
      catalog,
      blogPosts: posts,
      maxSources: 8,
    });

    let gotInbound = false;

    // Pass 1: exact substring placements into related sources
    for (const { article, score } of sources.slice(0, 5)) {
      const link = tryLinkToOrphanInSource({ source: article, orphan });
      if (!link) continue;

      console.log(
        `  exact: ${article.slug} → "${link.anchorText}" (score ${score.toFixed(2)})`
      );
      if (!dryRun) {
        await mergeSuggestionIntoSource(article.slug, link, "intent-orphan-inbound-v9");
      }
      report.exactLinksAdded++;
      gotInbound = true;
      if (!report.exactByOrphan[orphan.slug]) report.exactByOrphan[orphan.slug] = [];
      report.exactByOrphan[orphan.slug].push({
        sourceSlug: article.slug,
        anchorText: link.anchorText,
      });
      // One exact inbound is enough to clear orphan status after apply
      break;
    }

    if (gotInbound) continue;

    // Pass 2: draft bridge paragraph in best source
    if (!client) {
      report.stillOrphaned.push(orphan.slug);
      console.log("  no exact match; skipped bridge (no API key)");
      continue;
    }

    const best = sources[0];
    if (!best) {
      report.stillOrphaned.push(orphan.slug);
      console.log("  no related sources found");
      continue;
    }

    try {
      const draft = await draftBridgeParagraph({
        client,
        modelId,
        orphan,
        source: best.article,
      });
      if (!draft) {
        report.stillOrphaned.push(orphan.slug);
        console.log("  bridge draft failed");
        continue;
      }

      console.log(
        `  bridge: insert after P${draft.insertAfterParagraph} in ${draft.sourceSlug}`
      );
      console.log(`    ${draft.markdown.slice(0, 120)}…`);

      report.bridgesDrafted++;
      report.drafts.push(draft);

      if (!dryRun) {
        const draftPath = path.join(draftsDir, `${orphan.slug}.json`);
        await fs.writeFile(draftPath, JSON.stringify(draft, null, 2));
      }
    } catch (err) {
      report.stillOrphaned.push(orphan.slug);
      console.error(`  bridge error: ${(err as Error).message}`);
    }
  }

  const reportPath = path.join(draftsDir, `_report.json`);
  if (!dryRun) {
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log(`  Exact inbound suggestions: ${report.exactLinksAdded}`);
  console.log(`  Bridge drafts:             ${report.bridgesDrafted}`);
  console.log(`  Still needing attention:   ${report.stillOrphaned.length}`);
  console.log(`  Drafts dir: ${draftsDir}`);
  console.log("  Next: validate + apply suggestions, then:");
  console.log("    -f linker-v4 -m apply-orphan-drafts");
  console.log("═══════════════════════════════════════════════\n");
}

/**
 * Insert approved bridge paragraphs into source articles.
 */
export async function applyOrphanDrafts(options: CLIOptions): Promise<void> {
  const dryRun = options.dryRun === true;
  const draftsDir = path.resolve(DRAFTS_DIR);

  let files: string[];
  try {
    files = (await fs.readdir(draftsDir)).filter(
      (f) => f.endsWith(".json") && !f.startsWith("_")
    );
  } catch {
    console.error("No orphan-inbound-drafts directory found.");
    return;
  }

  if (options.slug) {
    files = files.filter((f) => f === `${options.slug}.json`);
  }

  const posts = await loadMarkdownFiles(BLOG_DIR);
  let applied = 0;
  let skipped = 0;

  for (const file of files) {
    const draft = JSON.parse(
      await fs.readFile(path.join(draftsDir, file), "utf-8")
    ) as OrphanBridgeDraft;

    if (draft.appliedAt) {
      skipped++;
      continue;
    }

    const article = posts.find((p) => p.slug === draft.sourceSlug);
    if (!article) {
      console.warn(`  source missing: ${draft.sourceSlug}`);
      skipped++;
      continue;
    }

    const body = parseBody(article.rawContent);
    if (body.includes(normalizeUrl(draft.orphanUrl))) {
      console.log(`  skip ${draft.orphanSlug}: source already links to orphan`);
      skipped++;
      continue;
    }

    const paragraphs = numberParagraphs(body);
    const anchor = paragraphs.find((p) => p.index === draft.insertAfterParagraph);
    if (!anchor) {
      console.warn(`  bad paragraph index in ${file}`);
      skipped++;
      continue;
    }

    const insertAt = anchor.offset + anchor.text.length;
    // Insert as its own paragraph block
    const insertion = `\n\n${draft.markdown.trim()}\n`;
    const newBody = body.slice(0, insertAt) + insertion + body.slice(insertAt);
    const rawFrontmatter = extractRawFrontmatter(article.rawContent);
    const newContent = rawFrontmatter + newBody;

    console.log(
      `  ${dryRun ? "[dry-run] " : ""}insert bridge into ${draft.sourceSlug} for ${draft.orphanSlug}`
    );

    if (!dryRun) {
      await fs.writeFile(article.filePath, newContent, "utf-8");
      draft.appliedAt = new Date().toISOString();
      await fs.writeFile(path.join(draftsDir, file), JSON.stringify(draft, null, 2));
    }
    applied++;
  }

  console.log(
    `\n${dryRun ? "[DRY RUN] Would apply" : "Applied"} ${applied} bridge drafts (${skipped} skipped)`
  );
}

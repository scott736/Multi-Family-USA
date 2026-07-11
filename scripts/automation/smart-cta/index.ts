// ============================================
// Smart CTA — CLI Handler
// ============================================
// Generate and manage AI-powered inline CTAs for blog posts.
// Uses Grok 4.5 via the xAI Grok API.
//
// Usage:
//   npx tsx scripts/automation -f smart-cta -m generate --slug my-article
//   npx tsx scripts/automation -f smart-cta -m generate --slug my-article --dry-run
//   npx tsx scripts/automation -f smart-cta -m generate --slug my-article --use-api
//   npx tsx scripts/automation -f smart-cta -m rescan --all
//   npx tsx scripts/automation -f smart-cta -m rescan --all --dry-run
//   npx tsx scripts/automation -f smart-cta -m rescan --all --skip-existing
//   npx tsx scripts/automation -f smart-cta -m rescan --all --category us-cross-border

import fs from "fs/promises";
import path from "path";
import readline from "readline";
import type { CLIOptions } from "../types";
import { PATHS, MODELS } from "../config";
import { parseFrontmatter } from "../shared/frontmatter";
import { insertSmartCTAs, stripSmartCTAs, insertGlossaryCTA, stripGlossaryCTAs, BOOKING_URL } from "../shared/smart-cta";
import { generateSmartCTAs, buildCTAPrompt } from "../shared/generate-smart-cta-api";

// ----------------
// Main Router
// ----------------

export async function runSmartCta(options: CLIOptions): Promise<void> {
  const { mode } = options;

  switch (mode) {
    case "generate":
      await generateForArticle(options);
      break;
    case "rescan":
      await rescanAll(options);
      break;
    case "inventory":
      await buildInventory(options);
      break;
    default:
      console.error(`Unknown smart-cta mode: ${mode}`);
      console.log("Available modes: generate, rescan, inventory");
      process.exit(1);
  }
}

// ----------------
// Generate Mode (single article)
// ----------------

async function generateForArticle(options: CLIOptions): Promise<void> {
  const { slug, dryRun, useApi, verbose } = options;

  if (!slug) {
    console.error("Missing required parameter: --slug");
    return;
  }

  const filePath = path.resolve(PATHS.BLOG_CONTENT, `${slug}.mdx`);

  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch {
    console.error(`Article not found: ${filePath}`);
    return;
  }

  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    console.error("Invalid frontmatter format");
    return;
  }

  const frontmatterRaw = fmMatch[1];
  const { frontmatter, body } = parseFrontmatter<Record<string, any>>(raw);
  const metadata = {
    title: frontmatter.title || "Untitled",
    category: frontmatter.category || "investing-fundamentals",
    topicCluster: frontmatter.topicCluster as string | undefined,
    region: frontmatter.region as string | undefined,
    tags: frontmatter.tags as string[] | undefined,
  };
  const cleanBody = stripSmartCTAs(body);

  console.log(`Generating Smart CTAs for: ${slug}`);
  console.log(`  Category: ${metadata.category}`);
  if (metadata.topicCluster) console.log(`  Cluster: ${metadata.topicCluster}`);

  // Decide generation method: --use-api skips prompt, otherwise ask
  let method: "api" | "prompt";
  if (useApi) {
    method = "api";
  } else {
    method = await promptGenerationMethod();
  }

  if (method === "prompt") {
    // Output prompt for an agent to generate CTAs, use templates as placeholder
    const prompt = buildCTAPrompt(cleanBody, {
      title: metadata.title,
      category: metadata.category,
      topicCluster: metadata.topicCluster,
      region: metadata.region,
      tags: metadata.tags,
    });

    console.log("\n" + "=".repeat(60));
    console.log("PROMPT FOR AGENT — Generate 2 CTA sentences:");
    console.log("=".repeat(60) + "\n");
    console.log(prompt);
    console.log("\n" + "=".repeat(60));
    console.log("END PROMPT");
    console.log("=".repeat(60) + "\n");

    // Insert template CTAs as placeholders so the file is valid
    const newBody = insertSmartCTAs(cleanBody, metadata.category, metadata.topicCluster as any, undefined, metadata.region);
    const newContent = `---\n${frontmatterRaw}\n---\n${newBody}`;

    if (dryRun) {
      console.log("[DRY RUN] Would insert template CTAs as placeholders — no changes saved.");
    } else {
      await fs.writeFile(filePath, newContent, "utf-8");
      console.log(`Inserted template CTAs as placeholders: ${filePath}`);
      console.log("Replace them with AI-generated CTAs from the prompt above.");
    }
    return;
  }

  // API method
  if (!process.env.XAI_API_KEY) {
    console.error("XAI_API_KEY environment variable required for API mode.");
    return;
  }

  console.log(`  Model: ${MODELS.UTILITY}\n`);

  const aiCTAs = await generateSmartCTAs(cleanBody, {
    title: metadata.title,
    category: metadata.category,
    topicCluster: metadata.topicCluster,
    region: metadata.region,
    tags: metadata.tags,
  }, verbose);

  if (aiCTAs.length === 0) {
    console.log("No CTAs generated. Check your XAI_API_KEY and try again.");
    return;
  }

  console.log(`Generated ${aiCTAs.length} AI CTA(s):\n`);
  aiCTAs.forEach((cta, i) => {
    console.log(`  CTA ${i + 1}: ${cta.slice(0, 120)}${cta.length > 120 ? "..." : ""}`);
  });
  console.log("");

  const newBody = insertSmartCTAs(cleanBody, metadata.category, metadata.topicCluster as any, aiCTAs, metadata.region);
  const newContent = `---\n${frontmatterRaw}\n---\n${newBody}`;

  if (dryRun) {
    console.log("[DRY RUN] Would update file — no changes saved.");
  } else {
    await fs.writeFile(filePath, newContent, "utf-8");
    console.log(`Updated: ${filePath}`);
  }
}

// ----------------
// Interactive Prompt
// ----------------

function promptGenerationMethod(): Promise<"api" | "prompt"> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  return new Promise((resolve) => {
    console.log("\nCTA generation method:");
    console.log("  1) xAI Grok API (Grok 4.5)");
    console.log("  2) Output prompt for agent");

    rl.question("Choose [1/2]: ", (answer) => {
      rl.close();
      resolve(answer.trim() === "2" ? "prompt" : "api");
    });
  });
}

// ----------------
// Rescan Mode (batch)
// ----------------

async function rescanAll(options: CLIOptions): Promise<void> {
  const { all, dryRun, verbose, noApi } = options;
  const concurrency = options.concurrency || 3;
  const skipExisting = options.skipExisting;
  const categoryFilter = options.category;
  const locale = (options.locale || "en").toLowerCase();
  const collection = (options.collection || "blog").toLowerCase();

  if (!all) {
    console.error("Please specify --all to rescan all blog posts.");
    return;
  }

  if (!noApi && !process.env.XAI_API_KEY) {
    console.error("XAI_API_KEY environment variable required (or pass --no-api to use templates).");
    return;
  }

  const blogDir = resolveContentDir(collection, locale);
  const files = await fs.readdir(blogDir);
  const mdFiles = files.filter((f) => f.endsWith(".mdx")).sort();

  console.log(`Rescanning ${mdFiles.length} ${collection} entries (locale=${locale}) with Smart CTAs`);
  console.log(`  Source: ${blogDir}`);
  console.log(`  Mode: ${noApi ? "templates only (no-api)" : "AI (grok-4.5)"}`);
  console.log(`  Concurrency: ${concurrency}`);
  if (skipExisting) console.log(`  Skip existing: yes`);
  if (categoryFilter) console.log(`  Category filter: ${categoryFilter}`);
  console.log(`  Write mode: ${dryRun ? "dry-run" : "write"}\n`);

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  // Process in concurrent batches
  for (let i = 0; i < mdFiles.length; i += concurrency) {
    const batch = mdFiles.slice(i, i + concurrency);

    const results = await Promise.allSettled(
      batch.map((file) => processOneFile(blogDir, file, dryRun, verbose, skipExisting, categoryFilter, noApi, locale, collection))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const file = batch[j];
      const progress = `[${i + j + 1}/${mdFiles.length}]`;

      if (result.status === "fulfilled") {
        if (result.value.skipped) {
          skipped++;
          if (verbose) console.log(`  ${progress} ${file}: skipped (${result.value.skipReason})`);
        } else {
          processed++;
          if (result.value.ctaCount > 0) {
            updated++;
            console.log(`  ${progress} ${file}: ${result.value.ctaCount} CTAs`);
          } else {
            console.log(`  ${progress} ${file}: no CTAs generated`);
          }
        }
      } else {
        errors++;
        console.error(`  ${progress} ${file}: ERROR - ${result.reason}`);
      }
    }

    // Small delay between batches to be kind to the API
    if (i + concurrency < mdFiles.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log(`\nRescan complete:`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Updated with AI CTAs: ${updated}`);
  if (skipped > 0) console.log(`  Skipped: ${skipped}`);
  if (errors > 0) console.log(`  Errors: ${errors}`);
  if (dryRun) console.log(`\n[DRY RUN] No files were modified.`);
}

// ----------------
// Helpers
// ----------------

interface FileResult {
  ctaCount: number;
  skipped: boolean;
  skipReason?: string;
}

function resolveContentDir(collection: string, locale: string): string {
  if (collection === "glossary") {
    return path.resolve(`src/content/glossary/${locale}`);
  }
  return locale === "es" ? path.resolve("src/content/es-blog") : path.resolve("src/content/blog");
}

async function processOneFile(
  blogDir: string,
  file: string,
  dryRun?: boolean,
  verbose?: boolean,
  skipExisting?: boolean,
  categoryFilter?: string,
  noApi?: boolean,
  locale: string = "en",
  collection: string = "blog"
): Promise<FileResult> {
  const filePath = path.join(blogDir, file);
  const raw = await fs.readFile(filePath, "utf-8");

  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return { ctaCount: 0, skipped: true, skipReason: "invalid frontmatter" };

  const frontmatterRaw = fmMatch[1];
  const { frontmatter, body } = parseFrontmatter<Record<string, any>>(raw);

  if (collection === "glossary") {
    const term = frontmatter.term || "Term";
    const definition = frontmatter.definition || "";

    if (skipExisting) {
      const inlineLinkPattern = new RegExp(`\\[.*?\\]\\(${BOOKING_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^)]*\\)`);
      if (inlineLinkPattern.test(body)) {
        return { ctaCount: 0, skipped: true, skipReason: "has CTAs" };
      }
    }

    const cleanBody = stripGlossaryCTAs(body);
    const newBody = insertGlossaryCTA(cleanBody, term, definition, locale);
    const newContent = `---\n${frontmatterRaw}\n---\n${newBody}`;

    if (!dryRun) {
      await fs.writeFile(filePath, newContent, "utf-8");
    }
    return { ctaCount: 1, skipped: false };
  }

  const metadata = {
    title: frontmatter.title || "Untitled",
    category: frontmatter.category || "investing-fundamentals",
    topicCluster: frontmatter.topicCluster as string | undefined,
    region: frontmatter.region as string | undefined,
    tags: frontmatter.tags as string[] | undefined,
  };

  // Skip drafts
  const isDraft = frontmatter.draft === true;
  if (isDraft) return { ctaCount: 0, skipped: true, skipReason: "draft" };

  // Skip by category filter
  if (categoryFilter && metadata.category !== categoryFilter) {
    return { ctaCount: 0, skipped: true, skipReason: `category ${metadata.category}` };
  }

  // Skip if already has CTAs and --skip-existing is set
  if (skipExisting) {
    const inlineLinkPattern = new RegExp(`\\[.*?\\]\\(${BOOKING_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^)]*\\)`);
    if (inlineLinkPattern.test(body)) {
      return { ctaCount: 0, skipped: true, skipReason: "has CTAs" };
    }
  }

  // Strip existing CTAs
  const cleanBody = stripSmartCTAs(body);

  // Generate AI CTAs unless --no-api is set
  let aiCTAs: string[] = [];
  if (!noApi) {
    aiCTAs = await generateSmartCTAs(cleanBody, {
      title: metadata.title,
      category: metadata.category,
      topicCluster: metadata.topicCluster,
      region: metadata.region,
      tags: metadata.tags,
    }, verbose);
    if (aiCTAs.length === 0) return { ctaCount: 0, skipped: false };
  }

  // Insert CTAs — when aiCTAs is empty, insertSmartCTAs falls back to templates
  const newBody = insertSmartCTAs(
    cleanBody,
    metadata.category,
    metadata.topicCluster as any,
    aiCTAs.length > 0 ? aiCTAs : undefined,
    metadata.region,
    undefined,
    locale
  );
  const newContent = `---\n${frontmatterRaw}\n---\n${newBody}`;

  if (!dryRun) {
    await fs.writeFile(filePath, newContent, "utf-8");
  }

  return { ctaCount: aiCTAs.length > 0 ? aiCTAs.length : 2, skipped: false };
}

// ----------------
// Inventory Mode
// ----------------

interface InventoryEntry {
  url: string;
  locale: string;
  type: string;
  title: string;
  ctaStrategy: string;
  primaryAction: string;
  secondaryAction: string;
  hasInlineCta: boolean;
}

async function buildInventory(options: CLIOptions): Promise<void> {
  const outputPath = path.resolve("src/data/smart-cta/page-inventory.json");
  const entries: InventoryEntry[] = [];
  const locales = ["en", "es"] as const;

  // Blog posts
  for (const locale of locales) {
    const blogDir = locale === "es" ? path.resolve("src/content/es-blog") : path.resolve("src/content/blog");
    const files = (await fs.readdir(blogDir)).filter((f) => f.endsWith(".mdx"));
    for (const file of files) {
      const raw = await fs.readFile(path.join(blogDir, file), "utf-8");
      const { frontmatter, body } = parseFrontmatter<Record<string, any>>(raw);
      const slug = file.replace(/\.mdx?$/, "");
      const url = locale === "en" ? `/blog/${slug}/` : `/${locale}/blog/${slug}/`;
      entries.push({
        url,
        locale,
        type: "blog",
        title: frontmatter.title || slug,
        ctaStrategy: "inline-smart-cta",
        primaryAction: "book-call",
        secondaryAction: body.includes("book-strategy-call") ? "inline-cta-present" : "needs-cta",
        hasInlineCta: body.includes("book-strategy-call"),
      });
    }
  }

  // Glossary
  for (const locale of locales) {
    const glossaryDir = path.resolve(`src/content/glossary/${locale}`);
    const files = (await fs.readdir(glossaryDir)).filter((f) => f.endsWith(".mdx"));
    for (const file of files) {
      const raw = await fs.readFile(path.join(glossaryDir, file), "utf-8");
      const { frontmatter, body } = parseFrontmatter<Record<string, any>>(raw);
      const slug = file.replace(/\.mdx?$/, "");
      const url = locale === "en" ? `/glossary/${slug}/` : `/${locale}/glossary/${slug}/`;
      entries.push({
        url,
        locale,
        type: "glossary",
        title: frontmatter.term || slug,
        ctaStrategy: "inline-glossary-cta + contextual-bottom-cta",
        primaryAction: "book-call",
        secondaryAction: "apply-or-calculator",
        hasInlineCta: body.includes("book-strategy-call"),
      });
    }
  }

  // Services (English slugs — FR/ES mirror paths)
  const servicesDir = path.resolve("src/content/services/en");
  const serviceFiles: string[] = [];
  async function walkServices(dir: string, prefix = "") {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      const rel = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.isDirectory()) {
        await walkServices(path.join(dir, item.name), rel);
      } else if (item.name.endsWith(".yml")) {
        serviceFiles.push(rel.replace(/\.yml$/, ""));
      }
    }
  }
  await walkServices(servicesDir);

  for (const serviceSlug of serviceFiles) {
    for (const locale of locales) {
      const url = locale === "en" ? `/${serviceSlug}/` : `/${locale}/${serviceSlug}/`;
      entries.push({
        url,
        locale,
        type: "service",
        title: serviceSlug,
        ctaStrategy: "hero-cta + overview-cta + contextual-bottom-cta",
        primaryAction: "book-call",
        secondaryAction: serviceSlug.includes("dscr")
          ? "calculator"
          : serviceSlug.includes("mli") || serviceSlug.includes("multi-family")
            ? "calculator"
            : "apply",
        hasInlineCta: true,
      });
    }
  }

  // Team members
  const teamDir = path.resolve("src/content/team");
  const teamFiles = (await fs.readdir(teamDir)).filter((f) => f.endsWith(".yml"));
  for (const file of teamFiles) {
    const slug = file.replace(/\.yml$/, "");
    entries.push({
      url: `/${slug}/`,
      locale: "en",
      type: "team",
      title: slug,
      ctaStrategy: "profile-booking-section",
      primaryAction: "book-call",
      secondaryAction: "apply",
      hasInlineCta: true,
    });
  }

  // Static Astro pages (dedupe by logical path)
  const pagesDir = path.resolve("src/pages");
  const astroFiles: string[] = [];
  async function walkPages(dir: string) {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        await walkPages(full);
      } else if (item.name.endsWith(".astro") && !item.name.startsWith("[")) {
        astroFiles.push(full);
      }
    }
  }
  await walkPages(pagesDir);

  for (const file of astroFiles) {
    const rel = path.relative(pagesDir, file).replace(/index\.astro$/, "").replace(/\.astro$/, "");
    let urlPath = "/" + rel.replace(/\\/g, "/");
    if (!urlPath.endsWith("/")) urlPath += "/";
    if (urlPath === "/") {
      for (const locale of locales) {
        entries.push({
          url: locale === "en" ? "/" : `/${locale}/`,
          locale,
          type: "static",
          title: "homepage",
          ctaStrategy: "contextual-bottom-cta",
          primaryAction: "book-call",
          secondaryAction: "apply",
          hasInlineCta: true,
        });
      }
      continue;
    }
    if (urlPath.startsWith("/fr/") || urlPath.startsWith("/es/")) {
      const locale = "es";
      entries.push({
        url: urlPath,
        locale,
        type: "static",
        title: rel,
        ctaStrategy: "contextual-bottom-cta",
        primaryAction: "book-call",
        secondaryAction: "contextual",
        hasInlineCta: true,
      });
    } else {
      for (const locale of locales) {
        entries.push({
          url: locale === "en" ? urlPath : `/${locale}${urlPath}`,
          locale,
          type: "static",
          title: rel,
          ctaStrategy: "contextual-bottom-cta",
          primaryAction: "book-call",
          secondaryAction: "contextual",
          hasInlineCta: true,
        });
      }
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    totalPages: entries.length,
    byType: entries.reduce(
      (acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    ),
    byLocale: entries.reduce(
      (acc, e) => {
        acc[e.locale] = (acc[e.locale] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    ),
    missingInlineCta: entries.filter((e) => !e.hasInlineCta).length,
    entries,
  };

  if (!options.dryRun) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(summary, null, 2), "utf-8");
  }

  console.log(`Page inventory: ${entries.length} total pages`);
  console.log(`  By type: ${JSON.stringify(summary.byType)}`);
  console.log(`  By locale: ${JSON.stringify(summary.byLocale)}`);
  console.log(`  Missing inline CTA: ${summary.missingInlineCta}`);
  if (!options.dryRun) {
    console.log(`\nWritten to: ${outputPath}`);
  } else {
    console.log("\n[DRY RUN] Inventory not written.");
  }
}


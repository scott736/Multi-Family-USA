// ============================================
// Service CTA — CLI Handler
// ============================================
// Insert contextual service-hub links into blog posts.
//
// Usage:
//   npx tsx scripts/automation -f service-cta -m rescan --all --locale all
//   npx tsx scripts/automation -f service-cta -m rescan --all --locale en --dry-run
//   npx tsx scripts/automation -f service-cta -m rescan --all --skip-existing
//   npx tsx scripts/automation -f service-cta -m rescan --slug my-article

import fs from "fs/promises";
import path from "path";
import type { CLIOptions } from "../types";
import { parseFrontmatter } from "../shared/frontmatter";
import {
  insertServiceCTA,
  stripServiceCTA,
  hasServiceHubLink,
  resolveServiceHub,
} from "../shared/service-cta";

const LOCALES = ["en", "es"] as const;

export async function runServiceCta(options: CLIOptions): Promise<void> {
  const { mode } = options;

  switch (mode) {
    case "rescan":
      await rescanAll(options);
      break;
    default:
      console.error(`Unknown service-cta mode: ${mode || "(none)"}`);
      console.log("Available modes: rescan");
      process.exit(1);
  }
}

async function rescanAll(options: CLIOptions): Promise<void> {
  const { all, dryRun, verbose, slug } = options;
  // --skip-existing defaults ON (omit flag or pass it); use --force to re-insert
  const skipExisting = options.force ? false : options.skipExisting !== false;
  const categoryFilter = options.category;
  const localeOpt = (options.locale || "en").toLowerCase();

  if (!all && !slug) {
    console.error("Please specify --all or --slug <name>.");
    return;
  }

  const locales =
    localeOpt === "all" ? [...LOCALES] : ([localeOpt] as string[]);

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalAlready = 0;
  let totalErrors = 0;

  for (const locale of locales) {
    const blogDir = locale === "es" ? path.resolve("src/content/es-blog") : path.resolve("src/content/blog");
    let mdFiles: string[];

    try {
      const files = await fs.readdir(blogDir);
      mdFiles = files.filter((f) => f.endsWith(".mdx")).sort();
    } catch {
      console.error(`Blog directory not found: ${blogDir}`);
      continue;
    }

    if (slug) {
      const target = slug.endsWith(".mdx") ? slug : `${slug}.mdx`;
      mdFiles = mdFiles.filter((f) => f === target);
      if (mdFiles.length === 0) {
        console.error(`Article not found: ${blogDir}/${target}`);
        continue;
      }
    }

    console.log(`\nService CTA rescan (locale=${locale}, ${mdFiles.length} posts)`);
    console.log(`  Skip existing: ${skipExisting ? "yes" : "no (force)"}`);
    console.log(`  Write mode: ${dryRun ? "dry-run" : "write"}`);

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let already = 0;
    let errors = 0;

    for (let i = 0; i < mdFiles.length; i++) {
      const file = mdFiles[i];
      const progress = `[${i + 1}/${mdFiles.length}]`;

      try {
        const result = await processOneFile(
          blogDir,
          file,
          dryRun,
          skipExisting,
          categoryFilter,
          locale
        );

        if (result.skipped) {
          skipped++;
          if (result.skipReason === "has service hub") already++;
          if (verbose) {
            console.log(`  ${progress} ${file}: skipped (${result.skipReason})`);
          }
        } else if (result.updated) {
          processed++;
          updated++;
          console.log(
            `  ${progress} ${file}: inserted → ${result.hubUrl}`
          );
        } else {
          processed++;
          if (verbose) console.log(`  ${progress} ${file}: unchanged`);
        }
      } catch (err) {
        errors++;
        console.error(`  ${progress} ${file}: ERROR - ${err}`);
      }
    }

    console.log(`\nLocale ${locale} complete:`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Already had hub link: ${already}`);
    if (skipped - already > 0) console.log(`  Other skipped: ${skipped - already}`);
    if (errors > 0) console.log(`  Errors: ${errors}`);

    totalProcessed += processed;
    totalUpdated += updated;
    totalSkipped += skipped;
    totalAlready += already;
    totalErrors += errors;
  }

  // Coverage report
  console.log("\n── Coverage ──");
  for (const locale of locales) {
    const coverage = await measureCoverage(locale);
    console.log(
      `  ${locale}: ${coverage.withHub}/${coverage.total} posts have ≥1 service hub link (${coverage.pct}%)`
    );
  }

  console.log(`\nTotals: updated=${totalUpdated}, already=${totalAlready}, errors=${totalErrors}`);
  if (dryRun) console.log("\n[DRY RUN] No files were modified.");
  void totalProcessed;
  void totalSkipped;
}

interface FileResult {
  updated: boolean;
  skipped: boolean;
  skipReason?: string;
  hubUrl?: string;
}

async function processOneFile(
  blogDir: string,
  file: string,
  dryRun?: boolean,
  skipExisting?: boolean,
  categoryFilter?: string,
  locale: string = "en"
): Promise<FileResult> {
  const filePath = path.join(blogDir, file);
  const raw = await fs.readFile(filePath, "utf-8");

  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    return { updated: false, skipped: true, skipReason: "invalid frontmatter" };
  }

  const frontmatterRaw = fmMatch[1];
  const { frontmatter, body } = parseFrontmatter<Record<string, unknown>>(raw);

  if (frontmatter.draft === true) {
    return { updated: false, skipped: true, skipReason: "draft" };
  }

  const category =
    (typeof frontmatter.category === "string" && frontmatter.category) ||
    "investing-fundamentals";

  if (categoryFilter && category !== categoryFilter) {
    return { updated: false, skipped: true, skipReason: `category ${category}` };
  }

  if (skipExisting && hasServiceHubLink(body)) {
    return { updated: false, skipped: true, skipReason: "has service hub" };
  }

  const cleanBody = stripServiceCTA(body);
  const hubUrl = resolveServiceHub(cleanBody, category);
  const newBody = insertServiceCTA(cleanBody, category, locale);

  if (newBody === body) {
    return { updated: false, skipped: false, hubUrl };
  }

  const newContent = `---\n${frontmatterRaw}\n---\n${newBody}`;
  if (!dryRun) {
    await fs.writeFile(filePath, newContent, "utf-8");
  }

  return { updated: true, skipped: false, hubUrl };
}

async function measureCoverage(
  locale: string
): Promise<{ total: number; withHub: number; pct: number }> {
  const blogDir = locale === "es" ? path.resolve("src/content/es-blog") : path.resolve("src/content/blog");
  const files = (await fs.readdir(blogDir)).filter((f) => f.endsWith(".mdx"));
  let withHub = 0;
  let total = 0;

  for (const file of files) {
    const raw = await fs.readFile(path.join(blogDir, file), "utf-8");
    const { frontmatter, body } = parseFrontmatter<Record<string, unknown>>(raw);
    if (frontmatter.draft === true) continue;
    total++;
    if (hasServiceHubLink(body)) withHub++;
  }

  const pct = total === 0 ? 0 : Math.round((withHub / total) * 1000) / 10;
  return { total, withHub, pct };
}

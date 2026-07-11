#!/usr/bin/env npx tsx

// ============================================
// Multi-Family USA Automation System - Main CLI
// ============================================

import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "util";
import type { CLIOptions } from "./types";

// Parse command line arguments
const { values } = parseArgs({
  options: {
    feature: { type: "string", short: "f" },
    mode: { type: "string", short: "m" },
    slug: { type: "string" },
    file: { type: "string" },
    "episode-id": { type: "string" },
    "share-url": { type: "string" },
    "show-id": { type: "string" },
    "use-api": { type: "boolean" },
    all: { type: "boolean" },
    "dry-run": { type: "boolean" },
    concurrency: { type: "string" },
    model: { type: "string" },
    threshold: { type: "string" },
    "max-posts": { type: "string" },
    competitor: { type: "string" },
    keywords: { type: "string" },
    url: { type: "string" },
    prompt: { type: "string" },
    to: { type: "string" },
    "baseline-date": { type: "string" },
    "high-confidence-only": { type: "boolean" },
    rerank: { type: "boolean" },
    "no-rerank": { type: "boolean" },
    force: { type: "boolean" },
    "skip-existing": { type: "boolean" },
    category: { type: "string" },
    "no-api": { type: "boolean" },
    strict: { type: "boolean" },
    locale: { type: "string" },
    collection: { type: "string" },
    count: { type: "string" },
    "confirm-send": { type: "boolean" },
    edition: { type: "string" },
    subject: { type: "string" },
    "html-file": { type: "string" },
    verbose: { type: "boolean" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
});

const rerankOpt: boolean | undefined = values["no-rerank"]
  ? false
  : values.rerank === true
    ? true
    : undefined;

const options: CLIOptions = {
  feature: values.feature,
  mode: values.mode,
  slug: values.slug,
  file: values.file,
  episodeId: values["episode-id"],
  shareUrl: values["share-url"],
  showId: values["show-id"],
  useApi: values["use-api"],
  all: values.all,
  dryRun: values["dry-run"],
  verbose: values.verbose,
  concurrency: values.concurrency ? parseInt(values.concurrency, 10) || undefined : undefined,
  model: values.model,
  highConfidenceOnly: values["high-confidence-only"],
  rerank: rerankOpt,
  force: values.force,
  skipExisting: values["skip-existing"],
  category: values.category,
  noApi: values["no-api"],
  strict: values.strict,
  locale: values.locale,
  collection: values.collection,
  threshold: values.threshold ? (isNaN(parseInt(values.threshold, 10)) ? undefined : parseInt(values.threshold, 10)) : undefined,
  maxPosts: values["max-posts"] ? (isNaN(parseInt(values["max-posts"] as string, 10)) ? undefined : parseInt(values["max-posts"] as string, 10)) : undefined,
  competitor: values.competitor,
  keywords: values.keywords,
  url: values.url,
  prompt: values.prompt,
  to: values.to,
  baselineDate: values["baseline-date"],
  count: values.count ? parseInt(values.count, 10) || undefined : undefined,
  confirmSend: values["confirm-send"],
  edition: values.edition,
  subject: values.subject,
  htmlFile: values["html-file"],
};

// Help text
function showHelp() {
  console.log(`
Multi-Family USA Automation System
==========================

Usage: npx tsx scripts/automation -f <feature> -m <mode> [options]

FEATURES (-f):
──────────────
  linker-v4       Internal linking system (Smart Linker v6)
  smart-cta       AI-powered inline CTA generation
  service-cta     Contextual service-hub links in blog posts
  podcast         Auto-create blog posts from podcast episodes
  scheduler       Queue-based article publishing
  seo             Competitor analysis & rank tracking (DataForSEO)
  newsletter      AI-powered investor newsletter generator

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LINKER v6 (-f linker-v4)
────────────────────────

  WORKFLOW:
    1. build-catalog   Build page catalog + TF-IDF index (embeddings in GHA only)
    2. generate        Local: deterministic (no API). GHA: --use-api for new posts
    3. validate        Validate suggestions (deterministic rules + semantic gates)
    4. apply           Insert validated links into markdown
    5. relink-local    Full-site relink (strip all locales → EN generate → apply all)

  Utility modes:
    strip              Remove internal links (preserves CTA links by default)
    rerank             LLM trim when too many links passed validation (GHA)
    semantic-audit     Audit live links for quality issues (no API)
    quality-score      Grade link graph health (orphans, force bridges, outbound)
    draft-orphan-inbound  Draft inbound links for orphans (XAI when keyed)
    apply-orphan-drafts   Apply orphan inbound drafts

  Options:
    --slug <name>      Target specific post
    --all              Process all posts
    --locale <code>    en (default), es, fr, or all (strip/apply; relink-local uses all)
    --dry-run          Preview changes without saving
    --use-api          xAI Grok API — GitHub Actions only (new published posts)
    --force            Regenerate even if suggestions exist
    --strict           Fail quality-score when grade is D/F
    --model <name>     Model: haiku (default), sonnet, opus
    --concurrency <n>  Parallel API calls (default: 3)

  Examples:
    npx tsx scripts/automation -f linker-v4 -m relink-local
    npx tsx scripts/automation -f linker-v4 -m strip --all --locale all
    npx tsx scripts/automation -f linker-v4 -m apply --all --locale all
    npx tsx scripts/automation -f linker-v4 -m build-catalog
    npx tsx scripts/automation -f linker-v4 -m generate --all
    npx tsx scripts/automation -f linker-v4 -m validate --all
    npx tsx scripts/automation -f linker-v4 -m apply --all --dry-run
    npx tsx scripts/automation -f linker-v4 -m strip --all
    npx tsx scripts/automation -f linker-v4 -m report --all

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SMART CTA (-f smart-cta)
────────────────────────

  Modes:
    generate        Generate AI CTAs for a specific article
    rescan          Regenerate CTAs for all blog posts or glossary terms
    inventory       Build full site page inventory with CTA strategy map

  Options:
    --slug <name>      Target specific post (generate mode)
    --all              Process all posts (rescan mode)
    --collection <name>  blog (default) or glossary (rescan)
    --locale <code>    en (default), es, or fr (rescan)
    --use-api          Skip interactive prompt, use xAI Grok API directly
    --dry-run          Preview changes without saving
    --skip-existing    Skip posts that already have inline CTAs (rescan)
    --category <name>  Only process posts in this category (rescan)
    --concurrency <n>  Parallel API calls for rescan (default: 3)
    --verbose          Show validation details and skipped files

  Interactive mode (generate without --use-api):
    Prompts you to choose between Grok API or outputting
    the prompt for an agent to generate CTAs instead.

SERVICE CTA (-f service-cta)
────────────────────────────

  Modes:
    rescan          Insert one service-hub CTA per post missing a hub link

  Options:
    --all              Process all posts
    --slug <name>      Target specific post
    --locale <code>    en (default), es, fr, or all
    --dry-run          Preview changes without saving
    --skip-existing    Skip posts that already have a service hub link (default on)
    --force            Re-strip and re-insert even when a hub link exists
    --category <name>  Only process posts in this category
    --verbose          Show skipped files

  Examples:
    npx tsx scripts/automation -f service-cta -m rescan --all --locale all
    npx tsx scripts/automation -f service-cta -m rescan --all --locale en --dry-run

  Model: Grok 4.5 (grok-4.5)
  Requires: XAI_API_KEY environment variable

  Examples:
    npx tsx scripts/automation -f smart-cta -m generate --slug my-article
    npx tsx scripts/automation -f smart-cta -m generate --slug my-article --use-api
    npx tsx scripts/automation -f smart-cta -m generate --slug my-article --dry-run
    npx tsx scripts/automation -f smart-cta -m rescan --all --dry-run
    npx tsx scripts/automation -f smart-cta -m rescan --all --skip-existing
    npx tsx scripts/automation -f smart-cta -m rescan --all --category us-cross-border

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PODCAST (-f podcast)
────────────────────

  Modes:
    process         Process a new episode


  Options:
    --episode-id    Transistor episode ID
    --share-url     Transistor share URL
    --show-id       Transistor show ID

  Example:
    npx tsx scripts/automation -f podcast -m process --episode-id=abc123 --share-url=https://... --show-id=12345

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCHEDULER (-f scheduler)
────────────────────────

  Modes:
    process-next    Process next queued article
    enhance         Enhance a specific article
    publish         Publish a specific article
    gap-audit       Generate queue + published gap report (read-only)
    consolidate-queue Build canonical topic map and mark merged queue items
    build-90d-calendar Generate 13-week publishing calendar CSV

  Options:
    --file          Target file path
    --count <n>     Publish multiple articles in one run (catch-up mode)

  Examples:
    npx tsx scripts/automation -f scheduler -m process-next
    npx tsx scripts/automation -f scheduler -m process-next --count 3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SEO (-f seo)
────────────

  Labs modes:
    competitors     Discover who ranks for the same keywords as multifamily-usa.com
    keyword-gap     Find keywords competitors rank for that we don't
    rank-check      Check where multifamily-usa.com ranks for specific keywords

  Keyword & SERP modes:
    keyword-volume  Search volume, CPC, competition for keywords
    serp            Top 100 Google organic results for a keyword
    trends          Google Trends comparison (max 5 keywords)

  Site audit modes:
    backlinks       Backlink profile summary for a domain
    onpage          On-page SEO crawl & audit (posts task, polls for results)

  Local / business:
    business        Google My Business profile info

  Options:
    --keywords      Keywords (comma-separated) for volume/serp/trends/rank-check
    --competitor    Competitor domain for keyword-gap and backlinks modes
    --url           Specific URL to crawl (onpage mode)
    --dry-run       Show what API calls would be made

  Uses DataForSEO API (pay-per-request, ~$0.02–$0.10 per call).
  Requires DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD in .env.

  Examples:
    npx tsx scripts/automation -f seo -m competitors
    npx tsx scripts/automation -f seo -m keyword-gap --competitor nesto.ca
    npx tsx scripts/automation -f seo -m rank-check --keywords "investment property mortgage"
    npx tsx scripts/automation -f seo -m keyword-volume --keywords "mortgage broker,mortgage rates"
    npx tsx scripts/automation -f seo -m serp --keywords "mortgage broker windsor"
    npx tsx scripts/automation -f seo -m backlinks --competitor nesto.ca
    npx tsx scripts/automation -f seo -m trends --keywords "mortgage rates,dscr loan"
    npx tsx scripts/automation -f seo -m onpage
    npx tsx scripts/automation -f seo -m onpage --url "https://multifamily-usa.com/contact/"
    npx tsx scripts/automation -f seo -m business
    npx tsx scripts/automation -f seo -m competitors --dry-run

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEWSLETTER (-f newsletter)
──────────────────────────

  Modes:
    generate        Show newsletter draft workflow (content written in Cursor/agent)
    recent          List blog posts published in the last N days (JSON output)
    send            Send newsletter-draft.md via Elastic Email (CLI list)
    send-approved   Guarded production send for Cursor automation (Active + Engaged lists)
    preflight       Check send log + Elastic Email before send-approved

  Options:
    --threshold     Days to look back for recent mode (default: 7)
    --max-posts     Cap number of posts returned (recent mode)
    --prompt        Custom angle/insight to synthesize into the newsletter
    --to            Preview recipient for send mode
    --confirm-send  Required for full-list send (omitted for --to preview)
    --edition       Edition date YYYY-MM-DD (send-approved / preflight)
    --subject       Subject line (send-approved / preflight)
    --html-file     HTML artifact path (send-approved)
    --file          Plain-text artifact path (send-approved)
    --force         Override send log / EE duplicate check (use with care)
    --dry-run       Preview without sending (send mode)

  Examples:
    npx tsx scripts/automation -f newsletter -m recent --threshold 7
    npx tsx scripts/automation -f newsletter -m send --to scott@multifamily-usa.com
    npx tsx scripts/automation -f newsletter -m send --confirm-send
    npx tsx scripts/automation -f newsletter -m preflight --edition 2026-06-28 --subject "Multi-Family USA Weekly..."
    npx tsx scripts/automation -f newsletter -m send-approved --edition 2026-06-28 --subject "..." --html-file scripts/automation/newsletter/.artifacts/2026-06-28.html --file scripts/automation/newsletter/.artifacts/2026-06-28.txt --confirm-send

`);
}

// Main function
export async function main(cliOptions?: CLIOptions) {
  const options = cliOptions || {
    feature: values.feature,
    mode: values.mode,
    slug: values.slug,
    file: values.file,
    episodeId: values["episode-id"],
    shareUrl: values["share-url"],
    showId: values["show-id"],
    useApi: values["use-api"],
    all: values.all,
    dryRun: values["dry-run"],
    verbose: values.verbose,
    concurrency: values.concurrency ? parseInt(values.concurrency, 10) || undefined : undefined,
    model: values.model,
    highConfidenceOnly: values["high-confidence-only"],
    rerank: rerankOpt,
    force: values.force,
    skipExisting: values["skip-existing"],
    category: values.category,
    noApi: values["no-api"],
    locale: values.locale,
    collection: values.collection,
    threshold: values.threshold ? (isNaN(parseInt(values.threshold, 10)) ? undefined : parseInt(values.threshold, 10)) : undefined,
    maxPosts: values["max-posts"] ? (isNaN(parseInt(values["max-posts"] as string, 10)) ? undefined : parseInt(values["max-posts"] as string, 10)) : undefined,
    competitor: values.competitor,
    keywords: values.keywords,
    url: values.url,
    prompt: values.prompt,
    to: values.to,
    baselineDate: values["baseline-date"],
    count: values.count ? parseInt(values.count, 10) || undefined : undefined,
    confirmSend: values["confirm-send"],
    edition: values.edition,
    subject: values.subject,
    htmlFile: values["html-file"],
  };

  if (values.help || !options.feature) {
    showHelp();
    return;
  }

  console.log(`\n🚀 Multi-Family USA Automation\n`);
  console.log(`Feature: ${options.feature}`);
  console.log(`Mode: ${options.mode || "default"}`);
  if (options.dryRun) console.log(`⚠️  Dry run - no changes will be saved`);
  console.log("");

  try {
    switch (options.feature) {
      case "linker-v4": {
        const { runLinkerV4 } = await import("./linker-v4/index");
        await runLinkerV4(options);
        break;
      }

      case "smart-cta": {
        const { runSmartCta } = await import("./smart-cta/index");
        await runSmartCta(options);
        break;
      }

      case "service-cta": {
        const { runServiceCta } = await import("./service-cta/index");
        await runServiceCta(options);
        break;
      }

      case "seo":
      case "newsletter":
      case "podcast":
      case "scheduler":
        console.error(
          `Feature "${options.feature}" is not ported to Multi-Family USA. Available: linker-v4, smart-cta, service-cta`
        );
        process.exit(1);
        break;

      default:
        console.error(`Unknown feature: ${options.feature}`);
        showHelp();
        process.exit(1);
    }

    console.log("\n✅ Done!\n");
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

// Run if called directly (tsx may pass scripts/automation or scripts/automation/index.ts)
const cliEntry = process.argv[1] ? path.resolve(process.argv[1]) : "";
const thisFile = path.resolve(fileURLToPath(import.meta.url));
const automationDir = path.dirname(thisFile);
if (cliEntry === thisFile || cliEntry === automationDir) {
  main();
}

// Note: main() is called conditionally above via import.meta.url check

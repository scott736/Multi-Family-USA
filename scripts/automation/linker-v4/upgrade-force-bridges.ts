#!/usr/bin/env npx tsx
// Upgrade legacy/filler force-bridge paragraphs to marked site-native bridges.
// Deterministic by default. With XAI_API_KEY, can rewrite via LLM (--use-api).
//
//   npx tsx scripts/automation/linker-v4/upgrade-force-bridges.ts
//   npx tsx scripts/automation/linker-v4/upgrade-force-bridges.ts --use-api --max 80

import fs from "fs/promises";
import { loadBlogAndCatalog } from "./intent-placement";
import { parseBody, extractRawFrontmatter } from "./parse";
import {
  LEGACY_FORCE_BRIDGE_PATTERNS,
  LINKER_SITE,
} from "./linker-site-config";
import { LlmClient } from "../shared/llm";
import { MODELS } from "../config";

function parseArgs(argv: string[]) {
  const maxIdx = argv.indexOf("--max");
  return {
    dryRun: argv.includes("--dry-run"),
    useApi: argv.includes("--use-api"),
    max: maxIdx >= 0 ? parseInt(argv[maxIdx + 1], 10) : 500,
  };
}

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/;

function extractLink(paragraph: string): { anchor: string; url: string } | null {
  const m = paragraph.match(LINK_RE);
  if (!m) return null;
  return { anchor: m[1], url: m[2] };
}

function isLegacyOrMarkedBridge(paragraph: string): boolean {
  if (paragraph.includes(LINKER_SITE.forceBridgeMarker)) return true;
  return LEGACY_FORCE_BRIDGE_PATTERNS.some((re) => {
    re.lastIndex = 0;
    return re.test(paragraph);
  });
}

async function llmRewrite(args: {
  client: LlmClient;
  sourceTitle: string;
  orphanTitle: string;
  url: string;
  contextBefore: string;
}): Promise<string | null> {
  const prompt = [
    `Rewrite ONE short bridge paragraph (1-2 sentences) for ${LINKER_SITE.brand}.`,
    "Include exactly one markdown link to the given URL.",
    "No CTAs, no hype, no 'click here', no 'exploring this further'.",
    "Sound natural in context.",
    "",
    `Source article: ${args.sourceTitle}`,
    `Context before: ${args.contextBefore.slice(0, 350)}`,
    `Destination title: ${args.orphanTitle}`,
    `Destination URL: ${args.url}`,
    "",
    "Return only the paragraph markdown.",
  ].join("\n");

  const response = await args.client.messages.create({
    model: MODELS.ANALYSIS,
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!text || !text.includes(args.url)) return null;
  if (text.includes(LINKER_SITE.forceBridgeMarker)) return text;
  return `${LINKER_SITE.forceBridgeMarker}\n${text}`;
}

async function main() {
  const { dryRun, useApi, max } = parseArgs(process.argv.slice(2));
  const { posts, catalog } = await loadBlogAndCatalog();
  const client = useApi && process.env.XAI_API_KEY ? new LlmClient() : null;

  let upgraded = 0;
  let scanned = 0;

  for (const post of posts) {
    if (upgraded >= max) break;
    const body = parseBody(post.rawContent);
    const blocks = body.split(/\n\n+/);
    let changed = false;

    for (let i = 0; i < blocks.length; i++) {
      if (upgraded >= max) break;
      const block = blocks[i]!;
      if (!isLegacyOrMarkedBridge(block)) continue;
      scanned++;

      const link = extractLink(block);
      if (!link) continue;

      const dest = catalog.find(
        (c) =>
          link.url.includes(c.url.replace(/\/$/, "")) ||
          c.url.replace(/\/$/, "") === link.url.replace(/\/$/, "")
      );

      let next: string | null = null;
      if (client) {
        try {
          next = await llmRewrite({
            client,
            sourceTitle: String(post.frontmatter.title || post.slug),
            orphanTitle: dest?.title || link.anchor,
            url: link.url.endsWith("/") ? link.url : `${link.url}/`,
            contextBefore: blocks[i - 1] || "",
          });
        } catch (err) {
          console.warn(`  LLM failed on ${post.slug}: ${(err as Error).message}`);
        }
      }

      if (!next) {
        next = LINKER_SITE.buildForceBridge({
          title: dest?.title || link.anchor,
          url: link.url,
          type: dest?.type || "post",
        });
      }

      // Avoid no-op rewrites of already-good marked bridges with same URL
      if (block.includes(LINKER_SITE.forceBridgeMarker) && block.includes(link.url) && !client) {
        // still refresh template if legacy phrasing remains inside
        const legacyHit = LEGACY_FORCE_BRIDGE_PATTERNS.some((re) => {
          re.lastIndex = 0;
          return re.test(block);
        });
        if (!legacyHit) continue;
      }

      console.log(
        `${dryRun ? "[dry] " : ""}upgrade ${post.slug} → ${link.url}`
      );
      blocks[i] = next;
      changed = true;
      upgraded++;
    }

    if (changed && !dryRun) {
      const newBody = blocks.join("\n\n");
      const fm = extractRawFrontmatter(post.rawContent);
      await fs.writeFile(post.filePath, fm + newBody, "utf-8");
      post.rawContent = fm + newBody;
    }
  }

  console.log(
    `\nScanned force/legacy bridges: ${scanned}; upgraded: ${upgraded}${client ? " (API)" : " (templates)"}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

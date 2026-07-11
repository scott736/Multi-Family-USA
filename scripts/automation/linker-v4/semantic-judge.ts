// ============================================
// Smart Linker v6 — LLM Semantic Judge (GHA only)
// ============================================
// Rejects links where the anchor would mislead the reader about the target page.

import fs from "fs/promises";
import path from "path";
import LlmClient from "../shared/llm";
import type { SuggestionFile, ValidatedLink } from "./types";
import { loadMergedCatalog, normalizeUrl } from "./catalog-utils";
import { parseBody } from "./parse";

const SUGGESTIONS_DIR = "src/data/linker-v4/suggestions";

interface JudgeVerdict {
  index: number;
  keep: boolean;
  reason: string;
}

interface JudgeOutput {
  verdicts: JudgeVerdict[];
  summary?: string;
}

export async function semanticJudgeSuggestionFile(
  client: LlmClient,
  modelId: string,
  slug: string,
  articleBody: string,
  articleTitle: string,
  verbose?: boolean
): Promise<boolean> {
  const suggestionPath = path.join(path.resolve(SUGGESTIONS_DIR), `${slug}.json`);

  let suggestionFile: SuggestionFile;
  try {
    suggestionFile = JSON.parse(await fs.readFile(suggestionPath, "utf-8"));
  } catch {
    return false;
  }

  const accepted = (suggestionFile.validated || []).filter((v) => v.passed);
  if (accepted.length === 0) return false;

  const { pages } = await loadMergedCatalog();
  const metaByUrl = new Map(
    pages.map((p) => [normalizeUrl(p.url), p])
  );

  const linkLines = accepted.map((v, i) => {
    const meta = metaByUrl.get(normalizeUrl(v.suggestion.targetUrl));
    return [
      `[${i}]`,
      `  anchor: "${v.suggestion.anchorText}"`,
      `  target: ${v.suggestion.targetUrl}`,
      `  target title: ${meta?.title || "unknown"}`,
      `  reader promise: ${(meta as { readerPromise?: string })?.readerPromise || v.suggestion.expectation}`,
      `  link when: ${((meta as { linkWhen?: string[] })?.linkWhen || []).join("; ") || "n/a"}`,
      `  financing concepts: ${((meta as { financingConcepts?: string[] })?.financingConcepts || []).join(", ") || "n/a"}`,
      `  topics excluded: ${((meta as { topicsExcluded?: string[] })?.topicsExcluded || []).join(", ") || "n/a"}`,
      `  questions answered: ${((meta as { questionsAnswered?: string[] })?.questionsAnswered || []).join("; ") || "n/a"}`,
      `  do not link when: ${((meta as { doNotLinkWhen?: string[] })?.doNotLinkWhen || []).join("; ") || "n/a"}`,
    ].join("\n");
  });

  const prompt = [
    "You are a semantic quality judge for internal links on a mortgage/real estate site.",
    "For each candidate link, decide if clicking the anchor text would deliver what the reader expects from the target page.",
    "",
    "REJECT when:",
    "- Anchor is a data point (unit count, dollar amount, percentage) not a financing topic",
    "- Target is wrong asset class (e.g. residential mortgage page for mixed-use case study)",
    "- Anchor is a mid-clause fragment (e.g. \"the mortgage and\", \"a property financed at\", \"the time and\")",
    "- Anchor starts or ends with function words (the, and, with, for, to, in, at)",
    "- Anchor has fewer than 5 words or does not describe what the reader will learn",
    "- Reader would be surprised or misled by the destination",
    "- Target answers a different question than the anchor implies (e.g. mortgage limits → force appreciation)",
    "- Residential rate discussion links to commercial-only page, or self-storage links to general development guide",
    "",
    `Article: ${articleTitle}`,
    `Excerpt: ${articleBody.slice(0, 1200)}`,
    "",
    "Candidate links:",
    linkLines.join("\n\n"),
    "",
    "Return a verdict for EVERY index using the judge_links tool.",
  ].join("\n");

  let output: JudgeOutput | null = null;

  try {
    const response = await client.messages.create({
      model: modelId,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          name: "judge_links",
          description: "Semantic keep/reject verdict for each link candidate.",
          input_schema: {
            type: "object" as const,
            properties: {
              verdicts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "number" },
                    keep: { type: "boolean" },
                    reason: { type: "string" },
                  },
                  required: ["index", "keep", "reason"],
                },
              },
              summary: { type: "string" },
            },
            required: ["verdicts"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "judge_links" },
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (toolUse && toolUse.type === "tool_use") {
      output = toolUse.input as JudgeOutput;
    }
  } catch (err) {
    console.warn(
      `  Semantic judge failed for ${slug}: ${err instanceof Error ? err.message : String(err)}`
    );
    return false;
  }

  if (!output?.verdicts?.length) return false;

  const rejectMap = new Map(
    output.verdicts.filter((v) => !v.keep).map((v) => [v.index, v.reason])
  );

  if (rejectMap.size === 0) {
    if (verbose) console.log(`  Judge ${slug}: all ${accepted.length} links kept`);
    return false;
  }

  const validated: ValidatedLink[] = [];
  let acceptedIdx = 0;
  for (const v of suggestionFile.validated || []) {
    if (!v.passed) {
      validated.push(v);
      continue;
    }
    const reason = rejectMap.get(acceptedIdx);
    acceptedIdx++;
    if (reason) {
      validated.push({
        ...v,
        passed: false,
        rejectionReason: `semantic-judge: ${reason}`,
      });
    } else {
      validated.push(v);
    }
  }

  suggestionFile.validated = validated;
  await fs.writeFile(suggestionPath, JSON.stringify(suggestionFile, null, 2));

  console.log(
    `  Judge ${slug}: rejected ${rejectMap.size}/${accepted.length}${output.summary ? ` — ${output.summary}` : ""}`
  );
  return true;
}

export async function semanticJudgeAll(options: {
  slug?: string;
  model?: string;
  verbose?: boolean;
  allowLocal?: boolean;
}): Promise<void> {
  if (!process.env.XAI_API_KEY) {
    console.log("  Skipping semantic judge: XAI_API_KEY not set");
    return;
  }

  if (!process.env.GITHUB_ACTIONS && !options.allowLocal) {
    console.error("semantic-judge requires GITHUB_ACTIONS=true or allowLocal (relink --use-api).");
    return;
  }

  const client = new LlmClient();
  const modelMap: Record<string, string> = {
    haiku: "grok-4.5",
    sonnet: "grok-4.5",
    opus: "grok-4.5",
  };
  const modelId = modelMap[options.model || "haiku"] || modelMap.haiku;

  const { loadMarkdownFiles, BLOG_DIR } = await import("./parse");
  const posts = await loadMarkdownFiles(BLOG_DIR);
  const postMap = new Map(posts.map((p) => [p.slug, p]));

  const suggDir = path.resolve(SUGGESTIONS_DIR);
  let files = (await fs.readdir(suggDir)).filter((f) => f.endsWith(".json"));
  if (options.slug) {
    files = files.filter((f) => f === `${options.slug}.json`);
  }

  for (const file of files) {
    const slug = file.replace(/\.json$/, "");
    const article = postMap.get(slug);
    if (!article) continue;
    const body = parseBody(article.rawContent);
    const title = String(article.frontmatter.title || slug);
    await semanticJudgeSuggestionFile(client, modelId, slug, body, title, options.verbose);
  }
}

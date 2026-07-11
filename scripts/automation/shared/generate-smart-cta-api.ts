// ============================================
// Smart CTA — AI-Powered CTA Generation via xAI Grok API
// ============================================
// Calls Grok 4.5 to generate article-specific CTA sentences.
// Returns sentences with {link} placeholders, matching the
// format used by the template system in smart-cta.ts.
//
// Usage (standalone):
//   import { generateSmartCTAs } from "./generate-smart-cta-api";
//   const ctas = await generateSmartCTAs(articleBody, { title, category, ... });

import LlmClient from "./llm";
import { WRITING_STYLE_PROMPT, MODELS } from "../config";

// ----------------
// Types
// ----------------

export interface SmartCTAMetadata {
  title: string;
  category: string;
  topicCluster?: string;
  region?: string;
  tags?: string[];
}

interface CTAResult {
  ctas: Array<{
    sentence: string;
    reference: string;
  }>;
}

// ----------------
// Constants
// ----------------

const MODEL_ID = MODELS.UTILITY;
const MAX_TOKENS = 1024;

// ----------------
// Main Function
// ----------------

/**
 * Generate 1-2 article-specific CTA sentences using Grok 4.5 API.
 * Returns sentences with {link} placeholder for the booking URL.
 * Returns empty array on failure (caller should fall back to templates).
 *
 * @param articleContent - Full markdown body of the article
 * @param metadata - Article metadata for context
 * @param verbose - Whether to log errors and validation details
 */
export async function generateSmartCTAs(
  articleContent: string,
  metadata: SmartCTAMetadata,
  verbose?: boolean
): Promise<string[]> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    if (verbose) console.error("XAI_API_KEY not set — skipping AI CTA generation");
    return [];
  }

  const client = new LlmClient({ apiKey });
  const prompt = buildCTAPrompt(articleContent, metadata);

  try {
    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    });

    // Extract text from response
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      if (verbose) console.error("No text in LLM response");
      return [];
    }

    // Parse JSON from response — strip markdown code fences if present
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed: CTAResult = JSON.parse(jsonText);
    if (!parsed.ctas || !Array.isArray(parsed.ctas)) {
      if (verbose) console.error("Invalid response structure — missing ctas array");
      return [];
    }

    // Filter: must contain {link} placeholder
    let ctas = parsed.ctas
      .filter((c) => c.sentence && c.sentence.includes("{link}"))
      .map((c) => c.sentence);

    // Validate word count (20-60 words per CTA)
    ctas = ctas.filter((cta) => {
      const wordCount = cta.split(/\s+/).length;
      if (wordCount < 20 || wordCount > 60) {
        if (verbose) console.warn(`  Rejected CTA (${wordCount} words, need 20-60): ${cta.slice(0, 80)}...`);
        return false;
      }
      return true;
    });

    // Check similarity: if both CTAs share >80% of words, drop the second
    if (ctas.length >= 2) {
      const words1 = new Set(ctas[0].toLowerCase().split(/\s+/));
      const words2 = new Set(ctas[1].toLowerCase().split(/\s+/));
      const overlap = [...words1].filter((w) => words2.has(w)).length;
      const similarity = overlap / Math.min(words1.size, words2.size);
      if (similarity > 0.8) {
        if (verbose) console.warn(`  Dropped second CTA (${Math.round(similarity * 100)}% word overlap)`);
        ctas = [ctas[0]];
      }
    }

    return ctas.slice(0, 2);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Smart CTA generation failed: ${message}`);
    return [];
  }
}

// ----------------
// Prompt Builder
// ----------------

export function buildCTAPrompt(
  articleContent: string,
  metadata: SmartCTAMetadata
): string {
  // Trim article to ~3000 words to keep costs down
  const words = articleContent.split(/\s+/);
  const trimmedContent =
    words.length > 3000 ? words.slice(0, 3000).join(" ") + "\n\n[...article continues]" : articleContent;

  const lines: string[] = [];

  lines.push(
    "You are a CTA copywriter for Multi-Family USA, a Canadian mortgage brokerage that specializes in helping real estate investors get financing."
  );
  lines.push("");
  lines.push("Your job: write 1-2 CTA sentences to be inserted mid-article in a blog post.");
  lines.push("Each sentence must persuade the reader to book a free strategy call, and must include a `{link}` placeholder where the booking link will go.");
  lines.push("");

  // Writing style
  lines.push("## Writing Style");
  lines.push(WRITING_STYLE_PROMPT.trim());
  lines.push("");

  // What makes a great CTA
  lines.push("## What Makes a Great Inline CTA");
  lines.push("- References a **specific concept, number, or strategy** from the article — NOT generic topic-level messaging");
  lines.push("- Feels like a natural next step the reader would think of themselves");
  lines.push("- Connects the article's content to the value of talking to a financing expert");
  lines.push("- Reads like editorial advice from a friend, not an advertisement");
  lines.push("- Uses 1-2 sentences max (aim for 25-45 words per CTA)");
  lines.push("");

  // Examples of good vs bad
  lines.push("## Examples");
  lines.push("");
  lines.push("**GOOD** (specific to article about the 70% rule in flipping):");
  lines.push('> Now that you know how the 70% rule protects your flip margins, the next step is lining up your financing — {link} and we\'ll help you structure the purchase and refinance so the numbers actually work.');
  lines.push("");
  lines.push("**GOOD** (specific to article about debt ratios):");
  lines.push('> Your GDS and TDS ratios directly determine how much you can borrow — {link} and we\'ll show you exactly where your ratios stand and which lenders work best for your profile.');
  lines.push("");
  lines.push("**BAD** (generic, could apply to any article):");
  lines.push('> Getting your financing strategy right is important — {link} to learn more about your options.');
  lines.push("");
  lines.push("**BAD** (too salesy):");
  lines.push('> Don\'t wait — {link} today before rates go up!');
  lines.push("");

  // Article context
  lines.push("## Article Details");
  lines.push(`Title: ${metadata.title}`);
  lines.push(`Category: ${metadata.category}`);
  if (metadata.topicCluster) lines.push(`Topic Cluster: ${metadata.topicCluster}`);
  if (metadata.region) lines.push(`Region: ${metadata.region}`);
  if (metadata.tags?.length) lines.push(`Tags: ${metadata.tags.join(", ")}`);
  lines.push("");

  // Full article
  lines.push("## Article Content");
  lines.push("");
  lines.push(trimmedContent);
  lines.push("");

  // Instructions
  lines.push("## Instructions");
  lines.push("Generate exactly 2 CTA sentences for this article. Each must:");
  lines.push("1. Reference a specific concept from this article (not a generic topic)");
  lines.push("2. Include `{link}` exactly once where the booking link goes");
  lines.push("3. Connect the article concept to why talking to a mortgage expert helps");
  lines.push("4. Sound conversational and direct — like advice from a knowledgeable friend");
  lines.push("5. Be 25-45 words long");
  lines.push("");
  lines.push("The two CTAs should reference DIFFERENT parts/concepts of the article so they work well placed in separate sections.");
  lines.push("");
  lines.push('Return ONLY a JSON object with this exact structure (no markdown fences, no explanation):');
  lines.push('{ "ctas": [{ "sentence": "...", "reference": "concept from article this CTA references" }] }');

  return lines.join("\n");
}

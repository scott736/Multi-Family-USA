#!/usr/bin/env node
// Generate photorealistic hero images for DSCR Authority articles via Leonardo API.
// Usage:
//   LEONARDO_API_KEY=... node scripts/generate-article-images.mjs [--only=states/alabama] [--limit=1] [--collection=states]
//   node scripts/generate-article-images.mjs --dry-run

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "src/content");
const OUT_DIR = path.join(ROOT, "public/images/articles");

const LEONARDO_API_KEY = process.env.LEONARDO_API_KEY;
const LEONARDO_GENERATE_URL = "https://cloud.leonardo.ai/api/rest/v2/generations";
const LEONARDO_STATUS_URL = "https://cloud.leonardo.ai/api/rest/v1/generations";

const MODEL = "gpt-image-1.5";
const WIDTH = 1536;
const HEIGHT = 1024;
const MODE = "QUALITY";
const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 40;

const COLLECTIONS = [
  "guides",
  "loan-types",
  "states",
  "comparisons",
  "investor-profiles",
  "property-types",
];

const args = parseArgs();

function parseArgs() {
  const out = { only: null, limit: Infinity, collection: null, dryRun: false, force: false, concurrency: 8 };
  for (const a of process.argv.slice(2)) {
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--force") out.force = true;
    else if (a.startsWith("--only=")) out.only = a.slice(7);
    else if (a.startsWith("--limit=")) out.limit = Number(a.slice(8));
    else if (a.startsWith("--collection=")) out.collection = a.slice(13);
    else if (a.startsWith("--concurrency=")) out.concurrency = Math.max(1, Number(a.slice(14)));
  }
  return out;
}

const STOP_WORDS = new Set((
  "about above after again against all also an and another any are around as at be been before " +
  "being below between both but by can could did do does doing down during each either every few " +
  "for from further had has have having her here hers herself him himself his how i in into is it " +
  "its itself just like me more most my never no nor not now of off on once only or other our out " +
  "over own same she should so some such than that the their them themselves then there these they " +
  "this those through to too under until up us very was we were what when where which while who " +
  "whom why will with within without would you your yourself"
).split(/\s+/));

function stripFrontmatterAndMarkdown(raw) {
  let body = raw;
  if (body.startsWith("---")) {
    const end = body.indexOf("\n---", 3);
    if (end !== -1) body = body.slice(end + 4);
  }
  return body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[*_~`>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFrontmatter(raw) {
  if (!raw.startsWith("---")) return {};
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return {};
  const fm = raw.slice(3, end);
  const result = {};
  for (const line of fm.split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (m) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (v) result[m[1]] = v;
    }
  }
  return result;
}

function sentences(text) {
  return (text.match(/[^.!?]+[.!?]?/g) || [])
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);
}

function keywords(text, limit = 12) {
  const counts = new Map();
  for (const w of (text.toLowerCase().match(/[a-z][a-z0-9']{3,}/g) || [])) {
    if (STOP_WORDS.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([w]) => w);
}

function summarize(title, body) {
  const clean = stripFrontmatterAndMarkdown(body);
  const lines = sentences(clean);
  if (lines.length === 0) return "";
  const titleWords = new Set((title.toLowerCase().match(/[a-z][a-z0-9']{3,}/g) || []));
  const counts = new Map();
  for (const w of (clean.toLowerCase().match(/[a-z][a-z0-9']{3,}/g) || [])) {
    if (STOP_WORDS.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  const scored = lines.map((s, i) => {
    const words = new Set((s.toLowerCase().match(/[a-z][a-z0-9']{3,}/g) || []));
    let score = 1;
    for (const w of words) {
      if (STOP_WORDS.has(w)) continue;
      if (titleWords.has(w)) score += 3;
      const f = counts.get(w);
      if (f) score += Math.min(3, Math.log2(f + 1));
    }
    score += 1.2 - Math.abs(i / Math.max(1, lines.length) - 0.35);
    const n = s.split(/\s+/).length;
    if (n > 34) score *= 0.85;
    if (n < 10) score *= 0.5;
    return { s, score };
  });
  const picked = scored.sort((a, b) => b.score - a.score).slice(0, 3).map((x) => x.s).join(" ");
  const words = picked.split(/\s+/);
  return words.length > 90 ? words.slice(0, 90).join(" ") + "..." : picked;
}

function collectionStyleHint(collection, fm) {
  switch (collection) {
    case "states":
      return `U.S. real estate scene in ${fm.stateName || "the state"}, iconic local architecture and skyline cues, professional realtor-grade exterior photography of single-family rental homes or small multifamily buildings, warm golden-hour natural sunlight, clear blue sky, lush landscaping, residential investment property aesthetic`;
    case "loan-types":
      return "modern financial services photography, professional real estate investor reviewing loan documents at a sleek wooden desk, laptop showing charts, natural window light, upscale office environment, subtle depth-of-field, confident businesslike mood";
    case "property-types":
      return "editorial architectural photography of the specific property type, exterior three-quarter view, flattering late-afternoon sun, well-kept landscaping, realistic neighborhood context, suburban or urban investment property aesthetic";
    case "comparisons":
      return "conceptual split-composition real estate photography, two contrasting investment scenarios side by side, clean editorial framing, premium real estate magazine quality";
    case "investor-profiles":
      return "lifestyle business portrait photography of a confident real estate investor in a modern setting, candid authentic expression, natural office or home-office light, real estate portfolio documents and a laptop visible, premium editorial look";
    case "guides":
    default:
      return "clean premium editorial real estate finance photography, professional investor and rental property theme, bright natural light, polished magazine aesthetic, subtle depth-of-field";
  }
}

function buildPrompt(title, collection, fm, body) {
  const summary = summarize(title, body);
  const kw = keywords(body, 6).join(", ");
  const style = collectionStyleHint(collection, fm);

  const shortSummary = summary ? summary.split(/\s+/).slice(0, 45).join(" ") : "";

  const parts = [
    `Photorealistic editorial real estate photograph. Subject: ${title}.`,
    `Scene: ${style}.`,
    shortSummary ? `Context: ${shortSummary}` : "",
    kw ? `Visual hints: ${kw}.` : "",
    "Shot on full-frame DSLR, 35mm lens, natural cinematic light, lifelike colors, tack-sharp, shallow depth of field, 3:2 landscape.",
    "No text, no logos, no watermarks. Real photograph, not illustration.",
  ].filter(Boolean);

  let prompt = parts.join(" ");
  if (prompt.length > 1450) prompt = prompt.slice(0, 1447) + "...";
  return prompt;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function createGeneration(prompt) {
  const payload = {
    public: false,
    model: MODEL,
    parameters: {
      mode: MODE,
      prompt,
      prompt_enhance: "ON",
      quantity: 1,
      width: WIDTH,
      height: HEIGHT,
      seed: Math.floor(Math.random() * 4294967296),
    },
  };
  const res = await fetch(LEONARDO_GENERATE_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${LEONARDO_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Leonardo create failed (${res.status}): ${bodyText}`);
  }
  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new Error(`Leonardo create returned non-JSON: ${bodyText.slice(0, 400)}`);
  }
  if (process.env.DEBUG_LEONARDO) {
    console.log("  [debug] prompt length:", prompt.length);
    console.log("  [debug] response:", bodyText.slice(0, 400));
  }
  const id =
    data?.generate?.generationId ||
    data?.sdGenerationJob?.generationId ||
    data?.generationId ||
    data?.id;
  if (!id) throw new Error(`Leonardo create returned no id: ${JSON.stringify(data)}`);
  return id;
}

async function waitForGeneration(id) {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const res = await fetch(`${LEONARDO_STATUS_URL}/${id}`, {
      headers: { accept: "application/json", authorization: `Bearer ${LEONARDO_API_KEY}` },
    });
    if (!res.ok) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    const data = await res.json();
    const status = (data?.generations_by_pk?.status || "").toUpperCase();
    const imgs = data?.generations_by_pk?.generated_images || [];
    if (imgs[0]?.url) return imgs[0].url;
    if (status === "FAILED") throw new Error(`Leonardo generation FAILED for ${id}`);
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Timed out polling Leonardo generation ${id}`);
}

async function downloadTo(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, buf);
}

async function listArticles() {
  const items = [];
  const collections = args.collection ? [args.collection] : COLLECTIONS;
  for (const col of collections) {
    const dir = path.join(CONTENT_DIR, col);
    let names;
    try {
      names = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.endsWith(".mdx")) continue;
      const slug = name.replace(/\.mdx$/, "");
      items.push({ collection: col, slug, filePath: path.join(dir, name) });
    }
  }
  return items.sort((a, b) => (a.collection + a.slug).localeCompare(b.collection + b.slug));
}

async function alreadyExists(collection, slug) {
  const p = path.join(OUT_DIR, collection, `${slug}.jpg`);
  try {
    await fs.access(p);
    return p;
  } catch {
    return null;
  }
}

async function main() {
  if (!LEONARDO_API_KEY && !args.dryRun) {
    console.error("LEONARDO_API_KEY is required");
    process.exit(1);
  }

  const all = await listArticles();
  const targets = args.only ? all.filter((a) => `${a.collection}/${a.slug}` === args.only) : all;
  if (targets.length === 0) {
    console.error("No articles matched.");
    process.exit(1);
  }

  console.log(`Target articles: ${targets.length} (collection filter: ${args.collection || "all"}, concurrency: ${args.concurrency})`);

  const queue = [];
  let skipped = 0;
  for (const a of targets) {
    const existing = !args.force && (await alreadyExists(a.collection, a.slug));
    if (existing) {
      console.log(`[skip] ${a.collection}/${a.slug}`);
      skipped++;
      continue;
    }
    queue.push(a);
  }

  const total = Math.min(queue.length, args.limit);
  const slice = queue.slice(0, total);
  console.log(`To generate: ${slice.length}  Already existed: ${skipped}`);

  let done = 0;
  let failed = 0;
  const failures = [];
  let cursor = 0;

  async function worker(workerId) {
    while (true) {
      const i = cursor++;
      if (i >= slice.length) return;
      const a = slice[i];

      const raw = await fs.readFile(a.filePath, "utf-8");
      const fm = parseFrontmatter(raw);
      const title = fm.title || fm.h1 || a.slug.replace(/-/g, " ");
      const prompt = buildPrompt(title, a.collection, fm, raw);
      const outPath = path.join(OUT_DIR, a.collection, `${a.slug}.jpg`);

      const tag = `[w${workerId} ${i + 1}/${slice.length}]`;
      console.log(`${tag} start ${a.collection}/${a.slug} :: ${title.slice(0, 80)}`);

      if (args.dryRun) {
        console.log(`${tag} [dry-run] ${path.relative(ROOT, outPath)}`);
        done++;
        continue;
      }

      try {
        const id = await createGeneration(prompt);
        const url = await waitForGeneration(id);
        await downloadTo(url, outPath);
        done++;
        console.log(`${tag} DONE ${a.collection}/${a.slug} -> ${path.relative(ROOT, outPath)}  (total saved: ${done})`);
      } catch (e) {
        failed++;
        failures.push({ slug: `${a.collection}/${a.slug}`, error: e.message });
        console.error(`${tag} ERROR ${a.collection}/${a.slug}: ${e.message}`);
      }
    }
  }

  const workers = Array.from({ length: args.concurrency }, (_, i) => worker(i + 1));
  await Promise.all(workers);

  console.log(`\n---`);
  console.log(`Generated: ${done}  Skipped: ${skipped}  Failed: ${failed}`);
  if (failures.length) {
    console.log(`Failures:`);
    for (const f of failures) console.log(`  - ${f.slug}: ${f.error}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
// Convert generated JPGs in public/images/articles/ to WebP and move them into
// src/assets/articles/ so Astro's content-collection image() + <Image> pipeline
// (and Vercel's image service) can optimize them.

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "public/images/articles");
const DEST_DIR = path.join(ROOT, "src/assets/articles");

const QUALITY = 82;
const MAX_WIDTH = 1600;

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else yield full;
  }
}

async function main() {
  let converted = 0;
  let skipped = 0;
  const failures = [];

  for await (const file of walk(SRC_DIR)) {
    if (!/\.(jpe?g|png)$/i.test(file)) continue;
    const rel = path.relative(SRC_DIR, file);
    const destRel = rel.replace(/\.(jpe?g|png)$/i, ".webp");
    const destPath = path.join(DEST_DIR, destRel);
    try {
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await sharp(file)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY, effort: 5 })
        .toFile(destPath);
      await fs.unlink(file);
      converted++;
      console.log(`ok  ${rel} -> ${path.relative(ROOT, destPath)}`);
    } catch (e) {
      failures.push({ file: rel, error: e.message });
      console.error(`ERR ${rel}: ${e.message}`);
    }
  }

  try {
    for await (const f of walk(SRC_DIR)) {
      if (f) { /* still has files */ }
    }
    const rem = [];
    for await (const f of walk(SRC_DIR)) rem.push(f);
    if (rem.length === 0) {
      await fs.rm(SRC_DIR, { recursive: true, force: true });
      console.log(`\nCleaned up empty public/images/articles/`);
    }
  } catch {}

  console.log(`\nConverted: ${converted}  Skipped: ${skipped}  Failed: ${failures.length}`);
  if (failures.length) for (const f of failures) console.log(`  - ${f.file}: ${f.error}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

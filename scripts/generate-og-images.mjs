// Generates category OG images (1200×630) for social sharing.
// Run with: node scripts/generate-og-images.mjs
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(ROOT, "public/og");

const NAVY = "#0F2544";
const ACCENT = "#C9A227";
const WHITE = "#FFFFFF";
const MUTED = "#94A3B8";

/** @type {{ file: string; kicker: string; title: string; subtitle: string }[]} */
const CATEGORIES = [
  {
    file: "learn.png",
    kicker: "Learn",
    title: "Multifamily Financing Guides",
    subtitle: "Underwriting, capital markets & execution",
  },
  {
    file: "states.png",
    kicker: "Markets",
    title: "State Market Guides",
    subtitle: "51-state multifamily financing overviews",
  },
  {
    file: "cities.png",
    kicker: "Markets",
    title: "City Market Guides",
    subtitle: "Local multifamily financing snapshots",
  },
  {
    file: "tools.png",
    kicker: "Tools",
    title: "Underwriting Calculators",
    subtitle: "NOI, DSCR, cap rate & loan sizing",
  },
];

/**
 * @param {{ kicker: string; title: string; subtitle: string }} opts
 */
function buildSvg({ kicker, title, subtitle }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${NAVY}"/>
      <stop offset="100%" stop-color="#1a3a5c"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="6" fill="${ACCENT}"/>
  <text x="80" y="120" fill="${ACCENT}" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" letter-spacing="0.12em">${kicker.toUpperCase()}</text>
  <text x="80" y="220" fill="${WHITE}" font-family="system-ui, -apple-system, sans-serif" font-size="56" font-weight="700">${escapeXml(title)}</text>
  <text x="80" y="290" fill="${MUTED}" font-family="system-ui, -apple-system, sans-serif" font-size="32">${escapeXml(subtitle)}</text>
  <text x="80" y="560" fill="${WHITE}" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="600">Multi-Family USA</text>
  <text x="80" y="600" fill="${MUTED}" font-family="system-ui, -apple-system, sans-serif" font-size="22">multifamily-usa.com</text>
</svg>`;
}

/** @param {string} text */
function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  for (const category of CATEGORIES) {
    const svg = buildSvg(category);
    const outPath = resolve(OUT_DIR, category.file);
    await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(outPath);
    console.log(`wrote ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Regenerates favicon PNGs and email logo PNG from the source SVGs.
// Run with: node scripts/generate-brand-assets.mjs
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const faviconSvgPath = resolve(ROOT, "public/favicon/favicon.svg");
const emailLogoSvgPath = resolve(ROOT, "public/images/layout/logo.svg");

async function renderPng(svgPath, outPath, size) {
  const svg = await readFile(svgPath);
  const opts = typeof size === "number" ? { width: size, height: size } : size;
  await sharp(svg, { density: 384 }).resize(opts).png({ compressionLevel: 9 }).toFile(outPath);
  console.log(`wrote ${outPath}`);
}

// Minimal PNG-in-ICO packer: wraps a PNG as a single-entry .ico (modern browsers accept this).
async function writeIco(pngBuffers, outPath) {
  // ICONDIR: 6 bytes — reserved(2) type(2) count(2)
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = [];
  let offset = 6 + 16 * count;
  for (const { buf, size } of pngBuffers) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // color count
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bit count
    e.writeUInt32LE(buf.length, 8); // bytes in res
    e.writeUInt32LE(offset, 12); // image offset
    offset += buf.length;
    entries.push(e);
  }

  const out = Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.buf)]);
  await writeFile(outPath, out);
  console.log(`wrote ${outPath}`);
}

async function pngBufferFromSvg(svgPath, size) {
  const svg = await readFile(svgPath);
  return sharp(svg, { density: 384 })
    .resize({ width: size, height: size })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  // Favicon raster variants
  await renderPng(faviconSvgPath, resolve(ROOT, "public/favicon/favicon-96x96.png"), 96);
  await renderPng(faviconSvgPath, resolve(ROOT, "public/favicon/apple-touch-icon.png"), 180);
  await renderPng(faviconSvgPath, resolve(ROOT, "public/favicon/web-app-manifest-192x192.png"), 192);
  await renderPng(faviconSvgPath, resolve(ROOT, "public/favicon/web-app-manifest-512x512.png"), 512);

  // favicon.ico — multi-size (16, 32, 48)
  const ico16 = await pngBufferFromSvg(faviconSvgPath, 16);
  const ico32 = await pngBufferFromSvg(faviconSvgPath, 32);
  const ico48 = await pngBufferFromSvg(faviconSvgPath, 48);
  await writeIco(
    [
      { buf: ico16, size: 16 },
      { buf: ico32, size: 32 },
      { buf: ico48, size: 48 },
    ],
    resolve(ROOT, "public/favicon/favicon.ico"),
  );

  // Email logo PNG — wide wordmark, rendered at ~3x for retina email clients
  await renderPng(
    emailLogoSvgPath,
    resolve(ROOT, "public/images/layout/logo.png"),
    { width: 680, height: 256, fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } },
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

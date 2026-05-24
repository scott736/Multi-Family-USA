/**
 * Sync legal/tax/market metadata from dscr-loans state MDX into Multi-Family-USA.
 */
import fs from "node:fs";
import path from "node:path";

const DSCR_DIR = path.resolve("../dscr-loans/src/content/states");
const MF_DIR = path.resolve("src/content/states");
const ES_DIR = path.resolve("src/content/es-states");

const CITY_ANCHORS = {
  texas: { avgCapRate: 5.4, avgPricePerUnit: 152000 },
  florida: { avgCapRate: 4.9, avgPricePerUnit: 198000 },
  arizona: { avgCapRate: 5.0, avgPricePerUnit: 188000 },
  georgia: { avgCapRate: 5.2, avgPricePerUnit: 164000 },
  "north-carolina": { avgCapRate: 5.3, avgPricePerUnit: 171000 },
};

function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = {};
  const lines = m[1].split("\n");
  let key = null;
  let arr = null;
  for (const line of lines) {
    const kv = line.match(/^(\w+): (.+)$/);
    if (kv) {
      key = kv[1];
      arr = null;
      let val = kv[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      fm[key] = val;
    } else if (line.match(/^(\w+):$/)) {
      key = RegExp.$1;
      arr = [];
      fm[key] = arr;
    } else if (arr && line.match(/^  - "?(.+?)"?$/)) {
      arr.push(RegExp.$1);
    }
  }
  return { fm, frontmatter: m[0], body: content.slice(m[0].length) };
}

function formatPrice(n) {
  return n.toLocaleString("en-US");
}

function foreclosureLabel(type) {
  if (type === "mixed") return "mixed (judicial and non-judicial)";
  return type;
}

function buildLegalParagraph(stateName, d) {
  const taxRate =
    d.statePropertyTax != null
      ? `with an effective property-tax rate near ${Number(d.statePropertyTax).toFixed(2)}%`
      : null;
  const eviction = d.evictionTimelineDays ? `typical eviction timelines of ${d.evictionTimelineDays}` : null;
  const rent =
    d.rentControl === "true" || d.rentControl === true
      ? "and statewide or local rent-control rules that may apply"
      : "and no statewide rent control";
  const mid = [taxRate, eviction, rent].filter(Boolean).join(", ");
  const income =
    d.hasStateIncomeTax === "true" || d.hasStateIncomeTax === true
      ? `${stateName} has a state income tax. `
      : `${stateName} does not have a state income tax. `;
  return `From an execution standpoint, ${stateName} is generally viewed as a ${foreclosureLabel(d.foreclosureType)} foreclosure state${mid ? `, ${mid}` : ""}. ${income}These factors can influence lender risk assessment, legal diligence scope, and sponsor-level cash-flow planning.`;
}

function patchFrontmatter(fmBlock, d, slug, mfFm) {
  let inner = fmBlock.replace(/^---\n|\n---$/g, "");
  // Remove any previously appended legal fields (re-sync safe)
  inner = inner.replace(/\nstatePropertyTax:.*$/m, "");
  inner = inner.replace(/\nevictionTimelineDays:.*$/m, "");
  inner = inner.replace(/\nrentControl:.*$/m, "");
  inner = inner.replace(/\nprohibitsPpp1to4Unit:.*$/m, "");

  const anchor = CITY_ANCHORS[slug];
  const avgCapRate = anchor ? anchor.avgCapRate : Number(mfFm.avgCapRate);
  const avgPricePerUnit = anchor ? anchor.avgPricePerUnit : Number(mfFm.avgPricePerUnit);

  const setScalar = (key, val) => {
    const re = new RegExp(`^${key}: .*$`, "m");
    inner = re.test(inner) ? inner.replace(re, `${key}: ${val}`) : inner;
  };

  setScalar("tier", `'${d.tier}'`);
  setScalar("avgCapRate", avgCapRate);
  setScalar("avgPricePerUnit", avgPricePerUnit);
  setScalar("hasStateIncomeTax", d.hasStateIncomeTax);
  setScalar("foreclosureType", d.foreclosureType);

  const markets = (d.topMarkets || []).map((m) => `- ${m}`).join("\n");
  inner = inner.replace(/topMarkets:\n(?:- .+\n)+/, `topMarkets:\n${markets}\n`);

  const legalBlock = [
    `statePropertyTax: ${d.statePropertyTax}`,
    `evictionTimelineDays: ${d.evictionTimelineDays}`,
    `rentControl: ${d.rentControl}`,
    `prohibitsPpp1to4Unit: ${d.prohibitsPpp1to4Unit ?? false}`,
  ].join("\n");

  inner = inner.replace(
    /^avgPricePerUnit: .+$/m,
    (line) => `${line}\n${legalBlock}`,
  );

  return { fm: `---\n${inner}\n---`, avgCapRate, avgPricePerUnit };
}

function updateBody(body, stateName, d, avgCapRate, avgPricePerUnit) {
  const topList = (d.topMarkets || []).slice(0, 3).join(", ");
  let out = body;
  const esc = stateName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  out = out.replace(
    new RegExp(
      `A practical underwriting starting point for ${esc} is an average cap-rate context near [\\d.]+% and average pricing near \\$[\\d,]+ per unit, with transaction outcomes still heavily dependent on property condition, occupancy durability, and local demand drivers(?:\\. These statewide figures are directional and should be refined with current comp evidence for your specific submarket\\.)?\\.`,
    ),
    `A practical underwriting starting point for ${stateName} is an average cap-rate context near ${avgCapRate}% and average pricing near $${formatPrice(avgPricePerUnit)} per unit, with transaction outcomes still heavily dependent on property condition, occupancy durability, and local demand drivers. These statewide figures are directional and should be refined with current comp evidence for your specific submarket.`,
  );

  out = out.replace(
    new RegExp(`In ${esc}, operators often frame this by showing leasing momentum and tenant demand in areas such as [^.]+\\.`),
    `In ${stateName}, operators often frame this by showing leasing momentum and tenant demand in areas such as ${topList}.`,
  );

  out = out.replace(
    /From an execution standpoint, [^.]+\. (?:[^.]+\. )?These factors can influence lender risk assessment, legal diligence scope, and sponsor-level (?:cash-flow|return) planning\./,
    buildLegalParagraph(stateName, d),
  );

  return out;
}

function syncFile(mfPath, dscrPath, slug) {
  const raw = fs.readFileSync(mfPath, "utf8");
  const mf = parseFrontmatter(raw);
  const d = parseFrontmatter(fs.readFileSync(dscrPath, "utf8"));
  if (!mf || !d) throw new Error(`Parse failed: ${slug}`);

  const { fm: newFm, avgCapRate, avgPricePerUnit } = patchFrontmatter(mf.frontmatter, d.fm, slug, mf.fm);
  const newBody = updateBody(mf.body, d.fm.stateName, d.fm, avgCapRate, avgPricePerUnit);
  fs.writeFileSync(mfPath, `${newFm}\n${newBody}`);
  return { slug, anchor: !!CITY_ANCHORS[slug] };
}

function syncEsFrontmatterOnly(esPath, enPath) {
  const es = fs.readFileSync(esPath, "utf8");
  const en = fs.readFileSync(enPath, "utf8");
  const enFm = en.match(/^---\n([\s\S]*?)\n---/)?.[1];
  if (!enFm) return;

  const pull = (block, key) => block.match(new RegExp(`^${key}: (.+)$`, "m"))?.[1];
  const pullMarkets = (block) => {
    const m = block.match(/topMarkets:\n((?:- .+\n)+)/);
    return m ? m[1].trimEnd() : null;
  };

  let out = es;
  for (const key of [
    "tier",
    "avgCapRate",
    "avgPricePerUnit",
    "statePropertyTax",
    "hasStateIncomeTax",
    "foreclosureType",
    "evictionTimelineDays",
    "rentControl",
    "prohibitsPpp1to4Unit",
  ]) {
    const val = pull(enFm, key);
    if (val == null) continue;
    const re = new RegExp(`^${key}: .*$`, "m");
    if (re.test(out)) out = out.replace(re, `${key}: ${val}`);
    else out = out.replace(/^---\n/, `---\n${key}: ${val}\n`);
  }
  const markets = pullMarkets(enFm);
  if (markets) out = out.replace(/topMarkets:\n(?:- .+\n)+/, `topMarkets:\n${markets}\n`);

  fs.writeFileSync(esPath, out);
}

const updated = [];
for (const f of fs.readdirSync(MF_DIR).filter((x) => x.endsWith(".mdx")).sort()) {
  const slug = f.replace(".mdx", "");
  const dscrPath = path.join(DSCR_DIR, f);
  if (!fs.existsSync(dscrPath)) {
    console.warn("skip (no dscr source):", slug);
    continue;
  }
  updated.push(syncFile(path.join(MF_DIR, f), dscrPath, slug));
}

for (const f of fs.readdirSync(ES_DIR).filter((x) => x.endsWith(".mdx"))) {
  const slug = f.replace(".mdx", "");
  const enPath = path.join(MF_DIR, f);
  if (fs.existsSync(enPath)) syncEsFrontmatterOnly(path.join(ES_DIR, f), enPath);
}

console.log(`Synced ${updated.length} EN state files.`);
console.log(
  "City-anchored cap/price updates:",
  updated.filter((u) => u.anchor).map((u) => u.slug).join(", ") || "(none)",
);

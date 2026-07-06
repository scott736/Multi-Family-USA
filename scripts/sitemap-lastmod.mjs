// Builds pathname → ISO date map from MDX frontmatter for sitemap lastmod.
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

/** Keep in sync with SITE_LAST_REVIEWED in src/consts.ts */
export const SITE_LAST_REVIEWED = "2026-07-05";

/** @type {Record<string, (slug: string) => string>} */
const COLLECTION_ROUTES = {
  "src/content/guides": (slug) => `/learn/${slug}/`,
  "src/content/states": (slug) => `/states/${slug}/`,
  "src/content/cities": (slug) => `/cities/${slug}/`,
  "src/content/loan-types": (slug) => `/loan-types/${slug}/`,
  "src/content/property-types": (slug) => `/property-types/${slug}/`,
  "src/content/comparisons": (slug) => `/compare/${slug}/`,
  "src/content/investor-profiles": (slug) => `/invest/${slug}/`,
  "src/content/blog": (slug) => `/blog/${slug}/`,
  "src/content/es-guides": (slug) => `/es/learn/${slug}/`,
  "src/content/es-states": (slug) => `/es/states/${slug}/`,
  "src/content/es-cities": (slug) => `/es/cities/${slug}/`,
  "src/content/es-loan-types": (slug) => `/es/loan-types/${slug}/`,
  "src/content/es-property-types": (slug) => `/es/property-types/${slug}/`,
  "src/content/es-comparisons": (slug) => `/es/compare/${slug}/`,
  "src/content/es-investor-profiles": (slug) => `/es/invest/${slug}/`,
  "src/content/es-blog": (slug) => `/es/blog/${slug}/`,
};

/**
 * @param {string} content
 * @returns {string | null}
 */
function parseDateFromMdx(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yaml = match[1];
  const lastUpdated = yaml.match(/^lastUpdated:\s*(.+)$/m);
  const published = yaml.match(/^published:\s*(.+)$/m);
  const raw = (lastUpdated?.[1] ?? published?.[1])?.trim();
  if (!raw) return null;

  const normalized = raw.replace(/['"]/g, "");
  if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) return normalized.slice(0, 10);
  return null;
}

/**
 * @returns {Promise<Map<string, string>>}
 */
export async function buildSitemapLastmodMap() {
  /** @type {Map<string, string>} */
  const map = new Map();

  for (const [relativeDir, toPath] of Object.entries(COLLECTION_ROUTES)) {
    const dir = join(ROOT, relativeDir);
    let files;
    try {
      files = await readdir(dir);
    } catch {
      continue;
    }

    for (const file of files.filter((f) => f.endsWith(".mdx"))) {
      const content = await readFile(join(dir, file), "utf8");
      const date = parseDateFromMdx(content) ?? SITE_LAST_REVIEWED;
      const slug = file.replace(/\.mdx$/, "");
      map.set(toPath(slug), date);
    }
  }

  map.set("/", SITE_LAST_REVIEWED);
  return map;
}

/**
 * @param {Map<string, string>} map
 * @param {string} pathname
 * @returns {string}
 */
export function lookupLastmod(map, pathname) {
  const withSlash = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const withoutSlash = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return map.get(withSlash) ?? map.get(withoutSlash) ?? SITE_LAST_REVIEWED;
}

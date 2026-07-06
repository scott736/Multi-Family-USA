/**
 * Ping IndexNow after production builds so Bing and partners re-crawl updated URLs.
 * Runs in CI on main pushes when INDEXNOW_PING=1 (see .github/workflows/ci.yml).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const SITE_URL = "https://multifamily-usa.com";
const HOST = "multifamily-usa.com";
const KEY = "multifamilyusa7f3a9c2e8b4d6f1a5c9e2b7d4f8a1c3";
const KEY_LOCATION = `${SITE_URL}/${KEY}.txt`;
const SITEMAP_PATH = join(process.cwd(), "dist/client/sitemap-0.xml");
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

if (!process.env.CI && process.env.INDEXNOW_PING !== "1") {
  console.log("Skipping IndexNow ping (set INDEXNOW_PING=1 or run in CI).");
  process.exit(0);
}

if (!existsSync(SITEMAP_PATH)) {
  console.error(`Sitemap not found at ${SITEMAP_PATH}. Run npm run build first.`);
  process.exit(1);
}

const sitemap = readFileSync(SITEMAP_PATH, "utf8");
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

if (urlList.length === 0) {
  console.error("No URLs found in sitemap.");
  process.exit(1);
}

const body = {
  host: HOST,
  key: KEY,
  keyLocation: KEY_LOCATION,
  urlList: urlList.slice(0, 10_000),
};

const response = await fetch(INDEXNOW_ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});

if (!response.ok) {
  const text = await response.text();
  if (response.status === 403 && text.includes("SiteVerificationNotCompleted")) {
    console.warn(
      `IndexNow verification pending for ${KEY_LOCATION} — will succeed after production deploy propagates.`,
    );
    process.exit(0);
  }
  console.error(`IndexNow ping failed (${response.status}): ${text}`);
  process.exit(1);
}

console.log(`IndexNow ping OK — submitted ${body.urlList.length} URLs.`);

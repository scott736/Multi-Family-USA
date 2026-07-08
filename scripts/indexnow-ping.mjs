/**
 * Ping IndexNow after production builds so Bing and partners re-crawl updated URLs.
 * Runs in CI on main pushes when INDEXNOW_PING=1 (see .github/workflows/ci.yml).
 */
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { exitFail, exitOk, exitWarn } from "./cli.mjs";
import { INDEXNOW_KEY, SITE_URL } from "./site-config.mjs";

const SITEMAP_PATH = join(process.cwd(), "dist/client/sitemap-0.xml");
const KEY_PATH = join(process.cwd(), "public", `${INDEXNOW_KEY}.txt`);
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

async function loadIndexNowKey() {
  try {
    await access(KEY_PATH);
  } catch {
    exitFail(`IndexNow key file not found at ${KEY_PATH}.`);
  }

  const key = (await readFile(KEY_PATH, "utf8")).trim();
  if (key !== INDEXNOW_KEY) {
    exitFail("IndexNow key file content does not match INDEXNOW_KEY in site-config.mjs.");
  }

  return key;
}

async function main() {
  if (!process.env.CI && process.env.INDEXNOW_PING !== "1") {
    exitOk("Skipping IndexNow ping (set INDEXNOW_PING=1 or run in CI).");
  }

  try {
    await access(SITEMAP_PATH);
  } catch {
    exitFail(`Sitemap not found at ${SITEMAP_PATH}. Run npm run build first.`);
  }

  const key = await loadIndexNowKey();
  const keyLocation = `${SITE_URL}/${key}.txt`;
  const sitemap = await readFile(SITEMAP_PATH, "utf8");
  const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => match[1])
    .slice(0, 10_000);

  if (urlList.length === 0) {
    exitFail("No URLs found in sitemap.");
  }

  const body = {
    host: new URL(SITE_URL).hostname,
    key,
    keyLocation,
    urlList,
  };

  let response;
  try {
    response = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    exitFail(`IndexNow ping failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 403) {
      exitWarn(
        `IndexNow verification pending for ${keyLocation} — will succeed after production deploy propagates.`,
      );
    }
    exitFail(`IndexNow ping failed (${response.status}): ${text}`);
  }

  exitOk(`IndexNow ping OK — submitted ${body.urlList.length} URLs.`);
}

main().catch((error) => {
  exitFail(error instanceof Error ? error.message : String(error));
});

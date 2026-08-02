/**
 * Astro's Cloudflare handler short-circuits prerendered pages to ASSETS
 * before src/middleware.ts runs. Wrap the built worker entry so legacy
 * `?q=` SearchAction/template URLs 301 to the clean path first.
 */
import { existsSync, renameSync, writeFileSync } from "node:fs";

const entry = "dist/server/entry.mjs";
const inner = "dist/server/astro-entry.mjs";

if (!existsSync(entry)) {
  throw new Error(`Missing ${entry}; run astro build first`);
}

renameSync(entry, inner);
writeFileSync(
  entry,
  `import astro from "./astro-entry.mjs";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.searchParams.has("q")) {
      url.searchParams.delete("q");
      return Response.redirect(url.toString(), 301);
    }
    return astro.fetch(request, env, ctx);
  },
};
`,
);

console.log("Wrapped dist/server/entry.mjs with ?q= 301 redirect");

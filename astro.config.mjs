// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

import { buildSitemapLastmodMap, lookupLastmod } from "./scripts/sitemap-lastmod.mjs";
import { SITE_URL } from "./scripts/site-config.mjs";

const lastmodMap = await buildSitemapLastmodMap();

export default defineConfig({
  site: SITE_URL,
  trailingSlash: "always",
  compressHTML: true,
  prefetch: {
    defaultStrategy: "hover",
  },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) =>
        !page.includes("/api/") &&
        !page.includes("/404") &&
        !page.includes("/thank-you") &&
        !page.includes("/admin/") &&
        // Utility / printable pages — noindex or tokenized; exclude from crawl budget.
        !page.includes("/booking/") &&
        !page.includes("/downloads/"),
      i18n: {
        defaultLocale: "en",
        locales: {
          en: "en-US",
          es: "es-US",
        },
      },
      changefreq: "weekly",
      priority: 0.7,
      serialize(item) {
        const path = new URL(item.url).pathname;
        item.lastmod = lookupLastmod(lastmodMap, path);

        if (path === "/") {
          item.priority = 1;
          item.changefreq = "daily";
        } else if (path.startsWith("/tools/") || path === "/deal-review/") {
          item.priority = 0.9;
        } else if (
          ["/learn/", "/states/", "/cities/", "/compare/", "/invest/", "/loan-types/", "/property-types/"].some(
            (prefix) => path.startsWith(prefix),
          )
        ) {
          item.priority = 0.8;
        }
        return item;
      },
    }),
    react(),
  ],
  // Static by default; API routes opt into SSR via prerender = false.
  output: "static",
  adapter: cloudflare({
    imageService: "compile",
    platformProxy: {
      enabled: true,
    },
    prerenderEnvironment: "node",
  }),
  build: {
    concurrency: 4,
    inlineStylesheets: "auto",
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      sourcemap: false,
      rollupOptions: {
        external: ["/pagefind/pagefind.js"],
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) {
              return "react-vendor";
            }
            if (id.includes("node_modules/lucide-react")) {
              return "icons";
            }
            if (id.includes("node_modules/motion")) {
              return "motion";
            }
          },
        },
      },
    },
  },
});

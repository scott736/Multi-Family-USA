// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://multifamily-usa.com",
  integrations: [
    mdx(),
    sitemap({
      filter: (page) =>
        !page.includes("/api/") &&
        !page.includes("/404") &&
        !page.includes("/thank-you") &&
        !page.includes("/admin/"),
      changefreq: "weekly",
      priority: 0.7,
      serialize(item) {
        const path = new URL(item.url).pathname;
        if (path === "/") {
          item.priority = 1;
          item.changefreq = "daily";
        } else if (path.startsWith("/tools/") || path === "/deal-review/") {
          item.priority = 0.9;
        } else if (
          ["/learn/", "/states/", "/cities/", "/compare/", "/invest/", "/loan-types/", "/property-types/"].includes(path)
        ) {
          item.priority = 0.8;
        }
        return item;
      },
    }),
    react(),
  ],
  output: "static",
  adapter: vercel({
    maxDuration: 60,
  }),
  build: {
    // Vercel build machines expose 4 cores; parallelize static page generation.
    concurrency: 4,
  },
  vite: {
    plugins: [tailwindcss()],
    build: { sourcemap: false },
  },
});

import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

import { SITE_DESCRIPTION, SITE_URL } from "@/consts";
import { filterPublished } from "@/lib/scheduled-publish";

export async function GET() {
  const posts = filterPublished(await getCollection("esBlog")).sort((a, b) => {
    const ad = a.data.published ?? a.data.lastUpdated ?? new Date(0);
    const bd = b.data.published ?? b.data.lastUpdated ?? new Date(0);
    return new Date(bd).getTime() - new Date(ad).getTime();
  });

  return rss({
    title: "Multi-Family USA — Blog en español",
    description: `${SITE_DESCRIPTION} Contenido editorial en español para operadores multifamiliares comerciales en EE. UU.`,
    site: SITE_URL,
    customData: `<language>es-us</language>`,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.published ?? post.data.lastUpdated ?? new Date(),
      link: `/es/blog/${post.id.replace(/\.mdx$/, "")}/`,
    })),
  });
}

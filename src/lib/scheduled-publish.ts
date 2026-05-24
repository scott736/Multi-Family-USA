// Scheduled publishing for content collections.
//
// Posts whose `published` frontmatter date is in the future are excluded from
// listings, getStaticPaths, RSS, and sitemap. The site is rebuilt daily by
// .github/workflows/scheduled-publish.yml hitting a Vercel deploy hook, so
// each scheduled post goes live on the build that runs on or after its
// `published` date.

interface MaybePublishedEntry {
  data: {
    published?: Date | string;
  };
}

const PUBLISH_OVERRIDE = process.env.PUBLISH_PREVIEW_FUTURE === "1";

export function isPublished(entry: MaybePublishedEntry, now: Date = new Date()): boolean {
  if (PUBLISH_OVERRIDE) return true;
  const published = entry.data.published;
  if (!published) return true;
  const publishedAt = published instanceof Date ? published : new Date(published);
  if (Number.isNaN(publishedAt.getTime())) return true;
  return publishedAt.getTime() <= now.getTime();
}

export function filterPublished<T extends MaybePublishedEntry>(
  entries: T[],
  now: Date = new Date(),
): T[] {
  return entries.filter((entry) => isPublished(entry, now));
}

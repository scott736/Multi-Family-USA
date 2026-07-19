# Scheduled blog publishing

Blog posts in `src/content/blog/*.mdx` go live automatically based on their
`published:` frontmatter date. This document explains how it works.

## How it works

1. Each MDX file has a `published: YYYY-MM-DD` field in its frontmatter.
2. At Astro build time, `src/lib/scheduled-publish.ts` filters out any post
   whose `published` date is in the future. Filtered posts are excluded from:
   - `/blog/` index listing (`src/pages/blog/index.astro`)
   - `/blog/[slug]/` pages (`src/pages/blog/[slug].astro` getStaticPaths)
   - Sitemap (it only enumerates routes Astro generated)
   - RSS (downstream of the same data)
3. A daily GitHub Action (`.github/workflows/scheduled-publish.yml`) runs at
   12:05 UTC, checks whether any post has `published:` equal to today, and
   if so pushes a tiny empty commit to `main`. The Deploy Cloudflare
   workflow runs on every push to `main`, so the next build picks up the
   newly-eligible post.

**No deploy hook required beyond the existing Cloudflare deploy workflow
and `CLOUDFLARE_*` secrets.** The scheduled publish workflow uses the
default `GITHUB_TOKEN` with `contents: write` permission to push the
empty commit.

## Authoring a new scheduled post

```yaml
---
title: "..."
description: "..."
published: 2026-08-12          # the date you want it to go live
lastUpdated: 2026-08-12
author: "Chris Micucci"
category: "strategy"
---
```

If `published` is in the future, the post is checked into the repo but
invisible on the live site until the daily rebuild on that date.

## Previewing future posts locally

```bash
PUBLISH_PREVIEW_FUTURE=1 npm run dev
PUBLISH_PREVIEW_FUTURE=1 npm run build
```

The flag is checked in `src/lib/scheduled-publish.ts` and only bypasses the
filter when explicitly set.

## Editing the schedule

Move the `published` date forward or backward in frontmatter, commit, and
the next daily check (or any push-triggered build) will reflect the change.

## Triggering a rebuild manually

GitHub → **Actions → Scheduled blog publishing → Run workflow**. Optionally
set `force_publish: true` to push an empty commit even if no post is
scheduled for today (useful for verifying the wiring).

## Changing the cadence

Edit the `cron:` line in `.github/workflows/scheduled-publish.yml`. Daily
is the recommended floor — running less often risks a post sitting
un-published for a day or two past its date.

## Commit-history note

When a post is scheduled for today, the workflow pushes an empty commit
like:

> chore(blog): scheduled publish for 2026-05-12
>
> Posts going live: src/content/blog/dscr-mid-term-rentals.mdx

Across the 48-article schedule (2026-05-12 → 2026-09-30), this adds 48
extra commits to main over five months. They're easy to filter with
`git log --invert-grep --grep="scheduled publish"`.

If you ever want to eliminate even those commits, replace the workflow's
`Push empty commit` step with a manual trigger of the Deploy Cloudflare
workflow (`workflow_dispatch`) or a Cloudflare Deploy Hook URL stored as
a repo secret. The trade-off is one extra one-time setup step.

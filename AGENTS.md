# AGENTS.md

Guidance for AI agents working in this repository.

## Project overview

**Multi-Family USA** is a bilingual (English + Spanish) Astro 6 marketing site for US commercial multifamily financing. Content lives in `src/content/**` (MDX); pages in `src/pages/**`. React islands power underwriting calculators and scheduling UI.

Standard commands (see `package.json`):

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local dev server (default `http://localhost:4321`) |
| `npm run build` | Production build + Pagefind search index |
| `npm run preview` | Serve built site locally |
| `npm run lint` | ESLint |
| `npm run check` | Lint + build (matches CI) |

CI (`.github/workflows/ci.yml`) runs on Node **24** with `npm ci`, `npm run lint`, and `npm run build`.

## Cursor Cloud specific instructions

### Node.js version

`package.json` requires Node **24.x** (CI uses 24). `.nvmrc` still says `22` — prefer **24** to match CI.

Cloud VMs ship with `/exec-daemon/node` (v22) **earlier on `PATH` than nvm**. Before running npm scripts, activate Node 24 and prepend nvm to `PATH`:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 24 2>/dev/null || nvm install 24
export PATH="$NVM_DIR/versions/node/$(nvm version 24 | tr -d v)/bin:$PATH"
node -v   # should print v24.x
```

### Services

Only one local process is required for most development:

| Service | Command | URL |
|---------|---------|-----|
| Astro dev | `npm run dev` | `http://localhost:4321` |
| Prod preview + search | `npm run build && npm run preview` | `http://localhost:4321` |

Use **tmux** for long-running dev servers (see cloud agent tooling). No Docker or local database.

Optional hosted integrations (copy `.env.example` → `.env`): Supabase, Nylas, Elastic Email, Upstash Redis. Lead form and booking flows need these; browsing pages and calculators does not.

### Pagefind / site search

Pagefind is generated during `npm run build` into `dist/pagefind/`. Full-text search in the navbar works after **build + preview**, not in plain `npm run dev`.

In dev, `SiteSearch` may log a Vite warning when dynamically importing `/pagefind/pagefind.js` (file absent until build). This does not block calculator pages or static content; search simply stays unavailable until a build exists.

### Future-dated blog posts

Blog posts with future `published:` dates are hidden by default. Preview locally with:

```bash
PUBLISH_PREVIEW_FUTURE=1 npm run dev
```

See `.github/SCHEDULED_PUBLISHING.md`.

### Locale mirrors

When a change applies to both locales, update English and Spanish paths (`src/content/es-*`, `src/pages/es/**`).

### Verification checklist

For app/content changes: `npm run lint` and `npm run build`. Spot-check affected routes on the dev server. Calculators under `/tools/*` are a good smoke test for React hydration.

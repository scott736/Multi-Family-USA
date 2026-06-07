# AGENTS.md

## Cursor Cloud specific instructions

### Product

Single Astro 6 marketing site (**Multi-Family USA**) with English + Spanish content, client-side underwriting calculators, and Vercel serverless API routes (`/api/*`) for lead capture. See `package.json` scripts and `.github/workflows/ci.yml` for the canonical CI pipeline.

### Node.js version

- **Required:** Node **24.x** (`package.json` `engines` and CI). `.nvmrc` still says `22` — prefer `package.json`/CI.
- Cloud VMs ship `/exec-daemon/node` (v22) ahead of nvm on `PATH`. Before `npm` commands, activate Node 24:

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 24
export PATH="$(dirname "$(nvm which 24)"):$PATH"
node --version   # should print v24.x
```

### Dependencies

```bash
npm ci --prefer-offline --no-audit --no-fund
```

No Docker, Makefile, or shell bootstrap scripts in this repo.

### Run / verify

| Task | Command |
|------|---------|
| Dev server | `npm run dev` → http://localhost:4321 |
| Lint | `npm run lint` |
| Build (+ Pagefind index) | `npm run build` |
| CI equivalent | `npm run check` (`lint` + `build`) |
| Preview prod build | `npm run preview` |

**Tests:** There is no `test` script (no Jest/Vitest/Playwright). CI only runs lint + build.

### Dev server notes

- Start with host binding if accessing from outside the shell: `npm run dev -- --host 0.0.0.0 --port 4321`
- Long-running dev server: use a named tmux session (e.g. `astro-dev-server`).
- **Site search (Pagefind):** The search index is generated during `npm run build` (`pagefind --site dist`). In dev, `SiteSearch` loads `/pagefind/pagefind.js` and fails gracefully if missing — pages still render; only the navbar search widget is unavailable until after a build copies index assets into `public/`.

### Optional integrations (`.env.example`)

Not required for browsing pages or calculators. Needed for full API flows:

- **Lead form E2E:** `ELASTIC_EMAIL_API_KEY` (throws if missing on submit)
- **Lead persistence:** Supabase vars (`PUBLIC_SUPABASE_URL`, etc.) — skipped when unset
- **Rate limiting:** Upstash Redis — falls back to in-memory locally
- **Booking/scheduling:** Nylas + Supabase — UI exists; `/api/nylas/*` routes may be incomplete in some snapshots

Copy `.env.example` → `.env` for local API testing. Preview future-dated blog posts: `PUBLISH_PREVIEW_FUTURE=1 npm run dev`.

### Git hooks

No project-level Husky/pre-commit configuration. CI on push/PR runs lint + build.

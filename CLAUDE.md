# CLAUDE.md — jorgensen-foundation

The Jorgensen Foundation **marketing/public site** (and some app-shell pages), built with
**Eleventy (11ty)** + Nunjucks. Deploys to **Vercel** (`jorgensenfoundation.org`). Talks to
`jorgensen-backend` for dynamic features (login, grants, newsletter, contact, payments).

## Stack

- Eleventy (`@11ty/eleventy`), Nunjucks (`.njk`) templates, plain CSS
- Vercel hosting (`vercel.json`: `cleanUrls: true`)

## Commands

```bash
npm install
npm run dev      # eleventy --serve (local dev)
npm run build    # eleventy → _site/
npm run clean    # rm -rf _site
```

## Layout

- `src/*.njk` — one file per page (`index`, `about`, `boss`, `fep`, `opls`, `grants`,
  `publications`, `news`, `contact`, `login`, `dashboard`, `admin`, `terms`, `privacy`,
  `verify`, `reset-password`, `coming-soon`, etc.).
- `src/_includes/` — shared layouts/partials: `base.njk`, `marketing.njk`, `app.njk`,
  `nav.njk` / `nav-app.njk`, the `footer*.njk` variants.
- `src/css/` — per-page stylesheets plus `tokens.css` (design tokens) and `app.css`.
- Static assets (`css`, `js`, `img`, `videos`) are passthrough-copied; output drops the `src/`
  prefix. Output goes to `_site/` (gitignored build dir).

## Eleventy config (`.eleventy.js`)

- Input `src/`, output `_site/`, includes `_includes/`.
- Only `.njk` files are processed as templates (`templateFormats: ["njk"]`).
- **Legacy `src/*.html` files are passthrough-copied verbatim** (byte-identical) so existing
  URLs keep working — convert them to `base.njk` one at a time, don't bulk-rewrite.

## Conventions

- New pages: use the shared `base.njk` / `marketing.njk` layout + a matching `src/css/<page>.css`.
- Keep design tokens in `tokens.css`; reuse them rather than hardcoding brand colors.
- Don't edit `_site/` — it's generated. Edit `src/`.

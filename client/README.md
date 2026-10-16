# UniAssist Web Client

React 19 + Vite 7 web app for students, department staff and admins. See the
root `README.md` for the whole project.

## Run locally

```bash
cp .env.example .env   # VITE_SERVER_URL (Node API) and VITE_PYTHON_URL (AI service)
npm install
npm run dev            # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build into `dist/` (the `VITE_*` URLs are baked in) |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run lint` | ESLint |

## Theme

Two modes from one set of tokens: **Day Desk** (light, the default) and
**Night Desk** (dark).

- All colors are CSS variables in `src/theme/tokens.css` (`:root` = light,
  `[data-theme="dark"]` = dark), mapped to Tailwind classes such as
  `bg-surface`, `text-muted`, `bg-primary`, `text-success`, plus
  `rounded-card` / `rounded-panel` and `shadow-card` / `shadow-panel`.
- Inline styles use the same tokens via `C` in `src/theme/palette.js`;
  charts use `useChartColors()`.
- The mode lives on `<html data-theme>`, is saved as `uniassist-theme` in
  localStorage, and is applied by a small script in `index.html` before
  React renders (no flash).
- Don't put hex colors in components. To add a token, define it in both blocks
  of `tokens.css`, map it in its `@theme inline` block, and add it to `C` if
  inline styles need it.
- Font: Manrope (loaded in `index.html`).

## Deploy (Cloudflare)

`wrangler.jsonc` deploys `dist/` as Workers static assets with a single-page-app
fallback (`BrowserRouter` routes like `/chat` serve `index.html`), and
`public/_headers` caches the hashed bundles for a year.

```bash
VITE_SERVER_URL=https://uniassist-api.<you>.workers.dev \
VITE_PYTHON_URL=https://uniassist-api.<you>.workers.dev/ai \
npm run build && npx wrangler deploy
```

Or run the **Deploy to Cloudflare** GitHub Actions workflow (target `web`).

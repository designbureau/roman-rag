# Vercel deploy

The frontend deploys as a static SPA. SSR is off (`ssr: false` in `react-router.config.ts`) — every request goes directly to Supabase Edge Functions from the browser, so there's nothing useful to render server-side.

## One-time setup

1. https://vercel.com/new
2. **Import Git Repository** → `designbureau/bleek-lloyd-rag`
3. **Configure Project**:
   - **Root Directory**: `bleek-lloyd-rag`
     (the workspace root — `vercel.json` sits there and uses `pnpm --filter @bleek/web build`)
   - **Framework Preset**: Vite (auto-detected from `vercel.json`)
   - All other build/output fields: leave as default. `vercel.json` sets them.
4. **Environment Variables** (add for **Production, Preview, Development**):
   - `VITE_SUPABASE_URL` = `https://gwtrjffqbbecgoeiqqeo.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = the anon JWT (Supabase → Project Settings → API → "anon public")
5. **Deploy**.

## What gets deployed

- **Build**: `pnpm install --frozen-lockfile && pnpm --filter @bleek/web build`
- **Output**: `web/build/client/` — static files only (no Node runtime)
- **Routing**: client-side via React Router; the SPA fallback rewrite is implicit (Vercel serves `index.html` for unknown paths in SPA mode)

## What's NOT on Vercel

- The chat / search / speak / TTS endpoints — those are Supabase Edge Functions on `gwtrjffqbbecgoeiqqeo.supabase.co/functions/v1/*`, deployed via `supabase functions deploy ... --use-api`.
- The corpus database — Supabase Postgres on the same project.
- The CLI scrape + embed pipelines — local-only; the corpus is uploaded once via `pnpm embed` from a developer machine.

## Re-deploying

Pushing to `main` triggers a Vercel production deploy automatically (per `vercel.json`'s `git.deploymentEnabled.main`). Pushes to other branches build preview deploys.

If you need to ship Edge Function changes too, redeploy via:
```
npx -y supabase@latest functions deploy <name> --project-ref gwtrjffqbbecgoeiqqeo --use-api
```
That's separate from the Vercel deploy.

## Costs

- Vercel: free tier covers this prototype's traffic comfortably.
- Supabase: project pinned to the Swanky org at $10/mo (one-time decision; see `docs/architecture.md`).
- OpenAI: ~$0.02/run for the embed pipeline; query embeddings are sub-cent.
- Anthropic: claude-sonnet-4-6 generation, ~$0.01–0.02 per chat reply at typical lengths.
- ElevenLabs: free tier blocks library voice API access; Listen button falls back to the browser's built-in TTS. See `docs/roadmap.md` for the upgrade path.

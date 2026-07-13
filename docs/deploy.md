# Vercel deploy

The frontend deploys as a static SPA. SSR is off (`ssr: false` in
`web/react-router.config.ts`); every request goes directly to Supabase Edge
Functions from the browser, so there is nothing useful to render
server-side.

## Vercel project

Project on the personal `designbureau` hobby account, linked to
`designbureau/roman-rag` via the Vercel CLI (`vercel link`). `vercel.json`
at the repo root carries the settings:

- **Build**: `pnpm install --frozen-lockfile && pnpm --filter @roman/web build`
- **Output**: `web/build/client/` (static files only, no Node runtime)
- **Routing**: client-side via React Router; an explicit SPA fallback
  rewrite sends every path to `index.html` (static assets are served from
  the filesystem first, so the rewrite only catches app routes)

**Environment variables** (Production, Preview, Development):

- `VITE_SUPABASE_URL` = `https://zypnwehtzzwxlepyrbjh.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = the anon JWT (Supabase → Project Settings →
  API → "anon public"). Use the legacy JWT-format key: the newer
  `sb_publishable_` key is not a JWT and fails the Edge Functions'
  `verify_jwt`.

Pushing to `main` triggers a production deploy automatically (per
`vercel.json`'s `git.deploymentEnabled.main`). Other branches build
previews.

## Auth

The site is public (gallery, papers); `/chat` and `/admin` are gated. The
gate (`web/app/components/auth-gate.tsx`) wraps only those two routes;
`AUTH_ENABLED` in `web/app/lib/config.ts` is the master switch, and
`pnpm dev` bypasses the gate locally (`IS_DEV_BYPASS`).

Sign-in is magic link + Google, invite-only:

- `signInWithOtp` passes `shouldCreateUser: false`, so the sign-in form
  never creates an account.
- Admin access additionally requires `profiles.is_admin = true` on the
  signed-in user's row.

**One-time Supabase dashboard setup** (project `zypnwehtzzwxlepyrbjh`):

1. **Auth → Sign In / Up**: turn OFF "Allow new users to sign up"
   (invite-only; belt and braces with `shouldCreateUser: false`).
2. **Auth → URL Configuration**: set Site URL to the production URL, and
   add the Vercel domains to Redirect URLs, e.g.
   `https://<project>.vercel.app/**` (plus any custom domain later).
   Magic links and the Google OAuth return both depend on this.
3. **Auth → Providers → Google**: create an OAuth client in Google Cloud
   Console (Authorised redirect URI:
   `https://zypnwehtzzwxlepyrbjh.supabase.co/auth/v1/callback`), then paste
   the client ID and secret here. Until this is done the Google button
   errors; the magic link works regardless.
4. **Users**: create/invite users from Auth → Users. The
   `handle_new_user` trigger creates their `profiles` row; grant admin
   with:
   ```sql
   update public.profiles set is_admin = true
   where id = (select id from auth.users where email = '<email>');
   ```

## What's NOT on Vercel

- The chat / search / speak / transcribe endpoints: Supabase Edge Functions
  on `zypnwehtzzwxlepyrbjh.supabase.co/functions/v1/*`, deployed via the
  Supabase CLI (`supabase functions deploy <name> --project-ref
  zypnwehtzzwxlepyrbjh`).
- The corpus database: Supabase Postgres on the same project.
- The CLI scrape + embed pipelines: local-only; the corpus is uploaded via
  `pnpm embed` from a developer machine.

## Costs

- Vercel: hobby tier covers this comfortably.
- Supabase: per-project plan as provisioned.
- OpenAI: query embeddings are sub-cent; the embed pipeline is pennies per
  full run.
- Anthropic: Sonnet-class generation, roughly $0.01–0.02 per chat reply at
  typical lengths.
- ElevenLabs: per-character TTS on replies spoken from the ring.

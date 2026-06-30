import type { Config } from "@react-router/dev/config";

export default {
  // SPA mode. We have no server-side data fetching: useChat streams directly
  // to the Supabase Edge Function from the browser. SSR adds runtime cost
  // (Node server on Vercel) for no first-paint benefit since the chat panel
  // is client-only anyway. Switch back to true if a route ever grows a
  // loader.
  ssr: false,
} satisfies Config;

import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { AuthProvider } from "./lib/auth";
import "./globals.css";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Private experimental prototype — keep it out of search
            engines and AI training crawlers. `noindex,nofollow` covers
            Google/Bing; the explicit user-agent lines below cover the
            major LLM scrapers that ignore the generic robots tag. */}
        <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
        <meta name="googlebot" content="noindex, nofollow" />
        <meta name="GPTBot" content="noindex, nofollow" />
        <meta name="ChatGPT-User" content="noindex, nofollow" />
        <meta name="ClaudeBot" content="noindex, nofollow" />
        <meta name="Google-Extended" content="noindex, nofollow" />
        <meta name="CCBot" content="noindex, nofollow" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
        />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  // AuthProvider is global so any route can read auth state (the admin
  // link in SiteNav, the /admin route's own gate), but the site itself is
  // public: AuthGate now wraps only the /admin route (see routes/admin.tsx),
  // not the Outlet.
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export function meta() {
  return [
    { title: "Voces Romae" },
    {
      name: "description",
      content:
        "A retrieval-augmented reading interface for the voices of ancient Rome — its figures speaking in the first person from their own surviving writings, in English with the original Latin or Greek where it survives.",
    },
  ];
}

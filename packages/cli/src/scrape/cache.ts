/**
 * Tiny on-disk fetch cache. Hashes URL → file under data/.cache/.
 *
 * Polite to source servers, instant re-runs in dev. Cache is gitignored.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CACHE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../data/.cache",
);

function keyFor(url: string): string {
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 12);
  // Best-effort path slug for grep-ability inside .cache/
  const slug = url
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9._/-]+/g, "_")
    .replace(/\//g, "_")
    .slice(0, 80);
  return `${slug}__${hash}`;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function fetchCached(
  url: string,
  init?: RequestInit & { ttlSeconds?: number; politeMs?: number },
): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, keyFor(url));

  if (await exists(file)) {
    return readFile(file, "utf8");
  }

  const headers = new Headers(init?.headers);
  if (!headers.has("user-agent")) {
    headers.set(
      "user-agent",
      "roman-rag/0.1 (private research prototype; +https://github.com/designbureau/roman-rag)",
    );
  }
  if (!headers.has("accept")) {
    headers.set("accept", "text/html,text/plain,*/*;q=0.8");
  }
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    throw new Error(`Fetch ${url} failed: ${res.status} ${res.statusText}`);
  }
  const body = await res.text();
  await writeFile(file, body, "utf8");
  if (init?.politeMs && init.politeMs > 0) {
    await new Promise((r) => setTimeout(r, init.politeMs));
  }
  return body;
}

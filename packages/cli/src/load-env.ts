/**
 * Load the repo-root `.env` regardless of where the CLI runs from.
 *
 * Walks up from this module's directory (and the process CWD) looking for a
 * `.env`, so it resolves correctly whether the code runs from `src` via tsx or
 * from compiled `dist`. Real process-env vars always win (`override: false`),
 * so an env-configured secret beats a stale `.env` line.
 *
 * Import this at the top of any CLI entrypoint.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

function findEnvFiles(): string[] {
  const found: string[] = [];
  const starts = [path.dirname(fileURLToPath(import.meta.url)), process.cwd()];
  for (const start of starts) {
    let dir = start;
    // Walk up to the filesystem root looking for a .env.
    for (;;) {
      const candidate = path.join(dir, ".env");
      if (existsSync(candidate) && !found.includes(candidate)) found.push(candidate);
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return found;
}

for (const p of findEnvFiles()) {
  config({ path: p, override: false });
}

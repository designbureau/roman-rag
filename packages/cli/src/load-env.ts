/**
 * Load .env from a few likely locations: project root, then parent folder
 * (so an .env at bleek-lloyd-archive/.env is picked up too).
 *
 * Import this at the top of any CLI entrypoint.
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.resolve(here, "../../../../.env"),       // bleek-lloyd-rag/.env
  path.resolve(here, "../../../../../.env"),    // bleek-lloyd-archive/.env
];

for (const p of candidates) {
  config({ path: p, override: false });
}

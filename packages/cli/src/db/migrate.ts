import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { makeCliClient } from "./client.js";

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../db/migrations",
);

async function main() {
  const sql = makeCliClient();

  await sql`
    create table if not exists _migrations (
      filename   text primary key,
      applied_at timestamptz default now()
    )
  `;

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = new Set(
    (await sql<{ filename: string }[]>`select filename from _migrations`).map(
      (r) => r.filename,
    ),
  );

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`· skip ${file}`);
      continue;
    }
    const body = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    console.log(`▶ apply ${file}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into _migrations (filename) values (${file})`;
    });
    ran += 1;
  }

  console.log(`Done. ${ran} migration(s) applied.`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

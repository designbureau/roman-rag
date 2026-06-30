import { Link } from "react-router";
import { PAPERS } from "~/content/papers";
import { SiteNav } from "~/components/site-nav";

export function meta() {
  return [{ title: "Papers — Bleek-Lloyd Archive" }];
}

export default function Papers() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 lg:py-12">
      <header className="mb-8">
        <h1 className="font-display text-5xl">Papers</h1>
        <p className="mt-3 max-w-2xl text-sm text-[color:var(--muted-foreground)]">
          Write-ups behind this project: the reading interface, the question
          of the language's lost sound, and what technology can and cannot do
          for the records of endangered and sleeping languages more broadly.
        </p>
      </header>

      <SiteNav />

      <ul className="space-y-4">
        {PAPERS.map((p) => (
          <li key={p.slug}>
            <Link
              to={`/papers/${p.slug}`}
              className="block rounded-md border border-[color:var(--border)] bg-[color:var(--background)] p-5 transition-colors hover:border-[color:var(--accent)]"
            >
              <span className="label-mono">{p.kind}</span>
              <h2 className="mt-1 font-display text-2xl text-[color:var(--foreground)]">
                {p.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-[color:var(--muted-foreground)]">
                {p.blurb}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

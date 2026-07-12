import { Link, useParams } from "react-router";
import { SiteNav } from "~/components/site-nav";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Route } from "./+types/papers.$slug";
import { PAPERS, getPaper } from "~/content/papers";

export function meta({ params }: Route.MetaArgs) {
  const paper = getPaper(params.slug);
  return [
    {
      title: paper
        ? `${paper.title} — The Roman Archive`
        : "Paper not found — The Roman Archive",
    },
  ];
}

export default function Paper() {
  const { slug } = useParams();
  const paper = slug ? getPaper(slug) : undefined;

  if (!paper) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-3xl">Paper not found</h1>
        <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
          That paper doesn't exist.{" "}
          <Link to="/papers" className="underline hover:text-[color:var(--accent)]">
            See the papers.
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[750px] px-4 py-8 lg:py-12">
      <SiteNav />

      <nav className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <Link
          to="/papers"
          className="underline text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
        >
          ← all papers
        </Link>
        {PAPERS.filter((p) => p.slug !== paper.slug).map((p) => (
          <Link
            key={p.slug}
            to={`/papers/${p.slug}`}
            className="underline text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
          >
            {p.title}
          </Link>
        ))}
      </nav>

      <article className="paper-prose prose prose-lg max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Open external references in a new tab; internal links (none
            // expected in these papers) keep default behaviour.
            a: ({ href, children, ...rest }) => {
              const external = typeof href === "string" && /^https?:\/\//.test(href);
              return (
                <a
                  href={href}
                  {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                  {...rest}
                >
                  {children}
                </a>
              );
            },
          }}
        >
          {paper.markdown}
        </ReactMarkdown>
      </article>
    </main>
  );
}

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
        ? `${paper.title} — Voces Romae`
        : "Paper not found — Voces Romae",
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
            // The papers embed the gallery's motion studies via ordinary
            // image syntax pointing at .mp4 files (react-markdown renders no
            // raw HTML, so a literal <video> tag in the markdown would be
            // dropped). Muted looping autoplay — they're silent studies —
            // with the alt text as a caption. <video> and <span> are both
            // phrasing content, so nesting inside react-markdown's <p>
            // wrapper stays valid HTML, unlike <figure>/<figcaption>.
            img: ({ src, alt }) => {
              if (typeof src === "string" && src.endsWith(".mp4")) {
                return (
                  <span className="my-8 block">
                    <video
                      src={src}
                      autoPlay
                      loop
                      muted
                      playsInline
                      preload="metadata"
                      className="mx-auto block w-full max-w-[420px]"
                    />
                    {alt && (
                      <span className="mt-3 block text-center text-sm italic text-[color:var(--muted-foreground)]">
                        {alt}
                      </span>
                    )}
                  </span>
                );
              }
              return <img src={src} alt={alt} />;
            },
          }}
        >
          {paper.markdown}
        </ReactMarkdown>
      </article>
    </main>
  );
}

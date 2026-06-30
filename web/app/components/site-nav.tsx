import { NavLink } from "react-router";

// The site-wide section nav. Kept in one place so every template renders
// the same links, in the same order, in the same position.
const NAV_LINKS: { to: string; label: string }[] = [
  { to: "/", label: "chat" },
  { to: "/library", label: "library" },
  { to: "/topics", label: "topics" },
  { to: "/graph", label: "graph" },
  { to: "/heatmap", label: "by informant" },
  { to: "/glossary", label: "glossary" },
  { to: "/papers", label: "papers" },
];

// Resting links are muted; hover goes black; the current page is accent.
function linkClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? "text-[color:var(--accent)]"
    : "text-[color:var(--muted-foreground)] hover:text-black";
}

export function SiteNav({ isAdmin = false }: { isAdmin?: boolean }) {
  return (
    <nav className="mb-8 flex flex-wrap gap-x-4 gap-y-1 pb-4 text-[12px] uppercase tracking-wide no-underline">
      {NAV_LINKS.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.to === "/"}
          className={linkClass}
        >
          {l.label}
        </NavLink>
      ))}
      {isAdmin && (
        <NavLink to="/admin" className={linkClass}>
          admin
        </NavLink>
      )}
    </nav>
  );
}

import { NavLink } from "react-router";
import { useAuth } from "~/lib/auth";
import { AUTH_ENABLED, IS_DEV_BYPASS } from "~/lib/config";

// The site-wide section nav. Kept in one place so every template renders
// the same links, in the same order, in the same position.
// Only the sections with real Cicero data are linked. The thematic
// analytics (/topics, /graph, /heatmap) and the Latin /glossary need the
// theme-tagging pass over a fuller corpus; they stay routable (with empty
// states) but unlinked until that data lands, then re-add them here.
// /library and /chat are hidden the same way — still routable directly,
// just not linked from the nav.
const NAV_LINKS: { to: string; label: string }[] = [
  { to: "/", label: "gallery" },
  { to: "/papers", label: "about" },
];

// Resting links are muted; hover goes full-strength foreground; the
// current page is accent.
function linkClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? "text-[color:var(--accent)]"
    : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]";
}

export function SiteNav() {
  // Admin state comes straight from the auth context (AuthProvider is
  // global in root.tsx), so the admin link appears for a signed-in admin
  // on any page and stays hidden for everyone else. The route itself is
  // gated regardless — hiding the link is tidiness, not the boundary.
  const { isAdmin } = useAuth();
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
      {(isAdmin || !AUTH_ENABLED || IS_DEV_BYPASS) && (
        <NavLink to="/admin" className={linkClass}>
          admin
        </NavLink>
      )}
    </nav>
  );
}

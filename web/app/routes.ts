import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("topics", "routes/topics.tsx"),
  route("graph", "routes/graph.tsx"),
  route("heatmap", "routes/heatmap.tsx"),
  route("library", "routes/library.tsx"),
  route("glossary", "routes/glossary.tsx"),
  route("papers", "routes/papers.tsx"),
  route("papers/:slug", "routes/papers.$slug.tsx"),
  route("admin", "routes/admin.tsx"),
] satisfies RouteConfig;

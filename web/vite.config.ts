import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  server: {
    fs: {
      // Allow the dev server to read the repo's top-level docs/, which is
      // the single source for the /papers pages (imported raw) and sits
      // outside the web/ Vite root.
      allow: [".."],
    },
  },
});

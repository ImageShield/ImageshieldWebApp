import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * The setup from Next's own Vitest guide, with Vite's built-in tsconfig `paths`
 * support standing in for the `vite-tsconfig-paths` plugin the guide installs, plus
 * one alias.
 *
 * `server-only` throws on import unless the bundler resolves it under React's
 * `react-server` condition, which only Next's server build does. The route handlers
 * and `lib/` modules under test import it, so it is pointed at the package's own empty
 * module here. Turning on `react-server` instead would also swap React itself for its
 * server build and break every component test.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
  },
});

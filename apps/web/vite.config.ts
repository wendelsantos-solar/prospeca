import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";

const leafletStubId = "\0leaflet-ssr-stub";

function ssrStubLeaflet() {
  return {
    name: "ssr-stub-leaflet",
    enforce: "pre" as const,
    resolveId(id: string, _importer: string | undefined, options: { ssr?: boolean }) {
      if (options?.ssr && (id === "leaflet" || id === "leaflet.markercluster")) {
        return leafletStubId;
      }
    },
    load(id: string) {
      if (id === leafletStubId) {
        return "const stub = {}; export default stub;";
      }
    },
  };
}

export default defineConfig({
  // Monorepo: env files live at the repo root, not in apps/web.
  envDir: `${import.meta.dirname}/../..`,
  plugins: [
    ssrStubLeaflet(),
    tanstackStart({
      // Must come before JSX transform plugins (react, tailwindcss)
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: { "@": `${import.meta.dirname}/src` },
    tsconfigPaths: true,
  },
  css: {
    transformer: "lightningcss",
  },
  server: {
    host: "::",
    port: 8080,
  },
});

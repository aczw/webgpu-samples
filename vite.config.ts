import { defineConfig } from "vite";

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log("[INFO] __dirname:", __dirname);

const config = defineConfig({
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        root: resolve(__dirname, "index.html"),
        "forward-plus-clustered-deferred": resolve(
          __dirname,
          "forward-plus-clustered-deferred/index.html"
        ),
      },
    },
  },
  resolve: {
    // Matches "paths" setting in tsconfig.json
    alias: {
      "@": resolve(__dirname, "./src"),
      "@fpcd": resolve(__dirname, "./src/forward-plus-clustered-deferred"),
    },
  },
  plugins: [tailwindcss()],
});

export default config;

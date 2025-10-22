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
        "clustered-rendering": resolve(__dirname, "clustered-rendering/index.html"),
      },
    },
  },
  resolve: {
    // Matches "paths" setting in tsconfig.json
    alias: {
      "@": resolve(__dirname, "./src"),
      "@clustered": resolve(__dirname, "./src/clustered-rendering"),
    },
  },
  plugins: [tailwindcss()],
});

export default config;

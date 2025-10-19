import { defineConfig } from "vite";

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
});

export default config;

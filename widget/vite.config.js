import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const path = (relative) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  root: path("."),
  publicDir: false,
  esbuild: { jsx: "automatic", jsxImportSource: "preact" },
  build: {
    outDir: path("../extensions/countdown-timer/assets/"),
    // Other extension assets live here too; only the two files below are overwritten.
    emptyOutDir: false,
    lib: {
      entry: path("src/index.js"),
      formats: ["iife"],
      name: "CountdownTimerWidget",
      fileName: () => "countdown-timer.js",
      cssFileName: "countdown-timer",
    },
  },
});

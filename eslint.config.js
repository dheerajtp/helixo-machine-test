import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";

export default defineConfig(
  globalIgnores(["**/dist/", "**/build/", "**/coverage/", "**/.shopify/", "extensions/*/assets/"]),
  js.configs.recommended,
  // Leading underscore marks a parameter that exists only for its position (Express error handlers).
  { rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_" }] } },
  {
    files: ["web/**/*.js", "eslint.config.js"],
    ignores: ["web/frontend/**"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["web/frontend/**/*.{js,jsx}"],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Vite config runs in Node, not the browser.
    files: ["web/frontend/vite.config.js"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["widget/src/**/*.{js,jsx}"],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ["widget/{scripts,test}/**/*.js", "widget/vite.config.js"],
    languageOptions: { globals: globals.node },
  },
  // Template code kept as shipped: each rule is off only for the file that trips it.
  {
    files: ["web/privacy.js", "web/shopify.js"],
    rules: { "no-unused-vars": "off" },
  }
);

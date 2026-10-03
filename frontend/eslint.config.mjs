import { defineConfig, globalIgnores } from "eslint/config";
import { fixupPluginRules } from "@eslint/compat";
import nextConfig from "eslint-config-next";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextConfig.map((config) => config.plugins?.["@next/next"] ? {
    ...config,
    plugins: { ...config.plugins, "@next/next": fixupPluginRules(config.plugins["@next/next"]) },
  } : config),
  ...nextTs,
  // Keep the Core Web Vitals rules with the audited plugin version.
  {
    rules: {
      "@next/next/no-html-link-for-pages": "error",
      "@next/next/no-sync-scripts": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // These React Compiler diagnostics require a full component-by-component
  // migration. The application is not compiled with React Compiler today, so
  // keep the established hook patterns lintable while retaining Next's normal
  // correctness rules.
  {
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;

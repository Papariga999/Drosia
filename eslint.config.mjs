import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * ESLint flat config (ESLint 9 / Next 16). Replaces the legacy .eslintrc.json,
 * which is incompatible with ESLint 9's flat-config requirement.
 */
const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // App Router: fonts are loaded once in the shared root layout, so this
      // Pages-Router (_document.js) oriented rule is a false positive here.
      "@next/next/no-page-custom-font": "off",
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "Design/**",
      "design_handoff/**",
      "scripts/**",
    ],
  },
];

export default config;

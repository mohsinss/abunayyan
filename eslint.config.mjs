import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      // `no-undef` is redundant under TypeScript — tsc catches every
      // undeclared reference at compile time, and the core rule produces
      // false positives on TS-only constructs. Keep off.
      "no-undef": "off",

      // Re-enabled after the audit. Core rule is fine for our purposes;
      // `_`-prefixed names are allowed for intentional discards.
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      // Re-enabled after the audit. Catches stale-closure bugs that silently
      // break features after a refactor. Disable per-line with a reason when
      // the closure really is intentional.
      "react-hooks/exhaustive-deps": "warn",
    },
    ignores: [
      "**/__tests__/**/*",
      "jest.config.js",
      "jest.setup.js",
      ".next",
      "node_modules",
      "*.test.ts",
      "*.test.tsx",
    ],
  },
];

export default eslintConfig;

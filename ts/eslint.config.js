import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  // ...tseslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    ignores: [
      "to-cjs.js",
      "smoke/smoke.cjs",
      "eslint.config.js",
      "jest.config.js",
      "**/dist/",
      "**/pubdir/",
      "**/node_modules/",
      "patch-version.cjs",
      "setup-jsr-json.cjs",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      "no-console": ["warn"],
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-inferrable-types": "error",
      "@typescript-eslint/no-deprecated": "error",
    },
  },
);

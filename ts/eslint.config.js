import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    ignores: ["jest.config.js", "**/dist/", "**/pubdir/", "**/node_modules/", "patch-version.cjs", "setup-jsr-json.cjs"],
  },
  {
    rules: {
      "no-console": ["warn"],
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-inferrable-types": "error",
    },
  },
);

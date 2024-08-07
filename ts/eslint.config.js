import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    ignores: ["jest.config.js", "**/dist/", "**/pubdir/", "**/node_modules/"],
  },
  {
    rules: {
      "no-console": ["warn"],
    },
  },
);

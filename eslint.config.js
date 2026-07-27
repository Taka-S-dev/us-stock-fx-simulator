import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
  { ignores: ["node_modules/**", "coverage/**"] },

  js.configs.recommended,

  {
    files: ["public/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.browser,
        // CDN から読み込むライブラリ
        Plotly: "readonly",
        noUiSlider: "readonly",
        bootstrap: "readonly",
      },
    },
    rules: {
      // console.log の消し忘れを検知する（warn / error は意図的に残す）
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
      "no-var": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },

  {
    files: ["tests/**/*.js", "*.config.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },

  // 整形に関するルールは Prettier に任せる
  prettier,
];

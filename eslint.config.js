import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import prettierConfig from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
    js.configs.recommended,
    {
        files: ["**/*.{js,jsx,ts,tsx}"],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        plugins: {
            react,
            "react-hooks": reactHooks,
            import: importPlugin,
            "jsx-a11y": jsxA11y,
            "@typescript-eslint": typescriptEslint,
        },
        settings: {
            react: {
                version: "detect",
            },
            "import/resolver": {
                node: {
                    paths: ["src"],
                    extensions: [".js", ".jsx", ".ts", ".tsx"],
                },
            },
        },
        rules: {
            ...react.configs.recommended.rules,
            ...reactHooks.configs.recommended.rules,
            ...importPlugin.configs.recommended.rules,
            ...jsxA11y.configs.recommended.rules,
            ...typescriptEslint.configs.recommended.rules,
            "no-unused-vars": "off",
            "react/react-in-jsx-scope": "off",
            "@typescript-eslint/ban-ts-comment": "off",
            "@typescript-eslint/no-explicit-any": "off",
        },
    },
    prettierConfig,
];

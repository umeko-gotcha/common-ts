import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
    // ビルドの出力は検査しない
    globalIgnores(["**/dist/"]),
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
        plugins: { js },
        extends: ["js/recommended"],
        languageOptions: { globals: globals.browser },
    },
    tseslint.configs.recommended,
    // if・for・while などの本体は、1 文でも必ず { } で囲む
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
        rules: { curly: ["error", "all"] },
    },
    // 型を偽れる書き方を禁止する：as による型の言い換え（as const は可）と、! による null でないことの言い切り
    {
        files: ["**/*.{ts,mts,cts}"],
        rules: {
            "@typescript-eslint/consistent-type-assertions": [
                "error",
                { assertionStyle: "never" },
            ],
            "@typescript-eslint/no-non-null-assertion": "error",
        },
    },
]);

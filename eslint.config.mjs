import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Scoped, not global: only components/fields/* trips this false positive.
    // react-hook-form's `useController` returns a `field` object that mixes a
    // real ref (`field.ref`) with plain values (`field.value`, `field.name`).
    // The `react-hooks/refs` rule (React Compiler-era eslint-plugin-react-hooks
    // bundled with Next.js 16) can't tell them apart and flags every property
    // read on that object as an illegal ref-during-render access — a known
    // false positive for this exact pattern, not a real bug (e.g. `Uang.tsx`
    // must read `field.value` during render to format the displayed Rupiah
    // string; there's no way to do controlled-field formatting without it).
    // Keeping the rule active everywhere else so it can still catch real
    // ref-during-render bugs elsewhere in the codebase.
    files: ["components/fields/**/*.tsx"],
    rules: {
      "react-hooks/refs": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Worktree asing (bukan bagian repo ini) -- tanpa ini, `npm run lint` ikut
    // melint kode di sana dan gagal dengan error yang tidak berkaitan sama
    // sekali dengan proyek ini.
    ".kilo/**",
  ]),
]);

export default eslintConfig;

import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const CORE_FORBIDDEN_GLOBALS = [
  'window',
  'document',
  'performance',
  'AudioContext',
  'requestAnimationFrame',
  'setTimeout',
  'setInterval',
  'localStorage',
  'navigator',
  'fetch',
].map((name) => ({
  name,
  message: `src/core は ${name} を直接参照しない。時刻・乱数・IO は引数で受け取る（CLAUDE.md）。`,
}));

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'out/**', 'dist/**', 'release/**', 'reference/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.core.json', './tsconfig.web.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'error',
    },
  },
  {
    // core は純粋 TS。DOM / Electron / タイマー / 乱数に触らない。
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...CORE_FORBIDDEN_GLOBALS],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'core は Rng を引数で受け取る。' },
        { object: 'Date', property: 'now', message: 'core は時刻を引数で受け取る。' },
      ],
      'no-restricted-imports': [
        'error',
        { patterns: ['electron', 'node:*', '../render/*', '../ui/*', '../audio/*', '../platform/*', '../input/*'] },
      ],
    },
  },
  {
    files: ['electron/**/*.ts', 'scripts/**/*.mjs', 'tests/**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', __dirname: 'readonly' },
    },
    rules: {
      // main プロセスと配布スクリプトは標準出力に書いてよい
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
);

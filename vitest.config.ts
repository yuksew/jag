import { defineConfig } from 'vitest/config';

// 単体テストは core と、DOM を持たない input の純粋ロジック、AudioContext をモックした audio。
// node 環境で走らせ、core が window / document を触ると必ず落ちるようにしておく。
export default defineConfig({
  test: {
    include: ['src/core/**/*.test.ts', 'src/input/**/*.test.ts', 'src/audio/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});

import { defineConfig } from 'vitest/config';

// 単体テストは core のみ。DOM を持たない node 環境で走らせ、
// core が window / document を触ると必ず落ちるようにしておく。
export default defineConfig({
  test: {
    include: ['src/core/**/*.test.ts'],
    environment: 'node',
  },
});

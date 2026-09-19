import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string };
const define = { __APP_VERSION__: JSON.stringify(pkg.version) };

// main / preload は electron/ 配下、renderer はプロジェクト直下の index.html を入口にする。
// 出力はすべて out/ 以下（package.json の "main" と electron-builder.yml が参照する）。
export default defineConfig({
  main: {
    define,
    // steamworks.js はネイティブモジュールなので束ねない
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      lib: { entry: resolve(__dirname, 'electron/main.ts') },
      rollupOptions: { output: { entryFileNames: 'main.js' } },
    },
  },
  preload: {
    define,
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      lib: { entry: resolve(__dirname, 'electron/preload.ts') },
      rollupOptions: { output: { entryFileNames: 'preload.js' } },
    },
  },
  renderer: {
    root: '.',
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: resolve(__dirname, 'index.html') },
    },
    resolve: {
      alias: { '@core': resolve(__dirname, 'src/core') },
    },
  },
});

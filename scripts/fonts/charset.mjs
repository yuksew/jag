#!/usr/bin/env node
// 同梱フォントのサブセット用に文字集合を作る。
// 文言は src/i18n に閉じているので、そこに出る文字 + 数字・記号・ひらがな・カタカナ全部 + 「三球」を集める。
//   node scripts/fonts/charset.mjs            → 全文字（表示用・本文用）
//   node scripts/fonts/charset.mjs --latin    → 欧文だけ（数字用スラブ体）
// 出力は 1 行の文字列。build.mjs が pyftsubset --text-file に渡す。
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const latinOnly = process.argv.includes('--latin');
const outArg = process.argv.find((a) => a.startsWith('--out='));

const chars = new Set();
const range = (a, b) => {
  for (let c = a; c <= b; c++) chars.add(String.fromCodePoint(c));
};

// 印字可能な ASCII（数字・記号・英字）
range(0x20, 0x7e);
// よく使う記号（i18n に無くても Canvas や数値表示で出る）
for (const c of '±×÷→←↑↓…・ー〜～「」『』（）：；、。！？＋－／％＝〈〉《》【】○●◎△▲□■☆★✓✔♪♫‐–—‘’“”') chars.add(c);
// 全角数字と全角英字
range(0xff10, 0xff19);
range(0xff21, 0xff3a);
range(0xff41, 0xff5a);
if (!latinOnly) {
  // ひらがな・カタカナ全部（長音符・中黒を含む）
  range(0x3041, 0x309f);
  range(0x30a0, 0x30ff);
  // 半角カナ
  range(0xff61, 0xff9f);
  // タイトル
  for (const c of '三球') chars.add(c);
  // i18n に出る文字（日本語・英語）
  for (const f of ['src/i18n/ja.ts', 'src/i18n/en.ts']) {
    for (const c of readFileSync(join(root, f), 'utf8')) {
      if (c.codePointAt(0) >= 0x80 && !/\s/.test(c)) chars.add(c);
    }
  }
}
const out = [...chars].sort().join('');
if (outArg) writeFileSync(outArg.slice('--out='.length), out);
else process.stdout.write(out);

#!/usr/bin/env node
// 同梱フォントを取得してサブセット化する（pyftsubset が要る）。
//   node scripts/fonts/build.mjs           取得 + サブセット → src/assets/fonts/*.woff2
//   FONT_CACHE=<dir> で TTF の置き場を変える（既定は OS の一時ディレクトリ。git には入れない）
// 取得元は fonts.gstatic.com（Google Fonts の CSS から TTF の URL を引く）。ライセンスは各 OFL。
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cache = process.env.FONT_CACHE ?? join(tmpdir(), 'sankyu-fonts');
const outDir = join(root, 'src', 'assets', 'fonts');
mkdirSync(cache, { recursive: true });
mkdirSync(outDir, { recursive: true });

/**
 * family: Google Fonts の指定、out: 出力名、latin: 欧文だけにするか、
 * name: 同梱後のファミリー名（改変版なので元の名前を残さない。Alfa Slab One は Reserved Font Name を持つ）
 */
const FONTS = [
  { family: 'Kaisei+Decol:wght@700', pick: 0, out: 'kaisei-decol-700', latin: false, name: 'Sankyu Display', style: 'Bold' },
  { family: 'Alfa+Slab+One', pick: 0, out: 'alfa-slab-one-400', latin: true, name: 'Sankyu Numbers', style: 'Regular' },
  { family: 'Zen+Kaku+Gothic+New:wght@400;700', pick: 0, out: 'zen-kaku-gothic-new-400', latin: false, name: 'Sankyu Text', style: 'Regular' },
  { family: 'Zen+Kaku+Gothic+New:wght@400;700', pick: 1, out: 'zen-kaku-gothic-new-700', latin: false, name: 'Sankyu Text', style: 'Bold' },
];

const UA = 'Mozilla/5.0';
function fetchText(url) {
  return execFileSync('curl', ['-sS', '-A', UA, url], { encoding: 'utf8' });
}

const charsAll = join(cache, 'charset-all.txt');
const charsLatin = join(cache, 'charset-latin.txt');
execFileSync('node', [join(root, 'scripts', 'fonts', 'charset.mjs'), `--out=${charsAll}`]);
execFileSync('node', [join(root, 'scripts', 'fonts', 'charset.mjs'), '--latin', `--out=${charsLatin}`]);

const seen = new Map();
for (const f of FONTS) {
  const ttf = join(cache, `${f.out}.ttf`);
  if (!existsSync(ttf)) {
    let urls = seen.get(f.family);
    if (!urls) {
      const css = fetchText(`https://fonts.googleapis.com/css2?family=${f.family}`);
      urls = [...css.matchAll(/https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf/g)].map((m) => m[0]);
      seen.set(f.family, urls);
    }
    const url = urls[f.pick];
    if (!url) throw new Error(`no ttf url for ${f.family} #${f.pick}`);
    console.log(`fetch ${url}`);
    execFileSync('curl', ['-sS', '-A', UA, '-o', ttf, url]);
  }
  const woff2 = join(outDir, `${f.out}.woff2`);
  execFileSync('pyftsubset', [
    ttf,
    `--text-file=${f.latin ? charsLatin : charsAll}`,
    '--flavor=woff2',
    '--layout-features=kern,liga,tnum,pnum,lnum,palt',
    '--no-hinting',
    '--desubroutinize',
    `--output-file=${woff2}`,
  ]);
  // name テーブルを同梱名に付け替える（fontTools は pyftsubset と一緒に入っている）
  execFileSync('python3', ['-', woff2, f.name, f.style], {
    input: [
      'import sys',
      'from fontTools.ttLib import TTFont',
      'path, fam, sty = sys.argv[1], sys.argv[2], sys.argv[3]',
      'f = TTFont(path)',
      'n = f["name"]',
      'for rec in list(n.names):',
      '    if rec.nameID in (1, 2, 3, 4, 6, 16, 17):',
      '        n.removeNames(rec.nameID, rec.platformID, rec.platEncID, rec.langID)',
      'full = fam if sty == "Regular" else f"{fam} {sty}"',
      'ps = (fam + "-" + sty).replace(" ", "")',
      'for pid, eid, lid in ((3, 1, 0x409), (1, 0, 0)):',
      '    n.setName(fam, 1, pid, eid, lid)',
      '    n.setName(sty, 2, pid, eid, lid)',
      '    n.setName(full, 3, pid, eid, lid)',
      '    n.setName(full, 4, pid, eid, lid)',
      '    n.setName(ps, 6, pid, eid, lid)',
      'f.flavor = "woff2"',
      'f.save(path)',
    ].join('\n'),
  });
  console.log(`${f.out}.woff2  ${(statSync(woff2).size / 1024).toFixed(0)} KB  (${f.name} ${f.style})`);
}
writeFileSync(join(outDir, 'README.md'), [
  '# 同梱フォント（サブセット済み）',
  '',
  'scripts/fonts/build.mjs で fonts.gstatic.com から TTF を取り、src/i18n の文字 + 数字・記号・かな全部で pyftsubset した woff2。',
  '文言を足したら `node scripts/fonts/build.mjs` を再実行する（pyftsubset と curl が要る）。',
  '',
  '| ファイル | 書体 | 用途 | @font-face |',
  '|---|---|---|---|',
  '| kaisei-decol-700.woff2 | Kaisei Decol Bold | 見出し・タブ・判定・完走 | "Sankyu Display" |',
  '| alfa-slab-one-400.woff2 | Alfa Slab One | 数字（欧文スラブ） | "Sankyu Numbers" |',
  '| zen-kaku-gothic-new-400.woff2 / -700.woff2 | Zen Kaku Gothic New | 本文 | "Sankyu Text" |',
  '',
  'ライセンスはいずれも SIL Open Font License 1.1（OFL.txt）。THIRD_PARTY_NOTICES.md にも記載。',
  '',
].join('\n'));

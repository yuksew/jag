#!/usr/bin/env node
// キャラクター 3 案（a / b / c）の比較用スクリーンショット。
//   pnpm compile && xvfb-run -a env SHOTS_OUT=/tmp/sankyu-characters node tests/character-shots.mjs
// 練習場（3 球）で {待機, clean 直後, wobble 直後, drop 直後（驚き／がっかり）, 見せ場中} を
// 案 × ライト／ダークで撮り、キャンバス中央のクロップと、パッシング（6 球・75）の 2 人並びも出す。
// 最後に compare-characters-light.png / -dark.png（グリッドの比較シート）を作る。
// 絞り込み: SHOTS_CHARACTERS=a,b SHOTS_THEMES=light SHOTS_SKIP_PASSING=1 SHOTS_SKIP_PERF=1
/* global window, document */
import { _electron as electron, chromium } from 'playwright';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.SHOTS_OUT ?? '/tmp/sankyu-characters';
mkdirSync(OUT, { recursive: true });

const pick = (name, all) => {
  const v = process.env[name];
  if (!v) return all;
  const want = v.split(',').map((s) => s.trim());
  return all.filter((s) => want.includes(s));
};
const CHARACTERS = pick('SHOTS_CHARACTERS', ['a', 'b', 'c']);
const THEMES = pick('SHOTS_THEMES', ['light', 'dark']);
const STATES = ['idle', 'clean', 'wobble', 'showcase', 'drop-surprise', 'drop'];

const INTERVAL = 620;
/** 見せ場を早める（開発モードの tuning.override.json。core には触らない） */
const SHOWCASE_AT = 14;
const CROP_W = 480;
const MID_W = 340;

const base = { version: 6, catch: 0, clean: 0, core: 0, sp: 0, totalCatches: 0, bestRun: 0, runs: 0, playMs: 0, completeMs: 0, tree: {}, balls: 3, pattern: '3', patClean: {}, mode: 'ball', spins: 1, clubClean: {}, applause: 0, shown: [], passClean: {}, flash7: false, sealed: [], milestones: [], achievements: [], recordOpen: false, done: false };
const settings = { version: 1, display: { fullscreen: false, scale: 100, reduceMotion: false }, sound: { master: 0, sfx: 0, click: false }, input: { offsetMs: 40, throwKeys: ['Space', 'Enter'] }, lang: 'ja' };
const practiceSave = { catch: 123, clean: 1, totalCatches: 420, bestRun: 38, runs: 6, recordOpen: true, milestones: ['c100', 'r20'] };
const passingSave = { catch: 800, clean: 8, totalCatches: 9000, bestRun: 70, runs: 40, balls: 6, pattern: '75', mode: 'passing', applause: 300, shown: ['3', '4', '5', '6'], recordOpen: true, milestones: ['c100', 'c500', 'c2000', 'r20', 'r40'] };
const stageSave = { catch: 900, clean: 9, totalCatches: 15000, bestRun: 90, runs: 60, balls: 7, pattern: '7', mode: 'stage', applause: 1000, shown: ['3', '4', '5', '6', '7'], flash7: true, recordOpen: true, milestones: ['c100', 'c500', 'c2000', 'r20', 'r40', 'r80'] };

async function session(save, character, dark, fn) {
  const ud = mkdtempSync(join(tmpdir(), 'sankyu-char-'));
  mkdirSync(join(ud, 'save'), { recursive: true });
  writeFileSync(join(ud, 'save', 'save.json'), JSON.stringify({ ...base, ...save }));
  // Playwright のキー入力の遅延（約 40ms）をオフセット補正で吸収する
  writeFileSync(join(ud, 'settings.json'), JSON.stringify(settings));
  writeFileSync(join(ud, 'tuning.override.json'), JSON.stringify({ showcase: { baseAt: SHOWCASE_AT } }));
  const app = await electron.launch({ args: ['--no-sandbox', root], cwd: root, env: { ...process.env, SANKYU_USERDATA: ud } });
  const win = await app.firstWindow();
  await win.addInitScript((c) => {
    document.documentElement.dataset.character = c;
  }, character);
  if (dark) await win.emulateMedia({ colorScheme: 'dark' });
  await win.waitForSelector('#start-btn');
  await win.evaluate((c) => {
    document.documentElement.dataset.character = c;
  }, character);
  await win.waitForTimeout(600);
  const got = await win.evaluate(() => document.documentElement.dataset.character);
  if (got !== character) throw new Error(`character-shots: data-character=${got}, want ${character}`);
  try {
    await fn(win);
  } finally {
    await app.close();
  }
}

/** 拍 k の時刻（ラン開始のキー入力から） */
const beatAt = (t0, k) => t0 + INTERVAL * (k + 1);

async function waitUntil(win, t) {
  const w = t - Date.now();
  if (w > 0) await win.waitForTimeout(w);
}

/** キャンバス全体と中央のクロップを撮る */
async function shoot(win, name) {
  const cv = win.locator('#cv');
  await cv.screenshot({ path: join(OUT, `${name}.png`) });
  const box = await cv.boundingBox();
  const w = Math.min(CROP_W, box.width);
  await win.screenshot({ path: join(OUT, `${name}-crop.png`), clip: { x: box.x + box.width / 2 - w / 2, y: box.y, width: w, height: box.height } });
  // 比較シート用: 頭から手までを大きく
  const mw = Math.min(MID_W, box.width);
  await win.screenshot({ path: join(OUT, `${name}-mid.png`), clip: { x: box.x + box.width / 2 - mw / 2, y: box.y + box.height * 0.42, width: mw, height: box.height * 0.58 } });
}

const stats = [];
async function readStats(win, label) {
  const st = await win.evaluate(() => window.__sankyuArenaStats ?? null);
  if (st && st.frames > 0) stats.push({ label, avg: st.totalMs / st.frames, max: st.maxMs, frames: st.frames });
}

for (const character of CHARACTERS) {
  for (const theme of THEMES) {
    const dark = theme === 'dark';
    const tag = `${character}-${theme}`;
    // 練習場: 待機 → clean → wobble → 見せ場 → drop
    await session(practiceSave, character, dark, async (win) => {
      await shoot(win, `${tag}-idle`);
      await win.evaluate(() => {
        window.__sankyuArenaStats = undefined;
      });
      await win.keyboard.press('Space');
      const t0 = Date.now();
      for (let k = 0; k <= 3; k++) {
        await waitUntil(win, beatAt(t0, k));
        await win.keyboard.press('Space');
      }
      await waitUntil(win, beatAt(t0, 3) + 150);
      await shoot(win, `${tag}-clean`);
      for (let k = 4; k <= 5; k++) {
        await waitUntil(win, beatAt(t0, k));
        await win.keyboard.press('Space');
      }
      // wobble: 拍から +180ms（許容幅 140ms の 1〜2 倍）
      await waitUntil(win, beatAt(t0, 6) + 180);
      await win.keyboard.press('Space');
      await waitUntil(win, beatAt(t0, 6) + 180 + 40);
      await shoot(win, `${tag}-wobble`);
      for (let k = 7; k <= SHOWCASE_AT + 1; k++) {
        await waitUntil(win, beatAt(t0, k));
        await win.keyboard.press('Space');
      }
      await waitUntil(win, beatAt(t0, SHOWCASE_AT + 1) + 240);
      await shoot(win, `${tag}-showcase`);
      for (let k = SHOWCASE_AT + 2; k <= SHOWCASE_AT + 5; k++) {
        await waitUntil(win, beatAt(t0, k));
        await win.keyboard.press('Space');
      }
      // drop: 次の拍を放置（+280ms で未入力の落球）
      const dropK = SHOWCASE_AT + 6;
      await waitUntil(win, beatAt(t0, dropK) + 280 + 130);
      await shoot(win, `${tag}-drop-surprise`);
      await waitUntil(win, beatAt(t0, dropK) + 280 + 1300);
      await shoot(win, `${tag}-drop`);
      await readStats(win, `${tag} practice(3)`);
      console.log(`shot ${tag} practice`);
    });
    if (process.env.SHOTS_SKIP_PASSING) continue;
    // パッシング: 6 球・75。偶数拍が自分の投げ
    await session(passingSave, character, dark, async (win) => {
      await win.click('#tab-passing');
      await win.waitForTimeout(250);
      await win.evaluate(() => {
        window.__sankyuArenaStats = undefined;
      });
      await win.keyboard.press('Space');
      const t0 = Date.now();
      for (let k = 0; k <= 8; k += 2) {
        await waitUntil(win, beatAt(t0, k));
        await win.keyboard.press('Space');
      }
      await waitUntil(win, beatAt(t0, 8) + 200);
      await win.locator('#cv').screenshot({ path: join(OUT, `${tag}-passing.png`) });
      await readStats(win, `${tag} passing(6)`);
      console.log(`shot ${tag} passing`);
    });
  }
}

// 描画時間: 舞台（7 球 + 光）で案ごとに測る
if (!process.env.SHOTS_SKIP_PERF) {
  for (const character of CHARACTERS) {
    await session(stageSave, character, false, async (win) => {
      await win.click('#tab-stage');
      await win.waitForTimeout(250);
      await win.evaluate(() => {
        window.__sankyuArenaStats = undefined;
      });
      await win.keyboard.press('Space');
      const t0 = Date.now();
      for (let k = 0; k <= 17; k++) {
        await waitUntil(win, beatAt(t0, k));
        await win.keyboard.press('Space');
      }
      await win.waitForTimeout(150);
      await win.locator('#cv').screenshot({ path: join(OUT, `${character}-light-stage7.png`) });
      await readStats(win, `${character}-light stage(7)`);
      console.log(`shot ${character} stage`);
    });
  }
}

// 描画時間（draw 1 回あたり。GPU の無い xvfb ではソフトウェア描画なので実機より遅い）
for (const s of stats) console.log(`frame ${s.label.padEnd(22)} avg ${s.avg.toFixed(2)}ms max ${s.max.toFixed(2)}ms (${s.frames} frames)`);

// 比較シート: 行 = 案、列 = 状態（クロップ）。最後にパッシングの行
const CHAR_LABEL = { a: 'A 街角の名人（3.5 頭身）', b: 'B サーカスの新人（3 頭身）', c: 'C 現代のジャグラー（4 頭身）' };
const STATE_LABEL = { idle: '待機', clean: 'clean 直後', wobble: 'wobble 直後', showcase: '見せ場中', 'drop-surprise': 'drop 直後（驚き）', drop: 'drop 後（がっかり）' };
const img = (file) => (existsSync(file) ? `data:image/png;base64,${readFileSync(file).toString('base64')}` : '');
const browser = await chromium.launch();
try {
  for (const theme of THEMES) {
    const bg = theme === 'dark' ? '#1b262a' : '#f2eee6';
    const fg = theme === 'dark' ? '#e8e0d0' : '#22343a';
    const cols = STATES.length;
    let html = `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;background:${bg};color:${fg};font:14px system-ui,sans-serif;padding:20px}
      h1{font-size:22px;margin:0 0 14px}
      .grid{display:grid;grid-template-columns:170px repeat(${cols},1fr);gap:10px;align-items:center}
      .hdr{font-size:17px;font-weight:700;text-align:center;padding:6px 0}
      .row{font-weight:700;font-size:15px;line-height:1.4}
      .cell{position:relative}
      .cell img{display:block;width:100%;height:auto;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.25)}
      .cell span{position:absolute;left:8px;top:8px;background:rgba(0,0,0,.6);color:#fff;padding:3px 8px;border-radius:6px;font-size:12px}
      .wide{grid-column:span 2}
    </style><body><h1>三球 キャラクター 3 案の比較 — ${theme === 'dark' ? 'ダーク' : 'ライト'}テーマ（練習場 3 球）</h1><div class="grid"><div></div>`;
    for (const st of STATES) html += `<div class="hdr">${STATE_LABEL[st]}</div>`;
    for (const character of CHARACTERS) {
      html += `<div class="row">${CHAR_LABEL[character]}</div>`;
      for (const st of STATES) {
        html += `<div class="cell"><img src="${img(join(OUT, `${character}-${theme}-${st}-mid.png`))}" alt=""><span>${character} / ${st}</span></div>`;
      }
    }
    if (!process.env.SHOTS_SKIP_PASSING) {
      html += `<div class="row">パッシング（6 球・75）<br>相方は同じ骨格で別の衣装</div>`;
      for (const character of CHARACTERS) {
        html += `<div class="cell wide"><img src="${img(join(OUT, `${character}-${theme}-passing.png`))}" alt=""><span>${character} / passing</span></div>`;
      }
    }
    html += '</div></body>';
    const page = await browser.newPage({ viewport: { width: 2200, height: 1200 } });
    await page.setContent(html);
    await page.waitForTimeout(200);
    const out = join(OUT, `compare-characters-${theme}.png`);
    await page.screenshot({ path: out, fullPage: true });
    await page.close();
    console.log(`sheet ${out}`);
  }
} finally {
  await browser.close();
}
console.log('done');

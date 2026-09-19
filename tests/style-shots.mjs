#!/usr/bin/env node
// 絵柄（vector / ink / paint）の比較用スクリーンショット。
//   pnpm compile && xvfb-run -a env SHOTS_OUT=/tmp/sankyu-style-shots node tests/style-shots.mjs
// 4 場面（練習場・クラブ・路上・舞台）× 3 スタイル × ライト／ダークを撮り、
// 最後に compare-light.png / compare-dark.png（グリッドの比較シート）を作る。
// 絞り込み: SHOTS_STYLES=ink,paint SHOTS_SCENES=practice,stage SHOTS_THEMES=light
/* global window, document */
import { _electron as electron, chromium } from 'playwright';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.SHOTS_OUT ?? '/tmp/sankyu-style-shots';
mkdirSync(OUT, { recursive: true });

const pick = (name, all) => {
  const v = process.env[name];
  if (!v) return all;
  const want = v.split(',').map((s) => s.trim());
  return all.filter((s) => want.includes(s));
};
const STYLES = pick('SHOTS_STYLES', ['vector', 'ink', 'paint']);
const THEMES = pick('SHOTS_THEMES', ['light', 'dark']);
const SCENE_NAMES = pick('SHOTS_SCENES', ['practice', 'club', 'street', 'stage']);

const base = { version: 6, catch: 0, clean: 0, core: 0, sp: 0, totalCatches: 0, bestRun: 0, runs: 0, playMs: 0, completeMs: 0, tree: {}, balls: 3, pattern: '3', patClean: {}, mode: 'ball', spins: 1, clubClean: {}, applause: 0, shown: [], passClean: {}, flash7: false, sealed: [], milestones: [], achievements: [], recordOpen: false, done: false };
const settings = { version: 1, display: { fullscreen: false, scale: 100, reduceMotion: false }, sound: { master: 0, sfx: 0, click: false }, input: { offsetMs: 40, throwKeys: ['Space', 'Enter'] }, lang: 'ja' };

/** 場面。save は初期セーブ、tab は開くタブ、beats は投げる拍数 */
const SCENES = {
  practice: { save: { catch: 123, clean: 1, totalCatches: 420, bestRun: 38, runs: 6, recordOpen: true, milestones: ['c100', 'r20'] }, tab: null, beats: 34 },
  club: { save: { catch: 400, clean: 6, totalCatches: 3000, bestRun: 60, runs: 25, balls: 4, pattern: '4', clubClean: { 1: 3 }, mode: 'club', spins: 2, recordOpen: true, milestones: ['c100', 'c500', 'c2000', 'r20', 'r40'] }, tab: '#tab-club', beats: 5 },
  street: { save: { catch: 500, clean: 6, totalCatches: 5000, bestRun: 60, runs: 30, balls: 5, pattern: '5', mode: 'street', applause: 84, shown: ['3', '4', '53', '552'], tree: { convert: 2 }, recordOpen: true, milestones: ['c100', 'c500', 'c2000', 'r20', 'r40'] }, tab: '#tab-street', beats: 12 },
  stage: { save: { catch: 900, clean: 9, totalCatches: 15000, bestRun: 90, runs: 60, balls: 7, pattern: '7', mode: 'stage', applause: 1000, shown: ['3', '4', '5', '6', '7'], flash7: true, recordOpen: true, milestones: ['c100', 'c500', 'c2000', 'r20', 'r40', 'r80'] }, tab: '#tab-stage', beats: 18 },
};

async function session(save, style, dark, fn) {
  const ud = mkdtempSync(join(tmpdir(), 'sankyu-style-'));
  mkdirSync(join(ud, 'save'), { recursive: true });
  writeFileSync(join(ud, 'save', 'save.json'), JSON.stringify({ ...base, ...save }));
  // Playwright のキー入力の遅延（約 40ms）をオフセット補正で吸収する
  writeFileSync(join(ud, 'settings.json'), JSON.stringify(settings));
  const app = await electron.launch({ args: ['--no-sandbox', root], cwd: root, env: { ...process.env, SANKYU_USERDATA: ud } });
  const win = await app.firstWindow();
  // 絵柄は data 属性で決める。以後の読み込みには addInitScript、
  // 既に読み込み済みのページには evaluate で付ける（Arena は MutationObserver で拾ってキャッシュを捨てる）
  await win.addInitScript((s) => {
    document.documentElement.dataset.artStyle = s;
  }, style);
  if (dark) await win.emulateMedia({ colorScheme: 'dark' });
  await win.waitForSelector('#start-btn');
  await win.evaluate((s) => {
    document.documentElement.dataset.artStyle = s;
  }, style);
  await win.waitForTimeout(500);
  try {
    await fn(win);
  } finally {
    await app.close();
  }
}

async function playBeats(win, n, interval = 620, key = 'Space') {
  await win.keyboard.press(key);
  const t0 = Date.now();
  for (let k = 0; k < n; k++) {
    const w = t0 + interval * (k + 1) - Date.now();
    if (w > 0) await win.waitForTimeout(w);
    await win.keyboard.press(key);
  }
  await win.waitForTimeout(120);
}

const stats = [];
for (const style of STYLES) {
  for (const theme of THEMES) {
    for (const name of SCENE_NAMES) {
      const sc = SCENES[name];
      const file = join(OUT, `${style}-${theme}-${name}.png`);
      await session(sc.save, style, theme === 'dark', async (win) => {
        const got = await win.evaluate(() => document.documentElement.dataset.artStyle ?? 'vector');
        if (got !== style) throw new Error(`style-shots: data-art-style=${got}, want ${style}`);
        if (sc.tab) {
          await win.click(sc.tab);
          await win.waitForTimeout(200);
        }
        await win.evaluate(() => {
          window.__sankyuArenaStats = undefined;
        });
        await playBeats(win, sc.beats);
        await win.locator('#cv').screenshot({ path: file });
        const st = await win.evaluate(() => window.__sankyuArenaStats ?? null);
        if (st && st.frames > 0) {
          stats.push({ style, theme, scene: name, avg: st.totalMs / st.frames, max: st.maxMs, frames: st.frames });
        }
      });
      console.log(`shot ${file}`);
    }
  }
}

// 描画時間（draw 1 回あたり。GPU の無い xvfb ではソフトウェア描画なので実機より遅い）
for (const s of stats) {
  console.log(`frame ${s.style.padEnd(6)} ${s.theme.padEnd(5)} ${s.scene.padEnd(8)} avg ${s.avg.toFixed(2)}ms max ${s.max.toFixed(2)}ms (${s.frames} frames)`);
}

// 比較シート: 列 = スタイル、行 = 場面。ライト／ダークで 1 枚ずつ
const LABEL = { vector: 'vector（現状）', ink: 'ink（手描き）', paint: 'paint（塗り）' };
const SCENE_LABEL = { practice: '練習場（3 球）', club: 'クラブ（4 球ダブル）', street: '路上（5 球）', stage: '舞台（7 球ショー）' };
const browser = await chromium.launch();
try {
  for (const theme of THEMES) {
    const bg = theme === 'dark' ? '#1b262a' : '#f2eee6';
    const fg = theme === 'dark' ? '#e8e0d0' : '#22343a';
    const cols = STYLES.length;
    let html = `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;background:${bg};color:${fg};font:14px system-ui,sans-serif;padding:20px}
      h1{font-size:22px;margin:0 0 14px}
      .grid{display:grid;grid-template-columns:150px repeat(${cols},1fr);gap:12px;align-items:center}
      .hdr{font-size:20px;font-weight:700;text-align:center;padding:6px 0}
      .row{font-weight:700;font-size:15px}
      .cell{position:relative}
      .cell img{display:block;width:100%;height:auto;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.25)}
      .cell span{position:absolute;left:8px;top:8px;background:rgba(0,0,0,.6);color:#fff;padding:3px 8px;border-radius:6px;font-size:13px}
    </style><body><h1>三球 絵柄の比較 — ${theme === 'dark' ? 'ダーク' : 'ライト'}テーマ</h1><div class="grid"><div></div>`;
    for (const style of STYLES) html += `<div class="hdr">${LABEL[style]}</div>`;
    for (const name of SCENE_NAMES) {
      html += `<div class="row">${SCENE_LABEL[name]}</div>`;
      for (const style of STYLES) {
        const file = join(OUT, `${style}-${theme}-${name}.png`);
        const src = existsSync(file) ? `data:image/png;base64,${readFileSync(file).toString('base64')}` : '';
        html += `<div class="cell"><img src="${src}" alt=""><span>${style} / ${name}</span></div>`;
      }
    }
    html += '</div></body>';
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.setContent(html);
    await page.waitForTimeout(200);
    const out = join(OUT, `compare-${theme}.png`);
    await page.screenshot({ path: out, fullPage: true });
    await page.close();
    console.log(`sheet ${out}`);
  }
} finally {
  await browser.close();
}
console.log('done');

import { _electron as electron } from 'playwright';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const OUT = process.env.SHOTS_OUT ?? '/tmp/sankyu-shots';
import { mkdirSync as _mk } from 'node:fs'; _mk(OUT, { recursive: true });
const base = { version: 6, catch: 0, clean: 0, core: 0, sp: 0, totalCatches: 0, bestRun: 0, runs: 0, playMs: 0, completeMs: 0, tree: {}, balls: 3, pattern: '3', patClean: {}, mode: 'ball', spins: 1, clubClean: {}, applause: 0, shown: [], passClean: {}, flash7: false, sealed: [], milestones: [], achievements: [], recordOpen: false, done: false };
async function session(save, fn, opts = {}) {
  const ud = mkdtempSync(join(tmpdir(), 'sankyu-shot-'));
  mkdirSync(join(ud, 'save'), { recursive: true });
  writeFileSync(join(ud, 'save', 'save.json'), JSON.stringify({ ...base, ...save }));
  // Playwright のキー入力の遅延（約 40ms）をオフセット補正で吸収する。許容幅は実際の値のまま
  const settings = opts.settings ?? { version: 1, display: { fullscreen: false, scale: 100, reduceMotion: false }, sound: { master: 0.8, sfx: 0.8, click: true }, input: { offsetMs: 40, throwKeys: ['Space', 'Enter'] }, lang: 'ja' };
  writeFileSync(join(ud, 'settings.json'), JSON.stringify(settings));
  const args = ['--no-sandbox', '/home/user/jag'];
  const app = await electron.launch({ args, cwd: '/home/user/jag', env: { ...process.env, SANKYU_USERDATA: ud } });
  const win = await app.firstWindow();
  // --force-dark-mode では prefers-color-scheme が変わらないので、Playwright のメディア指定で切り替える
  if (opts.dark) await win.emulateMedia({ colorScheme: 'dark' });
  await win.waitForSelector('#start-btn'); await win.waitForTimeout(500);
  try { await fn(win); } finally { await app.close(); }
}
async function playBeats(win, n, interval = 620, key = 'Space') {
  await win.keyboard.press(key);
  const t0 = Date.now();
  for (let k = 0; k < n; k++) { const w = t0 + interval * (k + 1) - Date.now(); if (w > 0) await win.waitForTimeout(w); await win.keyboard.press(key); }
  await win.waitForTimeout(120);
}
// 1 練習場: 3 球のラン中（見せ場の予告あたり）
await session({ catch: 123, clean: 1, totalCatches: 420, bestRun: 38, runs: 6, recordOpen: true, milestones: ['c100', 'r20'] }, async (win) => {
  await playBeats(win, 34);
  await win.screenshot({ path: join(OUT, '01-practice-run.png') });
});
// 2 身体（ツリー）
await session({ catch: 260, clean: 4, core: 1, totalCatches: 900, bestRun: 45, runs: 12, tree: { prec: 3, speed: 1, stam: 2, asym: 1 }, patClean: { '3': 2, '441': 1 }, recordOpen: true, milestones: ['c100', 'c500', 'r20', 'r40'] }, async (win) => {
  await win.click('#tab-body'); await win.waitForTimeout(300);
  await win.screenshot({ path: join(OUT, '02-body.png') });
});
// 3 記録帳（節目・記録・封印）
await session({ catch: 300, clean: 5, core: 1, sp: 1, totalCatches: 2400, bestRun: 82, runs: 20, balls: 4, pattern: '4', tree: { prec: 5 }, patClean: { '3': 3, '441': 1, '531': 1, '4': 1 }, sealed: ['441'], recordOpen: true, milestones: ['c100', 'c500', 'c2000', 'r20', 'r40', 'r80'] }, async (win) => {
  await win.click('#tab-record'); await win.waitForTimeout(300);
  await win.screenshot({ path: join(OUT, '03-record.png') });
});
// 4 クラブ（ダブルのラン中）
await session({ catch: 400, clean: 6, totalCatches: 3000, bestRun: 60, runs: 25, balls: 4, pattern: '4', clubClean: { 1: 3 }, mode: 'club', spins: 2, recordOpen: true, milestones: ['c100', 'c500', 'c2000', 'r20', 'r40'] }, async (win) => {
  await win.click('#tab-club'); await win.waitForTimeout(200);
  await playBeats(win, 5);
  await win.screenshot({ path: join(OUT, '04-club.png') });
});
// 5 路上（ラン中、拍手）
await session({ catch: 500, clean: 6, totalCatches: 5000, bestRun: 60, runs: 30, balls: 5, pattern: '5', mode: 'street', applause: 84, shown: ['3', '4', '53', '552'], tree: { convert: 2 }, recordOpen: true, milestones: ['c100', 'c500', 'c2000', 'r20', 'r40'] }, async (win) => {
  await win.click('#tab-street'); await win.waitForTimeout(200);
  await playBeats(win, 12);
  await win.screenshot({ path: join(OUT, '05-street.png') });
});
// 6 パッシング（ラン中）
await session({ catch: 800, clean: 8, totalCatches: 9000, bestRun: 70, runs: 40, balls: 6, pattern: '75', mode: 'passing', applause: 300, shown: ['3', '4', '5', '6'], recordOpen: true, milestones: ['c100', 'c500', 'c2000', 'r20', 'r40'] }, async (win) => {
  await win.click('#tab-passing'); await win.waitForTimeout(200);
  await win.keyboard.press('Space');
  const t0 = Date.now();
  for (let k = 0; k < 9; k += 2) { const w = t0 + 620 * (k + 1) - Date.now(); if (w > 0) await win.waitForTimeout(w); await win.keyboard.press('Space'); }
  await win.waitForTimeout(150);
  await win.screenshot({ path: join(OUT, '06-passing.png') });
});
// 7 舞台（ショー中）
await session({ catch: 900, clean: 9, totalCatches: 15000, bestRun: 90, runs: 60, balls: 7, pattern: '7', mode: 'stage', applause: 1000, shown: ['3', '4', '5', '6', '7'], flash7: true, recordOpen: true, milestones: ['c100', 'c500', 'c2000', 'r20', 'r40', 'r80'] }, async (win) => {
  await win.click('#tab-stage'); await win.waitForTimeout(200);
  await playBeats(win, 18);
  await win.screenshot({ path: join(OUT, '07-stage-show.png') });
});
// 8 完走
await session({ catch: 900, clean: 9, totalCatches: 15400, bestRun: 90, runs: 61, playMs: 7200000, completeMs: 7200000, balls: 7, pattern: '7', mode: 'stage', applause: 1000, shown: ['3', '4', '5', '6', '7'], flash7: true, recordOpen: true, done: true, milestones: ['c100', 'c500', 'c2000', 'r20', 'r40', 'r80'] }, async (win) => {
  await win.click('#tab-stage'); await win.waitForTimeout(300);
  await win.screenshot({ path: join(OUT, '08-complete.png') });
});
// 9 設定
await session({ catch: 40, totalCatches: 40, runs: 2 }, async (win) => {
  await win.click('#settings-btn'); await win.waitForTimeout(300);
  await win.screenshot({ path: join(OUT, '09-settings.png') });
});
// 10 ダークテーマ + 英語
await session({ catch: 123, clean: 1, totalCatches: 420, bestRun: 38, runs: 6, recordOpen: true, milestones: ['c100', 'r20'] }, async (win) => {
  await playBeats(win, 6);
  await win.screenshot({ path: join(OUT, '10-dark-en.png') });
}, { dark: true, settings: { version: 1, display: { fullscreen: false, scale: 100, reduceMotion: false }, sound: { master: 0.8, sfx: 0.8, click: true }, input: { offsetMs: 40, throwKeys: ['Space', 'Enter'] }, lang: 'en' } });
console.log('done');

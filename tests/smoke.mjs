#!/usr/bin/env node
// 起動スモーク。ビルド済みの out/ を Electron で起動し、
// 開始 → 6 拍投げる → やめる → セーブファイルが書かれることを確認する。
//   pnpm compile && pnpm smoke          （Linux でヘッドレスなら xvfb-run -a pnpm smoke）
import { _electron as electron } from 'playwright';
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = process.env.SMOKE_SHOTS ?? mkdtempSync(join(tmpdir(), 'sankyu-smoke-'));
const INTERVAL = 620;

function assert(cond, msg) {
  if (!cond) throw new Error(`smoke: ${msg}`);
}

const app = await electron.launch({ args: ['--no-sandbox', root], cwd: root });
try {
  const userData = await app.evaluate(({ app }) => app.getPath('userData'));
  const win = await app.firstWindow();
  await win.waitForSelector('#start-btn');
  await win.waitForTimeout(300);
  await win.screenshot({ path: join(shotDir, 'boot.png') });
  assert((await win.title()) === '三球', 'title');

  await win.keyboard.press('Space');
  const t0 = Date.now();
  for (let k = 0; k < 6; k++) {
    const wait = t0 + INTERVAL * (k + 1) - Date.now();
    if (wait > 0) await win.waitForTimeout(wait);
    await win.keyboard.press('Space');
  }
  await win.waitForTimeout(100);
  await win.screenshot({ path: join(shotDir, 'run.png') });
  const beats = Number(await win.textContent('#h-beat'));
  assert(beats === 6, `beats=${beats}`);

  await win.click('#start-btn');
  await win.waitForTimeout(500);
  const saveDir = join(userData, 'save');
  assert(existsSync(join(saveDir, 'save.json')), 'save.json exists');
  const save = JSON.parse(readFileSync(join(saveDir, 'save.json'), 'utf8'));
  assert(save.version === 1 && save.runs >= 1, 'save content');

  await win.click('#tab-body');
  await win.waitForTimeout(300);
  await win.screenshot({ path: join(shotDir, 'body.png') });

  console.log(`smoke ok  userData=${userData}  save=${readdirSync(saveDir).join(',')}  shots=${shotDir}`);
} finally {
  await app.close();
}

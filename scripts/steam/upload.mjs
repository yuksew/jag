#!/usr/bin/env node
// SteamCMD で depot をアップロードする。
//   pnpm steam:upload -- --branch beta [--dry-run]
// 必要な環境変数: STEAM_USERNAME（パスワードは SteamCMD のキャッシュか STEAM_PASSWORD）
// 実際の App ID / Depot ID は app_build.vdf に書く（App ID 取得後に置き換える）。
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const args = process.argv.slice(2);

function opt(name, fallback) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}

const branch = opt('branch', 'dev');
const dryRun = opt('dry-run', false) === true;
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const template = readFileSync(join(here, 'app_build.vdf'), 'utf8');
const vdf = template
  .replaceAll('{{BRANCH}}', String(branch))
  .replaceAll('{{DESC}}', `${pkg.name} ${pkg.version} (${branch})`)
  .replaceAll('{{ROOT}}', root.replaceAll('\\', '/'));

const outDir = join(root, 'out', 'steam');
mkdirSync(outDir, { recursive: true });
const vdfPath = join(outDir, `app_build.${branch}.vdf`);
writeFileSync(vdfPath, vdf);
console.log(`[steam] wrote ${vdfPath}`);

if (dryRun) {
  console.log('[steam] dry-run: SteamCMD は実行しない');
  process.exit(0);
}

const steamcmd = process.env.STEAMCMD ?? 'steamcmd';
const user = process.env.STEAM_USERNAME;
if (!user) {
  console.error('[steam] STEAM_USERNAME が未設定');
  process.exit(1);
}
const cmd = ['+login', user];
if (process.env.STEAM_PASSWORD) cmd.push(process.env.STEAM_PASSWORD);
cmd.push('+run_app_build', vdfPath, '+quit');

const r = spawnSync(steamcmd, cmd, { stdio: 'inherit' });
if (r.error) {
  console.error(`[steam] ${steamcmd} を起動できない: ${r.error.message}`);
  process.exit(1);
}
process.exit(r.status ?? 1);

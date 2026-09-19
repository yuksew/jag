// セーブファイルの IO。userData/save/save.json。
// 書き込みは一時ファイル → rename の原子的置換、直前世代を save.json.bak に 1 つ残す。
import { app } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { SaveReadResult } from './api';

const FILE = 'save.json';
const BAK = 'save.json.bak';
const TMP = 'save.json.tmp';

export function saveDir(): string {
  return join(app.getPath('userData'), 'save');
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readFile(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

export async function readSave(): Promise<SaveReadResult> {
  const dir = saveDir();
  const hasBackup = await exists(join(dir, BAK));
  try {
    const json = await readFile(join(dir, FILE));
    if (json === null) return { kind: 'none', hasBackup };
    return { kind: 'ok', json };
  } catch {
    return { kind: 'unreadable', hasBackup };
  }
}

export async function writeSave(json: string): Promise<void> {
  const dir = saveDir();
  await fs.mkdir(dir, { recursive: true });
  const file = join(dir, FILE);
  const tmp = join(dir, TMP);
  const bak = join(dir, BAK);
  const fh = await fs.open(tmp, 'w');
  try {
    await fh.writeFile(json, 'utf8');
    await fh.sync();
  } finally {
    await fh.close();
  }
  if (await exists(file)) await fs.copyFile(file, bak);
  await fs.rename(tmp, file);
}

export async function restoreBackup(): Promise<SaveReadResult> {
  const dir = saveDir();
  const bak = join(dir, BAK);
  if (!(await exists(bak))) return { kind: 'none', hasBackup: false };
  await fs.copyFile(bak, join(dir, FILE));
  return readSave();
}

export async function clearSave(): Promise<void> {
  const dir = saveDir();
  for (const name of [FILE, BAK, TMP]) await fs.rm(join(dir, name), { force: true });
}

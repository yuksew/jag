// renderer の入口。core の状態を持ち、render / ui / input / platform を配線する。
import './style.css';
import {
  applyPrestige,
  applyTuningOverride,
  buy,
  isClubId,
  selectClub,
  checkAchievements,
  createRun,
  endRun,
  fresh,
  handleInput,
  startRun,
  tick,
  type PatternId,
  type RunEvent,
  type SaveState,
  type Spins,
} from './core';
import { t } from './i18n';
import { bindThrowInput } from './input';
import { createSaveStore } from './platform/save';
import { installErrorLogging, log } from './platform/log';
import { platformApi } from './platform/api';
import { Arena, type Flash } from './render/arena';
import { askDialog } from './ui/dialog';
import { byId } from './ui/dom';
import { Hud } from './ui/hud';
import { Pane } from './ui/pane';
import { Toast } from './ui/toast';

// 時刻と乱数は renderer が決めて core に渡す。拍の基準は M3 で AudioContext に移す
const clock = (): number => performance.now();
const rng = (): number => Math.random();

installErrorLogging();

let state: SaveState = fresh();
const run = createRun();
const store = createSaveStore();

const hud = new Hud();
const toast = new Toast(byId('toast'));
const canvas = byId<HTMLCanvasElement>('cv');
const arena = new Arena(canvas, t.canvas);
let flash: Flash | null = null;

byId('title').innerHTML = `${t.title}<small>${t.subtitle}</small>`;
const foot = byId('foot');
foot.innerHTML = `<span>${t.footer}</span><button id="reset-btn">${t.buttons.reset}</button>`;

// ---- セーブ ----
let saveTimer: number | undefined;
function flushSave(): void {
  if (saveTimer !== undefined) window.clearTimeout(saveTimer);
  saveTimer = undefined;
  store.write(state).catch((e: unknown) => log.error(`save failed: ${String(e)}`));
}
function scheduleSave(): void {
  if (saveTimer !== undefined) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flushSave, 300);
}

// ---- UI ----
const pane = new Pane(
  {
    selectPattern(id: PatternId) {
      if (run.on) return;
      state.pattern = id;
      state.mode = 'ball';
      scheduleSave();
      render();
    },
    selectClub(spins: Spins) {
      if (run.on) return;
      if (!selectClub(state, spins)) return;
      scheduleSave();
      render();
    },
    buy(id) {
      if (!buy(state, id)) return;
      flushSave();
      render();
    },
    prestige() {
      if (run.on) return;
      const before = state.balls;
      const r = applyPrestige(state);
      if (r === 'blocked') return;
      toast.show(r === 'done' ? t.toast.done : t.toast.prestige(state.balls));
      if (r === 'advanced') log.info(`prestige ${before} -> ${state.balls}`);
      unlockAchievements();
      flushSave();
      render();
    },
  },
  () => {
    flushSave();
    render();
  },
);

function render(): void {
  hud.wallet(state);
  hud.run(run);
  pane.render(state, run);
}

function setFlash(text: string, tone: Flash['tone']): void {
  flash = { text, tone, at: clock() };
}

function unlockAchievements(): void {
  for (const id of checkAchievements(state)) log.info(`achievement ${id}`);
}

function onEvents(events: RunEvent[]): void {
  let walletDirty = false;
  let paneDirty = false;
  for (const e of events) {
    switch (e.type) {
      case 'throw':
        walletDirty = true;
        setFlash(e.grade === 'wobble' ? t.flash.wobble : e.grade === 'auto' ? t.flash.auto : t.flash.clean, e.grade === 'wobble' ? 'warn' : 'ink');
        break;
      case 'early':
        setFlash(t.flash.early, 'bad');
        break;
      case 'clean':
        toast.show(t.toast.clean(isClubId(e.patternId) ? t.club.runName(t.club.spins[e.spins].name) : t.patterns[e.patternId].name));
        break;
      case 'flash7':
        toast.show(t.toast.flash7);
        paneDirty = true;
        break;
      case 'showcase-cleared':
        toast.show(t.toast.showcase);
        break;
      case 'drop':
        setFlash(t.flash.drop, 'bad');
        break;
      case 'record-open':
        toast.show(t.toast.recordOpen);
        paneDirty = true;
        break;
      case 'milestone': {
        const gains = Object.entries(e.milestone.give)
          .map(([k, v]) => t.gain(v, t.currency[k as keyof typeof t.currency]))
          .join('、');
        toast.show(t.toast.milestone(t.milestones[e.milestone.id] ?? e.milestone.id, gains));
        paneDirty = true;
        break;
      }
      case 'run-end':
        unlockAchievements();
        paneDirty = true;
        flushSave();
        break;
    }
  }
  if (paneDirty) render();
  else if (walletDirty) {
    hud.wallet(state);
    scheduleSave();
  }
}

function onThrow(): void {
  if (!run.on) {
    if (startRun(run, state, clock(), rng)) hud.run(run);
    return;
  }
  onEvents(handleInput(run, state, clock(), rng));
}

hud.startBtn.onclick = () => {
  if (run.on) onEvents(endRun(run, state));
  else onThrow();
};

byId<HTMLButtonElement>('reset-btn').onclick = () => {
  if (!window.confirm(t.confirmReset)) return;
  if (run.on) endRun(run, state);
  state = fresh();
  Object.assign(run, createRun());
  store.clear().catch((e: unknown) => log.error(`clear failed: ${String(e)}`));
  render();
};

bindThrowInput(canvas, onThrow);
window.addEventListener('resize', () => arena.fit());
window.addEventListener('beforeunload', () => {
  if (saveTimer !== undefined) flushSave();
});

// ---- 起動 ----
function frame(now: number): void {
  onEvents(tick(run, state, now, rng));
  arena.draw(now, run, state, flash);
  if (run.on) hud.run(run);
  requestAnimationFrame(frame);
}

/** 開発モード: userData/tuning.override.json で tuning.ts を上書きする */
function applyOverride(override: unknown, announce: boolean): void {
  if (override === null || override === undefined) return;
  const report = applyTuningOverride(override);
  log.info(`tuning override applied=${report.applied.join(',') || '-'} rejected=${report.rejected.join(',') || '-'}`);
  if (announce) {
    toast.show(t.toast.tuningApplied(report.applied.length));
    render();
  }
}

async function boot(): Promise<void> {
  const api = platformApi();
  if (api) {
    applyOverride(await api.tuning.load(), false);
    api.tuning.onChange((o) => applyOverride(o, true));
  }
  let r = await store.load();
  if (r.kind === 'corrupt') {
    const restore = r.hasBackup
      ? await askDialog(t.save.corrupt, [
          { label: t.save.restore, value: true, primary: true },
          { label: t.save.discard, value: false },
        ])
      : false;
    if (restore) r = await store.restoreBackup();
  }
  if (r.kind === 'ok') state = r.state;
  else if (r.kind === 'corrupt') log.warn('save is unreadable; starting fresh');
  log.info(`boot v${platformApi()?.version ?? 'browser'} balls=${state.balls}`);
  render();
  arena.fit();
  requestAnimationFrame(frame);
}

void boot();

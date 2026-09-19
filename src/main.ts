// renderer の入口。core の状態を持ち、render / ui / input / platform を配線する。
import './style.css';
import {
  applyPrestige,
  applyTuningOverride,
  buy,
  convertCatches,
  isClubId,
  selectClub,
  seal,
  selectPassing,
  selectStage,
  selectStreet,
  shiftRun,
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
  TUNING,
} from './core';
import type { Lang, Settings } from '../electron/api';
import { createAudio } from './audio';
import { createClock } from './audio/clock';
import { t } from './i18n';
import { bindThrowInput } from './input';
import { Calibration } from './input/calibrate';
import { GamepadInput } from './input/gamepad';
import { createSaveStore } from './platform/save';
import { applyDisplay, loadSettingsSync, saveSettings } from './platform/settings';
import { installErrorLogging, log } from './platform/log';
import { setPresence, syncAchievements, syncStats } from './platform/steam';
import { platformApi } from './platform/api';
import { Arena, type Flash } from './render/arena';
import { askDialog } from './ui/dialog';
import { byId } from './ui/dom';
import { Hud } from './ui/hud';
import { Pane } from './ui/pane';
import { SettingsPanel } from './ui/settings';
import { Toast } from './ui/toast';

installErrorLogging();

// 時刻と乱数は renderer が決めて core に渡す。拍の基準は AudioContext.currentTime（無ければ performance.now）
const clockSource = createClock();
const rng = (): number => Math.random();
let settings: Settings = loadSettingsSync();
const audio = createAudio(clockSource.context, settings.sound);
/** 入力の時刻。オフセット補正（入力の遅れ）を引く */
const inputNow = (): number => clockSource.now() - settings.input.offsetMs;

let state: SaveState = fresh();
const run = createRun();
const store = createSaveStore();

const hud = new Hud();
const toast = new Toast(byId('toast'));
const canvas = byId<HTMLCanvasElement>('cv');
const arena = new Arena(canvas, { ...t.canvas, showProgress: t.stage.progress });
let flash: Flash | null = null;

byId('title').innerHTML = `${t.title}<small>${t.subtitle}</small>`;
const foot = byId('foot');
foot.innerHTML = `<span>${t.footer}</span><span><button class="iconbtn" id="settings-btn">${t.settings.open}</button> <button id="reset-btn">${t.buttons.reset}</button></span>`;
const pausedBox = document.createElement('div');
pausedBox.id = 'paused';
pausedBox.className = 'paused';
pausedBox.hidden = true;
pausedBox.textContent = t.settings.paused;
canvas.parentElement?.append(pausedBox);

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
    selectStreet(id: PatternId) {
      if (run.on) return;
      if (!selectStreet(state)) return;
      state.pattern = id;
      scheduleSave();
      render();
    },
    selectPassing(id: PatternId) {
      if (run.on) return;
      if (!selectPassing(state, id)) return;
      scheduleSave();
      render();
    },
    openShow() {
      if (run.on) return;
      if (!selectStage(state)) return;
      flushSave();
      render();
    },
    seal(id: PatternId) {
      if (run.on) return;
      void askDialog(t.seal.confirm(t.patterns[id].name), [
        { label: t.seal.button, value: true, primary: true },
        { label: t.buttons.cancel, value: false },
      ]).then((ok) => {
        if (!ok || !seal(state, id)) return;
        toast.show(t.toast.sealed(t.patterns[id].name));
        unlockAchievements();
        flushSave();
        render();
      });
    },
    convert() {
      const gained = convertCatches(state);
      if (gained <= 0) return;
      toast.show(t.toast.converted(gained));
      unlockAchievements();
      flushSave();
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
      if (applyPrestige(state) === 'blocked') return;
      toast.show(`${t.toast.prestige(state.balls)} ${t.toast.sp(TUNING.balls.spPerPrestige)}`);
      log.info(`prestige ${before} -> ${state.balls}`);
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
  flash = { text, tone, at: clockSource.now() };
}

function unlockAchievements(): void {
  const unlocked = checkAchievements(state);
  for (const id of unlocked) log.info(`achievement ${id}`);
  if (unlocked.length) syncAchievements(state);
}

function onEvents(events: RunEvent[]): void {
  let walletDirty = false;
  let paneDirty = false;
  for (const e of events) {
    switch (e.type) {
      case 'throw':
        walletDirty = true;
        setFlash(t.flash[e.grade], e.grade === 'wobble' ? 'warn' : 'ink');
        audio.sfx(e.grade);
        break;
      case 'early':
        setFlash(t.flash.early, 'bad');
        audio.sfx('early');
        break;
      case 'clean':
        audio.sfx('clean-bonus');
        toast.show(
          t.toast.clean(
            isClubId(e.patternId)
              ? t.club.runName(t.club.spins[e.spins].name)
              : e.prop === 'passing'
                ? t.passing.runName(t.patterns[e.patternId].name)
                : t.patterns[e.patternId].name,
          ),
        );
        break;
      case 'flash7':
        toast.show(t.toast.flash7);
        paneDirty = true;
        break;
      case 'applause':
        walletDirty = true;
        break;
      case 'show-complete':
        toast.show(t.toast.showComplete);
        log.info(`show complete beats=${e.beats}`);
        paneDirty = true;
        break;
      case 'shown':
        if (!isClubId(e.patternId)) toast.show(t.toast.shown(t.patterns[e.patternId].name, e.bonus));
        paneDirty = true;
        break;
      case 'showcase-cleared':
        toast.show(t.toast.showcase);
        audio.sfx('showcase');
        setPresence(t.presence.showcase(state.balls));
        break;
      case 'drop':
        setFlash(t.flash.drop, 'bad');
        audio.sfx('drop');
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
        syncStats(state);
        setPresence(t.presence.idle(state.balls));
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
  if (settingsPanel.isOpen || calibration) {
    if (calibration) calibrationTap(inputNow());
    return;
  }
  if (!run.on) {
    if (startRun(run, state, clockSource.now(), rng)) {
      hud.run(run);
      scheduledClick = -1;
      setPresence(t.presence.running(state.balls));
    }
    return;
  }
  onEvents(handleInput(run, state, inputNow(), rng));
}

hud.startBtn.onclick = () => {
  if (run.on) onEvents(endRun(run, state));
  else onThrow();
};

byId<HTMLButtonElement>('reset-btn').onclick = () => {
  if (!window.confirm(t.confirmReset)) return;
  void resetAll();
};

async function resetAll(): Promise<void> {
  if (run.on) endRun(run, state);
  state = fresh();
  Object.assign(run, createRun());
  await store.clear().catch((e: unknown) => log.error(`clear failed: ${String(e)}`));
  render();
}

// ---- 設定 ----
let calibration: Calibration | null = null;
let calibrationResolve: ((offset: number | null) => void) | null = null;
let calibrationProgress: ((taps: number, need: number) => void) | null = null;
let calibrationClickK = -1;

function calibrationTap(now: number): void {
  if (!calibration) return;
  if (calibration.tap(now)) {
    const st = calibration.state;
    calibrationProgress?.(st.taps, st.need);
    if (st.done) finishCalibration(st.offsetMs);
  }
}

function finishCalibration(offset: number | null): void {
  const resolve = calibrationResolve;
  calibration = null;
  calibrationResolve = null;
  calibrationProgress = null;
  resolve?.(offset);
}

const settingsPanel = new SettingsPanel({
  onChange(next) {
    settings = next;
    audio.setSettings(settings.sound);
    throwInput.setKeys(settings.input.throwKeys);
    void applyDisplay(settings);
    saveSettings(settings).catch((e: unknown) => log.error(`settings save failed: ${String(e)}`));
  },
  calibrate(onProgress) {
    return new Promise<number | null>((resolve) => {
      finishCalibration(null);
      calibration = new Calibration(clockSource.now(), TUNING.beat.baseIntervalMs, 8, 2);
      calibrationClickK = -1;
      calibrationResolve = resolve;
      calibrationProgress = onProgress;
    });
  },
  cancelCalibration() {
    finishCalibration(null);
  },
  async deleteSave() {
    await resetAll();
    toast.show(t.settings.save.deleted);
  },
  changeLang(next: Lang) {
    if (run.on) return;
    settings = { ...settings, lang: next };
    saveSettings(settings)
      .then(() => window.location.reload())
      .catch((e: unknown) => log.error(`settings save failed: ${String(e)}`));
  },
  running: () => run.on,
});

byId<HTMLButtonElement>('settings-btn').onclick = () => {
  if (settingsPanel.isOpen) settingsPanel.close();
  else settingsPanel.open(settings);
};
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && settingsPanel.isOpen) settingsPanel.close();
});

// ---- 入力 ----
const throwInput = bindThrowInput(canvas, onThrow, settings.input.throwKeys);
const gamepad = new GamepadInput({
  onThrow,
  onBack: () => {
    if (settingsPanel.isOpen) settingsPanel.close();
  },
  onTabPrev: () => pane.step(-1),
  onTabNext: () => pane.step(1),
});
window.addEventListener('resize', () => arena.fit());

// ---- 一時停止（最小化・非表示） ----
let pausedAt: number | null = null;
const pausedEl = byId('paused');
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (run.on && pausedAt === null) {
      pausedAt = clockSource.now();
      pausedEl.hidden = false;
    }
  } else if (pausedAt !== null) {
    shiftRun(run, clockSource.now() - pausedAt);
    pausedAt = null;
    pausedEl.hidden = true;
    scheduledClick = -1;
  }
});

// ---- 終了時の保存 ----
window.addEventListener('beforeunload', () => {
  if (saveTimer !== undefined) flushSave();
});
platformApi()?.window.onFlushRequest(async () => {
  if (saveTimer !== undefined) window.clearTimeout(saveTimer);
  saveTimer = undefined;
  await store.write(state).catch((e: unknown) => log.error(`final save failed: ${String(e)}`));
});

// ---- 起動 ----
let scheduledClick = -1;
function frame(): void {
  const now = clockSource.now();
  gamepad.poll();
  if (pausedAt === null) {
    onEvents(tick(run, state, now, rng));
    // 次の拍のクリックを予約（拍ごとに 1 回）
    if (run.on && run.next && run.next.k !== scheduledClick) {
      scheduledClick = run.next.k;
      audio.scheduleClick(run.next.at, run.next.k % 4 === 0);
    }
  }
  if (calibration) {
    const k = calibration.nearestBeat(now + calibration.intervalMs / 2);
    if (k !== calibrationClickK) {
      calibrationClickK = k;
      audio.scheduleClick(calibration.beatAt(k), k % 4 === 0);
    }
  }
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
  // 起動時に未同期分を再送する（Steam が落ちていた間の解除など）
  syncAchievements(state);
  syncStats(state);
  setPresence(t.presence.idle(state.balls));
  render();
  arena.fit();
  await applyDisplay(settings);
  log.info(`clock=${clockSource.audio ? 'audio' : 'performance'} offset=${settings.input.offsetMs}ms lang=${settings.lang}`);
  requestAnimationFrame(frame);
}

void boot();

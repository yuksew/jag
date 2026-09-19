// ヘッダの通貨、練習場下の HUD、開始／停止ボタン。core の状態を読むだけ
import type { RunState, SaveState } from '../core';
import { t } from '../i18n';
import { byId } from './dom';

export class Hud {
  private readonly wCatch: HTMLElement;
  private readonly wClean: HTMLElement;
  private readonly wCore: HTMLElement;
  private readonly hBeat: HTMLElement;
  private readonly hStreak: HTMLElement;
  private readonly hRun: HTMLElement;
  private readonly hFat: HTMLElement;
  readonly startBtn: HTMLButtonElement;

  constructor() {
    const wallet = byId('wallet');
    wallet.innerHTML = (['catch', 'clean', 'core'] as const)
      .map((k) => `<div><b id="w-${k}">0</b><span>${t.currency[k]}</span></div>`)
      .join('');
    const hud = byId('hud');
    hud.innerHTML =
      `<div class="stat">` +
      `<div>${t.hud.beat} <b id="h-beat">0</b></div>` +
      `<div>${t.hud.streak} <b id="h-streak">0</b></div>` +
      `<div>${t.hud.run} <b id="h-run">0</b></div>` +
      `<div>${t.hud.fatigue} <span class="fat"><i id="h-fat"></i></span></div>` +
      `</div><button class="btn" id="start-btn">${t.buttons.start}</button>`;
    this.wCatch = byId('w-catch');
    this.wClean = byId('w-clean');
    this.wCore = byId('w-core');
    this.hBeat = byId('h-beat');
    this.hStreak = byId('h-streak');
    this.hRun = byId('h-run');
    this.hFat = byId('h-fat');
    this.startBtn = byId<HTMLButtonElement>('start-btn');
  }

  wallet(state: SaveState): void {
    this.wCatch.textContent = String(state.catch);
    this.wClean.textContent = String(state.clean);
    this.wCore.textContent = String(state.core);
  }

  run(run: RunState): void {
    this.hBeat.textContent = String(run.beats);
    this.hStreak.textContent = String(run.streak);
    this.hRun.textContent = String(run.catches);
    this.hFat.style.width = `${Math.min(100, run.fatigue * 100)}%`;
    this.startBtn.textContent = run.on ? t.buttons.stop : t.buttons.start;
  }
}

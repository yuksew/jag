// 窓口の帯（通貨）、Canvas 下端の板 HUD、開始／停止ボタン。core の状態を読むだけ
import { inShowcase, type RunState, type SaveState } from '../core';
import { t } from '../i18n';
import { byId } from './dom';
import { CURRENCY_ICON } from './icons';

/** 見せ場のこの拍数前から HUD のラベルを予告色にする（Canvas の予告と同じ） */
const SHOWCASE_WARN_BEATS = 8;

export class Hud {
  private readonly wallets: Record<'catch' | 'clean' | 'core' | 'applause' | 'sp', HTMLElement>;
  private readonly hBeat: HTMLElement;
  private readonly hBeatLabel: HTMLElement;
  private readonly hBeatTile: HTMLElement;
  private readonly hStreak: HTMLElement;
  private readonly hRun: HTMLElement;
  private readonly hFat: HTMLElement;
  private readonly hFatBox: HTMLElement;
  private readonly hudEl: HTMLElement;
  readonly startBtn: HTMLButtonElement;
  private last: Record<string, string> = {};

  constructor() {
    const wallet = byId('wallet');
    // 窓口の帯: アイコン + スラブ体の数字 + 小さなラベルを横並び
    const card = (k: 'catch' | 'clean' | 'core' | 'applause' | 'sp', label: string, hidden: boolean): string =>
      `<div class="card c-${k}" id="w-${k}-box" ${hidden ? 'hidden' : ''} title="${label}">${CURRENCY_ICON[k]}<b id="w-${k}">0</b><span>${label}</span></div>`;
    wallet.innerHTML =
      card('catch', t.currency.catch, false) +
      card('clean', t.currency.clean, false) +
      card('core', t.currency.core, false) +
      card('applause', t.applause, true) +
      card('sp', t.currency.sp, true);
    const hud = byId('hud');
    hud.innerHTML =
      `<div class="stat">` +
      `<div class="tile" id="h-beat-tile"><span class="lb" id="h-beat-label">${t.hud.beat}</span><b id="h-beat">0</b></div>` +
      `<div class="tile"><span class="lb">${t.hud.streak}</span><b id="h-streak">0</b></div>` +
      `<div class="tile"><span class="lb">${t.hud.run}</span><b id="h-run">0</b></div>` +
      `<div class="tile fatigue" id="h-fat-box"><span class="lb">${t.hud.fatigue}</span><span class="fat"><i id="h-fat"></i></span></div>` +
      `</div><button class="btn primary" id="start-btn">${t.buttons.start}</button>`;
    this.hudEl = hud;
    this.wallets = {
      catch: byId('w-catch'),
      clean: byId('w-clean'),
      core: byId('w-core'),
      applause: byId('w-applause'),
      sp: byId('w-sp'),
    };
    this.hBeat = byId('h-beat');
    this.hBeatLabel = byId('h-beat-label');
    this.hBeatTile = byId('h-beat-tile');
    this.hStreak = byId('h-streak');
    this.hRun = byId('h-run');
    this.hFat = byId('h-fat');
    this.hFatBox = byId('h-fat-box');
    this.startBtn = byId<HTMLButtonElement>('start-btn');
  }

  /** 数字を書き換え、変わったときだけ短く弾ませる */
  private setNum(el: HTMLElement, key: string, value: number): void {
    const s = String(value);
    if (this.last[key] === s) return;
    const first = this.last[key] === undefined;
    this.last[key] = s;
    el.textContent = s;
    if (first) return;
    el.classList.remove('bump');
    void el.offsetWidth; // アニメーションを再始動させる
    el.classList.add('bump');
  }

  wallet(state: SaveState): void {
    this.setNum(this.wallets.catch, 'catch', state.catch);
    this.setNum(this.wallets.clean, 'clean', state.clean);
    this.setNum(this.wallets.core, 'core', state.core);
    this.setNum(this.wallets.applause, 'applause', state.applause);
    this.setNum(this.wallets.sp, 'sp', state.sp);
    byId('w-applause-box').hidden = !(state.applause > 0 || state.shown.length > 0 || state.mode === 'street');
    byId('w-sp-box').hidden = !(state.sp > 0 || state.balls > 3);
    // 通貨が 4 つ以上並ぶときはラベルを畳んでアイコン + 数字だけにする（帯 1 本に収める）
    const shown = byId('wallet').querySelectorAll('.card:not([hidden])').length;
    byId('wallet').classList.toggle('dense', shown >= 4);
  }

  run(run: RunState): void {
    this.hBeat.textContent = String(run.beats);
    this.hStreak.textContent = String(run.streak);
    this.hRun.textContent = run.prop === 'street' ? t.street.runApplause(run.applause) : String(run.catches);
    const f = Math.min(1, Math.max(0, run.fatigue));
    this.hFat.style.width = `${f * 100}%`;
    this.hFatBox.classList.toggle('mid', f >= 0.4 && f < 0.7);
    this.hFatBox.classList.toggle('hi', f >= 0.7);
    // 見せ場の予告と最中はラベルを変えて色を付ける
    let label = t.hud.beat;
    let hot = false;
    let live = false;
    if (run.on && !run.showcaseDone) {
      if (inShowcase(run.k, run.showcaseAt)) {
        label = t.hud.showcase;
        hot = true;
        live = true;
      } else if (run.k >= run.showcaseAt - SHOWCASE_WARN_BEATS && run.k < run.showcaseAt) {
        label = t.hud.showcaseIn(run.showcaseAt - run.k);
        hot = true;
      }
    }
    if (this.hBeatLabel.textContent !== label) this.hBeatLabel.textContent = label;
    this.hBeatTile.classList.toggle('hot', hot);
    this.hudEl.classList.toggle('showcase', live);
    this.hudEl.classList.toggle('on', run.on);
    const btnLabel = run.on ? t.buttons.stop : t.buttons.start;
    if (this.startBtn.textContent !== btnLabel) this.startBtn.textContent = btnLabel;
    this.startBtn.classList.toggle('stop', run.on);
  }
}

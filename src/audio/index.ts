// 拍のクリック音・判定音・ジングル・環境音。Web Audio でその場で合成する（素材ファイル無し）。
// レシピは sfx.ts / ambience.ts、ノードの寿命管理は synth.ts。ここは配線と音量だけ。
import type { Settings } from '../../electron/api';
import type { ThrowGrade } from '../core';
import { createAmbience, type AmbienceKind } from './ambience';
import * as sfx from './sfx';
import { MAX_VOICES, Synth } from './synth';

export type { AmbienceKind } from './ambience';

export type SfxKind =
  | ThrowGrade
  | 'drop'
  | 'early'
  | 'clean-bonus'
  | 'showcase'
  | 'record-open'
  | 'prestige'
  | 'show-complete'
  | 'shown';

export interface Audio {
  /**
   * 拍の時刻（clock.now() と同じ基準、ms）にクリックを予約する。
   * 既に過ぎていれば即時。showcase が真なら金属的な音色になる
   */
  scheduleClick(atMs: number, accent: boolean, showcase?: boolean): void;
  sfx(kind: SfxKind): void;
  /** 環境音を切り替える。null で止める（ランの開始／終了で呼ぶ） */
  setAmbience(kind: AmbienceKind | null): void;
  /** 環境音のオン／オフ（設定項目は無いので内部フラグ。既定はオン） */
  setAmbienceEnabled(on: boolean): void;
  setSettings(s: Settings['sound']): void;
  /** 生きているボイス数と上限（テスト・デバッグ用） */
  stats(): { voices: number; limit: number };
}

/** 音量変更をなめらかにする時定数（秒） */
const VOLUME_SMOOTH = 0.02;

export function createAudio(ctx: AudioContext | null, initial: Settings['sound']): Audio {
  let sound = initial;
  if (!ctx) {
    return {
      scheduleClick: () => undefined,
      sfx: () => undefined,
      setAmbience: () => undefined,
      setAmbienceEnabled: () => undefined,
      setSettings: (s) => void (sound = s),
      stats: () => ({ voices: 0, limit: MAX_VOICES }),
    };
  }

  // バス構成: sfx / click / ambience → master → destination
  const master = ctx.createGain();
  master.connect(ctx.destination);
  const sfxBus = ctx.createGain();
  sfxBus.connect(master);
  const clickBus = ctx.createGain();
  clickBus.connect(master);
  const ambBus = ctx.createGain();
  ambBus.connect(master);

  const setGain = (g: GainNode, v: number): void => {
    g.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, VOLUME_SMOOTH);
  };
  const apply = (): void => {
    setGain(master, sound.master);
    setGain(sfxBus, sound.sfx);
    setGain(clickBus, sound.click ? sound.sfx : 0);
    setGain(ambBus, sound.sfx);
  };
  master.gain.value = sound.master;
  sfxBus.gain.value = sound.sfx;
  clickBus.gain.value = sound.click ? sound.sfx : 0;
  ambBus.gain.value = sound.sfx;

  const synth = new Synth(ctx);
  const ambience = createAmbience(ctx, ambBus);

  return {
    scheduleClick(atMs, accent, showcase = false) {
      // 止まっている間に予約すると再開時にまとめて鳴るので捨てる
      if (!sound.click || ctx.state !== 'running') return;
      const at = Math.max(ctx.currentTime, atMs / 1000);
      if (showcase) sfx.metalClick(synth, clickBus, at, accent);
      else sfx.woodblock(synth, clickBus, at, accent);
    },
    sfx(kind) {
      if (ctx.state !== 'running') return;
      const at = ctx.currentTime;
      switch (kind) {
        case 'clean':
          sfx.sparkle(synth, sfxBus, at);
          break;
        case 'auto':
          sfx.soft(synth, sfxBus, at, false);
          break;
        case 'partner':
          sfx.soft(synth, sfxBus, at, true);
          break;
        case 'wobble':
          sfx.wobble(synth, sfxBus, at);
          break;
        case 'drop':
          sfx.drop(synth, sfxBus, at);
          break;
        case 'early':
          sfx.whiff(synth, sfxBus, at);
          break;
        case 'clean-bonus':
          sfx.cleanBonus(synth, sfxBus, at);
          break;
        case 'showcase':
          sfx.showcaseChord(synth, sfxBus, at);
          break;
        case 'record-open':
          sfx.recordOpen(synth, sfxBus, at);
          break;
        case 'prestige':
          sfx.prestige(synth, sfxBus, at);
          break;
        case 'show-complete':
          sfx.showComplete(synth, sfxBus, at);
          break;
        case 'shown':
          sfx.applause(synth, sfxBus, at);
          break;
      }
    },
    setAmbience(kind) {
      ambience.set(kind);
    },
    setAmbienceEnabled(on) {
      ambience.enable(on);
    },
    setSettings(s) {
      sound = s;
      apply();
    },
    stats() {
      return { voices: synth.voices, limit: MAX_VOICES };
    },
  };
}

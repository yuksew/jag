// 拍のクリック音と判定音。Web Audio でその場で合成する（素材ファイル無し）。
import type { Settings } from '../../electron/api';
import type { ThrowGrade } from '../core';

export type SfxKind = ThrowGrade | 'drop' | 'early' | 'clean-bonus' | 'showcase';

export interface Audio {
  /** 拍の時刻（clock.now() と同じ基準、ms）にクリックを予約する */
  scheduleClick(atMs: number, accent: boolean): void;
  sfx(kind: SfxKind): void;
  setSettings(s: Settings['sound']): void;
}

export function createAudio(ctx: AudioContext | null, initial: Settings['sound']): Audio {
  let sound = initial;
  if (!ctx) {
    return { scheduleClick: () => undefined, sfx: () => undefined, setSettings: (s) => void (sound = s) };
  }
  const master = ctx.createGain();
  master.connect(ctx.destination);
  const apply = (): void => {
    master.gain.value = sound.master;
  };
  apply();

  const tone = (freq: number, at: number, dur: number, gain: number, type: OscillatorType = 'sine'): void => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  };

  return {
    scheduleClick(atMs, accent) {
      if (!sound.click) return;
      const at = Math.max(ctx.currentTime, atMs / 1000);
      tone(accent ? 1760 : 1320, at, 0.03, 0.25 * sound.sfx, 'square');
    },
    sfx(kind) {
      const at = ctx.currentTime;
      const v = sound.sfx;
      switch (kind) {
        case 'clean':
          tone(880, at, 0.08, 0.3 * v);
          break;
        case 'auto':
        case 'partner':
          tone(660, at, 0.06, 0.15 * v);
          break;
        case 'wobble':
          tone(440, at, 0.12, 0.3 * v, 'triangle');
          tone(415, at + 0.03, 0.1, 0.2 * v, 'triangle');
          break;
        case 'drop':
          tone(220, at, 0.25, 0.35 * v, 'sawtooth');
          tone(110, at + 0.05, 0.3, 0.3 * v, 'sawtooth');
          break;
        case 'early':
          tone(330, at, 0.05, 0.15 * v, 'triangle');
          break;
        case 'clean-bonus':
          tone(880, at, 0.08, 0.3 * v);
          tone(1108, at + 0.08, 0.08, 0.3 * v);
          tone(1320, at + 0.16, 0.14, 0.3 * v);
          break;
        case 'showcase':
          tone(660, at, 0.1, 0.3 * v);
          tone(990, at + 0.1, 0.2, 0.3 * v);
          break;
      }
    },
    setSettings(s) {
      sound = s;
      apply();
    },
  };
}

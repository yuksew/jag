import { describe, expect, it } from 'vitest';
import { createRun, handleInput, startRun, tick, type RunEvent } from './run';
import { canOpenShow, isShowComplete, selectStage, showProgress } from './stage';
import { fresh } from './state';
import { TUNING } from './tuning';
import type { Rng } from './types';

const never: Rng = () => 0.999;

function ready() {
  const s = fresh();
  s.balls = 7;
  s.recordOpen = true;
  s.flash7 = true;
  s.applause = 1000;
  return s;
}

function throwClean(run: ReturnType<typeof createRun>, s: ReturnType<typeof fresh>, n: number): RunEvent[] {
  const events: RunEvent[] = [];
  for (let i = 0; i < n && run.on; i++) {
    const at = run.next?.at ?? 0;
    events.push(...tick(run, s, at - 1, never));
    events.push(...handleInput(run, s, at, never));
  }
  return events;
}

describe('舞台: 解放', () => {
  it('7 球フラッシュと拍手 1000 が揃うまで開けない。完走後も開けない', () => {
    const s = ready();
    s.flash7 = false;
    expect(canOpenShow(s)).toBe(false);
    expect(selectStage(s)).toBe(false);
    s.flash7 = true;
    s.applause = 999;
    expect(canOpenShow(s)).toBe(false);
    s.applause = 1000;
    expect(selectStage(s)).toBe(true);
    expect(s.mode).toBe('stage');
    expect(s.pattern).toBe('7');
    s.done = true;
    expect(canOpenShow(s)).toBe(false);
  });
});

describe('舞台: ショー', () => {
  it('規定拍を投げ切ると完走。ランは落球ではなく成功として閉じる', () => {
    const s = ready();
    selectStage(s);
    const run = createRun();
    startRun(run, s, 0, never);
    expect(run.prop).toBe('stage');
    expect(run.baseToleranceMs).toBeCloseTo(140 * 0.4 * TUNING.balls.toleranceFactor[7] * TUNING.stage.toleranceFactor);
    expect(showProgress(run)).toEqual({ beats: 0, need: TUNING.stage.showBeats });
    const events = throwClean(run, s, 100);
    expect(isShowComplete(run)).toBe(true);
    expect(s.done).toBe(true);
    expect(run.on).toBe(false);
    expect(run.ended).toBe(false);
    expect(run.beats).toBe(TUNING.stage.showBeats);
    const types = events.map((e) => e.type);
    expect(types).toContain('show-complete');
    expect(types).not.toContain('drop');
    expect(types.at(-1) === 'run-end' || types.at(-1) === 'milestone').toBe(true);
    expect(s.runs).toBe(1);
    expect(s.applause).toBe(1000); // 拍手は減らない
  });

  it('途中で落とせば完走にならず、やり直せる', () => {
    const s = ready();
    selectStage(s);
    const run = createRun();
    startRun(run, s, 0, never);
    throwClean(run, s, 10);
    handleInput(run, s, (run.next?.at ?? 0) + 500, never);
    expect(run.on).toBe(false);
    expect(s.done).toBe(false);
    expect(canOpenShow(s)).toBe(true);
    expect(startRun(run, s, 10000, never)).toBe(true);
  });

  it('完走後はランを始められない', () => {
    const s = ready();
    s.done = true;
    expect(startRun(createRun(), s, 0, never)).toBe(false);
  });
});

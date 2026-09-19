// 1 ランの進行。投げ・落球・見せ場・通貨付与。
// RunState は保存しない。SaveState への書き込みはここと tree / prestige / milestones だけが行う。
import {
  effectiveTolerance,
  inShowcase,
  isAutoDue,
  isMissed,
  isShowcaseFinal,
  judgeInput,
  scheduleBeat,
  showcaseStart,
  type Beat,
} from './beat';
import { checkMilestones, type Milestone } from './milestones';
import {
  ballEffects,
  catchGain,
  clubPattern,
  initialHands,
  isClubId,
  landingHand,
  PATTERNS,
  throwingHand,
  throwValue,
  type Pattern,
  type PropPatternId,
} from './patterns';
import type { PracticeMode, SaveState } from './state';
import { derived, type Derived } from './tree';
import { TUNING, type Spins } from './tuning';
import type { Hand, Ms, Rng, ThrowGrade } from './types';

export interface Flight {
  from: Hand;
  to: Hand;
  /** 投げた時刻（拍の時刻） */
  t0: Ms;
  durationMs: number;
  /** 高度。描画側で画面高さに掛ける（カスケードの 3 が 1.0） */
  height: number;
  /** wobble のときの横ずれ方向（−1 / 0 / 1）。量は描画側 */
  wobble: -1 | 0 | 1;
}

export interface Ball {
  /** 色の割り当てなどに使う通し番号 */
  index: number;
  hand: Hand;
  flight: Flight | null;
}

export interface RunState {
  on: boolean;
  /** 直前のランが落球で終わったか（開始前の表示用） */
  ended: boolean;
  t0: Ms;
  /** 次に投げる拍の番号 */
  k: number;
  next: Beat | null;
  fatigue: number;
  /** ノーミス連続 */
  streak: number;
  /** このランで投げた拍数 */
  beats: number;
  /** このランで得たキャッチ */
  catches: number;
  showcaseAt: number;
  showcaseDone: boolean;
  /** 直前の投げが自動だったか（流れのボーナス） */
  lastAuto: boolean;
  intervalMs: number;
  /** ツリーの許容幅 × パターン係数 */
  baseToleranceMs: number;
  derived: Derived;
  pattern: Pattern;
  /** 球かクラブか */
  prop: PracticeMode;
  /** クラブの回転数（球のときは 1） */
  spins: Spins;
  /** このランのクリーン間隔（球数で変わる） */
  cleanEvery: number;
  /** 球数による高度係数 */
  heightFactor: number;
  balls: Ball[];
  /** 各手が持つ球の index。先頭から投げる */
  hands: [number[], number[]];
}

export type RunEvent =
  | { type: 'throw'; grade: ThrowGrade; k: number; gain: number }
  | { type: 'early' }
  | { type: 'clean'; patternId: PropPatternId; prop: PracticeMode; spins: Spins; count: number }
  | { type: 'showcase-cleared' }
  | { type: 'flash7' }
  | { type: 'drop' }
  | { type: 'run-end'; beats: number; catches: number }
  | { type: 'record-open' }
  | { type: 'milestone'; milestone: Milestone };

export function createRun(): RunState {
  return {
    on: false,
    ended: false,
    t0: 0,
    k: 0,
    next: null,
    fatigue: 0,
    streak: 0,
    beats: 0,
    catches: 0,
    showcaseAt: 0,
    showcaseDone: false,
    lastAuto: false,
    intervalMs: TUNING.beat.baseIntervalMs,
    baseToleranceMs: TUNING.beat.baseToleranceMs,
    derived: derived({ tree: {} } as SaveState),
    pattern: PATTERNS['3'],
    prop: 'ball',
    spins: 1,
    cleanEvery: TUNING.clean.everyBeats[3],
    heightFactor: 1,
    balls: [],
    hands: [[], []],
  };
}

/** ランを開始する。既に進行中か完走済みなら false */
export function startRun(run: RunState, state: SaveState, now: Ms, rng: Rng): boolean {
  if (run.on || state.done) return false;
  const pattern = state.mode === 'club' ? clubPattern(state.balls, state.spins) : PATTERNS[state.pattern];
  const effects = ballEffects(state.balls);
  const d = derived(state);
  run.on = true;
  run.ended = false;
  run.t0 = now;
  run.k = 0;
  run.fatigue = 0;
  run.streak = 0;
  run.beats = 0;
  run.catches = 0;
  run.showcaseAt = showcaseStart(state.core);
  run.showcaseDone = false;
  run.lastAuto = false;
  run.intervalMs = d.intervalMs;
  run.baseToleranceMs = d.toleranceMs * pattern.toleranceFactor * effects.toleranceFactor;
  run.derived = d;
  run.pattern = pattern;
  run.prop = state.mode;
  run.spins = state.mode === 'club' ? state.spins : 1;
  run.cleanEvery = effects.cleanEvery;
  run.heightFactor = effects.heightFactor * pattern.heightFactor;
  run.balls = initialHands(pattern.balls).map((hand, index) => ({ index, hand, flight: null }));
  run.hands = [[], []];
  for (const b of run.balls) run.hands[b.hand].push(b.index);
  nextBeat(run, rng);
  return true;
}

function nextBeat(run: RunState, rng: Rng): void {
  run.next = scheduleBeat(run.t0, run.intervalMs, run.k, run.derived.auto, rng);
}

/** k 拍目の実効許容幅 */
export function toleranceAt(run: RunState, k: number): number {
  return effectiveTolerance({
    baseToleranceMs: run.baseToleranceMs,
    fatigue: run.fatigue,
    showcase: inShowcase(k, run.showcaseAt),
    afterAuto: run.lastAuto,
    flowBonusMs: run.derived.flowMs,
  });
}

function throwBall(run: RunState, state: SaveState, grade: ThrowGrade, rng: Rng): RunEvent[] {
  const beat = run.next;
  if (!beat) return [];
  const events: RunEvent[] = [];
  const k = beat.k;
  const hand = throwingHand(k);
  const value = throwValue(run.pattern, k);

  // 手が空なら反対の手から取る。球が無くても投げは成立する（試作準拠）
  const index = run.hands[hand].shift() ?? run.hands[hand === 0 ? 1 : 0].shift();
  const ball = index === undefined ? undefined : run.balls[index];
  if (ball) {
    const dwell = run.intervalMs * TUNING.flight.dwellFactor;
    const durationMs = Math.max(value * run.intervalMs - dwell, run.intervalMs * TUNING.flight.minDurationFactor);
    let height = Math.pow(value / TUNING.balls.start, TUNING.flight.heightExponent) * run.heightFactor;
    if (inShowcase(k, run.showcaseAt)) height *= TUNING.showcase.heightFactor;
    ball.flight = {
      from: hand,
      to: landingHand(hand, value),
      t0: beat.at,
      durationMs,
      height,
      wobble: grade === 'wobble' ? (rng() < 0.5 ? -1 : 1) : 0,
    };
  }

  beat.thrown = true;
  run.beats = k + 1;

  // 疲労: 投げごとに増え、wobble 以外なら呼吸で少し抜ける
  run.fatigue += run.derived.fatigueRate;
  if (grade !== 'wobble') run.fatigue = Math.max(0, run.fatigue - run.derived.breath);

  // 通貨
  const gain = catchGain(run.pattern, state.balls);
  state.catch += gain;
  state.totalCatches += gain;
  run.catches += gain;
  events.push({ type: 'throw', grade, k, gain });

  if (grade === 'wobble') {
    run.streak = 0;
  } else {
    run.streak++;
    if (run.streak % run.cleanEvery === 0) {
      state.clean++;
      const id = run.pattern.id;
      let count: number;
      if (isClubId(id)) {
        count = (state.clubClean[run.spins] ?? 0) + 1;
        state.clubClean[run.spins] = count;
      } else {
        count = (state.patClean[id] ?? 0) + 1;
        state.patClean[id] = count;
      }
      events.push({ type: 'clean', patternId: id, prop: run.prop, spins: run.spins, count });
    }
  }
  run.lastAuto = grade === 'auto';

  if (isShowcaseFinal(k, run.showcaseAt) && !run.showcaseDone) {
    run.showcaseDone = true;
    state.core++;
    events.push({ type: 'showcase-cleared' });
  }

  // 7 球フラッシュ: 7 球すべてが同時に空中
  if (!state.flash7 && run.prop === 'ball' && run.balls.length >= TUNING.tabs.stageBalls && run.balls.every((b) => b.flight)) {
    state.flash7 = true;
    events.push({ type: 'flash7' });
  }

  run.k++;
  nextBeat(run, rng);
  return events;
}

/** ランを終える（落球、または「やめる」）。記録の更新と節目の判定 */
export function endRun(run: RunState, state: SaveState): RunEvent[] {
  if (!run.on) return [];
  run.on = false;
  run.ended = true;
  run.next = null;
  const events: RunEvent[] = [{ type: 'drop' }];
  state.runs++;
  state.bestRun = Math.max(state.bestRun, run.beats);
  if (!state.recordOpen && state.totalCatches >= TUNING.tabs.recordCatches) {
    state.recordOpen = true;
    events.push({ type: 'record-open' });
  }
  events.push({ type: 'run-end', beats: run.beats, catches: run.catches });
  for (const milestone of checkMilestones(state)) events.push({ type: 'milestone', milestone });
  return events;
}

/**
 * 「投げる」入力。進行中でなければ何もしない（開始は startRun）。
 * 自動拍と投げ済みの拍では無視する。
 */
export function handleInput(run: RunState, state: SaveState, now: Ms, rng: Rng): RunEvent[] {
  if (!run.on) return [];
  const beat = run.next;
  if (!beat || beat.thrown || beat.auto) return [];
  const result = judgeInput({
    now,
    beat,
    baseToleranceMs: run.baseToleranceMs,
    toleranceMs: toleranceAt(run, beat.k),
    eye: { read: run.derived.read, chase: run.derived.chase },
    rng,
  });
  switch (result) {
    case 'early':
      return [{ type: 'early' }];
    case 'clean':
    case 'wobble':
      return throwBall(run, state, result, rng);
    case 'drop':
      return endRun(run, state);
  }
}

/** 毎フレーム呼ぶ。自動投げ、未入力の落球、球の着地 */
export function tick(run: RunState, state: SaveState, now: Ms, rng: Rng): RunEvent[] {
  if (!run.on) return [];
  let events: RunEvent[] = [];
  const beat = run.next;
  if (beat && !beat.thrown) {
    if (isAutoDue(now, beat)) {
      events = throwBall(run, state, 'auto', rng);
    } else if (isMissed(now, beat, run.baseToleranceMs, toleranceAt(run, beat.k))) {
      events = endRun(run, state);
    }
  }
  // 着地
  for (const b of run.balls) {
    if (b.flight && now >= b.flight.t0 + b.flight.durationMs) {
      b.hand = b.flight.to;
      b.flight = null;
      run.hands[b.hand].push(b.index);
    }
  }
  return events;
}

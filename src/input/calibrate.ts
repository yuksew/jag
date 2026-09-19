// 入力オフセット補正。拍に合わせて N 回叩き、（入力時刻 − 拍の時刻）の平均をオフセットにする。
// DOM も音も知らない。呼び出し側が拍を鳴らし、入力時刻を渡す。
export interface CalibrationState {
  readonly intervalMs: number;
  readonly taps: number;
  readonly need: number;
  readonly errors: readonly number[];
  readonly done: boolean;
  /** 平均遅延（ms）。未完了なら null */
  readonly offsetMs: number | null;
}

export class Calibration {
  private readonly errs: number[] = [];

  constructor(
    private readonly t0: number,
    readonly intervalMs: number,
    readonly need = 8,
    /** 最初の何拍かは聞くだけにして、入力を採らない */
    readonly leadBeats = 2,
  ) {}

  /** k 拍目の時刻 */
  beatAt(k: number): number {
    return this.t0 + this.intervalMs * (k + 1);
  }

  /** now に最も近い拍の番号 */
  nearestBeat(now: number): number {
    return Math.max(0, Math.round((now - this.t0) / this.intervalMs) - 1);
  }

  /** 入力を 1 つ採る。採らなかった（早すぎ・完了済み）なら false */
  tap(now: number): boolean {
    if (this.done) return false;
    const k = this.nearestBeat(now);
    if (k < this.leadBeats) return false;
    const err = now - this.beatAt(k);
    if (Math.abs(err) >= this.intervalMs / 2) return false;
    this.errs.push(err);
    return true;
  }

  get done(): boolean {
    return this.errs.length >= this.need;
  }

  get state(): CalibrationState {
    const errors = [...this.errs];
    const offsetMs = this.done ? Math.round(errors.reduce((a, b) => a + b, 0) / errors.length) : null;
    return { intervalMs: this.intervalMs, taps: errors.length, need: this.need, errors, done: this.done, offsetMs };
  }
}

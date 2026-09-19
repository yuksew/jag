import { describe, expect, it } from 'vitest';
import { Calibration } from './calibrate';

describe('入力オフセット補正', () => {
  it('8 回の（入力 − 拍）の平均がオフセットになる', () => {
    const c = new Calibration(1000, 600, 8, 2);
    // 最初の 2 拍は採らない
    expect(c.tap(c.beatAt(0) + 30)).toBe(false);
    expect(c.tap(c.beatAt(1) + 30)).toBe(false);
    for (let k = 2; k < 10; k++) expect(c.tap(c.beatAt(k) + (k % 2 === 0 ? 40 : 20))).toBe(true);
    const s = c.state;
    expect(s.done).toBe(true);
    expect(s.taps).toBe(8);
    expect(s.offsetMs).toBe(30);
    expect(c.tap(c.beatAt(10))).toBe(false); // 完了後は採らない
  });

  it('早すぎる入力は前の拍に、遅すぎる入力は次の拍に寄せる。半拍以上ずれていれば捨てる', () => {
    const c = new Calibration(0, 600, 8, 0);
    expect(c.tap(600 - 100)).toBe(true); // k=0 の −100
    expect(c.tap(1200 + 250)).toBe(true); // k=1 の +250
    expect(c.state.errors).toEqual([-100, 250]);
    expect(c.tap(1800 + 300)).toBe(false); // ちょうど半拍はどちらとも言えないので捨てる
  });

  it('負のオフセット（早く叩く癖）も出る', () => {
    const c = new Calibration(0, 500, 4, 0);
    for (let k = 0; k < 4; k++) c.tap(c.beatAt(k) - 25);
    expect(c.state.offsetMs).toBe(-25);
  });
});

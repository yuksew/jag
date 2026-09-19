/** 0〜1 の乱数を返す。core は Math.random を直接呼ばず、これを引数で受け取る */
export type Rng = () => number;

/** ミリ秒。基準時計は呼び出し側が決める（試作は performance.now、本番は AudioContext.currentTime×1000） */
export type Ms = number;

export type CurrencyKey = 'catch' | 'clean' | 'core';

/** 0 = 右手、1 = 左手 */
export type Hand = 0 | 1;

/** 投げの成立の仕方。auto は筋記憶による自動投げ（clean 扱い） */
export type ThrowGrade = 'clean' | 'wobble' | 'auto';

/** 入力タイミングの判定 */
export type Verdict = 'clean' | 'wobble' | 'drop';

export function otherHand(h: Hand): Hand {
  return h === 0 ? 1 : 0;
}

// 調整用の定数はすべてここに置く。関数の中に数値を直書きしない（CLAUDE.md）。
// 値は docs/DESIGN.md「現在の調整値」と試作 reference/prototype.html に合わせてある。
// 開発モードでは userData/tuning.override.json で上書きできる（override.ts）。

export type BallCount = 3 | 4 | 5 | 6 | 7;
export type Spins = 1 | 2 | 3;

export const TUNING = {
  beat: {
    /** 拍の基本間隔 */
    baseIntervalMs: 620,
    /** 「速さ」1 段階ごとの短縮 */
    speedStepMs: 35,
    /** 許容幅の基本 */
    baseToleranceMs: 140,
    /** 「精度」1 段階ごとの拡張 */
    precisionStepMs: 12,
    /** 誤差 ≤ 許容幅 × wobbleFactor なら wobble */
    wobbleFactor: 2,
    /** 拍より 基本許容幅 × earlyIgnoreFactor 以上早い入力は無視する（試作準拠。DESIGN には無い） */
    earlyIgnoreFactor: 2,
    /** 拍から 許容幅 × missFactor 過ぎても入力が無ければ drop */
    missFactor: 2,
    /**
     * 未入力の締切に基本許容幅（疲労・見せ場・流れを反映しない）を使う。
     * 試作の挙動。false にすると実効許容幅を使う（docs/PROTOTYPE_DIFF.md）。
     */
    missDeadlineUsesBaseTolerance: true,
  },
  fatigue: {
    /** 投げ 1 回ごとの増加 */
    perBeat: 0.02,
    /** 「持久」1 段階ごとの増加抑制（割合） */
    staminaStep: 0.12,
    /** 「呼吸」1 段階ごとの回復（wobble 以外の投げごと） */
    breathStep: 0.006,
    /** 許容幅 = 基本 × (1 − toleranceShrink × min(疲労, 1)) */
    toleranceShrink: 0.5,
  },
  eye: {
    /** 「先読み」1 段階ごとの wobble → clean 確率 */
    readStep: 0.15,
    /** 「追い目」1 段階ごとの drop → wobble 確率 */
    chaseStep: 0.12,
  },
  memory: {
    /** 「筋記憶」1 段階ごとの自動投げ割合 */
    autoStep: 0.1,
    /** 「流れ」: 自動投げ直後の拍の許容幅ボーナス */
    flowBonusMs: 40,
  },
  clean: {
    /** ノーミス連続がこの拍数に達するごとにクリーン +1（球数ごと。球が増えると出やすくなる） */
    everyBeats: { 3: 30, 4: 30, 5: 27, 6: 24, 7: 20 } as Record<BallCount, number>,
  },
  showcase: {
    /** 見せ場の開始拍 = baseAt + perCore × 所持コア */
    baseAt: 40,
    perCore: 15,
    /** 見せ場の長さ（拍） */
    lengthBeats: 5,
    /** 見せ場中の許容幅係数 */
    toleranceFactor: 0.65,
    /** 見せ場中の高度係数 */
    heightFactor: 1.3,
  },
  catches: {
    /** キャッチ倍率 = パターン係数 × (1 + perExtraBall × (球数 − 3)) */
    perExtraBall: 0.5,
  },
  balls: {
    start: 3,
    max: 7,
    /** 球数追加に消費するコア */
    prestigeCoreCost: 1,
    /** 球数ごとの許容幅係数（「許容幅が狭まる」）。3・4 球は試作準拠で 1.0 */
    toleranceFactor: { 3: 1, 4: 1, 5: 0.95, 6: 0.9, 7: 0.85 } as Record<BallCount, number>,
    /** 球数ごとの高度係数（「要求高度が上がる」） */
    heightFactor: { 3: 1, 4: 1, 5: 1.1, 6: 1.2, 7: 1.3 } as Record<BallCount, number>,
  },
  club: {
    /** 回転数ごとの許容幅係数 */
    toleranceFactor: { 1: 1, 2: 0.8, 3: 0.62 } as Record<Spins, number>,
    /** 回転数ごとのキャッチ倍率（球のパターン係数の代わり） */
    catchMult: { 1: 1.2, 2: 2, 3: 3.2 } as Record<Spins, number>,
    /** 回転数ごとの高度係数 */
    heightFactor: { 1: 1, 2: 1.35, 3: 1.7 } as Record<Spins, number>,
    /** 次の回転数を解放するのに必要な、1 つ下の回転数のクリーン数 */
    unlockCleans: 3,
  },
  flight: {
    /** 球が手に留まる時間 = 拍 × dwellFactor */
    dwellFactor: 0.45,
    /** 滞空時間の下限 = 拍 × minDurationFactor */
    minDurationFactor: 0.5,
    /** 高度 = (サイトスワップ値 / 3) ^ heightExponent（描画側で画面高さに掛ける） */
    heightExponent: 1.2,
    /** wobble のとき軌道を横にずらす量（描画幅に対する割合） */
    wobbleOffset: 0.03,
  },
  street: {
    /** 路上で投げたキャッチ 1 つあたりの拍手（基本レート。「レートが悪い」） */
    baseRate: 0.02,
    /** 路上で見せた異なるパターン 1 種ごとのレート上昇（割合） */
    perShownPattern: 0.3,
    /** 手動変換（キャッチ → 拍手）のレート = 路上レート × manualFactor */
    manualFactor: 0.4,
    /** 手動変換の 1 回分のキャッチ */
    manualChunk: 100,
    /** 路上のランでこの拍数に達するとそのパターンを「見せた」ことになる */
    showBeats: 20,
    /** 新しいパターンを見せたときの拍手ボーナス（表現「見せ方」で増える） */
    newPatternBonus: 10,
  },
  expr: {
    /** 「表現: 変換」1 段階ごとの拍手レート上昇（割合） */
    convertStep: 0.15,
    /** 「表現: 見せ方」1 段階ごとの新パターンボーナス（拍手） */
    showoffStep: 10,
  },
  stage: {
    /** ショーで落とさずに投げ切る拍数。達成で完走 */
    showBeats: 40,
    /** ショー中の許容幅係数（見せ場より少し緩い） */
    toleranceFactor: 0.8,
    /** ショー中の高度係数 */
    heightFactor: 1.2,
  },
  tabs: {
    /** 記録帳が開く通算キャッチ数 */
    recordCatches: 100,
    /** クラブが開く球数 */
    clubBalls: 4,
    /** 路上が開く球数 */
    streetBalls: 5,
    /** パッシングが開く球数 */
    passingBalls: 6,
    /** 舞台: 7 球フラッシュ + 拍手 */
    stageBalls: 7,
    stageApplause: 1000,
  },
};

export type Tuning = typeof TUNING;

/** 球数を 3〜7 に丸める（テーブル参照用） */
export function ballCount(balls: number): BallCount {
  return Math.min(TUNING.balls.max, Math.max(TUNING.balls.start, Math.round(balls))) as BallCount;
}

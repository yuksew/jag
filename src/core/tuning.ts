// 調整用の定数はすべてここに置く。関数の中に数値を直書きしない（CLAUDE.md）。
// 値は docs/DESIGN.md「現在の調整値」と試作 reference/prototype.html に合わせてある。

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
    /** ノーミス連続がこの拍数に達するごとにクリーン +1 */
    everyBeats: 30,
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
  record: {
    /** 記録帳が開く通算キャッチ数 */
    openAtTotalCatches: 100,
  },
} as const;

export type Tuning = typeof TUNING;

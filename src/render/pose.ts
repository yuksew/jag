// ジャグラーの「演技」。ランの出来事（clean / wobble / drop / 拍手 / 見せ場）を受けて、
// 表情（目・眉・口・視線）と姿勢（呼吸・傾き・肩・背筋・お辞儀・跳ね）の目標値を出し、
// 時間で滑らかに追従させる。描画（character.ts）はこの値を読むだけ。core には触れない。

export interface Face {
  /** 目の開き（画面左・右）。0 = 閉じる、1 = 普通、1.3 = 見開く */
  eyeOpen: [number, number];
  /** 眉の高さ（画面左・右）。+ で上がる。頭の半径に対する割合 */
  browLift: [number, number];
  /** 眉の傾き（画面左・右）。+ で内側が下がる（きりっと）、− で内側が上がる（困り） */
  browTilt: [number, number];
  /** 口角。+ で笑い、− でへの字 */
  mouthCurve: number;
  /** 口の開き 0〜1 */
  mouthOpen: number;
  /** 口の幅の倍率 */
  mouthWide: number;
  /** 視線 −1〜1（x, y。y は + で下） */
  gaze: [number, number];
  /** 頬の赤み 0〜1 */
  blush: number;
  /** 笑い目（弧）0〜1 */
  smileEyes: number;
  /** 汗 0〜1 */
  sweat: number;
}

export interface Body {
  /** 呼吸の上下 −1〜1 */
  breathe: number;
  /** 上体の傾き（ラジアン、+ で画面右へ） */
  lean: number;
  /** 肩の落ち 0〜1（− で肩が上がる） */
  shoulderDrop: number;
  /** 背筋の伸び 0〜1 */
  stretch: number;
  /** お辞儀 0〜1 */
  bow: number;
  /** 跳ね 0〜1 */
  hop: number;
  /** 首の傾き（ラジアン） */
  headTilt: number;
  /** うなずき 0〜1 */
  nod: number;
  /** うなだれ 0〜1 */
  slump: number;
}

export interface Pose {
  face: Face;
  body: Body;
}

/** 基本の気分。arena が毎フレーム決める */
export type BaseMood = 'idle' | 'run' | 'showcase' | 'dropped' | 'done';
/** 出来事への反応。arena がイベントで呼ぶ */
export type Reaction = 'clean' | 'wobble' | 'drop' | 'applause' | 'bonus' | 'complete';

export interface PoseInput {
  /** 一番高い球の方向（頭から見た −1〜1）。無ければ null */
  lookAt: [number, number] | null;
  /** 拍の位相 0〜1（ラン中）。無ければ null */
  beatPhase: number | null;
  reduceMotion: boolean;
}

const CALM: Face = { eyeOpen: [1, 1], browLift: [0, 0], browTilt: [0, 0], mouthCurve: 0.2, mouthOpen: 0, mouthWide: 1, gaze: [0, 0], blush: 0, smileEyes: 0, sweat: 0 };
const FOCUS: Face = { eyeOpen: [0.82, 0.82], browLift: [-0.05, -0.05], browTilt: [0.2, 0.2], mouthCurve: -0.05, mouthOpen: 0, mouthWide: 0.8, gaze: [0, -0.4], blush: 0, smileEyes: 0, sweat: 0 };
const SHARP: Face = { eyeOpen: [0.66, 0.66], browLift: [-0.12, -0.12], browTilt: [0.45, 0.45], mouthCurve: 0.1, mouthOpen: 0, mouthWide: 0.75, gaze: [0, -0.5], blush: 0, smileEyes: 0, sweat: 0 };
const GLAD: Face = { eyeOpen: [1.05, 1.05], browLift: [0.12, 0.12], browTilt: [-0.05, -0.05], mouthCurve: 0.9, mouthOpen: 0.2, mouthWide: 1.2, gaze: [0, -0.2], blush: 0.5, smileEyes: 0, sweat: 0 };
const UNEASY: Face = { eyeOpen: [0.45, 1.15], browLift: [-0.08, 0.32], browTilt: [0.25, -0.15], mouthCurve: -0.25, mouthOpen: 0.08, mouthWide: 0.7, gaze: [0.35, -0.1], blush: 0, smileEyes: 0, sweat: 1 };
const SURPRISE: Face = { eyeOpen: [1.4, 1.4], browLift: [0.4, 0.4], browTilt: [0, 0], mouthCurve: 0, mouthOpen: 1, mouthWide: 0.6, gaze: [0, 0.7], blush: 0, smileEyes: 0, sweat: 0.6 };
const GLOOM: Face = { eyeOpen: [0.5, 0.5], browLift: [0.08, 0.08], browTilt: [-0.4, -0.4], mouthCurve: -0.7, mouthOpen: 0, mouthWide: 0.9, gaze: [0, 0.6], blush: 0, smileEyes: 0, sweat: 0.3 };
const JOY: Face = { eyeOpen: [1, 1], browLift: [0.18, 0.18], browTilt: [-0.05, -0.05], mouthCurve: 1, mouthOpen: 0.55, mouthWide: 1.35, gaze: [0, -0.3], blush: 0.8, smileEyes: 1, sweat: 0 };

const NEUTRAL_BODY: Body = { breathe: 0, lean: 0, shoulderDrop: 0, stretch: 0, bow: 0, hop: 0, headTilt: 0, nod: 0, slump: 0 };

const CLEAN_MS = 650;
const WOBBLE_MS = 950;
const SURPRISE_MS = 480;
const SURPRISE_FADE_MS = 260;
const APPLAUSE_MS = 1000;
const BONUS_MS = 1100;
const BLINK_PERIOD_MS = 3400;
const BLINK_MS = 120;
/** 表情の追従（ms）。小さいほど速い */
const FACE_EASE_MS = 70;
const BODY_EASE_MS = 110;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpFace(out: Face, a: Face, b: Face, t: number): Face {
  out.eyeOpen[0] = lerp(a.eyeOpen[0], b.eyeOpen[0], t);
  out.eyeOpen[1] = lerp(a.eyeOpen[1], b.eyeOpen[1], t);
  out.browLift[0] = lerp(a.browLift[0], b.browLift[0], t);
  out.browLift[1] = lerp(a.browLift[1], b.browLift[1], t);
  out.browTilt[0] = lerp(a.browTilt[0], b.browTilt[0], t);
  out.browTilt[1] = lerp(a.browTilt[1], b.browTilt[1], t);
  out.mouthCurve = lerp(a.mouthCurve, b.mouthCurve, t);
  out.mouthOpen = lerp(a.mouthOpen, b.mouthOpen, t);
  out.mouthWide = lerp(a.mouthWide, b.mouthWide, t);
  out.gaze[0] = lerp(a.gaze[0], b.gaze[0], t);
  out.gaze[1] = lerp(a.gaze[1], b.gaze[1], t);
  out.blush = lerp(a.blush, b.blush, t);
  out.smileEyes = lerp(a.smileEyes, b.smileEyes, t);
  out.sweat = lerp(a.sweat, b.sweat, t);
  return out;
}

function copyFace(f: Face): Face {
  return { ...f, eyeOpen: [f.eyeOpen[0], f.eyeOpen[1]], browLift: [f.browLift[0], f.browLift[1]], browTilt: [f.browTilt[0], f.browTilt[1]], gaze: [f.gaze[0], f.gaze[1]] };
}

/** 立ち上がりが速く、ゆっくり消える重み */
function pulse(t: number, attackMs: number, totalMs: number): number {
  if (t < 0 || t >= totalMs) return 0;
  if (t < attackMs) return t / attackMs;
  return 1 - (t - attackMs) / (totalMs - attackMs);
}

function easeTo(cur: number, target: number, k: number): number {
  return cur + (target - cur) * k;
}

export class Acting {
  private mood: BaseMood = 'idle';
  private cleanAt = -1e9;
  private wobbleAt = -1e9;
  private wobbleDir = 1;
  private dropAt = -1e9;
  private applauseAt = -1e9;
  private bonusAt = -1e9;
  private completeAt = -1e9;
  private readonly face: Face = copyFace(CALM);
  private readonly body: Body = { ...NEUTRAL_BODY };
  private readonly target: Face = copyFace(CALM);
  private readonly scratch: Face = copyFace(CALM);
  private lastNow = -1;

  /** 反応の強さ（相方は弱く） */
  constructor(private readonly gain = 1) {}

  setMood(m: BaseMood): void {
    this.mood = m;
  }

  react(r: Reaction, now: number, dir = 1): void {
    switch (r) {
      case 'clean':
        this.cleanAt = now;
        break;
      case 'wobble':
        this.wobbleAt = now;
        this.wobbleDir = dir;
        break;
      case 'drop':
        this.dropAt = now;
        break;
      case 'applause':
        // 連続の拍手ではお辞儀を重ねない
        if (now - this.applauseAt > APPLAUSE_MS) this.applauseAt = now;
        break;
      case 'bonus':
        this.bonusAt = now;
        break;
      case 'complete':
        this.completeAt = now;
        break;
      default:
        break;
    }
  }

  /** 表情と姿勢を now まで進めて返す。返り値は内部の参照（書き換えない） */
  pose(now: number, input: PoseInput): Pose {
    const dt = this.lastNow < 0 ? 16 : Math.min(60, Math.max(0, now - this.lastNow));
    this.lastNow = now;
    const g = this.gain;
    const { target, scratch } = this;

    // 基本の表情
    const base = this.mood === 'run' ? FOCUS : this.mood === 'showcase' ? SHARP : this.mood === 'dropped' ? GLOOM : this.mood === 'done' ? JOY : CALM;
    lerpFace(target, base, base, 0);
    // ラン中は一番高い球を追う
    if (input.lookAt && (this.mood === 'run' || this.mood === 'showcase')) {
      target.gaze[0] = input.lookAt[0];
      target.gaze[1] = input.lookAt[1];
    }
    // 反応を重ねる（後のものほど強い）
    const tClean = now - this.cleanAt;
    const wClean = pulse(tClean, 90, CLEAN_MS) * (this.mood === 'showcase' ? 0.45 : 1) * g;
    if (wClean > 0) lerpFace(target, target, GLAD, wClean);
    const tWobble = now - this.wobbleAt;
    const wWobble = pulse(tWobble, 60, WOBBLE_MS) * g;
    if (wWobble > 0) {
      lerpFace(scratch, UNEASY, UNEASY, 0);
      if (this.wobbleDir < 0) {
        // 左手の wobble は左右を入れ替える
        scratch.eyeOpen = [UNEASY.eyeOpen[1], UNEASY.eyeOpen[0]];
        scratch.browLift = [UNEASY.browLift[1], UNEASY.browLift[0]];
        scratch.browTilt = [UNEASY.browTilt[1], UNEASY.browTilt[0]];
        scratch.gaze = [-UNEASY.gaze[0], UNEASY.gaze[1]];
      }
      lerpFace(target, target, scratch, wWobble);
    }
    const tBonus = now - this.bonusAt;
    const wBonus = pulse(tBonus, 80, BONUS_MS) * g;
    if (wBonus > 0) lerpFace(target, target, JOY, wBonus);
    const tDrop = now - this.dropAt;
    if (tDrop >= 0 && tDrop < SURPRISE_MS + SURPRISE_FADE_MS) {
      const w = tDrop < SURPRISE_MS ? Math.min(1, tDrop / 50) : 1 - (tDrop - SURPRISE_MS) / SURPRISE_FADE_MS;
      lerpFace(target, target, SURPRISE, w * g);
    }
    const tComplete = now - this.completeAt;
    if (tComplete >= 0 && tComplete < 3000) lerpFace(target, target, JOY, Math.min(1, tComplete / 120));

    // 追従
    const kf = 1 - Math.exp(-dt / FACE_EASE_MS);
    lerpFace(this.face, this.face, target, kf);
    // まばたき（表情の上から掛ける）
    if (!input.reduceMotion && this.face.smileEyes < 0.5) {
      const bt = (now + this.gain * 700) % BLINK_PERIOD_MS;
      if (bt < BLINK_MS) {
        const k = 1 - Math.abs(bt - BLINK_MS / 2) / (BLINK_MS / 2);
        this.face.eyeOpen[0] *= 1 - k;
        this.face.eyeOpen[1] *= 1 - k;
      }
    }

    // 姿勢
    const b = this.body;
    const kb = 1 - Math.exp(-dt / BODY_EASE_MS);
    const reduce = input.reduceMotion;
    if (reduce) {
      b.breathe = 0;
      b.hop = 0;
      b.lean = 0;
    } else {
      if (input.beatPhase !== null && (this.mood === 'run' || this.mood === 'showcase')) {
        // 拍で沈んで戻る
        b.breathe = -0.55 * Math.cos(input.beatPhase * Math.PI * 2);
      } else {
        b.breathe = Math.sin(now / 1500 * Math.PI * 2);
      }
      const hopClean = tClean >= 0 && tClean < 260 ? Math.sin((tClean / 260) * Math.PI) * 0.6 : 0;
      const hopBonus = tBonus >= 0 && tBonus < 700 ? Math.abs(Math.sin((tBonus / 700) * Math.PI * 2)) : 0;
      const hopDone = this.mood === 'done' ? Math.abs(Math.sin(now / 420 * Math.PI)) * 0.5 : 0;
      b.hop = Math.max(hopClean, hopBonus, hopDone) * g;
      b.lean = tWobble >= 0 && tWobble < 1100 ? this.wobbleDir * 0.26 * Math.exp(-tWobble / 420) * Math.cos(tWobble / 115) * g : 0;
    }
    const dropped = this.mood === 'dropped';
    const surprised = tDrop >= 0 && tDrop < SURPRISE_MS;
    b.shoulderDrop = easeTo(b.shoulderDrop, dropped && !surprised ? 1 : surprised ? -0.6 : 0, kb);
    b.slump = easeTo(b.slump, dropped && !surprised ? 1 : 0, kb);
    b.stretch = easeTo(b.stretch, this.mood === 'showcase' || this.mood === 'done' ? 1 : 0, kb);
    const tApp = now - this.applauseAt;
    b.bow = reduce ? 0 : tApp >= 0 && tApp < APPLAUSE_MS ? Math.sin((tApp / APPLAUSE_MS) * Math.PI) : 0;
    b.nod = reduce ? 0 : pulse(tClean, 70, 300) * 0.6;
    b.headTilt = easeTo(b.headTilt, b.lean * 0.7 + (wWobble > 0 ? this.wobbleDir * 0.14 * wWobble : 0), kb);
    return { face: this.face, body: b };
  }
}

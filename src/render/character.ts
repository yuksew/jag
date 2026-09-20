// ジャグラーのキャラクター。3 案（a: 街角の名人 / b: サーカスの新人 / c: 現代のジャグラー）を
// 同じ骨格で描き分ける。<html data-character="a|b|c"> で切り替え（style.ts と同じ要領で監視）。
// 頭（髪・帽子）と胴（衣装）はオフスクリーンにキャッシュし、顔・腕・手・脚は毎フレーム描く。
// 表情と姿勢は pose.ts の Pose を読むだけ。
import { darken, lighten, mix, parseColor, rgba, type Palette, type RGBA } from './palette';
import type { Pose } from './pose';
import type { HandPose, Point } from './sprites';

export type CharacterId = 'a' | 'b' | 'c';

const IDS: readonly CharacterId[] = ['a', 'b', 'c'];
/** 既定の案 */
export const DEFAULT_CHARACTER: CharacterId = 'b';

let cachedId: CharacterId | null = null;

function readId(): CharacterId {
  const v = document.documentElement.dataset['character'];
  return (IDS as readonly string[]).includes(v ?? '') ? (v as CharacterId) : DEFAULT_CHARACTER;
}

/** 現在の案。属性が変わるまで使い回す */
export function currentCharacter(): CharacterId {
  if (cachedId === null) cachedId = readId();
  return cachedId;
}

/** data-character が変わったら onChange を呼ぶ */
export function watchCharacter(onChange: () => void): void {
  const mo = new MutationObserver(() => {
    const next = readId();
    if (next === cachedId) return;
    cachedId = next;
    onChange();
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-character'] });
}

// ---- 体格 -------------------------------------------------------------------

/** 頭の半径（hr）を単位にした体格 */
interface Proportions {
  /** 頭身 */
  heads: number;
  /** 頭の半径（描画幅に対する割合） */
  hr: number;
  /** 頭の横／縦の半径（hr 比） */
  headW: number;
  headH: number;
  neck: number;
  /** 肩から腰まで */
  torso: number;
  /** 肩・胴のくびれ・腰の半幅 */
  shoulder: number;
  waist: number;
  hip: number;
  armW: number;
  legW: number;
  /** 手のひらの半径 */
  hand: number;
  /** 表情・所作の振れ幅 */
  faceAmp: number;
  motionAmp: number;
  /** 顔の部品の位置（頭の中心から、hr 比） */
  eyeY: number;
  eyeSep: number;
  eyeR: number;
  browY: number;
  browW: number;
  mouthY: number;
  mouthW: number;
}

const PROPS: Record<CharacterId, Proportions> = {
  a: { heads: 3.5, hr: 0.036, headW: 0.9, headH: 1.0, neck: 0.32, torso: 1.75, shoulder: 0.98, waist: 0.66, hip: 0.74, armW: 0.38, legW: 0.36, hand: 0.4, faceAmp: 0.8, motionAmp: 0.6, eyeY: 0.08, eyeSep: 0.36, eyeR: 0.1, browY: -0.14, browW: 0.28, mouthY: 0.5, mouthW: 0.26 },
  b: { heads: 3, hr: 0.042, headW: 1.06, headH: 1.0, neck: 0.14, torso: 1.4, shoulder: 0.9, waist: 0.8, hip: 0.86, armW: 0.44, legW: 0.4, hand: 0.44, faceAmp: 1.4, motionAmp: 1.3, eyeY: 0.06, eyeSep: 0.42, eyeR: 0.23, browY: -0.36, browW: 0.3, mouthY: 0.54, mouthW: 0.32 },
  c: { heads: 4, hr: 0.033, headW: 0.9, headH: 1.02, neck: 0.4, torso: 1.9, shoulder: 1.08, waist: 0.7, hip: 0.78, armW: 0.4, legW: 0.34, hand: 0.4, faceAmp: 1.0, motionAmp: 1.1, eyeY: 0.06, eyeSep: 0.38, eyeR: 0.15, browY: -0.24, browW: 0.28, mouthY: 0.5, mouthW: 0.22 },
};

// ---- 衣装 -------------------------------------------------------------------

export interface Wardrobe {
  skin: RGBA;
  hair: RGBA;
  /** 上半身の主色（シャツ／ストライプの地／パーカー） */
  top: RGBA;
  /** 上半身の副色（ベスト／ストライプ／フードの裏） */
  top2: RGBA;
  /** 小物（サスペンダー・紐・時計鎖） */
  trim: RGBA;
  bottom: RGBA;
  shoe: RGBA;
  hat: RGBA;
  /** 輪郭線 */
  outline: string;
  /** 顔の線（目・眉・口） */
  line: RGBA;
  white: RGBA;
}

function darkHair(pal: Palette): RGBA {
  return pal.dark ? [88, 66, 60, 1] : [50, 36, 34, 1];
}

function brownHair(pal: Palette): RGBA {
  return pal.dark ? [128, 92, 66, 1] : [92, 62, 42, 1];
}

function orangeHair(pal: Palette): RGBA {
  return pal.dark ? [232, 150, 70, 1] : [214, 118, 48, 1];
}

/** 暗い衣装。ダークテーマでは背景に沈まないよう少し明るく、彩度を残す */
function darkCloth(pal: Palette, tint: RGBA | string): RGBA {
  return pal.dark ? mix(tint, pal.bg, 0.3) : darken(mix(tint, pal.ink, 0.55), 0.15);
}

export function wardrobe(id: CharacterId, partner: boolean, pal: Palette): Wardrobe {
  const c = parseColor;
  const skin: RGBA = partner ? darken(mix(pal.ivory, pal.amber, 0.42), 0.14) : mix(pal.ivory, pal.coral, 0.26);
  const line = darken(skin, 0.74);
  const outline = pal.dark ? 'rgba(18,22,26,0.6)' : 'rgba(40,32,30,0.5)';
  const white = lighten(pal.ivory, 0.5);
  const base = { skin, line, outline, white };
  if (id === 'a') {
    return partner
      ? { ...base, hair: mix(pal.muted, pal.ivory, 0.45), top: mix(pal.ivory, pal.sky, 0.12), top2: darkCloth(pal, pal.coral), trim: c(pal.amber), bottom: darkCloth(pal, pal.muted), shoe: darken(pal.amber, 0.55), hat: darkCloth(pal, pal.coral) }
      : { ...base, hair: brownHair(pal), top: mix(pal.ivory, pal.amber, 0.1), top2: darkCloth(pal, pal.sky), trim: c(pal.amber), bottom: darkCloth(pal, pal.muted), shoe: darken(pal.amber, 0.55), hat: pal.dark ? mix(pal.amber, pal.bg, 0.45) : darken(mix(pal.amber, pal.ink, 0.35), 0.25) };
  }
  if (id === 'b') {
    return partner
      ? { ...base, hair: darkHair(pal), top: white, top2: c(pal.sky), trim: darkCloth(pal, pal.sky), bottom: darkCloth(pal, pal.sky), shoe: c(pal.coral), hat: c(pal.coral) }
      : { ...base, hair: orangeHair(pal), top: white, top2: c(pal.coral), trim: darkCloth(pal, pal.coral), bottom: darkCloth(pal, pal.sky), shoe: darkCloth(pal, pal.coral), hat: c(pal.sky) };
  }
  return partner
    ? { ...base, hair: darkHair(pal), top: pal.dark ? mix(pal.coral, pal.bg, 0.15) : mix(pal.coral, pal.ink, 0.12), top2: darken(pal.coral, 0.35), trim: c(pal.ivory), bottom: darkCloth(pal, pal.muted), shoe: white, hat: c(pal.amber) }
    : { ...base, hair: darkHair(pal), top: pal.dark ? mix(pal.sky, pal.bg, 0.15) : mix(pal.sky, pal.ink, 0.12), top2: darken(pal.sky, 0.35), trim: c(pal.ivory), bottom: darkCloth(pal, mix(pal.muted, pal.sky, 0.4)), shoe: white, hat: c(pal.coral) };
}

// ---- 仕様 -------------------------------------------------------------------

export interface CharacterSpec {
  id: CharacterId;
  partner: boolean;
  /** 身体の中心 x */
  x: number;
  /** 足の接地 y */
  feetY: number;
  /** 描画幅（比率の基準） */
  unit: number;
  /** 右手・左手。null は腕を下ろす */
  hands: [HandPose | null, HandPose | null];
  /** 手を下ろしたときの高さの基準 */
  handY: number;
  /** 向き。−1 = 左、0 = 正面、1 = 右 */
  facing: -1 | 0 | 1;
  pose: Pose;
  pal: Palette;
  dpr: number;
}

type Pt = Point;

function rot(p: Pt, cx: number, cy: number, a: number): Pt {
  if (a === 0) return p;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = p.x - cx;
  const dy = p.y - cy;
  return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
}

function makeCanvas(w: number, h: number, dpr: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2d context is unavailable');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, g };
}

/** 胴の輪郭（原点 = 腰の中心、上が負） */
function torsoPath(P: Proportions, hr: number): Path2D {
  const L = P.torso * hr;
  const sw = P.shoulder * hr;
  const ww = P.waist * hr;
  const hw = P.hip * hr;
  const top = -L;
  const p = new Path2D();
  p.moveTo(-hw, 0);
  p.quadraticCurveTo(-ww * 1.02, -L * 0.42, -sw * 0.98, top + hr * 0.28);
  p.quadraticCurveTo(-sw, top + hr * 0.02, -sw * 0.62, top);
  p.lineTo(sw * 0.62, top);
  p.quadraticCurveTo(sw, top + hr * 0.02, sw * 0.98, top + hr * 0.28);
  p.quadraticCurveTo(ww * 1.02, -L * 0.42, hw, 0);
  p.closePath();
  return p;
}

// ---- 胴（キャッシュ） ---------------------------------------------------------

const TORSO_PAD = 0.9;

function renderTorso(id: CharacterId, P: Proportions, hr: number, W: Wardrobe, dpr: number): HTMLCanvasElement {
  const L = P.torso * hr;
  const sw = P.shoulder * hr;
  const w = sw * 2 + hr * 1.2;
  const h = L + hr * TORSO_PAD + hr * 0.3;
  const { c, g } = makeCanvas(w, h, dpr);
  // 原点を腰の中心に
  g.translate(w / 2, h - hr * 0.3);
  const body = torsoPath(P, hr);
  g.lineJoin = 'round';
  g.strokeStyle = W.outline;
  g.lineWidth = 1.4;
  if (id === 'c') {
    // フード（頭の後ろ）
    g.fillStyle = rgba(W.top2);
    g.beginPath();
    g.moveTo(-sw * 0.85, -L + hr * 0.3);
    g.quadraticCurveTo(-sw * 0.9, -L - hr * 0.75, 0, -L - hr * 0.72);
    g.quadraticCurveTo(sw * 0.9, -L - hr * 0.75, sw * 0.85, -L + hr * 0.3);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = rgba(darken(W.top2, 0.25));
    g.beginPath();
    g.moveTo(-sw * 0.55, -L + hr * 0.1);
    g.quadraticCurveTo(0, -L - hr * 0.45, sw * 0.55, -L + hr * 0.1);
    g.closePath();
    g.fill();
  }
  // 地の色（横方向の陰影）
  const grad = g.createLinearGradient(-sw, 0, sw, 0);
  grad.addColorStop(0, rgba(lighten(W.top, 0.12)));
  grad.addColorStop(0.5, rgba(W.top));
  grad.addColorStop(1, rgba(darken(W.top, 0.2)));
  g.fillStyle = grad;
  g.fill(body);
  g.save();
  g.clip(body);
  if (id === 'a') {
    // ベスト（V ネックからシャツが見える）
    g.fillStyle = rgba(W.top2);
    g.fillRect(-sw * 1.1, -L - 2, sw * 2.2, L + 4);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(-sw * 0.5, -L - 2);
    g.lineTo(0, -L * 0.5);
    g.lineTo(sw * 0.5, -L - 2);
    g.closePath();
    g.fill();
    // 襟
    g.fillStyle = rgba(W.top2);
    g.beginPath();
    g.moveTo(-sw * 0.52, -L - 2);
    g.lineTo(-sw * 0.36, -L + hr * 0.42);
    g.lineTo(-hr * 0.08, -L * 0.55);
    g.lineTo(-sw * 0.36, -L - 2);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(sw * 0.52, -L - 2);
    g.lineTo(sw * 0.36, -L + hr * 0.42);
    g.lineTo(hr * 0.08, -L * 0.55);
    g.lineTo(sw * 0.36, -L - 2);
    g.closePath();
    g.fill();
    g.strokeStyle = rgba(darken(W.top2, 0.4));
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, -L * 0.5);
    g.lineTo(0, 0);
    g.stroke();
    // ボタン
    g.fillStyle = rgba(W.trim);
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(0, -L * 0.42 + i * L * 0.16, hr * 0.06, 0, Math.PI * 2);
      g.fill();
    }
    // 懐中時計の鎖
    g.strokeStyle = rgba(W.trim);
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(hr * 0.1, -L * 0.24);
    g.quadraticCurveTo(hr * 0.45, -L * 0.05, sw * 0.7, -L * 0.28);
    g.stroke();
    // ベルト
    g.fillStyle = rgba(darken(W.bottom, 0.3));
    g.fillRect(-sw, -hr * 0.16, sw * 2, hr * 0.18);
    g.fillStyle = rgba(W.trim);
    g.fillRect(-hr * 0.1, -hr * 0.16, hr * 0.2, hr * 0.18);
  } else if (id === 'b') {
    // ストライプ
    g.fillStyle = rgba(W.top2);
    const band = hr * 0.19;
    for (let y = -L + band * 0.9; y < 0; y += band * 2) g.fillRect(-sw * 1.2, y, sw * 2.4, band);
    // 影
    const sh = g.createLinearGradient(-sw, 0, sw, 0);
    sh.addColorStop(0, 'rgba(255,255,255,0.14)');
    sh.addColorStop(0.55, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(0,0,0,0.16)');
    g.fillStyle = sh;
    g.fillRect(-sw * 1.2, -L - 2, sw * 2.4, L + 4);
    // サスペンダー
    g.strokeStyle = rgba(W.trim);
    g.lineWidth = hr * 0.2;
    g.lineCap = 'butt';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * sw * 0.52, -L - 2);
      g.lineTo(s * P.hip * hr * 0.48, 0);
      g.stroke();
    }
    g.fillStyle = rgba(W.hat);
    for (const s of [-1, 1]) g.fillRect(s * P.hip * hr * 0.48 - hr * 0.13, -hr * 0.24, hr * 0.26, hr * 0.14);
    // ウエスト
    g.fillStyle = rgba(W.bottom);
    g.fillRect(-sw, -hr * 0.1, sw * 2, hr * 0.12);
  } else {
    // パーカー: ジッパー・紐・カンガルーポケット
    g.strokeStyle = rgba(lighten(W.top, 0.35));
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(0, -L + hr * 0.15);
    g.lineTo(0, -hr * 0.55);
    g.stroke();
    g.strokeStyle = rgba(W.trim);
    g.lineWidth = 1.4;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * hr * 0.16, -L + hr * 0.12);
      g.quadraticCurveTo(s * hr * 0.2, -L + hr * 0.5, s * hr * 0.24, -L + hr * 0.82);
      g.stroke();
      g.fillStyle = rgba(W.trim);
      g.beginPath();
      g.arc(s * hr * 0.24, -L + hr * 0.86, hr * 0.05, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = rgba(darken(W.top, 0.14));
    g.strokeStyle = rgba(darken(W.top, 0.35));
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(-hr * 0.72, -hr * 0.62, hr * 1.44, hr * 0.56, hr * 0.14);
    g.fill();
    g.stroke();
    // 裾のリブ
    g.fillStyle = rgba(darken(W.top, 0.22));
    g.fillRect(-sw, -hr * 0.1, sw * 2, hr * 0.12);
  }
  g.restore();
  g.strokeStyle = W.outline;
  g.lineWidth = 1.4;
  g.stroke(body);
  if (id === 'b') {
    // 蝶ネクタイ
    g.fillStyle = rgba(W.hat);
    g.strokeStyle = W.outline;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, -L);
    g.lineTo(-hr * 0.34, -L - hr * 0.16);
    g.lineTo(-hr * 0.34, -L + hr * 0.16);
    g.closePath();
    g.moveTo(0, -L);
    g.lineTo(hr * 0.34, -L - hr * 0.16);
    g.lineTo(hr * 0.34, -L + hr * 0.16);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(0, -L, hr * 0.07, 0, Math.PI * 2);
    g.fill();
  } else if (id === 'a') {
    // シャツの襟
    g.fillStyle = rgba(W.top);
    g.strokeStyle = W.outline;
    g.lineWidth = 1;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(0, -L + hr * 0.05);
      g.lineTo(s * hr * 0.3, -L - hr * 0.16);
      g.lineTo(s * hr * 0.42, -L + hr * 0.16);
      g.closePath();
      g.fill();
      g.stroke();
    }
  }
  return c;
}

// ---- 頭（キャッシュ） ---------------------------------------------------------

const HEAD_PAD = 1.75;

function renderHead(id: CharacterId, partner: boolean, P: Proportions, hr: number, W: Wardrobe, dpr: number, facing: number): HTMLCanvasElement {
  const rx = P.headW * hr;
  const ry = P.headH * hr;
  const size = hr * HEAD_PAD * 2;
  const { c, g } = makeCanvas(size, size, dpr);
  g.translate(size / 2, size / 2);
  g.lineJoin = 'round';
  g.strokeStyle = W.outline;
  g.lineWidth = 1.3;
  const hair = rgba(W.hair);
  const hairDark = rgba(darken(W.hair, 0.3));
  const f = facing;

  // 頭の後ろにあるもの
  if (id === 'c' && !partner) {
    // ポニーテール（頭の横に垂れる）
    const side = f === 0 ? 1 : -f;
    g.fillStyle = hair;
    g.save();
    g.translate(side * rx * 0.98, -ry * 0.2);
    g.rotate(side * 0.28);
    g.beginPath();
    g.ellipse(0, ry * 0.62, rx * 0.3, ry * 0.72, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = hairDark;
    g.beginPath();
    g.ellipse(side * rx * 0.08, ry * 0.75, rx * 0.12, ry * 0.42, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  if (id === 'b') {
    // 後ろ髪（丸いシルエット）
    g.fillStyle = hair;
    g.beginPath();
    g.ellipse(0, -ry * 0.12, rx * 1.16, ry * 1.08, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  // 耳
  g.fillStyle = rgba(W.skin);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(s * rx * 0.98, ry * 0.12, hr * 0.16, hr * 0.2, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  // 顔
  const sg = g.createRadialGradient(-rx * 0.3, -ry * 0.35, hr * 0.1, 0, 0, rx * 1.1);
  sg.addColorStop(0, rgba(lighten(W.skin, 0.22)));
  sg.addColorStop(0.7, rgba(W.skin));
  sg.addColorStop(1, rgba(darken(W.skin, 0.16)));
  g.fillStyle = sg;
  g.beginPath();
  if (id === 'b') {
    // 丸くて頬が張った顔
    g.ellipse(0, ry * 0.05, rx, ry * 0.98, 0, 0, Math.PI * 2);
  } else if (id === 'a') {
    // 面長。顎がやや細い
    g.moveTo(-rx, -ry * 0.1);
    g.quadraticCurveTo(-rx, -ry, 0, -ry);
    g.quadraticCurveTo(rx, -ry, rx, -ry * 0.1);
    g.quadraticCurveTo(rx, ry * 0.75, 0, ry);
    g.quadraticCurveTo(-rx, ry * 0.75, -rx, -ry * 0.1);
  } else {
    g.moveTo(-rx, -ry * 0.15);
    g.quadraticCurveTo(-rx, -ry, 0, -ry);
    g.quadraticCurveTo(rx, -ry, rx, -ry * 0.15);
    g.quadraticCurveTo(rx * 0.98, ry * 0.85, 0, ry);
    g.quadraticCurveTo(-rx * 0.98, ry * 0.85, -rx, -ry * 0.15);
  }
  g.closePath();
  g.fill();
  g.stroke();

  if (id === 'a') {
    if (partner) {
      // 白髪まじりの横髪と口ひげ
      g.fillStyle = hair;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.ellipse(s * rx * 0.86, -ry * 0.2, hr * 0.22, hr * 0.42, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = hair;
      g.beginPath();
      g.moveTo(-hr * 0.36, hr * 0.4);
      g.quadraticCurveTo(-hr * 0.18, hr * 0.2, 0, hr * 0.34);
      g.quadraticCurveTo(hr * 0.18, hr * 0.2, hr * 0.36, hr * 0.4);
      g.quadraticCurveTo(hr * 0.18, hr * 0.48, 0, hr * 0.4);
      g.quadraticCurveTo(-hr * 0.18, hr * 0.48, -hr * 0.36, hr * 0.4);
      g.fill();
      // ベレー帽
      g.fillStyle = rgba(W.hat);
      g.beginPath();
      g.ellipse(-rx * 0.18 + f * rx * 0.2, -ry * 0.78, rx * 1.08, ry * 0.42, -0.12, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = rgba(darken(W.hat, 0.3));
      g.beginPath();
      g.arc(-rx * 0.2 + f * rx * 0.2, -ry * 1.18, hr * 0.07, 0, Math.PI * 2);
      g.fill();
    } else {
      // 横髪ともみあげ、顎ひげ
      g.fillStyle = hair;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.ellipse(s * rx * 0.88, -ry * 0.15, hr * 0.2, hr * 0.5, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.beginPath();
      g.moveTo(-hr * 0.22, ry * 0.86);
      g.quadraticCurveTo(0, ry * 1.12, hr * 0.22, ry * 0.86);
      g.quadraticCurveTo(0, ry * 0.94, -hr * 0.22, ry * 0.86);
      g.fill();
      // ハンチング帽: 山とつば
      const hat = rgba(W.hat);
      g.fillStyle = hat;
      g.beginPath();
      g.ellipse(0, -ry * 0.62, rx * 1.12, ry * 0.62, 0, Math.PI, Math.PI * 2);
      g.lineTo(rx * 1.05, -ry * 0.42);
      g.lineTo(-rx * 1.05, -ry * 0.42);
      g.closePath();
      g.fill();
      g.stroke();
      // ツイードの目
      g.save();
      g.clip();
      g.strokeStyle = rgba(darken(W.hat, 0.25));
      g.lineWidth = 1;
      for (let i = -6; i <= 6; i++) {
        g.beginPath();
        g.moveTo(i * hr * 0.2 - hr, -ry * 1.3);
        g.lineTo(i * hr * 0.2 + hr * 0.3, -ry * 0.4);
        g.stroke();
      }
      g.restore();
      // つば（前に張り出す）
      g.fillStyle = rgba(darken(W.hat, 0.35));
      g.strokeStyle = W.outline;
      g.beginPath();
      g.ellipse(f * rx * 0.25, -ry * 0.42, rx * 0.86, ry * 0.15, 0, 0, Math.PI);
      g.closePath();
      g.fill();
      g.stroke();
    }
  } else if (id === 'b') {
    if (partner) {
      // 前髪とおだんご 2 つ
      g.fillStyle = hair;
      g.beginPath();
      g.ellipse(0, -ry * 0.62, rx * 1.05, ry * 0.5, 0, Math.PI, Math.PI * 2);
      g.quadraticCurveTo(rx * 0.5, -ry * 0.05, 0, -ry * 0.3);
      g.quadraticCurveTo(-rx * 0.5, -ry * 0.05, -rx * 1.05, -ry * 0.62);
      g.closePath();
      g.fill();
      g.stroke();
      for (const s of [-1, 1]) {
        g.fillStyle = hair;
        g.beginPath();
        g.arc(s * rx * 0.92, -ry * 0.82, hr * 0.32, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.fillStyle = rgba(W.hat);
        g.beginPath();
        g.arc(s * rx * 0.92, -ry * 0.62, hr * 0.09, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      // くるくるの髪
      g.fillStyle = hair;
      g.beginPath();
      g.ellipse(0, -ry * 0.55, rx * 1.02, ry * 0.58, 0, Math.PI, Math.PI * 2);
      g.closePath();
      g.fill();
      const curls: [number, number, number][] = [
        [-1.05, -0.5, 0.34], [-0.78, -0.86, 0.36], [-0.35, -1.02, 0.38], [0.12, -1.06, 0.38], [0.58, -0.94, 0.36], [0.95, -0.62, 0.34], [-0.5, -0.66, 0.3], [0.32, -0.7, 0.3],
      ];
      for (const [cx, cy, r] of curls) {
        g.beginPath();
        g.arc(cx * rx, cy * ry, r * hr, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
      g.fillStyle = hairDark;
      for (const [cx, cy, r] of curls.slice(0, 6)) {
        g.beginPath();
        g.arc(cx * rx + r * hr * 0.25, cy * ry + r * hr * 0.25, r * hr * 0.28, 0, Math.PI * 2);
        g.fill();
      }
      // そばかす
      g.fillStyle = rgba(darken(W.skin, 0.28), 0.8);
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.arc(s * rx * (0.5 + i * 0.14), ry * (0.36 + (i % 2) * 0.08), hr * 0.03, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  } else if (partner) {
    // 刈り上げの短髪とヘッドバンド
    g.fillStyle = hair;
    g.beginPath();
    g.ellipse(0, -ry * 0.52, rx * 1.04, ry * 0.56, 0, Math.PI, Math.PI * 2);
    g.closePath();
    g.fill();
    g.stroke();
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i + 0.5) * (Math.PI / 7);
      g.beginPath();
      g.arc(Math.cos(a) * rx * 0.95, -ry * 0.5 + Math.sin(a) * ry * 0.55, hr * 0.17, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = rgba(W.hat);
    g.beginPath();
    g.ellipse(0, -ry * 0.5, rx * 1.03, ry * 0.5, 0, Math.PI * 1.05, Math.PI * 1.95);
    g.ellipse(0, -ry * 0.5, rx * 1.03, ry * 0.36, 0, Math.PI * 1.95, Math.PI * 1.05, true);
    g.closePath();
    g.fill();
  } else {
    // 分け目のある前髪。頭頂は結ぶ
    g.fillStyle = hair;
    g.beginPath();
    g.moveTo(-rx * 1.02, -ry * 0.28);
    g.quadraticCurveTo(-rx * 1.06, -ry * 1.12, 0, -ry * 1.06);
    g.quadraticCurveTo(rx * 1.06, -ry * 1.12, rx * 1.02, -ry * 0.28);
    // 右側は短く、左側は長い前髪
    g.quadraticCurveTo(rx * 0.7, -ry * 0.4, rx * 0.35, -ry * 0.55);
    g.quadraticCurveTo(rx * 0.2, -ry * 0.72, -rx * 0.15, -ry * 0.62);
    g.quadraticCurveTo(-rx * 0.55, -ry * 0.5, -rx * 0.72, -ry * 0.08);
    g.quadraticCurveTo(-rx * 0.9, -ry * 0.05, -rx * 1.02, -ry * 0.28);
    g.closePath();
    g.fill();
    g.stroke();
    // 髪留め（ポニーテールの根元）
    const side = f === 0 ? 1 : -f;
    g.fillStyle = rgba(W.hat);
    g.beginPath();
    g.ellipse(side * rx * 0.98, -ry * 0.22, hr * 0.13, hr * 0.09, side * 0.5, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  return c;
}

// ---- 顔（毎フレーム） ---------------------------------------------------------

const BLUSH: RGBA = [220, 90, 70, 1];
const SWEAT: RGBA = [120, 190, 220, 1];

function drawFace(ctx: CanvasRenderingContext2D, id: CharacterId, P: Proportions, hr: number, W: Wardrobe, pose: Pose, facing: number, sizeMul: number): void {
  const face = pose.face;
  const amp = P.faceAmp;
  const line = rgba(W.line);
  const rx = P.headW * hr;
  // 横向きのときは顔の部品を向きの側へ寄せる
  const fx = facing * rx * 0.22;
  const gazeX = face.gaze[0] + facing * 0.5;
  const gazeY = face.gaze[1] + pose.body.bow * 0.9;
  const drop = pose.body.bow * hr * 0.12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 頬
  if (face.blush > 0.03) {
    ctx.fillStyle = rgba(BLUSH, face.blush * 0.32);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(fx + s * rx * 0.62, hr * P.eyeY + hr * 0.36 + drop, hr * 0.22, hr * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 目
  const eyeR = P.eyeR * hr * sizeMul;
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? -1 : 1;
    const ex = fx + s * P.eyeSep * hr;
    const ey = hr * P.eyeY + drop + gazeY * hr * 0.03;
    const openRaw = face.eyeOpen[i === 0 ? 0 : 1];
    const open = Math.max(0, 1 + (openRaw - 1) * amp);
    if (face.smileEyes > 0.5) {
      // 笑い目
      ctx.strokeStyle = line;
      ctx.lineWidth = Math.max(1.4, hr * 0.09);
      ctx.beginPath();
      ctx.arc(ex, ey + eyeR * 0.5, eyeR * 1.05, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      continue;
    }
    if (open < 0.16) {
      ctx.strokeStyle = line;
      ctx.lineWidth = Math.max(1.3, hr * 0.07);
      ctx.beginPath();
      ctx.moveTo(ex - eyeR * 1.05, ey + eyeR * 0.2);
      ctx.lineTo(ex + eyeR * 1.05, ey + eyeR * 0.2);
      ctx.stroke();
      continue;
    }
    const ry = eyeR * Math.min(1.45, open);
    if (id === 'a') {
      // 小さな目。上まぶたの線で細める
      ctx.fillStyle = line;
      ctx.beginPath();
      ctx.ellipse(ex + gazeX * eyeR * 0.35, ey + gazeY * eyeR * 0.3, eyeR, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      if (open < 0.85) {
        ctx.strokeStyle = line;
        ctx.lineWidth = Math.max(1.2, hr * 0.06);
        ctx.beginPath();
        ctx.moveTo(ex - eyeR * 1.4, ey - ry * 0.9);
        ctx.lineTo(ex + eyeR * 1.4, ey - ry * 0.9);
        ctx.stroke();
      }
      // 白目のきらり
      ctx.fillStyle = rgba(W.white, 0.9);
      ctx.beginPath();
      ctx.arc(ex + gazeX * eyeR * 0.35 - eyeR * 0.3, ey + gazeY * eyeR * 0.3 - ry * 0.35, eyeR * 0.28, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    // 白目 + 瞳 + ハイライト（まぶたで上から切る）
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ex, ey, eyeR, ry, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = rgba(W.white);
    ctx.fillRect(ex - eyeR * 1.2, ey - ry * 1.2, eyeR * 2.4, ry * 2.4);
    const pr = eyeR * (id === 'b' ? 0.58 : 0.62);
    const px = ex + gazeX * (eyeR - pr) * 0.9;
    const py = ey + gazeY * (ry - pr * 0.8) * 0.9;
    ctx.fillStyle = rgba(id === 'b' ? mix(W.hair, W.line, 0.55) : W.line);
    ctx.beginPath();
    ctx.ellipse(px, py, pr, pr * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba(W.white, 0.95);
    ctx.beginPath();
    ctx.arc(px - pr * 0.35, py - pr * 0.4, pr * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = line;
    ctx.lineWidth = Math.max(1.2, hr * 0.07);
    ctx.beginPath();
    if (id === 'b') {
      ctx.ellipse(ex, ey, eyeR, ry, 0, 0, Math.PI * 2);
    } else {
      // アーモンド形: 上まぶただけ太く
      ctx.ellipse(ex, ey, eyeR, ry, 0, Math.PI * 1.05, Math.PI * 1.95);
    }
    ctx.stroke();
    // まつ毛（b）
    if (id === 'b') {
      ctx.lineWidth = Math.max(1.6, hr * 0.1);
      ctx.beginPath();
      ctx.ellipse(ex, ey, eyeR, ry, 0, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  }

  // 眉
  ctx.strokeStyle = line;
  ctx.lineWidth = id === 'a' ? Math.max(2, hr * 0.14) : id === 'b' ? Math.max(1.4, hr * 0.08) : Math.max(1.6, hr * 0.1);
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? -1 : 1;
    const ex = fx + s * P.eyeSep * hr;
    const lift = face.browLift[i === 0 ? 0 : 1] * amp;
    const tilt = face.browTilt[i === 0 ? 0 : 1] * amp;
    const by = hr * P.browY - lift * hr * 0.38 + drop;
    const L = P.browW * hr;
    // 内側の端が下がる向きが tilt > 0
    const a = s === -1 ? tilt : -tilt;
    const dx = Math.cos(a) * L;
    const dy = Math.sin(a) * L;
    ctx.beginPath();
    if (id === 'b') {
      // 弧の眉
      ctx.moveTo(ex - dx, by - dy + L * 0.25);
      ctx.quadraticCurveTo(ex, by - L * 0.3, ex + dx, by + dy + L * 0.25);
    } else {
      ctx.moveTo(ex - dx, by - dy);
      ctx.lineTo(ex + dx, by + dy);
    }
    ctx.stroke();
  }

  // 鼻
  ctx.strokeStyle = rgba(W.line, 0.55);
  ctx.lineWidth = Math.max(1, hr * 0.05);
  ctx.beginPath();
  if (id === 'b') {
    ctx.arc(fx + facing * hr * 0.05, hr * 0.3 + drop, hr * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = rgba(darken(W.skin, 0.2));
    ctx.fill();
  } else {
    ctx.moveTo(fx + facing * hr * 0.1 - hr * 0.02, hr * 0.14 + drop);
    ctx.quadraticCurveTo(fx + facing * hr * 0.1 + hr * 0.1, hr * 0.32 + drop, fx + facing * hr * 0.1 - hr * 0.06, hr * 0.34 + drop);
    ctx.stroke();
  }

  // 口
  const mw = P.mouthW * hr * Math.max(0.4, 1 + (face.mouthWide - 1) * amp);
  const curve = face.mouthCurve * amp;
  const open = Math.min(1.2, face.mouthOpen * amp);
  const my = hr * P.mouthY + drop;
  const mx = fx + facing * hr * 0.05;
  const cornerY = my - curve * hr * 0.12;
  const midY = my + curve * hr * 0.26;
  if (open > 0.08) {
    // 開いた口: 上唇の線と下の弧で囲む
    ctx.fillStyle = rgba(darken(W.skin, 0.62));
    ctx.beginPath();
    ctx.moveTo(mx - mw, cornerY);
    ctx.quadraticCurveTo(mx, midY - open * hr * 0.05, mx + mw, cornerY);
    ctx.quadraticCurveTo(mx, midY + open * hr * 0.42, mx - mw, cornerY);
    ctx.closePath();
    ctx.fill();
    if (curve > 0.3) {
      // 歯
      ctx.fillStyle = rgba(W.white);
      ctx.beginPath();
      ctx.moveTo(mx - mw * 0.85, cornerY + hr * 0.01);
      ctx.quadraticCurveTo(mx, midY + hr * 0.02, mx + mw * 0.85, cornerY + hr * 0.01);
      ctx.lineTo(mx + mw * 0.85, cornerY + hr * 0.1);
      ctx.quadraticCurveTo(mx, midY + hr * 0.1, mx - mw * 0.85, cornerY + hr * 0.1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = line;
    ctx.lineWidth = Math.max(1.2, hr * 0.06);
    ctx.stroke();
  } else {
    ctx.strokeStyle = line;
    ctx.lineWidth = Math.max(1.3, hr * 0.07);
    ctx.beginPath();
    ctx.moveTo(mx - mw, cornerY);
    if (Math.abs(curve) < 0.12 && id !== 'a') {
      // 一文字
      ctx.lineTo(mx + mw, cornerY);
    } else {
      ctx.quadraticCurveTo(mx, midY, mx + mw, cornerY);
    }
    ctx.stroke();
  }

  // 汗
  if (face.sweat > 0.05) {
    ctx.fillStyle = rgba(SWEAT, Math.min(1, face.sweat) * 0.9);
    const sx = fx - rx * 0.92;
    const sy = hr * P.browY + hr * 0.1 + drop;
    ctx.beginPath();
    ctx.moveTo(sx, sy - hr * 0.16);
    ctx.quadraticCurveTo(sx + hr * 0.13, sy + hr * 0.02, sx, sy + hr * 0.1);
    ctx.quadraticCurveTo(sx - hr * 0.13, sy + hr * 0.02, sx, sy - hr * 0.16);
    ctx.fill();
  }
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}

// ---- 手・腕・脚（毎フレーム） -------------------------------------------------

/** 丸い手。closed が 1 に近いほど握る */
function drawHand(ctx: CanvasRenderingContext2D, p: Pt, r: number, closed: number, side: number, W: Wardrobe): void {
  const path = new Path2D();
  path.ellipse(p.x, p.y + r * 0.1, r * (1 - closed * 0.08), r * (0.92 + closed * 0.1), 0, 0, Math.PI * 2);
  const spread = (1 - closed) * 0.42;
  const reach = r * (0.72 - closed * 0.3);
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i - 1) * spread + side * closed * 0.3;
    path.moveTo(p.x, p.y);
    path.arc(p.x + Math.cos(a) * reach, p.y + Math.sin(a) * reach, r * 0.36, 0, Math.PI * 2);
  }
  path.moveTo(p.x, p.y);
  path.arc(p.x - side * r * 0.82, p.y - r * 0.05 + closed * r * 0.1, r * 0.32, 0, Math.PI * 2);
  ctx.strokeStyle = W.outline;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.stroke(path);
  ctx.fillStyle = rgba(W.skin);
  ctx.fill(path);
  // 指の隙間
  if (closed < 0.5) {
    ctx.strokeStyle = rgba(W.line, 0.3 * (1 - closed * 2));
    ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
      const a = -Math.PI / 2 + (i - 0.5) * spread;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(a) * r * 0.55, p.y + Math.sin(a) * r * 0.55);
      ctx.lineTo(p.x + Math.cos(a) * r * 1.02, p.y + Math.sin(a) * r * 1.02);
      ctx.stroke();
    }
  }
}

interface Limb {
  a: Pt;
  mid: Pt;
  b: Pt;
}

function strokeLimb(ctx: CanvasRenderingContext2D, l: Limb, width: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(l.a.x, l.a.y);
  ctx.lineTo(l.mid.x, l.mid.y);
  ctx.lineTo(l.b.x, l.b.y);
  ctx.stroke();
}

function drawArm(ctx: CanvasRenderingContext2D, id: CharacterId, arm: Limb, w: number, W: Wardrobe, hr: number): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  strokeLimb(ctx, arm, w + 2.6, W.outline);
  if (id === 'a') {
    // シャツの袖をまくった前腕は肌
    strokeLimb(ctx, arm, w, rgba(W.top));
    ctx.strokeStyle = rgba(W.skin);
    ctx.lineWidth = w * 0.86;
    ctx.beginPath();
    ctx.moveTo(arm.mid.x + (arm.b.x - arm.mid.x) * 0.2, arm.mid.y + (arm.b.y - arm.mid.y) * 0.2);
    ctx.lineTo(arm.b.x, arm.b.y);
    ctx.stroke();
    // まくった袖口
    ctx.strokeStyle = rgba(darken(W.top, 0.18));
    ctx.lineWidth = w * 1.15;
    ctx.beginPath();
    ctx.moveTo(arm.mid.x + (arm.b.x - arm.mid.x) * 0.08, arm.mid.y + (arm.b.y - arm.mid.y) * 0.08);
    ctx.lineTo(arm.mid.x + (arm.b.x - arm.mid.x) * 0.26, arm.mid.y + (arm.b.y - arm.mid.y) * 0.26);
    ctx.stroke();
  } else if (id === 'b') {
    // ストライプの袖（破線で縞を作る）
    strokeLimb(ctx, arm, w, rgba(W.top));
    ctx.lineCap = 'butt';
    ctx.setLineDash([hr * 0.19, hr * 0.19]);
    strokeLimb(ctx, arm, w * 0.98, rgba(W.top2));
    ctx.setLineDash([]);
    ctx.lineCap = 'round';
    // 手首から先は肌
    ctx.strokeStyle = rgba(W.skin);
    ctx.lineWidth = w * 0.8;
    ctx.beginPath();
    ctx.moveTo(arm.mid.x + (arm.b.x - arm.mid.x) * 0.8, arm.mid.y + (arm.b.y - arm.mid.y) * 0.8);
    ctx.lineTo(arm.b.x, arm.b.y);
    ctx.stroke();
  } else {
    strokeLimb(ctx, arm, w, rgba(W.top));
    // 袖口のリブ
    ctx.strokeStyle = rgba(darken(W.top, 0.22));
    ctx.lineWidth = w * 1.05;
    ctx.beginPath();
    ctx.moveTo(arm.mid.x + (arm.b.x - arm.mid.x) * 0.82, arm.mid.y + (arm.b.y - arm.mid.y) * 0.82);
    ctx.lineTo(arm.mid.x + (arm.b.x - arm.mid.x) * 0.94, arm.mid.y + (arm.b.y - arm.mid.y) * 0.94);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}

function drawLegs(ctx: CanvasRenderingContext2D, id: CharacterId, P: Proportions, hr: number, W: Wardrobe, x: number, hipY: number, feetY: number, facing: number): void {
  const w = P.legW * hr;
  const hw = P.hip * hr;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const legs: Limb[] = [];
  for (const s of [-1, 1]) {
    const a: Pt = { x: x + s * hw * 0.5, y: hipY };
    const b: Pt = { x: x + s * hw * 0.62 + facing * hr * 0.1, y: feetY - hr * 0.16 };
    const mid: Pt = { x: (a.x + b.x) / 2 + s * hr * 0.04, y: (a.y + b.y) / 2 };
    legs.push({ a, mid, b });
  }
  if (id === 'b') {
    // 半ズボン + 縞の靴下 + 丸い靴
    for (const l of legs) strokeLimb(ctx, l, w + 2.6, W.outline);
    for (const l of legs) strokeLimb(ctx, l, w, rgba(W.white));
    ctx.lineCap = 'butt';
    ctx.setLineDash([hr * 0.14, hr * 0.14]);
    for (const l of legs) strokeLimb(ctx, l, w * 0.98, rgba(W.top2));
    ctx.setLineDash([]);
    ctx.lineCap = 'round';
    // 半ズボン
    ctx.fillStyle = rgba(W.bottom);
    ctx.strokeStyle = W.outline;
    ctx.lineWidth = 1.4;
    const kneeY = hipY + (feetY - hipY) * 0.5;
    ctx.beginPath();
    ctx.moveTo(x - hw, hipY - hr * 0.1);
    ctx.lineTo(x + hw, hipY - hr * 0.1);
    ctx.lineTo(x + hw * 1.15 + facing * hr * 0.05, kneeY);
    ctx.lineTo(x + hw * 0.1, kneeY);
    ctx.lineTo(x, kneeY - hr * 0.2);
    ctx.lineTo(x - hw * 0.1, kneeY);
    ctx.lineTo(x - hw * 1.15 + facing * hr * 0.05, kneeY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (const l of legs) {
      ctx.fillStyle = rgba(W.shoe);
      ctx.beginPath();
      ctx.ellipse(l.b.x + facing * hr * 0.1, feetY - hr * 0.1, hr * 0.36, hr * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (id === 'c') {
    // ジョガーパンツ + スニーカー
    for (const l of legs) strokeLimb(ctx, l, w + 2.6, W.outline);
    for (const l of legs) strokeLimb(ctx, l, w, rgba(W.bottom));
    for (const l of legs) {
      const fx = l.b.x + facing * hr * 0.12;
      const fy = feetY - hr * 0.12;
      ctx.fillStyle = rgba(W.shoe);
      ctx.strokeStyle = W.outline;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(fx - hr * 0.42, fy - hr * 0.2, hr * 0.84, hr * 0.36, hr * 0.16);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = rgba(W.hat);
      ctx.fillRect(fx - hr * 0.4, fy + hr * 0.02, hr * 0.8, hr * 0.06);
      ctx.fillStyle = rgba(W.line, 0.6);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(fx - hr * 0.16 + i * hr * 0.16, fy - hr * 0.08, hr * 0.03, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    // 細身のズボン + 革靴
    for (const l of legs) strokeLimb(ctx, l, w + 2.6, W.outline);
    for (const l of legs) strokeLimb(ctx, l, w, rgba(W.bottom));
    // 折り目
    ctx.strokeStyle = rgba(darken(W.bottom, 0.3));
    ctx.lineWidth = 1;
    for (const l of legs) {
      ctx.beginPath();
      ctx.moveTo(l.a.x, l.a.y + hr * 0.3);
      ctx.lineTo(l.b.x, l.b.y - hr * 0.1);
      ctx.stroke();
    }
    for (const l of legs) {
      ctx.fillStyle = rgba(W.shoe);
      ctx.strokeStyle = W.outline;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.ellipse(l.b.x + facing * hr * 0.1, feetY - hr * 0.1, hr * 0.38, hr * 0.17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}

// ---- 全体 -------------------------------------------------------------------

export class CharacterSprites {
  private readonly cache = new Map<string, HTMLCanvasElement>();

  clear(): void {
    this.cache.clear();
  }

  private get(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
    let c = this.cache.get(key);
    if (!c) {
      c = make();
      this.cache.set(key, c);
    }
    return c;
  }

  /** キャラクターを描く。手は spec.hands の位置に置く（hands[0] = 画面右の手） */
  draw(ctx: CanvasRenderingContext2D, s: CharacterSpec): void {
    const P = PROPS[s.id];
    const u = s.unit;
    const hr = u * P.hr;
    const W = wardrobe(s.id, s.partner, s.pal);
    const { body } = s.pose;
    const m = P.motionAmp;
    const themeKey = s.pal.dark ? 'd' : 'l';
    const key = `${s.id}|${s.partner ? 'p' : 'm'}|${themeKey}|${hr.toFixed(2)}|${s.dpr}|${s.facing}`;
    const torsoImg = this.get(`${key}|torso`, () => renderTorso(s.id, P, hr, W, s.dpr));
    const headImg = this.get(`${key}|head`, () => renderHead(s.id, s.partner, P, hr, W, s.dpr, s.facing));

    const height = P.heads * 2 * hr;
    const L = P.torso * hr;
    const rise = body.hop * hr * 0.4 * m;
    const feetY = s.feetY - rise * 0.35;
    const hipY = s.feetY - (height - 2 * P.headH * hr - P.neck * hr - L) - rise;
    // 上体の上下（呼吸・背筋・うなだれ・お辞儀）
    const dyUpper = body.breathe * hr * 0.05 * m - body.stretch * hr * 0.14 + body.slump * hr * 0.2 + body.bow * hr * 0.55;
    const sy = Math.max(0.6, 1 - dyUpper / L);
    const lean = body.lean * m;
    const px = s.x;
    const py = hipY;

    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.feetY, hr * (P.hip + 0.9), hr * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // 脚
    drawLegs(ctx, s.id, P, hr, W, s.x, hipY, feetY, s.facing);

    // 胴
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(lean);
    ctx.scale(1, sy);
    const tw = torsoImg.width / s.dpr;
    const th = torsoImg.height / s.dpr;
    ctx.drawImage(torsoImg, -tw / 2, -(th - hr * 0.3), tw, th);
    ctx.restore();

    // 肩と頭の位置（傾きを反映）
    const sw = P.shoulder * hr;
    const shoulderY = py - L * sy + hr * 0.18;
    const drop = body.shoulderDrop * hr * 0.16 * m;
    const shoulders: [Pt, Pt] = [
      rot({ x: px + sw * 0.82, y: shoulderY + drop }, px, py, lean),
      rot({ x: px - sw * 0.82, y: shoulderY + drop }, px, py, lean),
    ];
    const neckBase = rot({ x: px, y: py - L * sy }, px, py, lean);
    // お辞儀では頭が胴の縮み以上に下がる（前へ倒れて見える）
    const headC = rot({ x: px + s.facing * hr * 0.05, y: py - L * sy - P.neck * hr - P.headH * hr * 0.92 + body.slump * hr * 0.1 + body.bow * hr * 0.3 }, px, py, lean);
    const headAngle = lean + body.headTilt * m + body.bow * 0.25 + body.nod * 0.1 * m - body.slump * 0.06;

    // 腕（肩 → 肘 → 手）
    const armW = P.armW * hr;
    const handR = P.hand * hr;
    const arms: { limb: Limb; side: number; closed: number }[] = [];
    for (let i = 0; i < 2; i++) {
      const sh = shoulders[i === 0 ? 0 : 1];
      const side = i === 0 ? 1 : -1;
      const pose = s.hands[i === 0 ? 0 : 1];
      // 下ろした手はお辞儀で少し内側・下へ（腕を体に添える）
      const hand: Pt = pose ? pose.p : { x: sh.x + side * hr * (0.35 - body.bow * 0.12), y: s.handY + hr * 1.1 + body.slump * hr * 0.15 + body.bow * hr * 0.25 };
      const dx = hand.x - sh.x;
      const dy = hand.y - sh.y;
      // 肘は肩の下に垂れ、前腕が手へ伸びる（手が下がっているほど肘は外へ）
      const mid: Pt = pose
        ? { x: sh.x + dx * 0.22 + side * hr * (0.35 + body.slump * 0.25), y: sh.y + Math.max(hr * 1.05, dy * 0.8) }
        : { x: sh.x + dx * 0.5 + side * hr * 0.15, y: sh.y + dy * 0.55 };
      arms.push({ limb: { a: sh, mid, b: hand }, side, closed: pose ? pose.closed : 0.75 });
    }
    for (const a of arms) drawArm(ctx, s.id, a.limb, armW, W, hr);

    // 首
    ctx.strokeStyle = rgba(darken(W.skin, 0.12));
    ctx.lineWidth = hr * 0.42;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(neckBase.x, neckBase.y + hr * 0.1);
    ctx.lineTo(headC.x, headC.y + hr * 0.5);
    ctx.stroke();

    // 頭
    ctx.save();
    ctx.translate(headC.x, headC.y);
    ctx.rotate(headAngle);
    const hs = headImg.width / s.dpr;
    ctx.drawImage(headImg, -hs / 2, -hs / 2, hs, hs);
    drawFace(ctx, s.id, P, hr, W, s.pose, s.facing, 1);
    ctx.restore();

    // 手
    for (const a of arms) drawHand(ctx, a.limb.b, handR, a.closed, a.side, W);
  }
}

/** 見た目の確認用: 頭身と手の大きさ */
export function characterMetrics(id: CharacterId, unit: number): { heads: number; headRadius: number; handRadius: number } {
  const P = PROPS[id];
  return { heads: P.heads, headRadius: unit * P.hr, handRadius: unit * P.hr * P.hand };
}

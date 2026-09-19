// 球・クラブ・ジャグラーの描画。球とクラブは一度オフスクリーンに描いて drawImage で使い回す。
import { darken, lighten, mix, rgba, type Palette, type RGBA } from './palette';

export interface Point {
  x: number;
  y: number;
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

/** 陰影とハイライト付きの球。半径・色ごとにキャッシュ */
export class BallSprites {
  private readonly cache = new Map<string, HTMLCanvasElement>();

  clear(): void {
    this.cache.clear();
  }

  private render(color: string, r: number, dpr: number, ink: string): HTMLCanvasElement {
    const pad = 2;
    const size = (r + pad) * 2;
    const { c, g } = makeCanvas(size, size, dpr);
    const cx = r + pad;
    const cy = r + pad;
    const grad = g.createRadialGradient(cx - r * 0.38, cy - r * 0.4, r * 0.08, cx, cy, r * 1.05);
    grad.addColorStop(0, rgba(lighten(color, 0.55)));
    grad.addColorStop(0.35, color);
    grad.addColorStop(0.8, rgba(darken(color, 0.22)));
    grad.addColorStop(1, rgba(darken(color, 0.42)));
    g.fillStyle = grad;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = rgba(ink, 0.35);
    g.lineWidth = 1;
    g.stroke();
    // 反射の点
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.beginPath();
    g.ellipse(cx - r * 0.42, cy - r * 0.48, r * 0.2, r * 0.13, -Math.PI / 5, 0, Math.PI * 2);
    g.fill();
    return c;
  }

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, dpr: number, ink: string): void {
    const key = `${color}|${r}|${dpr}|${ink}`;
    let s = this.cache.get(key);
    if (!s) {
      s = this.render(color, r, dpr, ink);
      this.cache.set(key, s);
    }
    const size = s.width / dpr;
    ctx.drawImage(s, x - size / 2, y - size / 2, size, size);
  }
}

/** クラブ。原点は重心（頭寄り）。上が頭、下が柄 */
export class ClubSprites {
  private readonly cache = new Map<string, HTMLCanvasElement>();

  clear(): void {
    this.cache.clear();
  }

  private render(color: string, r: number, dpr: number, ink: string, ivory: string): HTMLCanvasElement {
    const w = r * 1.6;
    const top = r * 2.1;
    const bottom = r * 2.5;
    const { c, g } = makeCanvas(w, top + bottom, dpr);
    g.translate(w / 2, top);
    const outline = rgba(ink, 0.4);
    // 柄
    const handle = g.createLinearGradient(-r * 0.15, 0, r * 0.15, 0);
    handle.addColorStop(0, rgba(mix(ivory, color, 0.25)));
    handle.addColorStop(0.5, rgba(lighten(mix(ivory, color, 0.15), 0.2)));
    handle.addColorStop(1, rgba(darken(mix(ivory, color, 0.3), 0.15)));
    g.fillStyle = handle;
    g.strokeStyle = outline;
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(-r * 0.16, r * 0.2, r * 0.32, r * 1.95, r * 0.1);
    g.fill();
    g.stroke();
    // 柄の端の玉
    g.fillStyle = rgba(darken(color, 0.1));
    g.beginPath();
    g.arc(0, r * 2.15, r * 0.3, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // 頭（洋梨型）
    const body = g.createLinearGradient(-r * 0.65, 0, r * 0.65, 0);
    body.addColorStop(0, rgba(lighten(color, 0.35)));
    body.addColorStop(0.35, color);
    body.addColorStop(1, rgba(darken(color, 0.4)));
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(-r * 0.17, r * 0.35);
    g.bezierCurveTo(-r * 0.75, -r * 0.1, -r * 0.78, -r * 1.35, -r * 0.35, -r * 1.85);
    g.quadraticCurveTo(0, -r * 2.15, r * 0.35, -r * 1.85);
    g.bezierCurveTo(r * 0.78, -r * 1.35, r * 0.75, -r * 0.1, r * 0.17, r * 0.35);
    g.closePath();
    g.fill();
    g.stroke();
    // 帯
    g.save();
    g.clip();
    g.fillStyle = rgba(ivory, 0.55);
    g.fillRect(-r, -r * 0.55, r * 2, r * 0.22);
    g.fillStyle = rgba(ink, 0.18);
    g.fillRect(-r, -r * 1.05, r * 2, r * 0.12);
    g.restore();
    // 反射
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.beginPath();
    g.ellipse(-r * 0.3, -r * 1.2, r * 0.09, r * 0.45, 0.05, 0, Math.PI * 2);
    g.fill();
    return c;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    angle: number,
    color: string,
    dpr: number,
    ink: string,
    ivory: string,
  ): void {
    const key = `${color}|${r}|${dpr}|${ink}`;
    let s = this.cache.get(key);
    if (!s) {
      s = this.render(color, r, dpr, ink, ivory);
      this.cache.set(key, s);
    }
    const w = s.width / dpr;
    const h = s.height / dpr;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(s, -w / 2, -r * 2.1, w, h);
    ctx.restore();
  }
}

export interface FigureColors {
  skin: RGBA;
  shirt: RGBA;
  hair: RGBA;
  outline: string;
}

export function figureColors(pal: Palette, partner: boolean): FigureColors {
  return partner
    ? {
        skin: mix(pal.ivory, pal.amber, 0.3),
        shirt: mix(pal.coral, pal.dark ? pal.bg : pal.ink, 0.28),
        hair: darken(mix(pal.sky, pal.coral, 0.2), 0.62),
        outline: rgba(pal.ink, 0.45),
      }
    : {
        skin: mix(pal.ivory, pal.coral, 0.28),
        shirt: mix(pal.sky, pal.dark ? pal.bg : pal.ink, 0.28),
        hair: darken(pal.amber, 0.62),
        outline: rgba(pal.ink, 0.45),
      };
}

export interface HandPose {
  /** 描画位置（拍の上下を含む） */
  p: Point;
  /** 0 = 開く、1 = 閉じる */
  closed: number;
}

export interface FigureSpec {
  /** 身体の中心 x */
  x: number;
  /** 手の基準の高さ（ここから頭の位置を決める） */
  handY: number;
  /** 描画幅（比率の基準） */
  unit: number;
  /** 画面の高さ（胴を下端まで伸ばす） */
  bottom: number;
  /** 右手・左手。null は腕を下ろす */
  hands: [HandPose | null, HandPose | null];
  /** 向き。−1 = 左、0 = 正面、1 = 右 */
  facing: -1 | 0 | 1;
  colors: FigureColors;
}

/**
 * ジャグラーの身体。頭・胴・腕を描き、手は spec.hands の位置に置く。
 * 手は右手が hands[0]（画面右）、左手が hands[1]。
 */
export function drawFigure(ctx: CanvasRenderingContext2D, s: FigureSpec): void {
  const u = s.unit;
  const hr = u * 0.03;
  const headY = s.handY - u * 0.155;
  const shoulderY = headY + hr + u * 0.028;
  const sw = u * 0.058;
  const shirt = rgba(s.colors.shirt);
  const shirtDark = rgba(darken(s.colors.shirt, 0.25));
  const skin = rgba(s.colors.skin);
  const armW = u * 0.021;

  // 影（床の上）
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath();
  ctx.ellipse(s.x, s.handY + u * 0.075, u * 0.09, u * 0.014, 0, 0, Math.PI * 2);
  ctx.fill();

  // 胴（肩から下端まで、腰で少しすぼむ）
  const waistY = s.handY + u * 0.02;
  const ww = u * 0.048;
  const g = ctx.createLinearGradient(s.x - sw, 0, s.x + sw, 0);
  g.addColorStop(0, rgba(lighten(s.colors.shirt, 0.18)));
  g.addColorStop(0.55, shirt);
  g.addColorStop(1, shirtDark);
  ctx.fillStyle = g;
  ctx.strokeStyle = s.colors.outline;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(s.x - sw, shoulderY + u * 0.012);
  ctx.quadraticCurveTo(s.x - sw, shoulderY - u * 0.01, s.x - sw * 0.6, shoulderY - u * 0.012);
  ctx.lineTo(s.x + sw * 0.6, shoulderY - u * 0.012);
  ctx.quadraticCurveTo(s.x + sw, shoulderY - u * 0.01, s.x + sw, shoulderY + u * 0.012);
  ctx.quadraticCurveTo(s.x + sw * 0.95, waistY - u * 0.02, s.x + ww, waistY);
  ctx.lineTo(s.x + ww * 1.1, s.bottom + 2);
  ctx.lineTo(s.x - ww * 1.1, s.bottom + 2);
  ctx.lineTo(s.x - ww, waistY);
  ctx.quadraticCurveTo(s.x - sw * 0.95, waistY - u * 0.02, s.x - sw, shoulderY + u * 0.012);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // ベルト
  ctx.fillStyle = rgba(darken(s.colors.shirt, 0.45));
  ctx.fillRect(s.x - ww * 1.02, waistY, ww * 2.04, u * 0.012);

  // 首
  ctx.fillStyle = skin;
  ctx.fillRect(s.x - u * 0.012, headY + hr * 0.7, u * 0.024, u * 0.035);

  // 頭
  const hx = s.x + s.facing * u * 0.006;
  const hg = ctx.createRadialGradient(hx - hr * 0.35, headY - hr * 0.35, hr * 0.1, hx, headY, hr * 1.05);
  hg.addColorStop(0, rgba(lighten(s.colors.skin, 0.25)));
  hg.addColorStop(0.7, skin);
  hg.addColorStop(1, rgba(darken(s.colors.skin, 0.18)));
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(hx, headY, hr, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // 髪
  ctx.fillStyle = rgba(s.colors.hair);
  ctx.beginPath();
  ctx.arc(hx, headY - hr * 0.08, hr * 1.02, Math.PI * 1.05 + s.facing * 0.2, Math.PI * 1.95 + s.facing * 0.2);
  ctx.quadraticCurveTo(hx + s.facing * hr * 0.3, headY - hr * 0.35, hx - hr * 0.98, headY - hr * 0.1);
  ctx.closePath();
  ctx.fill();
  // 目（拍を見る）
  ctx.fillStyle = s.colors.outline;
  const ey = headY + hr * 0.05;
  if (s.facing === 0) {
    ctx.beginPath();
    ctx.arc(hx - hr * 0.35, ey, hr * 0.09, 0, Math.PI * 2);
    ctx.arc(hx + hr * 0.35, ey, hr * 0.09, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(hx + s.facing * hr * 0.55, ey, hr * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }

  // 腕（肩 → 肘 → 手）。手が無い側は下ろす
  const shoulders: [Point, Point] = [
    { x: s.x + sw * 0.85, y: shoulderY + u * 0.01 },
    { x: s.x - sw * 0.85, y: shoulderY + u * 0.01 },
  ];
  for (let i = 0; i < 2; i++) {
    const sh = shoulders[i] as Point;
    const side = i === 0 ? 1 : -1;
    const pose = s.hands[i] ?? null;
    const hand: Point = pose ? pose.p : { x: sh.x + side * u * 0.012, y: s.handY + u * 0.055 };
    const dx = hand.x - sh.x;
    const dy = hand.y - sh.y;
    const elbow: Point = pose
      ? { x: sh.x + dx * 0.45 + side * u * 0.018, y: sh.y + dy * 0.62 + u * 0.018 }
      : { x: sh.x + dx * 0.5 + side * u * 0.008, y: sh.y + dy * 0.5 };
    ctx.strokeStyle = shirtDark;
    ctx.lineWidth = armW + 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(sh.x, sh.y);
    ctx.lineTo(elbow.x, elbow.y);
    ctx.lineTo(hand.x, hand.y);
    ctx.stroke();
    ctx.strokeStyle = shirt;
    ctx.lineWidth = armW;
    ctx.stroke();
    // 手首から先は肌
    ctx.strokeStyle = skin;
    ctx.lineWidth = armW * 0.9;
    ctx.beginPath();
    ctx.moveTo(elbow.x + (hand.x - elbow.x) * 0.72, elbow.y + (hand.y - elbow.y) * 0.72);
    ctx.lineTo(hand.x, hand.y);
    ctx.stroke();
    drawHand(ctx, hand, u, pose ? pose.closed : 0.6, side, skin, s.colors.outline);
  }
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}

/** 手のひら。closed が 1 に近いほど指を閉じる */
function drawHand(
  ctx: CanvasRenderingContext2D,
  p: Point,
  u: number,
  closed: number,
  side: number,
  skin: string,
  outline: string,
): void {
  const r = u * 0.017;
  ctx.fillStyle = skin;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.2;
  // 手のひら
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + r * 0.2, r * (1.05 - closed * 0.12), r * (0.85 + closed * 0.15), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // 指。開いているときは上に短く並び、閉じると内側へ曲がって短くなる
  const spread = (1 - closed) * 0.3 + 0.18;
  const len = r * (0.75 - closed * 0.35);
  ctx.lineCap = 'round';
  ctx.lineWidth = r * 0.34;
  ctx.strokeStyle = skin;
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + (i - 1.5) * spread - side * closed * 0.4;
    const fx = p.x + (i - 1.5) * r * 0.42;
    const fy = p.y - r * 0.45;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + Math.cos(a) * len, fy + Math.sin(a) * len);
    ctx.stroke();
  }
  // 親指（外側）
  const ta = -Math.PI / 2 - side * (1.2 - closed * 0.5);
  ctx.beginPath();
  ctx.moveTo(p.x - side * r * 0.7, p.y);
  ctx.lineTo(p.x - side * r * 0.7 + Math.cos(ta) * r * 0.6, p.y + Math.sin(ta) * r * 0.6);
  ctx.stroke();
  // 輪郭は薄く一周
  ctx.lineCap = 'butt';
  ctx.lineWidth = 1;
  ctx.strokeStyle = outline;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + r * 0.2, r * (1.05 - closed * 0.12), r * (0.85 + closed * 0.15), 0, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
}

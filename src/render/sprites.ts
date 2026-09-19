// 球・クラブ・ジャグラーの描画。球とクラブは一度オフスクリーンに描いて drawImage で使い回す。
// 絵柄（vector / ink / paint）で描き分ける。ink のジッタは seed（低頻度で更新）から作る。
import {
  bezier,
  brushStroke,
  daub,
  hatch,
  inkCircle,
  inkLine,
  inkStroke,
  lcg,
  quad,
  resample,
  rimColor,
  shadeColor,
  tracePath,
  vivid,
  wash,
  wobble,
  wobblyCircle,
  wobblyEllipse,
  type Pt,
  type Rnd,
} from './brush';
import { darken, lighten, mix, rgba, type Palette, type RGBA } from './palette';
import type { ArtStyle } from './style';

export type Point = Pt;

/** スプライトの描画に要る環境。arena が毎フレーム同じものを渡す */
export interface SpriteEnv {
  style: ArtStyle;
  dpr: number;
  pal: Palette;
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

function hashStr(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** ink の線の色。紙が暗ければ明るいインク */
function inkColor(pal: Palette, alpha = 0.92): string {
  return rgba(pal.ink, alpha);
}

/** 陰影とハイライト付きの球。半径・色・絵柄ごとにキャッシュ */
export class BallSprites {
  private readonly cache = new Map<string, HTMLCanvasElement>();

  clear(): void {
    this.cache.clear();
  }

  private renderVector(color: string, r: number, dpr: number, ink: string): HTMLCanvasElement {
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

  private renderInk(color: string, r: number, env: SpriteEnv): HTMLCanvasElement {
    const { pal } = env;
    const pad = r * 0.5 + 3;
    const size = (r + pad) * 2;
    const { c, g } = makeCanvas(size, size, env.dpr);
    const cx = r + pad;
    const cy = r + pad;
    const rnd = lcg(hashStr(color) + Math.round(r * 10));
    // 水彩の塗り。輪郭から少しはみ出し、右下に寄る
    wash(g, wobblyCircle(rnd, cx + r * 0.08, cy + r * 0.1, r * 1.05, 0.07, 36), rgba(mix(color, pal.panel, 0.1)), 0.55, 0.7);
    // 影側の溜まり
    wash(g, wobblyCircle(rnd, cx + r * 0.28, cy + r * 0.3, r * 0.62, 0.14, 28), rgba(darken(color, 0.35)), 0.32, 0);
    // 紙の白を残したハイライト
    g.fillStyle = rgba(pal.panel, 0.9);
    g.beginPath();
    tracePath(g, wobblyEllipse(rnd, cx - r * 0.38, cy - r * 0.4, r * 0.24, r * 0.15, 0.2, 16), true);
    g.fill();
    // ハッチング（右下）
    const clip = new Path2D();
    clip.arc(cx, cy, r * 0.98, 0, Math.PI * 2);
    hatch(g, rnd, clip, { x: cx - r, y: cy - r, w: r * 2, h: r * 2 }, {
      color: inkColor(pal, 0.6),
      angle: -Math.PI / 4,
      spacing: Math.max(2.6, r * 0.17),
      width: 0.9,
      range: [r * 0.12, r],
      jitter: 1.2,
    });
    // 輪郭。太さが揺れる
    inkCircle(g, rnd, cx, cy, r, { color: inkColor(pal), width: Math.max(1.6, r * 0.11), vary: 0.6 }, 0.035);
    return c;
  }

  private renderPaint(color: string, r: number, env: SpriteEnv): HTMLCanvasElement {
    const { pal } = env;
    const pad = r * 0.3 + 2;
    const size = (r + pad) * 2;
    const { c, g } = makeCanvas(size, size, env.dpr);
    const cx = r + pad;
    const cy = r + pad;
    const rnd = lcg(hashStr(color) + Math.round(r * 10) + 7);
    const base = vivid(color, 1.25, 0);
    const shade = shadeColor(base, pal.sky, 0.45);
    const light = vivid(lighten(base, 0.3), 1.1, 0.05);
    const rim = rimColor(base, pal.amber);
    // 下地。輪郭線は無く、暗い側へ落ちる
    const grad = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r * 1.05);
    grad.addColorStop(0, rgba(light));
    grad.addColorStop(0.55, rgba(base));
    grad.addColorStop(1, rgba(shade));
    g.fillStyle = grad;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.beginPath();
    g.arc(cx, cy, r * 0.995, 0, Math.PI * 2);
    g.clip();
    g.filter = `blur(${(r * 0.07).toFixed(2)}px)`;
    // 筆跡。明るい側に沿って短い楕円を重ねる
    for (let i = 0; i < 9; i++) {
      const a = -2.4 + (i / 8) * 2.2 + (rnd() - 0.5) * 0.2;
      const d = r * (0.3 + rnd() * 0.35);
      daub(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * (0.28 + rnd() * 0.12), r * (0.12 + rnd() * 0.06), a + Math.PI / 2, rgba(mix(base, light, rnd()), 0.65));
    }
    // 暗い側
    for (let i = 0; i < 6; i++) {
      const a = 0.4 + (i / 5) * 1.8 + (rnd() - 0.5) * 0.2;
      const d = r * (0.55 + rnd() * 0.3);
      daub(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * (0.3 + rnd() * 0.1), r * (0.13 + rnd() * 0.05), a + Math.PI / 2, rgba(darken(shade, rnd() * 0.25), 0.55));
    }
    // リムライト（右下の縁）
    g.strokeStyle = rgba(rim, 0.85);
    g.lineWidth = r * 0.16;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(cx, cy, r * 0.9, Math.PI * 0.12, Math.PI * 0.62);
    g.stroke();
    g.filter = 'none';
    // 厚塗りのハイライト
    daub(g, cx - r * 0.4, cy - r * 0.42, r * 0.22, r * 0.12, -Math.PI / 5, 'rgba(255,255,255,0.92)');
    daub(g, cx - r * 0.22, cy - r * 0.58, r * 0.07, r * 0.05, 0, 'rgba(255,255,255,0.8)');
    g.restore();
    return c;
  }

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, env: SpriteEnv): void {
    const key = `${env.style}|${color}|${r}|${env.dpr}|${env.pal.ink}|${env.pal.panel}`;
    let s = this.cache.get(key);
    if (!s) {
      s = env.style === 'ink' ? this.renderInk(color, r, env) : env.style === 'paint' ? this.renderPaint(color, r, env) : this.renderVector(color, r, env.dpr, env.pal.ink);
      this.cache.set(key, s);
    }
    const size = s.width / env.dpr;
    ctx.drawImage(s, x - size / 2, y - size / 2, size, size);
  }
}

/** クラブの頭（洋梨型）の輪郭。原点は重心、上が頭 */
function clubHead(r: number): Pt[] {
  const m = (x: number, y: number): Pt => ({ x: x * r, y: y * r });
  return [
    ...bezier(m(-0.17, 0.35), m(-0.75, -0.1), m(-0.78, -1.35), m(-0.35, -1.85), 14),
    ...quad(m(-0.35, -1.85), m(0, -2.15), m(0.35, -1.85), 8).slice(1),
    ...bezier(m(0.35, -1.85), m(0.78, -1.35), m(0.75, -0.1), m(0.17, 0.35), 14).slice(1),
  ];
}

/** クラブ。原点は重心（頭寄り）。上が頭、下が柄 */
export class ClubSprites {
  private readonly cache = new Map<string, HTMLCanvasElement>();

  clear(): void {
    this.cache.clear();
  }

  private renderVector(color: string, r: number, dpr: number, ink: string, ivory: string): HTMLCanvasElement {
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

  private renderInk(color: string, r: number, env: SpriteEnv): HTMLCanvasElement {
    const { pal } = env;
    const w = r * 2.2;
    const top = r * 2.1;
    const bottom = r * 2.5;
    const { c, g } = makeCanvas(w, top + bottom + r * 0.3, env.dpr);
    g.translate(w / 2, top + r * 0.1);
    const rnd = lcg(hashStr(color) + Math.round(r * 10) + 3);
    const ink = inkColor(pal);
    const head = clubHead(r);
    const headWob = wobble(rnd, resample(head, 3, true), r * 0.03, true);
    // 柄（水彩 + 輪郭）
    const hx = r * 0.16;
    const handlePts = wobble(rnd, resample([{ x: -hx, y: r * 0.25 }, { x: hx, y: r * 0.25 }, { x: hx, y: r * 2.1 }, { x: -hx, y: r * 2.1 }], 4, true), 0.9, true);
    wash(g, handlePts.map((p) => ({ x: p.x + 1, y: p.y + 1 })), rgba(mix(pal.panel, color, 0.35)), 0.5, 0.6);
    inkStroke(g, rnd, handlePts, { color: ink, width: Math.max(1.4, r * 0.09), vary: 0.5, closed: true });
    // 端の玉
    wash(g, wobblyCircle(rnd, r * 0.05, r * 2.2, r * 0.32, 0.1, 20), rgba(darken(color, 0.1)), 0.55, 0.5);
    inkCircle(g, rnd, 0, r * 2.15, r * 0.3, { color: ink, width: Math.max(1.3, r * 0.08), vary: 0.5 }, 0.06);
    // 頭: 水彩の塗り、影の溜まり、ハッチング、輪郭
    wash(g, headWob.map((p) => ({ x: p.x + r * 0.08, y: p.y + r * 0.08 })), rgba(mix(color, pal.panel, 0.08)), 0.55, 0.7);
    wash(g, wobblyEllipse(rnd, r * 0.3, -r * 0.75, r * 0.28, r * 0.85, 0.1, 24), rgba(darken(color, 0.35)), 0.3, 0);
    const clip = new Path2D();
    tracePath(clip, head, true);
    hatch(g, rnd, clip, { x: -r, y: -r * 2.2, w: r * 2, h: r * 2.6 }, {
      color: inkColor(pal, 0.6),
      angle: -Math.PI / 3,
      spacing: Math.max(2.6, r * 0.17),
      width: 0.9,
      range: [r * 0.05, r * 1.2],
    });
    // 帯（2 本の線）
    for (const y of [-r * 0.5, -r * 1.05]) {
      inkLine(g, rnd, { x: -r * 0.7, y }, { x: r * 0.7, y }, { color: inkColor(pal, 0.7), width: 1.2, vary: 0.5 }, 1);
    }
    // 紙を残すハイライト
    g.fillStyle = rgba(pal.panel, 0.9);
    g.beginPath();
    tracePath(g, wobblyEllipse(rnd, -r * 0.3, -r * 1.2, r * 0.1, r * 0.45, 0.2, 16), true);
    g.fill();
    inkStroke(g, rnd, headWob, { color: ink, width: Math.max(1.6, r * 0.11), vary: 0.6, closed: true });
    return c;
  }

  private renderPaint(color: string, r: number, env: SpriteEnv): HTMLCanvasElement {
    const { pal } = env;
    const w = r * 1.9;
    const top = r * 2.1;
    const bottom = r * 2.5;
    const { c, g } = makeCanvas(w, top + bottom + r * 0.2, env.dpr);
    g.translate(w / 2, top + r * 0.05);
    const rnd = lcg(hashStr(color) + Math.round(r * 10) + 11);
    const base = vivid(color, 1.25, 0);
    const shade = shadeColor(base, pal.sky, 0.45);
    const light = vivid(lighten(base, 0.3), 1.1, 0.05);
    const rim = rimColor(base, pal.amber);
    const handleCol = mix(pal.ivory, base, 0.2);
    // 柄: 太い筆のストロークと、片側の影
    brushStroke(g, rnd, { x: 0, y: r * 0.3 }, { x: 0, y: r * 2.1 }, r * 0.34, rgba(darken(handleCol, 0.3)), 0.9);
    brushStroke(g, rnd, { x: -r * 0.05, y: r * 0.3 }, { x: -r * 0.05, y: r * 2.05 }, r * 0.2, rgba(lighten(handleCol, 0.15)), 0.9);
    daub(g, 0, r * 2.15, r * 0.32, r * 0.3, 0, rgba(shade));
    daub(g, -r * 0.08, r * 2.08, r * 0.16, r * 0.13, -0.5, rgba(light, 0.8));
    // 頭: 下地 → 筆跡 → リムライト
    const head = clubHead(r);
    const clip = new Path2D();
    tracePath(clip, head, true);
    const grad = g.createLinearGradient(-r * 0.7, 0, r * 0.7, 0);
    grad.addColorStop(0, rgba(light));
    grad.addColorStop(0.4, rgba(base));
    grad.addColorStop(1, rgba(shade));
    g.fillStyle = grad;
    g.fill(clip);
    g.save();
    g.clip(clip);
    g.filter = `blur(${(r * 0.06).toFixed(2)}px)`;
    for (let i = 0; i < 10; i++) {
      const y = -r * 1.9 + (i / 9) * r * 2.1;
      const x = -r * 0.35 + (rnd() - 0.5) * r * 0.2;
      daub(g, x, y, r * 0.12, r * 0.32, 0.15 + (rnd() - 0.5) * 0.3, rgba(mix(base, light, rnd()), 0.6));
    }
    for (let i = 0; i < 7; i++) {
      const y = -r * 1.6 + (i / 6) * r * 1.8;
      daub(g, r * 0.42 + (rnd() - 0.5) * r * 0.15, y, r * 0.12, r * 0.3, -0.2, rgba(darken(shade, rnd() * 0.2), 0.55));
    }
    // 帯: 筆で一撫で
    brushStroke(g, rnd, { x: -r * 0.8, y: -r * 0.5 }, { x: r * 0.8, y: -r * 0.55 }, r * 0.2, rgba(lighten(pal.ivory, 0.2)), 0.6);
    brushStroke(g, rnd, { x: -r * 0.8, y: -r * 1.05 }, { x: r * 0.8, y: -r * 1.1 }, r * 0.12, rgba(shade), 0.5);
    g.strokeStyle = rgba(rim, 0.8);
    g.lineWidth = r * 0.14;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(r * 0.55, -r * 0.2);
    g.quadraticCurveTo(r * 0.72, -r * 1.2, r * 0.3, -r * 1.85);
    g.stroke();
    g.filter = 'none';
    daub(g, -r * 0.32, -r * 1.25, r * 0.08, r * 0.4, 0.08, 'rgba(255,255,255,0.85)');
    g.restore();
    return c;
  }

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number, color: string, env: SpriteEnv): void {
    const key = `${env.style}|${color}|${r}|${env.dpr}|${env.pal.ink}|${env.pal.panel}`;
    let s = this.cache.get(key);
    if (!s) {
      s =
        env.style === 'ink'
          ? this.renderInk(color, r, env)
          : env.style === 'paint'
            ? this.renderPaint(color, r, env)
            : this.renderVector(color, r, env.dpr, env.pal.ink, env.pal.ivory);
      this.cache.set(key, s);
    }
    const w = s.width / env.dpr;
    const h = s.height / env.dpr;
    const originY = env.style === 'ink' ? r * 2.2 : env.style === 'paint' ? r * 2.15 : r * 2.1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(s, -w / 2, -originY, w, h);
    ctx.restore();
  }
}

export interface FigureColors {
  skin: RGBA;
  shirt: RGBA;
  hair: RGBA;
  outline: string;
}

export function figureColors(pal: Palette, partner: boolean, style: ArtStyle = 'vector'): FigureColors {
  const c: FigureColors = partner
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
  if (style === 'paint') {
    return { ...c, skin: vivid(c.skin, 1.2, 0.02), shirt: vivid(c.shirt, 1.4, 0.02), hair: vivid(c.hair, 1.2, -0.02) };
  }
  if (style === 'ink') {
    return { ...c, outline: rgba(pal.ink, 0.92) };
  }
  return c;
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
  style: ArtStyle;
  pal: Palette;
  /** ink のジッタの種。低頻度で変える */
  seed: number;
}

interface FigureGeom {
  u: number;
  hr: number;
  headY: number;
  hx: number;
  shoulderY: number;
  sw: number;
  waistY: number;
  ww: number;
  armW: number;
  torso: Pt[];
  shoulders: [Pt, Pt];
}

function figureGeom(s: FigureSpec): FigureGeom {
  const u = s.unit;
  const hr = u * 0.03;
  const headY = s.handY - u * 0.155;
  const shoulderY = headY + hr + u * 0.028;
  const sw = u * 0.058;
  const waistY = s.handY + u * 0.02;
  const ww = u * 0.048;
  const torso: Pt[] = [
    { x: s.x - sw, y: shoulderY + u * 0.012 },
    ...quad({ x: s.x - sw, y: shoulderY + u * 0.012 }, { x: s.x - sw, y: shoulderY - u * 0.01 }, { x: s.x - sw * 0.6, y: shoulderY - u * 0.012 }, 4).slice(1),
    { x: s.x + sw * 0.6, y: shoulderY - u * 0.012 },
    ...quad({ x: s.x + sw * 0.6, y: shoulderY - u * 0.012 }, { x: s.x + sw, y: shoulderY - u * 0.01 }, { x: s.x + sw, y: shoulderY + u * 0.012 }, 4).slice(1),
    ...quad({ x: s.x + sw, y: shoulderY + u * 0.012 }, { x: s.x + sw * 0.95, y: waistY - u * 0.02 }, { x: s.x + ww, y: waistY }, 5).slice(1),
    { x: s.x + ww * 1.1, y: s.bottom + 2 },
    { x: s.x - ww * 1.1, y: s.bottom + 2 },
    { x: s.x - ww, y: waistY },
    ...quad({ x: s.x - ww, y: waistY }, { x: s.x - sw * 0.95, y: waistY - u * 0.02 }, { x: s.x - sw, y: shoulderY + u * 0.012 }, 5).slice(1, -1),
  ];
  return {
    u,
    hr,
    headY,
    hx: s.x + s.facing * u * 0.006,
    shoulderY,
    sw,
    waistY,
    ww,
    armW: u * 0.021,
    torso,
    shoulders: [
      { x: s.x + sw * 0.85, y: shoulderY + u * 0.01 },
      { x: s.x - sw * 0.85, y: shoulderY + u * 0.01 },
    ],
  };
}

interface Arm {
  sh: Pt;
  elbow: Pt;
  hand: Pt;
  side: number;
  closed: number;
}

function arms(s: FigureSpec, gm: FigureGeom): [Arm, Arm] {
  const u = gm.u;
  const out: Arm[] = [];
  for (let i = 0; i < 2; i++) {
    const sh = gm.shoulders[i] as Pt;
    const side = i === 0 ? 1 : -1;
    const pose = s.hands[i] ?? null;
    const hand: Pt = pose ? pose.p : { x: sh.x + side * u * 0.012, y: s.handY + u * 0.055 };
    const dx = hand.x - sh.x;
    const dy = hand.y - sh.y;
    const elbow: Pt = pose
      ? { x: sh.x + dx * 0.45 + side * u * 0.018, y: sh.y + dy * 0.62 + u * 0.018 }
      : { x: sh.x + dx * 0.5 + side * u * 0.008, y: sh.y + dy * 0.5 };
    out.push({ sh, elbow, hand, side, closed: pose ? pose.closed : 0.6 });
  }
  return out as [Arm, Arm];
}

/**
 * ジャグラーの身体。頭・胴・腕を描き、手は spec.hands の位置に置く。
 * 手は右手が hands[0]（画面右）、左手が hands[1]。
 */
export function drawFigure(ctx: CanvasRenderingContext2D, s: FigureSpec): void {
  const gm = figureGeom(s);
  if (s.style === 'ink') return drawFigureInk(ctx, s, gm);
  if (s.style === 'paint') return drawFigurePaint(ctx, s, gm);
  return drawFigureVector(ctx, s, gm);
}

function drawFigureVector(ctx: CanvasRenderingContext2D, s: FigureSpec, gm: FigureGeom): void {
  const { u, hr, headY, hx, shoulderY, sw, waistY, ww, armW } = gm;
  const shirt = rgba(s.colors.shirt);
  const shirtDark = rgba(darken(s.colors.shirt, 0.25));
  const skin = rgba(s.colors.skin);

  // 影（床の上）
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath();
  ctx.ellipse(s.x, s.handY + u * 0.075, u * 0.09, u * 0.014, 0, 0, Math.PI * 2);
  ctx.fill();

  // 胴（肩から下端まで、腰で少しすぼむ）
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
  drawEyes(ctx, s, gm, s.colors.outline, hr * 0.09);

  // 腕（肩 → 肘 → 手）。手が無い側は下ろす
  for (const a of arms(s, gm)) {
    ctx.strokeStyle = shirtDark;
    ctx.lineWidth = armW + 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(a.sh.x, a.sh.y);
    ctx.lineTo(a.elbow.x, a.elbow.y);
    ctx.lineTo(a.hand.x, a.hand.y);
    ctx.stroke();
    ctx.strokeStyle = shirt;
    ctx.lineWidth = armW;
    ctx.stroke();
    // 手首から先は肌
    ctx.strokeStyle = skin;
    ctx.lineWidth = armW * 0.9;
    ctx.beginPath();
    ctx.moveTo(a.elbow.x + (a.hand.x - a.elbow.x) * 0.72, a.elbow.y + (a.hand.y - a.elbow.y) * 0.72);
    ctx.lineTo(a.hand.x, a.hand.y);
    ctx.stroke();
    drawHandVector(ctx, a.hand, u, a.closed, a.side, skin, s.colors.outline);
  }
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}

function drawEyes(ctx: CanvasRenderingContext2D, s: FigureSpec, gm: FigureGeom, color: string, r: number): void {
  const { hr, headY, hx } = gm;
  ctx.fillStyle = color;
  const ey = headY + hr * 0.05;
  ctx.beginPath();
  if (s.facing === 0) {
    ctx.arc(hx - hr * 0.35, ey, r, 0, Math.PI * 2);
    ctx.arc(hx + hr * 0.35, ey, r, 0, Math.PI * 2);
  } else {
    ctx.arc(hx + s.facing * hr * 0.55, ey, r, 0, Math.PI * 2);
  }
  ctx.fill();
}

/** 指の位置（手のひらの上に 4 本と親指） */
function fingers(p: Pt, u: number, closed: number, side: number): [Pt, Pt][] {
  const r = u * 0.017;
  const spread = (1 - closed) * 0.3 + 0.18;
  const len = r * (0.75 - closed * 0.35);
  const out: [Pt, Pt][] = [];
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + (i - 1.5) * spread - side * closed * 0.4;
    const fx = p.x + (i - 1.5) * r * 0.42;
    const fy = p.y - r * 0.45;
    out.push([{ x: fx, y: fy }, { x: fx + Math.cos(a) * len, y: fy + Math.sin(a) * len }]);
  }
  const ta = -Math.PI / 2 - side * (1.2 - closed * 0.5);
  out.push([{ x: p.x - side * r * 0.7, y: p.y }, { x: p.x - side * r * 0.7 + Math.cos(ta) * r * 0.6, y: p.y + Math.sin(ta) * r * 0.6 }]);
  return out;
}

/** 手のひら。closed が 1 に近いほど指を閉じる */
function drawHandVector(ctx: CanvasRenderingContext2D, p: Pt, u: number, closed: number, side: number, skin: string, outline: string): void {
  const r = u * 0.017;
  ctx.fillStyle = skin;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + r * 0.2, r * (1.05 - closed * 0.12), r * (0.85 + closed * 0.15), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.lineWidth = r * 0.34;
  ctx.strokeStyle = skin;
  for (const [a, b] of fingers(p, u, closed, side)) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.lineWidth = 1;
  ctx.strokeStyle = outline;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + r * 0.2, r * (1.05 - closed * 0.12), r * (0.85 + closed * 0.15), 0, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
}

/** 折れ線を法線方向に d だけずらす（腕の両側の線を作る） */
function offsetPolyline(pts: readonly Pt[], d: number): Pt[] {
  const n = pts.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)] as Pt;
    const b = pts[Math.min(n - 1, i + 1)] as Pt;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const p = pts[i] as Pt;
    out.push({ x: p.x - (dy / l) * d, y: p.y + (dx / l) * d });
  }
  return out;
}

// ---- ink（手描き） ----------------------------------------------------------

function drawFigureInk(ctx: CanvasRenderingContext2D, s: FigureSpec, gm: FigureGeom): void {
  const { u, hr, headY, hx, waistY, ww, armW } = gm;
  const rnd: Rnd = lcg(s.seed * 17 + 5);
  const ink = s.colors.outline;
  const inkW = Math.max(1.5, u * 0.0028);
  const shirtWash = rgba(s.colors.shirt);
  const skinWash = rgba(s.colors.skin);

  // 影: 楕円にハッチング
  const shadow = new Path2D();
  shadow.ellipse(s.x, s.handY + u * 0.075, u * 0.09, u * 0.014, 0, 0, Math.PI * 2);
  hatch(ctx, rnd, shadow, { x: s.x - u * 0.09, y: s.handY + u * 0.06, w: u * 0.18, h: u * 0.03 }, {
    color: rgba(s.pal.ink, 0.35),
    angle: -Math.PI / 5,
    spacing: 4,
    width: 0.9,
  });

  // 胴: 水彩の塗り（少しずれる）→ ハッチング → 輪郭
  const torso = wobble(rnd, resample(gm.torso, 6, true), inkW * 0.8, true);
  wash(ctx, torso.map((p) => ({ x: p.x + 2, y: p.y + 2 })), shirtWash, 0.5, 0.5);
  const torsoClip = new Path2D();
  tracePath(torsoClip, gm.torso, true);
  hatch(ctx, rnd, torsoClip, { x: s.x - gm.sw, y: gm.shoulderY - u * 0.02, w: gm.sw * 2, h: s.bottom - gm.shoulderY + u * 0.03 }, {
    color: rgba(s.pal.ink, 0.5),
    angle: -Math.PI / 3,
    spacing: Math.max(3.5, u * 0.007),
    width: 0.9,
    range: [gm.sw * 0.25, gm.sw * 1.6],
  });
  inkStroke(ctx, rnd, torso, { color: ink, width: inkW, vary: 0.5, closed: true });
  // ベルト
  inkLine(ctx, rnd, { x: s.x - ww * 1.02, y: waistY + u * 0.006 }, { x: s.x + ww * 1.02, y: waistY + u * 0.006 }, { color: ink, width: inkW * 1.4, vary: 0.4 }, 1);

  // 首（2 本の線）
  inkLine(ctx, rnd, { x: s.x - u * 0.011, y: headY + hr * 0.8 }, { x: s.x - u * 0.011, y: headY + hr + u * 0.028 }, { color: ink, width: inkW * 0.8 }, 0.6);
  inkLine(ctx, rnd, { x: s.x + u * 0.011, y: headY + hr * 0.8 }, { x: s.x + u * 0.011, y: headY + hr + u * 0.028 }, { color: ink, width: inkW * 0.8 }, 0.6);

  // 頭: 肌の水彩 + 頬の影ハッチ + 輪郭 + 髪
  wash(ctx, wobblyCircle(rnd, hx + hr * 0.1, headY + hr * 0.12, hr * 1.02, 0.06, 24), skinWash, 0.5, 0.5);
  const headClip = new Path2D();
  headClip.arc(hx, headY, hr, 0, Math.PI * 2);
  hatch(ctx, rnd, headClip, { x: hx - hr, y: headY - hr, w: hr * 2, h: hr * 2 }, {
    color: rgba(s.pal.ink, 0.4),
    angle: -Math.PI / 4,
    spacing: Math.max(3, hr * 0.2),
    width: 0.8,
    range: [hr * 0.4, hr],
  });
  inkCircle(ctx, rnd, hx, headY, hr, { color: ink, width: inkW, vary: 0.5 }, 0.05);
  const hairPts: Pt[] = [];
  const a0 = Math.PI * 1.05 + s.facing * 0.2;
  const a1 = Math.PI * 1.95 + s.facing * 0.2;
  for (let i = 0; i <= 14; i++) {
    const a = a0 + ((a1 - a0) * i) / 14;
    hairPts.push({ x: hx + Math.cos(a) * hr * 1.06, y: headY - hr * 0.08 + Math.sin(a) * hr * 1.06 });
  }
  const hairBottom = quad(hairPts[hairPts.length - 1] as Pt, { x: hx + s.facing * hr * 0.3, y: headY - hr * 0.35 }, hairPts[0] as Pt, 8).slice(1, -1);
  const hair = wobble(rnd, [...hairPts, ...hairBottom], inkW * 0.6, true);
  wash(ctx, hair, rgba(s.colors.hair), 0.75, 0.6);
  inkStroke(ctx, rnd, hair, { color: ink, width: inkW, vary: 0.5, closed: true });
  // 髪の流れ（数本の線）
  for (let i = 0; i < 3; i++) {
    const a = a0 + ((a1 - a0) * (0.25 + i * 0.25));
    inkLine(ctx, rnd, { x: hx + Math.cos(a) * hr * 0.95, y: headY - hr * 0.08 + Math.sin(a) * hr * 0.95 }, { x: hx + Math.cos(a) * hr * 0.55, y: headY - hr * 0.1 + Math.sin(a) * hr * 0.55 }, { color: rgba(s.pal.ink, 0.55), width: inkW * 0.7 }, 0.5);
  }
  drawEyes(ctx, s, gm, ink, hr * 0.1);

  // 腕: 両側の線と、間の水彩
  for (const a of arms(s, gm)) {
    const center: Pt[] = resample([a.sh, a.elbow, a.hand], 6);
    const left = wobble(rnd, offsetPolyline(center, armW / 2), inkW * 0.6);
    const right = wobble(rnd, offsetPolyline(center, -armW / 2), inkW * 0.6);
    const wristT = 0.72;
    const wi = Math.floor(left.length * wristT);
    wash(ctx, [...left.slice(0, wi + 1), ...right.slice(0, wi + 1).reverse()], shirtWash, 0.5, 0);
    wash(ctx, [...left.slice(wi), ...right.slice(wi).reverse()], skinWash, 0.5, 0);
    inkStroke(ctx, rnd, left, { color: ink, width: inkW, vary: 0.5, taper: true });
    inkStroke(ctx, rnd, right, { color: ink, width: inkW, vary: 0.5, taper: true });
    // 袖口
    const lw = left[wi] as Pt;
    const rw = right[wi] as Pt;
    inkLine(ctx, rnd, lw, rw, { color: ink, width: inkW * 0.8 }, 0.5);
    drawHandInk(ctx, rnd, a.hand, u, a.closed, a.side, skinWash, ink, inkW);
  }
}

function drawHandInk(ctx: CanvasRenderingContext2D, rnd: Rnd, p: Pt, u: number, closed: number, side: number, skin: string, ink: string, inkW: number): void {
  const r = u * 0.017;
  const rx = r * (1.05 - closed * 0.12);
  const ry = r * (0.85 + closed * 0.15);
  const palm = wobblyEllipse(rnd, p.x, p.y + r * 0.2, rx, ry, 0.08, 20);
  wash(ctx, palm.map((q) => ({ x: q.x + 1, y: q.y + 1 })), skin, 0.5, 0.4);
  inkStroke(ctx, rnd, palm, { color: ink, width: inkW * 0.9, vary: 0.5, closed: true });
  for (const [a, b] of fingers(p, u, closed, side)) {
    inkLine(ctx, rnd, a, b, { color: ink, width: inkW * 0.85, vary: 0.4 }, 0.5);
  }
}

// ---- paint（塗り） ----------------------------------------------------------

function drawFigurePaint(ctx: CanvasRenderingContext2D, s: FigureSpec, gm: FigureGeom): void {
  const { u, hr, headY, hx, sw, waistY, ww, armW } = gm;
  const rnd: Rnd = lcg(s.seed * 13 + 9);
  const shirt = s.colors.shirt;
  const shirtLight = lighten(mix(shirt, s.pal.amber, 0.15), 0.3);
  const shirtDark = shadeColor(shirt, s.pal.sky, 0.4);
  const skin = s.colors.skin;
  const skinLight = lighten(skin, 0.3);
  const skinDark = shadeColor(skin, s.pal.coral, 0.25);

  // 影: 柔らかい楕円
  const sg = ctx.createRadialGradient(s.x, s.handY + u * 0.075, 0, s.x, s.handY + u * 0.075, u * 0.1);
  sg.addColorStop(0, 'rgba(0,0,0,0.22)');
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg;
  ctx.save();
  ctx.translate(s.x, s.handY + u * 0.075);
  ctx.scale(1, 0.18);
  ctx.beginPath();
  ctx.arc(0, 0, u * 0.1, 0, Math.PI * 2);
  ctx.restore();
  ctx.fill();

  // 胴: 色面 + 筆跡（輪郭線なし）
  const torsoClip = new Path2D();
  tracePath(torsoClip, gm.torso, true);
  const g = ctx.createLinearGradient(s.x - sw, 0, s.x + sw, 0);
  g.addColorStop(0, rgba(shirtLight));
  g.addColorStop(0.45, rgba(shirt));
  g.addColorStop(1, rgba(shirtDark));
  ctx.fillStyle = g;
  ctx.fill(torsoClip);
  ctx.save();
  ctx.clip(torsoClip);
  for (let i = 0; i < 6; i++) {
    const y = gm.shoulderY + u * 0.01 + (i / 5) * (s.bottom - gm.shoulderY);
    daub(ctx, s.x - sw * 0.45 + (rnd() - 0.5) * u * 0.012, y, u * 0.016, u * 0.035, 0.25 + (rnd() - 0.5) * 0.3, rgba(mix(shirtLight, s.pal.ivory, 0.2), 0.7));
    daub(ctx, s.x + sw * 0.5 + (rnd() - 0.5) * u * 0.012, y + u * 0.012, u * 0.014, u * 0.032, -0.2 + (rnd() - 0.5) * 0.3, rgba(darken(shirtDark, 0.25), 0.65));
    daub(ctx, s.x + (rnd() - 0.5) * u * 0.02, y + u * 0.02, u * 0.01, u * 0.025, 0.1, rgba(mix(shirt, s.pal.amber, 0.15), 0.45));
  }
  // リムライト（右肩から右脇へ）
  ctx.strokeStyle = rgba(rimColor(shirt, s.pal.amber), 0.75);
  ctx.lineWidth = u * 0.005;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(s.x + sw * 0.75, gm.shoulderY - u * 0.005);
  ctx.quadraticCurveTo(s.x + sw * 0.98, waistY - u * 0.03, s.x + ww * 1.02, waistY + u * 0.02);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // ベルト
  brushStroke(ctx, rnd, { x: s.x - ww * 1.05, y: waistY + u * 0.006 }, { x: s.x + ww * 1.05, y: waistY + u * 0.006 }, u * 0.014, rgba(darken(shirtDark, 0.35)), 0.9, u * 0.012);
  ctx.restore();

  // 首
  ctx.fillStyle = rgba(skinDark);
  ctx.fillRect(s.x - u * 0.012, headY + hr * 0.7, u * 0.024, u * 0.035);

  // 頭: 球のような陰影 + 頬 + 髪
  const hg = ctx.createRadialGradient(hx - hr * 0.35, headY - hr * 0.35, hr * 0.1, hx, headY, hr * 1.05);
  hg.addColorStop(0, rgba(skinLight));
  hg.addColorStop(0.6, rgba(skin));
  hg.addColorStop(1, rgba(skinDark));
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(hx, headY, hr, 0, Math.PI * 2);
  ctx.fill();
  daub(ctx, hx - hr * 0.4 + s.facing * hr * 0.2, headY + hr * 0.25, hr * 0.22, hr * 0.14, 0, rgba(mix(skin, s.pal.coral, 0.5), 0.45));
  daub(ctx, hx + hr * 0.45, headY + hr * 0.3, hr * 0.2, hr * 0.12, 0.5, rgba(rimColor(skin, s.pal.amber), 0.6));
  ctx.fillStyle = rgba(s.colors.hair);
  ctx.beginPath();
  ctx.arc(hx, headY - hr * 0.08, hr * 1.04, Math.PI * 1.05 + s.facing * 0.2, Math.PI * 1.95 + s.facing * 0.2);
  ctx.quadraticCurveTo(hx + s.facing * hr * 0.3, headY - hr * 0.35, hx - hr * 0.98, headY - hr * 0.1);
  ctx.closePath();
  ctx.fill();
  daub(ctx, hx - hr * 0.35, headY - hr * 0.8, hr * 0.42, hr * 0.14, -0.6, rgba(lighten(s.colors.hair, 0.35), 0.7));
  drawEyes(ctx, s, gm, rgba(darken(s.colors.hair, 0.3)), hr * 0.1);

  // 腕: 暗い下地の上に明るい筆を重ねる
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const a of arms(s, gm)) {
    const wrist = { x: a.elbow.x + (a.hand.x - a.elbow.x) * 0.72, y: a.elbow.y + (a.hand.y - a.elbow.y) * 0.72 };
    ctx.strokeStyle = rgba(shirtDark);
    ctx.lineWidth = armW + 2;
    ctx.beginPath();
    ctx.moveTo(a.sh.x, a.sh.y);
    ctx.lineTo(a.elbow.x, a.elbow.y);
    ctx.lineTo(wrist.x, wrist.y);
    ctx.stroke();
    ctx.strokeStyle = rgba(shirtLight, 0.85);
    ctx.lineWidth = armW * 0.55;
    ctx.beginPath();
    ctx.moveTo(a.sh.x - 1.5, a.sh.y - 1.5);
    ctx.lineTo(a.elbow.x - 1.5, a.elbow.y - 1);
    ctx.lineTo(wrist.x - 1, wrist.y - 1);
    ctx.stroke();
    ctx.strokeStyle = rgba(skinDark);
    ctx.lineWidth = armW * 0.95;
    ctx.beginPath();
    ctx.moveTo(wrist.x, wrist.y);
    ctx.lineTo(a.hand.x, a.hand.y);
    ctx.stroke();
    ctx.strokeStyle = rgba(skinLight, 0.7);
    ctx.lineWidth = armW * 0.4;
    ctx.beginPath();
    ctx.moveTo(wrist.x - 1, wrist.y - 1);
    ctx.lineTo(a.hand.x - 1, a.hand.y - 1);
    ctx.stroke();
    drawHandPaint(ctx, a.hand, u, a.closed, a.side, skin, skinLight, skinDark);
  }
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}

function drawHandPaint(ctx: CanvasRenderingContext2D, p: Pt, u: number, closed: number, side: number, skin: RGBA, light: RGBA, dark: RGBA): void {
  const r = u * 0.017;
  const rx = r * (1.05 - closed * 0.12);
  const ry = r * (0.85 + closed * 0.15);
  const hg = ctx.createRadialGradient(p.x - rx * 0.3, p.y, 0, p.x, p.y + r * 0.2, rx * 1.2);
  hg.addColorStop(0, rgba(light));
  hg.addColorStop(0.6, rgba(skin));
  hg.addColorStop(1, rgba(dark));
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + r * 0.2, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = 'round';
  for (const [a, b] of fingers(p, u, closed, side)) {
    ctx.strokeStyle = rgba(dark);
    ctx.lineWidth = r * 0.38;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = rgba(skin);
    ctx.lineWidth = r * 0.24;
    ctx.beginPath();
    ctx.moveTo(a.x - 0.5, a.y - 0.5);
    ctx.lineTo(b.x - 0.5, b.y - 0.5);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

// 看板類。見せ場の横断幕（コーラルの布を紐で吊る）と、舞台の電飾看板（墨地に電球の縁）。
// 布と板はオフスクリーンにキャッシュし、文字だけ毎フレーム描く（文字は拍ごとに変わる）。
import { inkStroke, lcg, resample, vivid, wobble, type Pt } from './brush';
import { styledText } from './effects';
import { DISPLAY_FONT, fontsVersion } from './fonts';
import { darken, lighten, mix, rgba, type Palette, type RGBA } from './palette';
import type { ArtStyle } from './style';

export interface SignEnv {
  pal: Palette;
  style: ArtStyle;
  dpr: number;
  reduceMotion: boolean;
}

/** キャッシュの上限。超えたら全部捨てる（幅の種類は少ない） */
const CACHE_MAX = 12;
const PAD = 6;

function makeCanvas(w: number, h: number, dpr: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2d context is unavailable');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, g };
}

/** 横断幕の布の色 */
function clothColor(pal: Palette, style: ArtStyle): RGBA {
  const base = mix(pal.coral, [190, 60, 45, 1], pal.dark ? 0.25 : 0.35);
  return style === 'paint' ? vivid(base, 1.3, 0.02) : base;
}

/** 電飾看板の板の色（墨地）。ダークでは背景よりさらに暗く */
function boardColor(pal: Palette): RGBA {
  return pal.dark ? darken(mix(pal.bg, [20, 16, 14, 1], 0.5), 0.35) : darken(pal.ink, 0.25);
}

export class Signage {
  private readonly cache = new Map<string, HTMLCanvasElement>();
  private readonly widths = new Map<string, number>();
  private fontsSeen = -1;

  clear(): void {
    this.cache.clear();
    this.widths.clear();
  }

  private refresh(): void {
    const v = fontsVersion();
    if (v !== this.fontsSeen) {
      this.fontsSeen = v;
      this.clear();
    }
  }

  private get(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
    let c = this.cache.get(key);
    if (!c) {
      if (this.cache.size >= CACHE_MAX) this.cache.clear();
      c = make();
      this.cache.set(key, c);
    }
    return c;
  }

  private measure(ctx: CanvasRenderingContext2D, font: string, text: string): number {
    const key = `${font}|${text}`;
    let w = this.widths.get(key);
    if (w === undefined) {
      if (this.widths.size > 64) this.widths.clear();
      ctx.font = font;
      w = ctx.measureText(text).width;
      this.widths.set(key, w);
    }
    return w;
  }

  /**
   * 横断幕。Canvas 上端から両端を紐で吊った布に白抜きの文字。
   * enter は 0〜1 の出現（上から降りてくる）。動きを減らす設定では揺れない。
   */
  banner(ctx: CanvasRenderingContext2D, W: number, H: number, text: string, env: SignEnv, now: number, enter = 1, big = false): void {
    this.refresh();
    const { pal, style } = env;
    const px = Math.round(Math.max(14, Math.min(24, W * (big ? 0.03 : 0.026))));
    const font = `700 ${px}px ${DISPLAY_FONT}`;
    const textW = this.measure(ctx, font, text);
    const clothH = Math.round(px * 2.1);
    const clothW = Math.round(Math.max(W * 0.26, Math.min(W * 0.72, textW + px * 2.6)));
    const base = clothColor(pal, style);
    const key = `banner|${clothW}|${clothH}|${pal.dark ? 'd' : 'l'}|${style}|${env.dpr}`;
    const img = this.get(key, () => renderCloth(clothW, clothH, env.dpr, base, pal, style));

    const cx = W / 2;
    const y0 = H * 0.07;
    const reduce = env.reduceMotion;
    const e = 1 - Math.pow(1 - Math.max(0, Math.min(1, enter)), 3);
    const drop = reduce ? 0 : (1 - e) * -clothH * 1.6;
    const sway = reduce ? 0 : Math.sin(now / 1300) * 0.014 + Math.sin(now / 430) * 0.004 + (1 - e) * 0.03;
    const bob = reduce ? 0 : Math.sin(now / 900) * 1.5;
    const top = y0 + drop + bob;

    // 紐（上端の左右から布の角へ）
    const c = Math.cos(sway);
    const s = Math.sin(sway);
    const corner = (dx: number): Pt => ({ x: cx + dx * c, y: top + dx * s });
    const l = corner(-clothW / 2);
    const r = corner(clothW / 2);
    ctx.strokeStyle = rgba(pal.ink, pal.dark ? 0.6 : 0.5);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(cx - clothW / 2 - W * 0.06, -2);
    ctx.lineTo(l.x, l.y);
    ctx.moveTo(cx + clothW / 2 + W * 0.06, -2);
    ctx.lineTo(r.x, r.y);
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, top);
    ctx.rotate(sway);
    ctx.drawImage(img, -clothW / 2 - PAD, -PAD, clothW + PAD * 2, clothH + PAD * 2);
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, px * 0.2);
    ctx.lineJoin = 'round';
    styledText(ctx, text, 0, clothH / 2 + 1, rgba(lighten(pal.ivory, 0.6)), rgba(darken(base, 0.5), 0.9), style);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  /**
   * 電飾看板。墨地の板の縁に電球が並び、phase（0 / 1）で点灯する電球が入れ替わる。
   * all が真なら全部点灯（完走）。幕の上（Canvas 上端の中央）に置く。
   */
  marquee(ctx: CanvasRenderingContext2D, W: number, H: number, text: string, env: SignEnv, phase: number, all = false): void {
    this.refresh();
    const { pal, style } = env;
    const px = Math.round(Math.max(13, Math.min(22, W * 0.024)));
    const font = `700 ${px}px ${DISPLAY_FONT}`;
    const textW = this.measure(ctx, font, text);
    const boardH = Math.round(px * 2.4);
    const boardW = Math.round(Math.max(W * 0.22, Math.min(W * 0.62, textW + px * 3)));
    const mode = all ? 'a' : phase & 1 ? '1' : '0';
    const key = `marquee|${boardW}|${boardH}|${mode}|${pal.dark ? 'd' : 'l'}|${style}|${env.dpr}`;
    const img = this.get(key, () => renderBoard(boardW, boardH, env.dpr, pal, style, all ? -1 : phase & 1));
    const cx = W / 2;
    const y0 = Math.round(H * 0.018);
    // 吊り金具
    ctx.strokeStyle = rgba(darken(pal.amber, 0.3), 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - boardW * 0.42, -1);
    ctx.lineTo(cx - boardW * 0.42, y0 + 2);
    ctx.moveTo(cx + boardW * 0.42, -1);
    ctx.lineTo(cx + boardW * 0.42, y0 + 2);
    ctx.stroke();
    ctx.drawImage(img, cx - boardW / 2 - PAD, y0 - PAD, boardW + PAD * 2, boardH + PAD * 2);
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, px * 0.2);
    ctx.lineJoin = 'round';
    const fill = style === 'paint' ? rgba(vivid(lighten(pal.amber, 0.3), 1.2, 0.05)) : rgba(lighten(pal.amber, pal.dark ? 0.25 : 0.4));
    styledText(ctx, text, cx, y0 + boardH / 2 + 1, fill, 'rgba(0,0,0,0.65)', style);
    ctx.textBaseline = 'alphabetic';
  }
}

/** 布（横断幕）。原点は左上から PAD 内側 */
function renderCloth(w: number, h: number, dpr: number, base: RGBA, pal: Palette, style: ArtStyle): HTMLCanvasElement {
  const { c, g } = makeCanvas(w + PAD * 2, h + PAD * 2, dpr);
  g.translate(PAD, PAD);
  const sag = h * 0.14;
  const shape = (): void => {
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(w / 2, sag, w, 0);
    g.lineTo(w, h);
    g.quadraticCurveTo(w / 2, h + sag, 0, h);
    g.closePath();
  };
  // 影
  g.save();
  g.translate(0, 3);
  shape();
  g.fillStyle = 'rgba(0,0,0,0.2)';
  g.fill();
  g.restore();
  // 地
  shape();
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, rgba(lighten(base, 0.14)));
  grad.addColorStop(0.55, rgba(base));
  grad.addColorStop(1, rgba(darken(base, 0.12)));
  g.fillStyle = grad;
  g.fill();
  g.save();
  shape();
  g.clip();
  // ひだ（縦の薄い明暗）
  const folds = Math.max(4, Math.round(w / 60));
  for (let i = 1; i < folds; i++) {
    const x = (w * i) / folds;
    g.fillStyle = rgba(darken(base, 0.4), style === 'paint' ? 0.16 : 0.1);
    g.fillRect(x - w * 0.012, -sag, w * 0.024, h + sag * 3);
    g.fillStyle = rgba(lighten(base, 0.35), 0.1);
    g.fillRect(x + w * 0.012, -sag, w * 0.014, h + sag * 3);
  }
  // 縫い目
  g.strokeStyle = rgba(lighten(pal.ivory, 0.5), 0.55);
  g.lineWidth = 1;
  g.setLineDash([3, 3]);
  g.beginPath();
  g.moveTo(4, 5);
  g.quadraticCurveTo(w / 2, 5 + sag, w - 4, 5);
  g.moveTo(4, h - 5);
  g.quadraticCurveTo(w / 2, h - 5 + sag, w - 4, h - 5);
  g.stroke();
  g.setLineDash([]);
  // 裾の影
  g.fillStyle = rgba(darken(base, 0.4), 0.3);
  g.fillRect(0, h - 3, w, 3 + sag);
  g.restore();
  // 縁
  if (style === 'ink') {
    const rnd = lcg(11);
    const outline: Pt[] = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ];
    inkStroke(g, rnd, wobble(rnd, resample(outline, 10, true), 1.2, true), { color: rgba(pal.ink, 0.85), width: 1.5, vary: 0.6, closed: true });
  } else {
    shape();
    g.strokeStyle = rgba(darken(base, 0.5), 0.75);
    g.lineWidth = 1.3;
    g.stroke();
  }
  // 鳩目（紐の取り付け）
  for (const x of [0, w]) {
    g.beginPath();
    g.arc(x, 0, 3, 0, Math.PI * 2);
    g.fillStyle = rgba(darken(base, 0.6));
    g.fill();
    g.strokeStyle = rgba(pal.amber, 0.95);
    g.lineWidth = 1.5;
    g.stroke();
  }
  return c;
}

/** 電飾看板の板。litParity は点灯する電球の偶奇。−1 なら全部点灯 */
function renderBoard(w: number, h: number, dpr: number, pal: Palette, style: ArtStyle, litParity: number): HTMLCanvasElement {
  const { c, g } = makeCanvas(w + PAD * 2, h + PAD * 2, dpr);
  g.translate(PAD, PAD);
  const board = boardColor(pal);
  const frame = darken(mix(pal.amber, pal.ink, pal.dark ? 0.2 : 0.35), pal.dark ? 0.3 : 0.15);
  // 影
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.fillRect(2, 3, w, h);
  // 枠
  g.fillStyle = rgba(frame);
  g.beginPath();
  g.roundRect(0, 0, w, h, 3);
  g.fill();
  // 板
  const inset = 7;
  const grad = g.createLinearGradient(0, inset, 0, h - inset);
  grad.addColorStop(0, rgba(lighten(board, 0.1)));
  grad.addColorStop(1, rgba(darken(board, 0.15)));
  g.fillStyle = grad;
  g.fillRect(inset, inset, w - inset * 2, h - inset * 2);
  g.strokeStyle = rgba(pal.amber, 0.35);
  g.lineWidth = 1;
  g.strokeRect(inset + 0.5, inset + 0.5, w - inset * 2 - 1, h - inset * 2 - 1);
  // 電球（枠の中心線に沿って一周）
  const gap = 11;
  const nx = Math.max(2, Math.round((w - inset) / gap));
  const ny = Math.max(1, Math.round((h - inset) / gap));
  const pts: Pt[] = [];
  for (let i = 0; i < nx; i++) pts.push({ x: inset / 2 + ((w - inset) * i) / nx, y: inset / 2 });
  for (let i = 0; i < ny; i++) pts.push({ x: w - inset / 2, y: inset / 2 + ((h - inset) * i) / ny });
  for (let i = 0; i < nx; i++) pts.push({ x: w - inset / 2 - ((w - inset) * i) / nx, y: h - inset / 2 });
  for (let i = 0; i < ny; i++) pts.push({ x: inset / 2, y: h - inset / 2 - ((h - inset) * i) / ny });
  const bright = style === 'paint' ? vivid(lighten(pal.amber, 0.5), 1.2, 0.1) : lighten(pal.amber, 0.55);
  const dim = darken(pal.amber, 0.55);
  pts.forEach((p, i) => {
    const lit = litParity < 0 || i % 2 === litParity;
    if (lit) {
      const glow = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, 6);
      glow.addColorStop(0, rgba(bright, 0.6));
      glow.addColorStop(1, rgba(bright, 0));
      g.fillStyle = glow;
      g.fillRect(p.x - 6, p.y - 6, 12, 12);
    }
    g.beginPath();
    g.arc(p.x, p.y, lit ? 2.3 : 1.8, 0, Math.PI * 2);
    g.fillStyle = rgba(lit ? bright : dim);
    g.fill();
    if (lit) {
      g.beginPath();
      g.arc(p.x - 0.6, p.y - 0.6, 0.8, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.fill();
    }
  });
  if (style === 'ink') {
    const rnd = lcg(29);
    const outline: Pt[] = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ];
    inkStroke(g, rnd, wobble(rnd, resample(outline, 10, true), 1, true), { color: rgba(pal.ink, 0.85), width: 1.4, vary: 0.6, closed: true });
  }
  return c;
}

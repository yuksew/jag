// 背景。壁と床板、路上の縁石と観客、舞台の幕と光。静的な部分はオフスクリーンに描いて使い回す。
// 絵柄（vector / ink / paint）で描き分ける。ink は紙 + 線画 + 薄い塗り、paint は色面とぼかし。
import type { PracticeMode } from '../core';
import {
  brushStroke,
  daub,
  hatch,
  inkCircle,
  inkLine,
  inkStroke,
  lcg,
  paper,
  quad,
  resample,
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

/** 床の高さ（描画高さに対する割合）。手の少し下 */
export const FLOOR_Y = 0.86;

/** 決まった並びの観客を出すための簡易乱数 */
function lcgOld(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * 夜の稽古場の基調色（ダークテーマ）。ページの壁と同系にするため、テーマの青緑（--bg）は使わず
 * 琥珀（--amber）と墨（--ink）の混色を暗くして作る。ライトでは使わない。
 */
function nightWarm(pal: Palette): RGBA {
  return darken(mix(pal.ink, pal.amber, 0.5), 0.72);
}

function floorColor(pal: Palette, prop: PracticeMode): RGBA {
  if (prop === 'street') return pal.dark ? darken(mix(nightWarm(pal), pal.muted, 0.35), 0.1) : mix(pal.panel2, pal.muted, 0.14);
  if (prop === 'stage') return darken(mix(pal.panel2, pal.amber, 0.18), pal.dark ? 0.45 : 0.32);
  if (pal.dark) return darken(mix(pal.amber, pal.coral, 0.3), 0.6);
  return mix(pal.panel2, pal.amber, 0.12);
}

function wallTop(pal: Palette, prop: PracticeMode): RGBA {
  if (prop === 'street') return pal.dark ? mix(lighten(nightWarm(pal), 0.06), pal.sky, 0.1) : mix(pal.panel, pal.sky, 0.16);
  if (prop === 'stage') return darken(pal.panel2, pal.dark ? 0.55 : 0.5);
  if (pal.dark) return lighten(nightWarm(pal), 0.08);
  return lighten(pal.panel, 0.35);
}

function wallBottom(pal: Palette, prop: PracticeMode): RGBA {
  if (prop === 'street') return pal.dark ? darken(nightWarm(pal), 0.1) : mix(pal.panel2, pal.muted, 0.08);
  if (prop === 'stage') return darken(pal.panel2, pal.dark ? 0.35 : 0.28);
  if (pal.dark) return darken(nightWarm(pal), 0.2);
  return mix(pal.panel2, pal.line, 0.25);
}

function drawBoards(ctx: CanvasRenderingContext2D, w: number, y0: number, y1: number, pal: Palette, base: RGBA): void {
  ctx.fillStyle = rgba(base);
  ctx.fillRect(0, y0, w, y1 - y0);
  // 奥から手前への明るさの変化
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, rgba(lighten(base, 0.12)));
  g.addColorStop(1, rgba(darken(base, 0.08)));
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, w, y1 - y0);
  const rowH = Math.max(9, (y1 - y0) / 5);
  const seam = rgba(pal.ink, pal.dark ? 0.22 : 0.1);
  ctx.strokeStyle = seam;
  ctx.lineWidth = 1;
  const boardW = w * 0.14;
  for (let i = 0, y = y0 + rowH; y < y1; i++, y += rowH) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
    // 板の継ぎ目は段ごとにずらす
    const off = ((i * 0.37 + 0.2) % 1) * boardW;
    for (let x = off; x < w; x += boardW) {
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, y - rowH);
      ctx.lineTo(Math.round(x) + 0.5, y);
      ctx.stroke();
    }
  }
  // 手前の縁のハイライト
  ctx.fillStyle = rgba(lighten(base, 0.35), 0.6);
  ctx.fillRect(0, y0, w, 1.5);
}

interface Spectator {
  x: number;
  y: number;
  s: number;
  hr: number;
}

function spectators(x0: number, x1: number, baseY: number, scale: number, count: number, seed: number): Spectator[] {
  const rnd = lcgOld(seed);
  const out: Spectator[] = [];
  for (let i = 0; i < count; i++) {
    const x = x0 + ((i + 0.5) / count) * (x1 - x0) + (rnd() - 0.5) * ((x1 - x0) / count) * 0.8;
    const s = scale * (0.75 + rnd() * 0.45);
    const y = baseY + (rnd() - 0.5) * s * 0.4;
    out.push({ x, y, s, hr: s * 0.42 });
  }
  return out;
}

function spectatorBody(sp: Spectator): Pt[] {
  const { x, y, s, hr } = sp;
  return [
    { x: x - s * 0.95, y: y + s * 1.6 },
    ...quad({ x: x - s * 0.95, y: y + s * 1.6 }, { x: x - s * 0.95, y: y + hr * 1.2 }, { x: x - s * 0.35, y: y + hr * 1.05 }, 5).slice(1),
    { x: x + s * 0.35, y: y + hr * 1.05 },
    ...quad({ x: x + s * 0.35, y: y + hr * 1.05 }, { x: x + s * 0.95, y: y + hr * 1.2 }, { x: x + s * 0.95, y: y + s * 1.6 }, 5).slice(1),
  ];
}

export interface AudienceGroup {
  x0: number;
  x1: number;
  baseY: number;
  scale: number;
  count: number;
  seed: number;
  color: string;
  /** 「見せた」で明るくなるときの色 */
  bright: string;
}

/** 路上の観客の並び（奥 1 列、手前の左右）。静的な背景と動く客席（audience.ts）で共有する */
export function streetAudience(w: number, h: number, pal: Palette): AudienceGroup[] {
  const back = rgba(mix(pal.ink, pal.muted, 0.4), pal.dark ? 0.28 : 0.2);
  const front = rgba(mix(pal.ink, pal.muted, 0.15), pal.dark ? 0.55 : 0.5);
  const lit = mix(pal.ivory, pal.amber, 0.55);
  return [
    { x0: -w * 0.02, x1: w * 1.02, baseY: h * 0.66, scale: w * 0.026, count: 16, seed: 7, color: back, bright: rgba(lit, 0.45) },
    { x0: -w * 0.03, x1: w * 0.24, baseY: h * 0.93, scale: w * 0.03, count: 4, seed: 3, color: front, bright: rgba(lit, 0.9) },
    { x0: w * 0.76, x1: w * 1.03, baseY: h * 0.93, scale: w * 0.03, count: 4, seed: 11, color: front, bright: rgba(lit, 0.9) },
  ];
}

export { spectators, spectatorBody, type Spectator };

function drawAudience(ctx: CanvasRenderingContext2D, x0: number, x1: number, baseY: number, scale: number, count: number, color: string, seed: number): void {
  ctx.fillStyle = color;
  for (const sp of spectators(x0, x1, baseY, scale, count, seed)) {
    ctx.beginPath();
    tracePath(ctx, spectatorBody(sp), true);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.hr, 0, Math.PI * 2);
    ctx.fill();
  }
}

export interface BackdropOptions {
  /** 路上の観客を静的な背景に含めるか（vector では動く客席に分けるので false） */
  audience?: boolean;
  /** 舞台の飾り幕を静的な背景に含めるか（vector では手前に別で描くので false） */
  valance?: boolean;
}

/** 静的な背景をオフスクリーンに描く */
export function renderBackdrop(w: number, h: number, dpr: number, prop: PracticeMode, pal: Palette, style: ArtStyle = 'vector', opts: BackdropOptions = {}): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (style === 'ink') renderInk(ctx, w, h, dpr, prop, pal);
  else if (style === 'paint') renderPaint(ctx, w, h, prop, pal);
  else renderVector(ctx, w, h, prop, pal, opts);
  return c;
}

// ---- vector（現状） ---------------------------------------------------------

function renderVector(ctx: CanvasRenderingContext2D, w: number, h: number, prop: PracticeMode, pal: Palette, opts: BackdropOptions): void {
  const floorY = h * FLOOR_Y;
  const withAudience = opts.audience !== false;
  const withValance = opts.valance !== false;
  const groups = streetAudience(w, h, pal);

  // 壁
  const wall = ctx.createLinearGradient(0, 0, 0, floorY);
  wall.addColorStop(0, rgba(wallTop(pal, prop)));
  wall.addColorStop(1, rgba(wallBottom(pal, prop)));
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, floorY);

  if (prop === 'street') {
    // 建物の窓（奥）
    const win = pal.dark ? rgba(mix(pal.amber, nightWarm(pal), 0.55), 0.55) : rgba(mix(pal.panel2, pal.ink, 0.18), 0.5);
    const frame = rgba(pal.ink, 0.1);
    const ww = w * 0.055;
    const wh = h * 0.09;
    for (let r = 0; r < 2; r++) {
      const y = h * 0.1 + r * h * 0.19;
      for (let x = w * 0.06; x < w * 0.95; x += w * 0.16) {
        ctx.fillStyle = win;
        ctx.fillRect(x, y, ww, wh);
        ctx.strokeStyle = frame;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, ww, wh);
        ctx.beginPath();
        ctx.moveTo(x + ww / 2, y);
        ctx.lineTo(x + ww / 2, y + wh);
        ctx.stroke();
      }
    }
    // 奥の観客（薄い）
    const back = groups[0] as AudienceGroup;
    if (withAudience) drawAudience(ctx, back.x0, back.x1, back.baseY, back.scale, back.count, back.color, back.seed);
    // 縁石と舗道
    const curbH = h * 0.03;
    const curbBase = pal.dark ? lighten(nightWarm(pal), 0.12) : pal.panel2;
    ctx.fillStyle = rgba(mix(curbBase, pal.muted, pal.dark ? 0.3 : 0.32));
    ctx.fillRect(0, floorY - curbH, w, curbH);
    ctx.fillStyle = rgba(lighten(mix(curbBase, pal.muted, 0.2), 0.3), 0.7);
    ctx.fillRect(0, floorY - curbH, w, 2);
    ctx.fillStyle = rgba(pal.ink, 0.12);
    ctx.fillRect(0, floorY - 1.5, w, 1.5);
    const pave = floorColor(pal, prop);
    ctx.fillStyle = rgba(pave);
    ctx.fillRect(0, floorY, w, h - floorY);
    ctx.strokeStyle = rgba(pal.ink, pal.dark ? 0.18 : 0.09);
    ctx.lineWidth = 1;
    const slab = w * 0.09;
    for (let x = slab * 0.5; x < w; x += slab) {
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, floorY);
      ctx.lineTo(Math.round(x) + 0.5, h);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, Math.round(floorY + (h - floorY) * 0.55) + 0.5);
    ctx.lineTo(w, Math.round(floorY + (h - floorY) * 0.55) + 0.5);
    ctx.stroke();
    // 手前の観客（両端）
    if (withAudience) {
      for (const g of groups.slice(1)) drawAudience(ctx, g.x0, g.x1, g.baseY, g.scale, g.count, g.color, g.seed);
    }
    return;
  }

  if (prop === 'stage') {
    // 奥の幕（薄い縦じま）
    ctx.fillStyle = rgba(pal.ink, pal.dark ? 0.12 : 0.06);
    for (let x = 0; x < w; x += w * 0.05) ctx.fillRect(x, 0, w * 0.02, floorY);
    // 床板と手前の縁
    drawBoards(ctx, w, floorY, h, pal, floorColor(pal, prop));
    ctx.fillStyle = rgba(darken(pal.panel2, 0.6));
    ctx.fillRect(0, h - h * 0.04, w, h * 0.04);
    // フットライト
    for (let i = 0; i < 9; i++) {
      const x = w * (0.08 + (0.84 * i) / 8);
      const g = ctx.createRadialGradient(x, h - h * 0.04, 0, x, h - h * 0.04, w * 0.05);
      g.addColorStop(0, rgba(pal.amber, 0.55));
      g.addColorStop(1, rgba(pal.amber, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - w * 0.05, h - h * 0.11, w * 0.1, h * 0.08);
      ctx.fillStyle = rgba(lighten(pal.amber, 0.5));
      ctx.beginPath();
      ctx.arc(x, h - h * 0.038, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // 上の飾り幕（波形の裾と金の縁）
    if (withValance) drawValance(ctx, w, h, pal);
    return;
  }

  // 練習場・クラブ・パッシング: 壁の腰板と床板
  const railY = h * 0.6;
  ctx.fillStyle = rgba(pal.ink, pal.dark ? 0.1 : 0.05);
  ctx.fillRect(0, railY, w, floorY - railY);
  ctx.fillStyle = rgba(pal.ink, pal.dark ? 0.25 : 0.12);
  ctx.fillRect(0, railY, w, 2);
  ctx.strokeStyle = rgba(pal.ink, pal.dark ? 0.12 : 0.05);
  ctx.lineWidth = 1;
  for (let x = w * 0.04; x < w; x += w * 0.08) {
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, railY + 6);
    ctx.lineTo(Math.round(x) + 0.5, floorY - 2);
    ctx.stroke();
  }
  // 壁の光だまり（夜は電灯の琥珀）
  const glow = ctx.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.3, w * 0.55);
  glow.addColorStop(0, pal.dark ? rgba(pal.amber, 0.14) : rgba(pal.ivory, 0.35));
  glow.addColorStop(1, rgba(pal.dark ? pal.amber : pal.ivory, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, floorY);
  drawBoards(ctx, w, floorY, h, pal, floorColor(pal, prop));
  ctx.fillStyle = rgba(pal.ink, pal.dark ? 0.35 : 0.2);
  ctx.fillRect(0, floorY - 1, w, 2);
}

function curtainColor(pal: Palette): RGBA {
  return mix(pal.coral, [70, 18, 20, 1], pal.dark ? 0.55 : 0.45);
}

/** 飾り幕の裾（波形）の点列。右から左へ */
function valanceHem(w: number, h: number): Pt[] {
  const vh = h * 0.085;
  const scallop = w / 8;
  const pts: Pt[] = [{ x: w, y: vh }];
  for (let i = 8; i > 0; i--) {
    pts.push(...quad({ x: i * scallop, y: vh }, { x: (i - 0.5) * scallop, y: vh + h * 0.045 }, { x: (i - 1) * scallop, y: vh }, 8).slice(1));
  }
  return pts;
}

/** 舞台の飾り幕（上端の波形の裾と金の縁）。vector では毎フレーム手前に描く */
export function drawValance(ctx: CanvasRenderingContext2D, w: number, h: number, pal: Palette): void {
  const base = curtainColor(pal);
  const vh = h * 0.085;
  ctx.fillStyle = rgba(base);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, vh);
  const scallop = w / 8;
  for (let i = 8; i > 0; i--) {
    ctx.quadraticCurveTo((i - 0.5) * scallop, vh + h * 0.045, (i - 1) * scallop, vh);
  }
  ctx.closePath();
  ctx.fill();
  // ひだ
  ctx.fillStyle = rgba(darken(base, 0.3), 0.6);
  for (let x = scallop * 0.5; x < w; x += scallop) ctx.fillRect(x - 3, 0, 6, vh + h * 0.02);
  ctx.fillStyle = rgba(lighten(base, 0.25), 0.35);
  for (let x = scallop * 0.25; x < w; x += scallop) ctx.fillRect(x - 2, 0, 4, vh);
  // 金の縁
  ctx.strokeStyle = rgba(pal.amber, 0.9);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w, vh);
  for (let i = 8; i > 0; i--) {
    ctx.quadraticCurveTo((i - 0.5) * scallop, vh + h * 0.045, (i - 1) * scallop, vh);
  }
  ctx.stroke();
}

// ---- ink（手描き） ----------------------------------------------------------

function inkOf(pal: Palette, a: number): string {
  return rgba(pal.ink, a);
}

function renderInk(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, prop: PracticeMode, pal: Palette): void {
  const floorY = h * FLOOR_Y;
  const rnd = lcg(prop === 'street' ? 21 : prop === 'stage' ? 33 : 45);
  const ink = inkOf(pal, 0.85);
  const thin = inkOf(pal, 0.5);
  const lineW = Math.max(1.4, w * 0.0026);

  // 紙
  ctx.fillStyle = pal.panel;
  ctx.fillRect(0, 0, w, h);

  if (prop === 'street') {
    // 空の水彩と建物の壁
    wash(ctx, wobble(rnd, resample([{ x: -10, y: -10 }, { x: w + 10, y: -10 }, { x: w + 10, y: h * 0.62 }, { x: -10, y: h * 0.62 }], 30, true), 6, true), rgba(mix(pal.sky, pal.panel, 0.55)), pal.dark ? 0.35 : 0.3, 0.4);
    // 建物の輪郭（数棟）と、その中の窓
    const roofs = [0.34, 0.2, 0.4, 0.26, 0.36];
    let x = -w * 0.02;
    for (let i = 0; i < roofs.length; i++) {
      const bw = w * (0.18 + (i % 2) * 0.08);
      const top = h * (roofs[i] ?? 0.3);
      const box = wobble(rnd, resample([{ x, y: top }, { x: x + bw, y: top }, { x: x + bw, y: floorY }, { x, y: floorY }], 20, true), lineW, true);
      wash(ctx, box, rgba(mix(pal.panel2, pal.muted, 0.2)), pal.dark ? 0.35 : 0.4, 0.3);
      inkStroke(ctx, rnd, box, { color: ink, width: lineW, vary: 0.5, closed: true });
      const cols = i % 2 ? 3 : 2;
      const ww = bw / (cols * 2 + 1);
      const wh = h * 0.08;
      for (let wy = top + h * 0.05; wy + wh < h * 0.62; wy += wh * 1.9) {
        for (let c = 0; c < cols; c++) {
          const wx = x + ww * (c * 2 + 1);
          const win = wobble(rnd, resample([{ x: wx, y: wy }, { x: wx + ww, y: wy }, { x: wx + ww, y: wy + wh }, { x: wx, y: wy + wh }], 8, true), 0.8, true);
          wash(ctx, win.map((p) => ({ x: p.x + 2, y: p.y + 2 })), rgba(mix(pal.sky, pal.ink, 0.4)), 0.35, 0.4);
          inkStroke(ctx, rnd, win, { color: ink, width: lineW * 0.8, vary: 0.5, closed: true });
          inkLine(ctx, rnd, { x: wx + ww / 2, y: wy }, { x: wx + ww / 2, y: wy + wh }, { color: thin, width: lineW * 0.6 }, 0.8);
          inkLine(ctx, rnd, { x: wx, y: wy + wh / 2 }, { x: wx + ww, y: wy + wh / 2 }, { color: thin, width: lineW * 0.6 }, 0.8);
        }
      }
      x += bw - w * 0.01;
    }
    // 奥の観客（線だけ）
    for (const sp of spectators(-w * 0.02, w * 1.02, h * 0.66, w * 0.026, 16, 7)) {
      inkStroke(ctx, rnd, wobble(rnd, resample(spectatorBody(sp), 5), 0.8), { color: thin, width: lineW * 0.7, vary: 0.5, taper: true });
      inkCircle(ctx, rnd, sp.x, sp.y, sp.hr, { color: thin, width: lineW * 0.7, vary: 0.5 }, 0.08);
    }
    // 縁石: 二重線とハッチング
    const curbH = h * 0.03;
    const curbClip = new Path2D();
    curbClip.rect(0, floorY - curbH, w, curbH);
    hatch(ctx, rnd, curbClip, { x: 0, y: floorY - curbH, w, h: curbH }, { color: thin, angle: -Math.PI / 4, spacing: 5, width: 0.9 });
    inkLine(ctx, rnd, { x: -5, y: floorY - curbH }, { x: w + 5, y: floorY - curbH }, { color: ink, width: lineW * 1.3, vary: 0.4 }, 1.5);
    inkLine(ctx, rnd, { x: -5, y: floorY }, { x: w + 5, y: floorY }, { color: ink, width: lineW * 1.8, vary: 0.4 }, 1.5);
    // 舗道: 薄い塗りと目地
    wash(ctx, [{ x: -5, y: floorY + 2 }, { x: w + 5, y: floorY + 2 }, { x: w + 5, y: h + 5 }, { x: -5, y: h + 5 }], rgba(mix(pal.muted, pal.panel, 0.5)), pal.dark ? 0.3 : 0.28, 0);
    const slab = w * 0.09;
    for (let sx = slab * 0.5; sx < w; sx += slab) {
      inkLine(ctx, rnd, { x: sx, y: floorY + 2 }, { x: sx + (rnd() - 0.5) * 6, y: h }, { color: thin, width: lineW * 0.7, vary: 0.6 }, 1);
    }
    inkLine(ctx, rnd, { x: 0, y: floorY + (h - floorY) * 0.55 }, { x: w, y: floorY + (h - floorY) * 0.55 }, { color: thin, width: lineW * 0.7, vary: 0.6 }, 1.2);
    // 手前の観客（塗り + 線）
    for (const seed of [3, 11]) {
      const [x0, x1] = seed === 3 ? [-w * 0.03, w * 0.24] : [w * 0.76, w * 1.03];
      for (const sp of spectators(x0, x1, h * 0.93, w * 0.03, 4, seed)) {
        const body = wobble(rnd, resample(spectatorBody(sp), 5), lineW * 0.6);
        wash(ctx, [...body, { x: sp.x + sp.s * 0.95, y: h + 5 }, { x: sp.x - sp.s * 0.95, y: h + 5 }], rgba(mix(pal.ink, pal.muted, 0.3)), 0.4, 0);
        wash(ctx, wobblyCircle(rnd, sp.x + 1, sp.y + 1, sp.hr, 0.08, 20), rgba(mix(pal.ink, pal.muted, 0.3)), 0.4, 0);
        inkStroke(ctx, rnd, body, { color: ink, width: lineW, vary: 0.5, taper: true });
        inkCircle(ctx, rnd, sp.x, sp.y, sp.hr, { color: ink, width: lineW, vary: 0.5 }, 0.07);
      }
    }
    paper(ctx, 0, 0, w, h, dpr, pal.ink, pal.dark);
    return;
  }

  if (prop === 'stage') {
    // 奥の幕: 全面に深い赤の水彩、縦のひだの線
    const curtain = curtainColor(pal);
    wash(ctx, wobble(rnd, resample([{ x: -10, y: -10 }, { x: w + 10, y: -10 }, { x: w + 10, y: floorY }, { x: -10, y: floorY }], 30, true), 5, true), rgba(curtain), pal.dark ? 0.5 : 0.42, 0.3);
    for (let x = w * 0.03; x < w; x += w * 0.06) {
      inkLine(ctx, rnd, { x: x + (rnd() - 0.5) * 8, y: -4 }, { x: x + (rnd() - 0.5) * 12, y: floorY }, { color: inkOf(pal, 0.45), width: lineW * 0.8, vary: 0.8 }, 3);
    }
    const foldClip = new Path2D();
    foldClip.rect(0, 0, w, floorY);
    hatch(ctx, rnd, foldClip, { x: 0, y: 0, w, h: floorY }, { color: inkOf(pal, 0.18), angle: Math.PI / 2 - 0.05, spacing: w * 0.02, width: 1.2, jitter: 4 });
    // 床板
    inkBoards(ctx, rnd, w, floorY, h, pal, lineW, rgba(mix(pal.amber, pal.ink, 0.35)), 0.35);
    // 手前の縁
    const lip = wobble(rnd, resample([{ x: -5, y: h - h * 0.04 }, { x: w + 5, y: h - h * 0.04 }, { x: w + 5, y: h + 5 }, { x: -5, y: h + 5 }], 20, true), 1, true);
    wash(ctx, lip, rgba(pal.ink), 0.55, 0);
    inkLine(ctx, rnd, { x: -5, y: h - h * 0.04 }, { x: w + 5, y: h - h * 0.04 }, { color: ink, width: lineW * 1.6, vary: 0.4 }, 1.5);
    // フットライト: 小さな丸と光の輪郭線
    for (let i = 0; i < 9; i++) {
      const x = w * (0.08 + (0.84 * i) / 8);
      wash(ctx, wobblyCircle(rnd, x, h - h * 0.05, w * 0.035, 0.12, 20), rgba(pal.amber), 0.35, 0.5);
      inkCircle(ctx, rnd, x, h - h * 0.04, 3, { color: ink, width: lineW }, 0.1);
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI * 0.8 + (k / 4) * Math.PI * 0.6;
        inkLine(ctx, rnd, { x: x + Math.cos(a) * 6, y: h - h * 0.04 + Math.sin(a) * 6 }, { x: x + Math.cos(a) * 14, y: h - h * 0.04 + Math.sin(a) * 14 }, { color: rgba(pal.amber, 0.9), width: lineW * 0.8 }, 0.5);
      }
    }
    // 飾り幕: 水彩 + ひだのハッチング + 輪郭 + 金の縁
    const hem = valanceHem(w, h);
    const valance: Pt[] = [{ x: -5, y: -5 }, { x: w + 5, y: -5 }, ...wobble(rnd, resample(hem, 8), 1.5)];
    wash(ctx, valance, rgba(curtain), 0.65, 0.5);
    const vClip = new Path2D();
    tracePath(vClip, valance, true);
    hatch(ctx, rnd, vClip, { x: 0, y: 0, w, h: h * 0.14 }, { color: inkOf(pal, 0.4), angle: Math.PI / 2 + 0.08, spacing: w * 0.022, width: 1.4, jitter: 3 });
    inkStroke(ctx, rnd, wobble(rnd, resample(hem, 6), 1.2), { color: rgba(pal.amber, 0.95), width: lineW * 1.6, vary: 0.5, taper: true });
    inkStroke(ctx, rnd, wobble(rnd, resample(hem, 6), 1.8).map((p) => ({ x: p.x, y: p.y + 4 })), { color: ink, width: lineW, vary: 0.6, taper: true });
    paper(ctx, 0, 0, w, h, dpr, pal.ink, pal.dark);
    return;
  }

  // 練習場・クラブ・パッシング
  // 壁の薄い塗り（上は明るく）
  wash(ctx, wobble(rnd, resample([{ x: -10, y: -10 }, { x: w + 10, y: -10 }, { x: w + 10, y: h * 0.6 }, { x: -10, y: h * 0.6 }], 30, true), 6, true), rgba(mix(pal.ivory, pal.amber, 0.25)), pal.dark ? 0.06 : 0.28, 0.3);
  // 腰板
  const railY = h * 0.6;
  wash(ctx, wobble(rnd, resample([{ x: -10, y: railY }, { x: w + 10, y: railY }, { x: w + 10, y: floorY }, { x: -10, y: floorY }], 30, true), 3, true), rgba(mix(pal.muted, pal.panel, 0.4)), pal.dark ? 0.3 : 0.25, 0.3);
  inkLine(ctx, rnd, { x: -5, y: railY }, { x: w + 5, y: railY }, { color: ink, width: lineW * 1.2, vary: 0.5 }, 1.5);
  inkLine(ctx, rnd, { x: -5, y: railY + 7 }, { x: w + 5, y: railY + 7 }, { color: thin, width: lineW * 0.7, vary: 0.5 }, 1.2);
  for (let x = w * 0.04; x < w; x += w * 0.08) {
    inkLine(ctx, rnd, { x, y: railY + 10 }, { x: x + (rnd() - 0.5) * 4, y: floorY - 3 }, { color: thin, width: lineW * 0.8, vary: 0.7 }, 1.2);
  }
  // 壁と腰板の境の影
  const railClip = new Path2D();
  railClip.rect(0, floorY - h * 0.06, w, h * 0.06);
  hatch(ctx, rnd, railClip, { x: 0, y: floorY - h * 0.06, w, h: h * 0.06 }, { color: inkOf(pal, 0.28), angle: -Math.PI / 4, spacing: 6, width: 0.9 });
  // 床板
  inkBoards(ctx, rnd, w, floorY, h, pal, lineW, rgba(mix(pal.amber, pal.panel, 0.4)), pal.dark ? 0.2 : 0.3);
  inkLine(ctx, rnd, { x: -5, y: floorY }, { x: w + 5, y: floorY }, { color: ink, width: lineW * 2, vary: 0.4 }, 1.5);
  // 隅のハッチング（暗い角）
  for (const side of [0, 1]) {
    const clip = new Path2D();
    clip.rect(side ? w - w * 0.12 : 0, 0, w * 0.12, railY);
    hatch(ctx, rnd, clip, { x: side ? w - w * 0.12 : 0, y: 0, w: w * 0.12, h: railY }, { color: inkOf(pal, 0.12), angle: side ? -Math.PI / 3 : Math.PI / 3, spacing: 7, width: 1 });
  }
  paper(ctx, 0, 0, w, h, dpr, pal.ink, pal.dark);
}

function inkBoards(ctx: CanvasRenderingContext2D, rnd: Rnd, w: number, y0: number, y1: number, pal: Palette, lineW: number, tint: string, alpha: number): void {
  wash(ctx, [{ x: -5, y: y0 }, { x: w + 5, y: y0 }, { x: w + 5, y: y1 + 5 }, { x: -5, y: y1 + 5 }], tint, alpha, 0);
  const rowH = Math.max(9, (y1 - y0) / 5);
  const boardW = w * 0.14;
  for (let i = 0, y = y0 + rowH; y < y1; i++, y += rowH) {
    inkLine(ctx, rnd, { x: -5, y }, { x: w + 5, y: y + (rnd() - 0.5) * 3 }, { color: inkOf(pal, 0.55), width: lineW * 0.8, vary: 0.7 }, 1.5);
    const off = ((i * 0.37 + 0.2) % 1) * boardW;
    for (let x = off; x < w; x += boardW) {
      inkLine(ctx, rnd, { x, y: y - rowH + 2 }, { x: x + (rnd() - 0.5) * 3, y: y - 1 }, { color: inkOf(pal, 0.45), width: lineW * 0.7, vary: 0.6 }, 0.8);
    }
  }
  // 木目（短い線を散らす）
  for (let i = 0; i < 40; i++) {
    const x = rnd() * w;
    const y = y0 + rnd() * (y1 - y0);
    inkLine(ctx, rnd, { x, y }, { x: x + 10 + rnd() * 30, y: y + (rnd() - 0.5) * 2 }, { color: inkOf(pal, 0.22), width: lineW * 0.6, vary: 0.8 }, 0.6);
  }
}

// ---- paint（塗り） ----------------------------------------------------------

function renderPaint(ctx: CanvasRenderingContext2D, w: number, h: number, prop: PracticeMode, pal: Palette): void {
  const floorY = h * FLOOR_Y;
  const rnd = lcg(prop === 'street' ? 121 : prop === 'stage' ? 133 : 145);
  const blur = (px: number): void => {
    ctx.filter = px > 0 ? `blur(${px.toFixed(1)}px)` : 'none';
  };

  if (prop === 'street') {
    // 空: 冷たい上から暖かい地平へ
    const sky = ctx.createLinearGradient(0, 0, 0, floorY);
    sky.addColorStop(0, rgba(vivid(mix(pal.panel, pal.sky, pal.dark ? 0.3 : 0.45), 1.3, pal.dark ? -0.08 : 0.05)));
    sky.addColorStop(0.6, rgba(vivid(mix(pal.panel, pal.amber, 0.25), 1.2, 0)));
    sky.addColorStop(1, rgba(mix(pal.panel2, pal.muted, 0.2)));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    // 建物: ぼかした色面に、縦の筆跡
    const silhouette = pal.dark ? darken(mix(pal.bg, pal.sky, 0.25), 0.45) : darken(mix(pal.ink, pal.sky, 0.25), 0.15);
    blur(w * 0.006);
    const roofs = [0.3, 0.18, 0.36, 0.24, 0.32];
    let x = -w * 0.03;
    for (let i = 0; i < roofs.length; i++) {
      const bw = w * (0.18 + (i % 2) * 0.09);
      const top = h * (roofs[i] ?? 0.3);
      const tone = mix(mix(pal.panel2, pal.muted, 0.35), i % 2 ? pal.coral : pal.sky, 0.14);
      ctx.fillStyle = rgba(pal.dark ? darken(tone, 0.2) : tone, 0.92);
      ctx.fillRect(x, top, bw, floorY - top);
      for (let k = 0; k < 4; k++) {
        const sx = x + bw * (0.1 + k * 0.25) + (rnd() - 0.5) * bw * 0.1;
        brushStroke(ctx, rnd, { x: sx, y: top + h * 0.02 }, { x: sx + 2, y: floorY }, bw * 0.12, rgba(k % 2 ? lighten(tone, 0.12) : darken(tone, 0.15)), 0.5, bw * 0.1);
      }
      // 窓の灯り（建物の中に並べる）
      const cols = i % 2 ? 3 : 2;
      const ww = bw / (cols * 2 + 1);
      const wh = h * 0.075;
      for (let wy = top + h * 0.05; wy + wh < h * 0.62; wy += wh * 1.9) {
        for (let c = 0; c < cols; c++) {
          const wx = x + ww * (c * 2 + 1);
          const lit = rnd() > 0.35;
          ctx.fillStyle = lit ? rgba(vivid(pal.amber, 1.3, 0.2), 0.85) : rgba(darken(pal.sky, 0.4), 0.6);
          ctx.fillRect(wx, wy, ww, wh);
          if (lit) daub(ctx, wx + ww / 2, wy + wh / 2, ww * 0.9, wh * 0.9, 0, rgba(vivid(pal.amber, 1.3, 0.3), 0.35));
        }
      }
      x += bw - w * 0.02;
    }
    // 奥の観客（柔らかいシルエット）
    blur(w * 0.004);
    ctx.fillStyle = rgba(silhouette, pal.dark ? 0.5 : 0.35);
    for (const sp of spectators(-w * 0.02, w * 1.02, h * 0.66, w * 0.026, 16, 7)) {
      ctx.beginPath();
      tracePath(ctx, spectatorBody(sp), true);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.hr, 0, Math.PI * 2);
      ctx.fill();
    }
    blur(0);
    // 縁石と舗道: 幅広の筆
    const curbH = h * 0.03;
    brushStroke(ctx, rnd, { x: -10, y: floorY - curbH / 2 }, { x: w + 10, y: floorY - curbH / 2 }, curbH * 1.4, rgba(lighten(mix(pal.panel2, pal.muted, 0.3), 0.25)), 0.95, curbH * 0.5);
    brushStroke(ctx, rnd, { x: -10, y: floorY - curbH + 2 }, { x: w + 10, y: floorY - curbH + 2 }, 4, rgba(lighten(pal.ivory, 0.2)), 0.6, 6);
    const pave = vivid(floorColor(pal, prop), 1.1, 0);
    ctx.fillStyle = rgba(pave);
    ctx.fillRect(0, floorY, w, h - floorY);
    for (let i = 0; i < 6; i++) {
      const y = floorY + ((i + 0.5) / 6) * (h - floorY);
      const tone = i % 2 ? lighten(mix(pave, pal.sky, 0.1), 0.08) : darken(mix(pave, pal.coral, 0.06), 0.06);
      brushStroke(ctx, rnd, { x: -20, y }, { x: w + 20, y: y + (rnd() - 0.5) * 4 }, (h - floorY) / 5, rgba(tone), 0.7, (h - floorY) / 6);
    }
    brushStroke(ctx, rnd, { x: -10, y: floorY + 3 }, { x: w + 10, y: floorY + 3 }, 6, rgba(darken(pave, 0.35)), 0.5, 8);
    // 手前の観客
    blur(w * 0.003);
    ctx.fillStyle = rgba(darken(silhouette, 0.25), pal.dark ? 0.85 : 0.7);
    for (const seed of [3, 11]) {
      const [x0, x1] = seed === 3 ? [-w * 0.03, w * 0.24] : [w * 0.76, w * 1.03];
      for (const sp of spectators(x0, x1, h * 0.93, w * 0.03, 4, seed)) {
        ctx.beginPath();
        tracePath(ctx, spectatorBody(sp), true);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.hr, 0, Math.PI * 2);
        ctx.fill();
        daub(ctx, sp.x - sp.hr * 0.3, sp.y - sp.hr * 0.3, sp.hr * 0.5, sp.hr * 0.3, -0.6, rgba(rimColorFor(pal), 0.35));
      }
    }
    blur(0);
    return;
  }

  if (prop === 'stage') {
    // 奥の幕: 深い赤。中央に暖かい光
    const curtain = vivid(curtainColor(pal), 1.35, pal.dark ? -0.02 : 0.02);
    ctx.fillStyle = rgba(darken(curtain, 0.35));
    ctx.fillRect(0, 0, w, h);
    blur(w * 0.02);
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, w * 0.5);
    glow.addColorStop(0, rgba(vivid(mix(curtain, pal.amber, 0.45), 1.2, 0.1), 0.85));
    glow.addColorStop(1, rgba(curtain, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, floorY);
    // ひだ: 縦の筆
    blur(w * 0.004);
    for (let x = w * 0.02; x < w; x += w * 0.055) {
      const light = rnd() > 0.5;
      brushStroke(ctx, rnd, { x: x + (rnd() - 0.5) * 10, y: -10 }, { x: x + (rnd() - 0.5) * 16, y: floorY + 5 }, w * (light ? 0.02 : 0.03), rgba(light ? lighten(curtain, 0.2) : darken(curtain, 0.45)), light ? 0.4 : 0.55, w * 0.02);
    }
    blur(0);
    // 床板: 暖かい茶を横に筆で
    paintBoards(ctx, rnd, w, floorY, h, pal, vivid(floorColor(pal, prop), 1.25, 0.02));
    // 手前の縁
    ctx.fillStyle = rgba(darken(pal.panel2, 0.7));
    ctx.fillRect(0, h - h * 0.04, w, h * 0.04);
    // フットライト: 暖色のグロー
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const x = w * (0.08 + (0.84 * i) / 8);
      const g = ctx.createRadialGradient(x, h - h * 0.04, 0, x, h - h * 0.04, w * 0.07);
      g.addColorStop(0, rgba(vivid(pal.amber, 1.4, 0.2), 0.7));
      g.addColorStop(0.4, rgba(pal.amber, 0.25));
      g.addColorStop(1, rgba(pal.amber, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - w * 0.07, h - h * 0.14, w * 0.14, h * 0.11);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 9; i++) {
      const x = w * (0.08 + (0.84 * i) / 8);
      daub(ctx, x, h - h * 0.038, 3.5, 2.5, 0, rgba(lighten(pal.amber, 0.7)));
    }
    // 飾り幕
    const hem = valanceHem(w, h);
    const vClip = new Path2D();
    tracePath(vClip, [{ x: -5, y: -5 }, { x: w + 5, y: -5 }, ...hem], true);
    const vg = ctx.createLinearGradient(0, 0, 0, h * 0.13);
    vg.addColorStop(0, rgba(darken(curtain, 0.2)));
    vg.addColorStop(1, rgba(lighten(curtain, 0.12)));
    ctx.fillStyle = vg;
    ctx.fill(vClip);
    ctx.save();
    ctx.clip(vClip);
    blur(w * 0.003);
    const scallop = w / 8;
    for (let x = scallop * 0.5; x < w; x += scallop) {
      brushStroke(ctx, rnd, { x, y: -5 }, { x: x + 2, y: h * 0.13 }, w * 0.012, rgba(darken(curtain, 0.5)), 0.6, w * 0.01);
      brushStroke(ctx, rnd, { x: x - scallop * 0.3, y: -5 }, { x: x - scallop * 0.3 + 1, y: h * 0.11 }, w * 0.008, rgba(lighten(curtain, 0.35)), 0.5, w * 0.01);
    }
    blur(0);
    ctx.restore();
    // 金の縁: 筆で一撫で
    const hemPts = resample(hem, 10);
    for (let i = 1; i < hemPts.length; i++) {
      const a = hemPts[i - 1] as Pt;
      const b = hemPts[i] as Pt;
      brushStroke(ctx, rnd, a, b, 4, rgba(vivid(pal.amber, 1.3, 0.1)), 0.9, 5);
    }
    return;
  }

  // 練習場・クラブ・パッシング: 色面の重なりと大きなぼかし
  const wallA = vivid(wallTop(pal, prop), 1.2, 0);
  const wallB = vivid(mix(wallBottom(pal, prop), pal.amber, 0.12), 1.2, 0);
  const wall = ctx.createLinearGradient(0, 0, 0, floorY);
  wall.addColorStop(0, rgba(mix(wallA, pal.sky, 0.12)));
  wall.addColorStop(1, rgba(wallB));
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, h);
  // 壁: 漆喰のむらのように、幅広の筆をほぼ水平に重ねる（暖色多め、寒色少し）
  blur(w * 0.012);
  for (let i = 0; i < 18; i++) {
    const y = -h * 0.03 + (i / 17) * h * 0.66;
    const x = (rnd() - 0.3) * w * 0.6;
    const warm = i % 3 !== 1;
    const tone = warm ? mix(wallB, pal.amber, 0.25) : mix(wallA, pal.sky, 0.2);
    brushStroke(ctx, rnd, { x, y }, { x: x + w * (0.5 + rnd() * 0.4), y: y - h * (0.005 + rnd() * 0.015) }, h * 0.075, rgba(warm ? lighten(tone, 0.08) : darken(tone, 0.04)), pal.dark ? 0.22 : 0.3, h * 0.035);
  }
  blur(w * 0.03);
  // 光だまりと暗い隅
  daub(ctx, w * 0.5, h * 0.25, w * 0.4, h * 0.28, 0, rgba(vivid(mix(pal.ivory, pal.amber, 0.25), 1.1, 0.08), pal.dark ? 0.14 : 0.4));
  daub(ctx, w * 0.02, h * 0.1, w * 0.24, h * 0.5, 0.4, rgba(darken(mix(wallA, pal.sky, 0.5), 0.35), 0.55));
  daub(ctx, w * 0.98, h * 0.1, w * 0.24, h * 0.5, -0.4, rgba(darken(mix(wallA, pal.sky, 0.5), 0.35), 0.55));
  daub(ctx, w * 0.5, -h * 0.05, w * 0.6, h * 0.12, 0, rgba(darken(mix(wallA, pal.sky, 0.4), 0.3), 0.4));
  // 腰板: 少し暗い帯
  const railY = h * 0.6;
  blur(w * 0.006);
  ctx.fillStyle = rgba(darken(mix(wallB, pal.muted, 0.3), 0.12), 0.85);
  ctx.fillRect(-10, railY, w + 20, floorY - railY);
  for (let x = w * 0.04; x < w; x += w * 0.08) {
    brushStroke(ctx, rnd, { x, y: railY + 4 }, { x: x + (rnd() - 0.5) * 3, y: floorY }, w * 0.012, rgba(lighten(wallB, 0.25)), 0.35, w * 0.01);
  }
  blur(0);
  brushStroke(ctx, rnd, { x: -10, y: railY }, { x: w + 10, y: railY + 1 }, 5, rgba(lighten(wallB, 0.45)), 0.7, 7);
  // 床板
  paintBoards(ctx, rnd, w, floorY, h, pal, vivid(floorColor(pal, prop), 1.2, 0));
}

function rimColorFor(pal: Palette): RGBA {
  return lighten(pal.amber, 0.4);
}

function paintBoards(ctx: CanvasRenderingContext2D, rnd: Rnd, w: number, y0: number, y1: number, pal: Palette, base: RGBA): void {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, rgba(lighten(base, 0.15)));
  g.addColorStop(1, rgba(darken(base, 0.15)));
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, w, y1 - y0);
  const rowH = Math.max(9, (y1 - y0) / 5);
  ctx.filter = `blur(${(rowH * 0.12).toFixed(1)}px)`;
  for (let i = 0, y = y0; y < y1; i++, y += rowH) {
    const tone = i % 2 ? lighten(mix(base, pal.amber, 0.2), 0.12) : darken(mix(base, pal.coral, 0.08), 0.1);
    brushStroke(ctx, rnd, { x: -20, y: y + rowH / 2 }, { x: w + 20, y: y + rowH / 2 + (rnd() - 0.5) * 3 }, rowH * 0.95, rgba(tone), 0.75, rowH * 0.35);
    // 継ぎ目の影
    const boardW = w * 0.14;
    const off = ((i * 0.37 + 0.2) % 1) * boardW;
    for (let x = off; x < w; x += boardW) {
      daub(ctx, x, y + rowH / 2, 1.5, rowH * 0.45, 0, rgba(darken(base, 0.45), 0.5));
    }
  }
  ctx.filter = 'none';
  // 奥の縁の影と、手前のハイライト
  const shadow = ctx.createLinearGradient(0, y0, 0, y0 + rowH * 0.8);
  shadow.addColorStop(0, rgba(darken(base, 0.5), 0.55));
  shadow.addColorStop(1, rgba(darken(base, 0.5), 0));
  ctx.fillStyle = shadow;
  ctx.fillRect(0, y0, w, rowH * 0.8);
  brushStroke(ctx, rnd, { x: -10, y: y0 + 1 }, { x: w + 10, y: y0 + 1 }, 3, rgba(lighten(mix(base, pal.amber, 0.3), 0.5)), 0.5, 6);
}

// ---- 幕・光（毎フレーム） ---------------------------------------------------

/**
 * 舞台の幕。open は 1 で両端に寄り、0 で中央で閉じる。
 * 動くので毎フレーム描く。
 */
export function drawCurtains(ctx: CanvasRenderingContext2D, w: number, h: number, pal: Palette, open: number, style: ArtStyle = 'vector', seed = 0): void {
  const base = style === 'paint' ? vivid(curtainColor(pal), 1.35, 0) : curtainColor(pal);
  const minW = w * 0.13;
  const panelW = minW + (w * 0.5 - minW) * (1 - open);
  // 裾は画面の下端まで（閉じたときに手前のものを全部隠す）
  const bottom = h;
  const rnd = lcg(seed * 7 + 1);
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? 0 : w - panelW;
    if (style === 'ink') {
      const edgeX = side < 0 ? x0 + panelW : x0;
      const panel: Pt[] = [{ x: x0 - 5, y: -5 }, { x: x0 + panelW + 5, y: -5 }, { x: x0 + panelW + 5, y: bottom + 5 }, { x: x0 - 5, y: bottom + 5 }];
      wash(ctx, panel, rgba(base), 0.6, 0);
      wash(ctx, panel, pal.panel, 0.08, 0);
      const folds = Math.max(3, Math.round(panelW / (w * 0.035)));
      for (let i = 1; i < folds; i++) {
        const fx = x0 + (i / folds) * panelW;
        inkLine(ctx, rnd, { x: fx, y: -3 }, { x: fx + (rnd() - 0.5) * 10, y: bottom }, { color: inkOf(pal, 0.5), width: 1.4, vary: 0.8 }, 3);
      }
      inkLine(ctx, rnd, { x: edgeX, y: h * 0.02 }, { x: edgeX, y: bottom }, { color: rgba(pal.amber, 0.95), width: 3, vary: 0.4 }, 1.5);
      inkLine(ctx, rnd, { x: edgeX - side * 5, y: 0 }, { x: edgeX - side * 5, y: bottom }, { color: inkOf(pal, 0.85), width: 2, vary: 0.5 }, 1.5);
      continue;
    }
    const g = ctx.createLinearGradient(x0, 0, x0 + panelW, 0);
    g.addColorStop(0, rgba(side < 0 ? lighten(base, 0.1) : darken(base, 0.3)));
    g.addColorStop(1, rgba(side < 0 ? darken(base, 0.3) : lighten(base, 0.1)));
    ctx.fillStyle = g;
    ctx.fillRect(x0, 0, panelW, bottom);
    // ひだ
    const folds = Math.max(3, Math.round(panelW / (w * 0.035)));
    const fw = panelW / folds;
    for (let i = 0; i < folds; i++) {
      const fx = x0 + i * fw;
      const fg = ctx.createLinearGradient(fx, 0, fx + fw, 0);
      if (style === 'paint') {
        fg.addColorStop(0, rgba(darken(base, 0.5), 0.7));
        fg.addColorStop(0.35, rgba(lighten(mix(base, pal.amber, 0.2), 0.3), 0.45));
        fg.addColorStop(0.55, rgba(base, 0));
        fg.addColorStop(1, rgba(darken(base, 0.55), 0.75));
      } else {
        fg.addColorStop(0, rgba(darken(base, 0.35), 0.55));
        fg.addColorStop(0.45, rgba(lighten(base, 0.2), 0.25));
        fg.addColorStop(1, rgba(darken(base, 0.4), 0.6));
      }
      ctx.fillStyle = fg;
      ctx.fillRect(fx, 0, fw, bottom);
      if (style === 'paint') {
        for (let k = 0; k < 3; k++) {
          daub(ctx, fx + fw * 0.4, h * (0.15 + k * 0.3) + (rnd() - 0.5) * h * 0.1, fw * 0.18, h * 0.08, 0.05, rgba(lighten(base, 0.35), 0.35));
        }
      }
    }
    // 裾の影と縁
    ctx.fillStyle = rgba(darken(base, 0.5), 0.5);
    ctx.fillRect(x0, bottom - h * 0.02, panelW, h * 0.02);
    ctx.fillStyle = rgba(style === 'paint' ? vivid(pal.amber, 1.3, 0.1) : pal.amber, 0.7);
    ctx.fillRect(side < 0 ? x0 + panelW - 3 : x0, h * 0.02, 3, bottom - h * 0.02);
  }
}

/**
 * スポットライト。intensity 0〜1。上から中央へ降りる円錐と床の光だまり。
 * 周囲は少し暗くする。
 */
export function drawSpotlight(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: Palette,
  cx: number,
  intensity: number,
  dim: number,
  style: ArtStyle = 'vector',
  seed = 0,
): void {
  if (intensity <= 0.001) return;
  const floorY = h * FLOOR_Y;
  if (dim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${(pal.dark ? 0.35 : 0.16) * dim * intensity * (style === 'paint' ? 1.6 : 1)})`;
    ctx.fillRect(0, 0, w, h);
  }
  const top = -h * 0.15;
  const topHalf = w * 0.03;
  const baseHalf = w * 0.24;
  if (style === 'ink') {
    // 線画の円錐と、薄い水彩
    const rnd = lcg(seed * 3 + 2);
    const cone: Pt[] = [{ x: cx - topHalf, y: top }, { x: cx + topHalf, y: top }, { x: cx + baseHalf, y: floorY + h * 0.02 }, { x: cx - baseHalf, y: floorY + h * 0.02 }];
    wash(ctx, cone, rgba(pal.amber), 0.14 * intensity, 0);
    inkLine(ctx, rnd, cone[1] as Pt, cone[2] as Pt, { color: rgba(pal.amber, 0.7 * intensity), width: 1.6, vary: 0.6 }, 2);
    inkLine(ctx, rnd, cone[0] as Pt, cone[3] as Pt, { color: rgba(pal.amber, 0.7 * intensity), width: 1.6, vary: 0.6 }, 2);
    const pool = wobblyEllipse(rnd, cx, floorY + h * 0.02, baseHalf, baseHalf * 0.18, 0.05, 40);
    wash(ctx, pool, rgba(lighten(pal.amber, 0.3)), 0.3 * intensity, 0);
    inkStroke(ctx, rnd, pool, { color: rgba(pal.amber, 0.8 * intensity), width: 1.6, vary: 0.6, closed: true });
    return;
  }
  const warm = style === 'paint' ? vivid(pal.amber, 1.3, 0.12) : pal.amber;
  if (style === 'paint') ctx.globalCompositeOperation = 'lighter';
  const k = style === 'paint' ? 1.7 : 1;
  const cone = ctx.createLinearGradient(0, top, 0, floorY);
  cone.addColorStop(0, rgba(warm, 0.02 * intensity * k));
  cone.addColorStop(0.35, rgba(warm, 0.18 * intensity * k));
  cone.addColorStop(1, rgba(warm, 0.08 * intensity * k));
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(cx - topHalf, top);
  ctx.lineTo(cx + topHalf, top);
  ctx.lineTo(cx + baseHalf, floorY + h * 0.02);
  ctx.lineTo(cx - baseHalf, floorY + h * 0.02);
  ctx.closePath();
  ctx.fill();
  if (style === 'paint') {
    // 中心の芯
    const core = ctx.createLinearGradient(0, top, 0, floorY);
    core.addColorStop(0, rgba(lighten(warm, 0.4), 0.05 * intensity));
    core.addColorStop(1, rgba(lighten(warm, 0.4), 0.16 * intensity));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.moveTo(cx - topHalf * 0.5, top);
    ctx.lineTo(cx + topHalf * 0.5, top);
    ctx.lineTo(cx + baseHalf * 0.5, floorY + h * 0.02);
    ctx.lineTo(cx - baseHalf * 0.5, floorY + h * 0.02);
    ctx.closePath();
    ctx.fill();
  }
  // 床の光だまり
  const pool = ctx.createRadialGradient(cx, floorY + h * 0.02, 0, cx, floorY + h * 0.02, baseHalf * (style === 'paint' ? 1.3 : 1));
  pool.addColorStop(0, rgba(lighten(warm, 0.4), (style === 'paint' ? 0.7 : 0.45) * intensity));
  pool.addColorStop(1, rgba(warm, 0));
  ctx.fillStyle = pool;
  ctx.save();
  ctx.translate(cx, floorY + h * 0.02);
  ctx.scale(1, 0.18);
  ctx.beginPath();
  ctx.arc(0, 0, baseHalf * 1.3, 0, Math.PI * 2);
  ctx.restore();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

/** 舞台の常灯。左右の上から中央へ差す薄い光 */
export function drawStageLights(ctx: CanvasRenderingContext2D, w: number, h: number, pal: Palette, intensity: number, style: ArtStyle = 'vector'): void {
  const floorY = h * FLOOR_Y;
  if (style === 'ink') {
    // 線画では光線を細い線の束で
    ctx.strokeStyle = rgba(pal.amber, 0.35 * intensity);
    ctx.lineWidth = 1;
    for (const side of [-1, 1]) {
      const sx = w * 0.5 + side * w * 0.42;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(sx - side * w * 0.03 + side * i * w * 0.02, 0);
        ctx.lineTo(w * 0.5 - side * w * 0.18 + side * i * w * 0.1, floorY);
        ctx.stroke();
      }
    }
    return;
  }
  const warm = style === 'paint' ? vivid(pal.amber, 1.3, 0.1) : pal.amber;
  if (style === 'paint') ctx.globalCompositeOperation = 'lighter';
  for (const side of [-1, 1]) {
    const sx = w * 0.5 + side * w * 0.42;
    const g = ctx.createLinearGradient(sx, 0, w * 0.5, floorY);
    g.addColorStop(0, rgba(warm, (style === 'paint' ? 0.3 : 0.16) * intensity));
    g.addColorStop(1, rgba(warm, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx - side * w * 0.04, 0);
    ctx.lineTo(sx + side * w * 0.04, 0);
    ctx.lineTo(w * 0.5 + side * w * 0.12, floorY);
    ctx.lineTo(w * 0.5 - side * w * 0.2, floorY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

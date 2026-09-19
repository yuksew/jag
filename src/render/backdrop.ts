// 背景。壁と床板、路上の縁石と観客、舞台の幕と光。静的な部分はオフスクリーンに描いて使い回す。
import type { PracticeMode } from '../core';
import { darken, lighten, mix, rgba, type Palette, type RGBA } from './palette';

/** 床の高さ（描画高さに対する割合）。手の少し下 */
export const FLOOR_Y = 0.86;

/** 決まった並びの観客を出すための簡易乱数 */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function floorColor(pal: Palette, prop: PracticeMode): RGBA {
  if (prop === 'street') return mix(pal.panel2, pal.muted, pal.dark ? 0.2 : 0.14);
  if (prop === 'stage') return darken(mix(pal.panel2, pal.amber, 0.18), pal.dark ? 0.45 : 0.32);
  return mix(pal.panel2, pal.amber, pal.dark ? 0.06 : 0.12);
}

function wallTop(pal: Palette, prop: PracticeMode): RGBA {
  if (prop === 'street') return mix(pal.panel, pal.sky, pal.dark ? 0.1 : 0.16);
  if (prop === 'stage') return darken(pal.panel2, pal.dark ? 0.55 : 0.5);
  return lighten(pal.panel, pal.dark ? 0 : 0.35);
}

function wallBottom(pal: Palette, prop: PracticeMode): RGBA {
  if (prop === 'street') return mix(pal.panel2, pal.muted, 0.08);
  if (prop === 'stage') return darken(pal.panel2, pal.dark ? 0.35 : 0.28);
  return pal.dark ? darken(pal.panel2, 0.12) : mix(pal.panel2, pal.line, 0.25);
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

function drawAudience(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  baseY: number,
  scale: number,
  count: number,
  color: string,
  seed: number,
): void {
  const rnd = lcg(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = x0 + ((i + 0.5) / count) * (x1 - x0) + (rnd() - 0.5) * ((x1 - x0) / count) * 0.8;
    const s = scale * (0.75 + rnd() * 0.45);
    const y = baseY + (rnd() - 0.5) * s * 0.4;
    const hr = s * 0.42;
    // 肩
    ctx.beginPath();
    ctx.moveTo(x - s * 0.95, y + s * 1.6);
    ctx.quadraticCurveTo(x - s * 0.95, y + hr * 1.2, x - s * 0.35, y + hr * 1.05);
    ctx.lineTo(x + s * 0.35, y + hr * 1.05);
    ctx.quadraticCurveTo(x + s * 0.95, y + hr * 1.2, x + s * 0.95, y + s * 1.6);
    ctx.closePath();
    ctx.fill();
    // 頭
    ctx.beginPath();
    ctx.arc(x, y, hr, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 静的な背景をオフスクリーンに描く */
export function renderBackdrop(w: number, h: number, dpr: number, prop: PracticeMode, pal: Palette): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const floorY = h * FLOOR_Y;

  // 壁
  const wall = ctx.createLinearGradient(0, 0, 0, floorY);
  wall.addColorStop(0, rgba(wallTop(pal, prop)));
  wall.addColorStop(1, rgba(wallBottom(pal, prop)));
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, floorY);

  if (prop === 'street') {
    // 建物の窓（奥）
    const win = rgba(mix(pal.panel2, pal.ink, pal.dark ? 0.35 : 0.18), 0.5);
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
    drawAudience(ctx, -w * 0.02, w * 1.02, h * 0.66, w * 0.026, 16, rgba(mix(pal.ink, pal.muted, 0.4), pal.dark ? 0.28 : 0.2), 7);
    // 縁石と舗道
    const curbH = h * 0.03;
    ctx.fillStyle = rgba(mix(pal.panel2, pal.muted, pal.dark ? 0.45 : 0.32));
    ctx.fillRect(0, floorY - curbH, w, curbH);
    ctx.fillStyle = rgba(lighten(mix(pal.panel2, pal.muted, 0.2), 0.3), 0.7);
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
    const front = rgba(mix(pal.ink, pal.muted, 0.15), pal.dark ? 0.55 : 0.5);
    drawAudience(ctx, -w * 0.03, w * 0.24, h * 0.93, w * 0.03, 4, front, 3);
    drawAudience(ctx, w * 0.76, w * 1.03, h * 0.93, w * 0.03, 4, front, 11);
    return c;
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
    drawValance(ctx, w, h, pal);
    return c;
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
  // 壁の光だまり
  const glow = ctx.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.3, w * 0.55);
  glow.addColorStop(0, rgba(pal.ivory, pal.dark ? 0.05 : 0.35));
  glow.addColorStop(1, rgba(pal.ivory, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, floorY);
  drawBoards(ctx, w, floorY, h, pal, floorColor(pal, prop));
  ctx.fillStyle = rgba(pal.ink, pal.dark ? 0.35 : 0.2);
  ctx.fillRect(0, floorY - 1, w, 2);
  return c;
}

function curtainColor(pal: Palette): RGBA {
  return mix(pal.coral, [70, 18, 20, 1], pal.dark ? 0.55 : 0.45);
}

function drawValance(ctx: CanvasRenderingContext2D, w: number, h: number, pal: Palette): void {
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

/**
 * 舞台の幕。open は 1 で両端に寄り、0 で中央で閉じる。
 * 動くので毎フレーム描く（矩形数本なので軽い）。
 */
export function drawCurtains(ctx: CanvasRenderingContext2D, w: number, h: number, pal: Palette, open: number): void {
  const base = curtainColor(pal);
  const minW = w * 0.13;
  const panelW = minW + (w * 0.5 - minW) * (1 - open);
  // 裾は画面の下端まで（閉じたときに手前のものを全部隠す）
  const bottom = h;
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? 0 : w - panelW;
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
      fg.addColorStop(0, rgba(darken(base, 0.35), 0.55));
      fg.addColorStop(0.45, rgba(lighten(base, 0.2), 0.25));
      fg.addColorStop(1, rgba(darken(base, 0.4), 0.6));
      ctx.fillStyle = fg;
      ctx.fillRect(fx, 0, fw, bottom);
    }
    // 裾の影と縁
    ctx.fillStyle = rgba(darken(base, 0.5), 0.5);
    ctx.fillRect(x0, bottom - h * 0.02, panelW, h * 0.02);
    ctx.fillStyle = rgba(pal.amber, 0.7);
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
): void {
  if (intensity <= 0.001) return;
  const floorY = h * FLOOR_Y;
  if (dim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${(pal.dark ? 0.35 : 0.16) * dim * intensity})`;
    ctx.fillRect(0, 0, w, h);
  }
  const top = -h * 0.15;
  const topHalf = w * 0.03;
  const baseHalf = w * 0.24;
  const cone = ctx.createLinearGradient(0, top, 0, floorY);
  cone.addColorStop(0, rgba(pal.amber, 0.02 * intensity));
  cone.addColorStop(0.35, rgba(pal.amber, 0.18 * intensity));
  cone.addColorStop(1, rgba(pal.amber, 0.08 * intensity));
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(cx - topHalf, top);
  ctx.lineTo(cx + topHalf, top);
  ctx.lineTo(cx + baseHalf, floorY + h * 0.02);
  ctx.lineTo(cx - baseHalf, floorY + h * 0.02);
  ctx.closePath();
  ctx.fill();
  // 床の光だまり
  const pool = ctx.createRadialGradient(cx, floorY + h * 0.02, 0, cx, floorY + h * 0.02, baseHalf);
  pool.addColorStop(0, rgba(lighten(pal.amber, 0.4), 0.45 * intensity));
  pool.addColorStop(1, rgba(pal.amber, 0));
  ctx.fillStyle = pool;
  ctx.save();
  ctx.translate(cx, floorY + h * 0.02);
  ctx.scale(1, 0.18);
  ctx.beginPath();
  ctx.arc(0, 0, baseHalf, 0, Math.PI * 2);
  ctx.restore();
  ctx.fill();
}

/** 舞台の常灯。左右の上から中央へ差す薄い光 */
export function drawStageLights(ctx: CanvasRenderingContext2D, w: number, h: number, pal: Palette, intensity: number): void {
  const floorY = h * FLOOR_Y;
  for (const side of [-1, 1]) {
    const sx = w * 0.5 + side * w * 0.42;
    const g = ctx.createLinearGradient(sx, 0, w * 0.5, floorY);
    g.addColorStop(0, rgba(pal.amber, 0.16 * intensity));
    g.addColorStop(1, rgba(pal.amber, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx - side * w * 0.04, 0);
    ctx.lineTo(sx + side * w * 0.04, 0);
    ctx.lineTo(w * 0.5 + side * w * 0.12, floorY);
    ctx.lineTo(w * 0.5 - side * w * 0.2, floorY);
    ctx.closePath();
    ctx.fill();
  }
}

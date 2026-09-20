// 路上の客席（vector 用）。拍手で手が上がる 2 コマと、「見せた」で客席全体が明るくなる 1 コマ。
// 観客の並びは backdrop.ts の streetAudience と同じ。帯だけをオフスクリーンに描いて使い回す。
import { spectatorBody, spectators, streetAudience, type Spectator } from './backdrop';
import { tracePath } from './brush';
import type { Palette } from './palette';

/** 手のコマ。0 = 下ろす、1 = 真上、2 = 開いて振る */
export type HandsFrame = 0 | 1 | 2;

/** 描く帯（描画高さに対する割合）。奥の列と手前の列 */
const STRIPS: readonly { y0: number; y1: number }[] = [
  { y0: 0.54, y1: 0.76 },
  { y0: 0.82, y1: 1 },
];

function makeCanvas(w: number, h: number, dpr: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2d context is unavailable');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, g };
}

/** 観客 1 人。frame に応じて腕を上げる */
function drawSpectator(g: CanvasRenderingContext2D, sp: Spectator, frame: HandsFrame, color: string): void {
  const { x, y, s, hr } = sp;
  g.fillStyle = color;
  g.beginPath();
  tracePath(g, spectatorBody(sp), true);
  g.fill();
  g.beginPath();
  g.arc(x, y, hr, 0, Math.PI * 2);
  g.fill();
  if (frame === 0) return;
  g.strokeStyle = color;
  g.lineWidth = s * 0.3;
  g.lineCap = 'round';
  const shY = y + hr * 1.35;
  for (const side of [-1, 1]) {
    const sx = x + side * s * 0.72;
    const ex = frame === 1 ? x + side * s * 0.85 : x + side * s * 1.3;
    const ey = frame === 1 ? y - s * 0.95 : y - s * 0.55;
    g.beginPath();
    g.moveTo(sx, shY);
    g.lineTo(ex, ey);
    g.stroke();
    g.beginPath();
    g.arc(ex, ey, s * 0.2, 0, Math.PI * 2);
    g.fill();
  }
}

function renderLayer(w: number, h: number, dpr: number, pal: Palette, frame: HandsFrame, bright: boolean): HTMLCanvasElement {
  const total = STRIPS.reduce((a, st) => a + (st.y1 - st.y0) * h, 0);
  const { c, g } = makeCanvas(w, total, dpr);
  const groups = streetAudience(w, h, pal);
  let offset = 0;
  for (const st of STRIPS) {
    g.save();
    g.translate(0, offset - st.y0 * h);
    g.beginPath();
    g.rect(-5, st.y0 * h, w + 10, (st.y1 - st.y0) * h);
    g.clip();
    for (const grp of groups) {
      if (grp.baseY < st.y0 * h || grp.baseY > st.y1 * h) continue;
      const people = spectators(grp.x0, grp.x1, grp.baseY, grp.scale, grp.count, grp.seed);
      people.forEach((sp, i) => {
        // 上げ方を人ごとに変える（同じコマでも真上と振りが混ざる）
        const f: HandsFrame = frame === 0 ? 0 : ((i + frame) % 2 === 0 ? 1 : 2);
        drawSpectator(g, sp, f, bright ? grp.bright : grp.color);
      });
    }
    g.restore();
    offset += (st.y1 - st.y0) * h;
  }
  return c;
}

export class Audience {
  private readonly cache = new Map<string, HTMLCanvasElement>();

  clear(): void {
    this.cache.clear();
  }

  private layer(w: number, h: number, dpr: number, pal: Palette, frame: HandsFrame, bright: boolean): HTMLCanvasElement {
    const key = `${w}x${h}|${dpr}|${pal.dark ? 'd' : 'l'}|${frame}|${bright ? 'b' : 'n'}`;
    let c = this.cache.get(key);
    if (!c) {
      c = renderLayer(w, h, dpr, pal, frame, bright);
      this.cache.set(key, c);
    }
    return c;
  }

  /** 客席を描く。bright は 0〜1（「見せた」の明るさ） */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, pal: Palette, frame: HandsFrame, bright: number): void {
    const base = this.layer(w, h, dpr, pal, frame, false);
    this.blit(ctx, base, w, h, dpr);
    if (bright > 0.01) {
      ctx.globalAlpha = Math.min(1, bright);
      this.blit(ctx, this.layer(w, h, dpr, pal, frame, true), w, h, dpr);
      ctx.globalAlpha = 1;
    }
  }

  private blit(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, w: number, h: number, dpr: number): void {
    let offset = 0;
    for (const st of STRIPS) {
      const sh = (st.y1 - st.y0) * h;
      ctx.drawImage(img, 0, offset * dpr, w * dpr, sh * dpr, 0, st.y0 * h, w, sh);
      offset += sh;
    }
  }
}

// 演出。きらめき・紙吹雪・落ちた球・浮かぶ文字。状態は Arena の中だけで持ち、core には触れない。
import { daub } from './brush';
import { lighten, rgba } from './palette';
import type { ArtStyle } from './style';

interface Particle {
  kind: 'spark' | 'confetti';
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 残り寿命（ms） */
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
}

export interface Faller {
  index: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  bounces: number;
  /** 転がりの回転（クラブのため） */
  rot: number;
  vr: number;
  resting: boolean;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

const G_CONFETTI = 320;
const G_BALL = 1900;
const MAX_PARTICLES = 240;

export class Effects {
  private particles: Particle[] = [];
  private texts: FloatText[] = [];
  readonly fallers: Faller[] = [];
  private rnd: () => number = Math.random;

  get busy(): boolean {
    return this.particles.length > 0 || this.texts.length > 0 || this.fallers.some((f) => !f.resting);
  }

  /** 生きている粒の数（上限つきの連続発生に使う） */
  get particleCount(): number {
    return this.particles.length;
  }

  /** 見た目の乱数。決まった並びが欲しいテストのために差し替えられる */
  seed(rnd: () => number): void {
    this.rnd = rnd;
  }

  clearParticles(): void {
    this.particles.length = 0;
    this.texts.length = 0;
  }

  clearFallers(): void {
    this.fallers.length = 0;
  }

  /** きらめき。clean のとき投げた手から */
  sparkle(x: number, y: number, color: string, n = 7, speed = 110): void {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (this.rnd() - 0.5) * Math.PI * 1.3;
      const v = speed * (0.5 + this.rnd());
      this.push({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 380 + this.rnd() * 260,
        maxLife: 640,
        size: 1.5 + this.rnd() * 2,
        color,
        rot: 0,
        vr: 0,
      });
    }
  }

  /**
   * 紙吹雪。x を中心に幅 spread から降らせる。
   * lift を大きくすると下から投げ上げたように高く舞う（客席からの紙吹雪）
   */
  confetti(x: number, y: number, spread: number, colors: readonly string[], n: number, lift = 200, sideways = 220): void {
    for (let i = 0; i < n; i++) {
      const color = colors[Math.floor(this.rnd() * colors.length)] ?? colors[0] ?? '#fff';
      this.push({
        kind: 'confetti',
        x: x + (this.rnd() - 0.5) * spread,
        y: y + (this.rnd() - 0.5) * 20,
        vx: (this.rnd() - 0.5) * sideways,
        vy: -60 - this.rnd() * lift,
        life: 1400 + this.rnd() * 900,
        maxLife: 2300,
        size: 3 + this.rnd() * 3,
        color,
        rot: this.rnd() * Math.PI,
        vr: (this.rnd() - 0.5) * 12,
      });
    }
  }

  /** 浮かんで消える文字（拍手の +N など） */
  float(x: number, y: number, text: string, color: string): void {
    this.texts.push({ x, y, text, color, life: 900, maxLife: 900 });
    if (this.texts.length > 12) this.texts.shift();
  }

  /** 落ちた球。空中の位置と速度から床へ落として跳ねる */
  drop(index: number, x: number, y: number, vx: number, vy: number, r: number, color: string): void {
    this.fallers.push({ index, x, y, vx, vy, r, color, bounces: 0, rot: 0, vr: vx / r, resting: false });
  }

  private push(p: Particle): void {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push(p);
  }

  /** dt はミリ秒 */
  update(dt: number, floorY: number, width: number): void {
    const s = dt / 1000;
    let w = 0;
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      if (p.kind === 'confetti') {
        p.vy += G_CONFETTI * s;
        p.vx *= 1 - 1.6 * s;
        p.vy *= 1 - 1.2 * s;
        p.x += (p.vx + Math.sin(p.rot * 2) * 40) * s;
        p.rot += p.vr * s;
      } else {
        p.vy += 260 * s;
        p.x += p.vx * s;
      }
      p.y += p.vy * s;
      this.particles[w++] = p;
    }
    this.particles.length = w;

    w = 0;
    for (const t of this.texts) {
      t.life -= dt;
      if (t.life <= 0) continue;
      t.y -= 28 * s;
      this.texts[w++] = t;
    }
    this.texts.length = w;

    for (const f of this.fallers) {
      if (f.resting) continue;
      f.vy += G_BALL * s;
      f.x += f.vx * s;
      f.y += f.vy * s;
      f.rot += f.vr * s;
      const ground = floorY - f.r;
      if (f.y >= ground) {
        f.y = ground;
        f.bounces++;
        f.vy = -f.vy * 0.42;
        f.vx *= 0.7;
        f.vr = f.vx / f.r;
        if (Math.abs(f.vy) < 60 || f.bounces > 4) {
          f.vy = 0;
          f.vx *= 0.5;
          if (Math.abs(f.vx) < 8) f.resting = true;
        }
      }
      if (f.x < f.r) {
        f.x = f.r;
        f.vx = Math.abs(f.vx) * 0.5;
      } else if (f.x > width - f.r) {
        f.x = width - f.r;
        f.vx = -Math.abs(f.vx) * 0.5;
      }
    }
  }

  /** きらめきと紙吹雪。球より手前に描く。絵柄で形を変える */
  drawParticles(ctx: CanvasRenderingContext2D, style: ArtStyle = 'vector', ink = 'rgba(0,0,0,0.8)'): void {
    if (style === 'ink') return this.drawParticlesInk(ctx, ink);
    if (style === 'paint') return this.drawParticlesPaint(ctx);
    for (const p of this.particles) {
      const a = Math.min(1, p.life / (p.maxLife * 0.4));
      if (p.kind === 'spark') {
        ctx.fillStyle = rgba(p.color, a);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - p.size * 1.6);
        ctx.lineTo(p.x + p.size * 0.6, p.y);
        ctx.lineTo(p.x, p.y + p.size * 1.6);
        ctx.lineTo(p.x - p.size * 0.6, p.y);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = rgba(p.color, a);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 + Math.abs(Math.cos(p.rot * 3)) * p.size * 0.4);
        ctx.restore();
      }
    }
  }

  /** ink: きらめきは米印の線、紙吹雪は線で囲んだ小さな紙 */
  private drawParticlesInk(ctx: CanvasRenderingContext2D, ink: string): void {
    ctx.lineCap = 'round';
    for (const p of this.particles) {
      const a = Math.min(1, p.life / (p.maxLife * 0.4));
      if (p.kind === 'spark') {
        ctx.strokeStyle = rgba(p.color, a);
        ctx.lineWidth = 1.4;
        const s = p.size * 1.8;
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const ang = (k / 3) * Math.PI + p.x * 0.01;
          ctx.moveTo(p.x - Math.cos(ang) * s, p.y - Math.sin(ang) * s);
          ctx.lineTo(p.x + Math.cos(ang) * s, p.y + Math.sin(ang) * s);
        }
        ctx.stroke();
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const hh = p.size / 4 + Math.abs(Math.cos(p.rot * 3)) * p.size * 0.2;
        ctx.fillStyle = rgba(p.color, a * 0.6);
        ctx.fillRect(-p.size / 2 + 0.8, -hh + 0.8, p.size, hh * 2);
        ctx.strokeStyle = rgba(ink, a);
        ctx.lineWidth = 1.1;
        ctx.strokeRect(-p.size / 2, -hh, p.size, hh * 2);
        ctx.restore();
      }
    }
    ctx.lineCap = 'butt';
  }

  /** paint: きらめきは柔らかい光の粒、紙吹雪は筆のひと触れ */
  private drawParticlesPaint(ctx: CanvasRenderingContext2D): void {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      if (p.kind !== 'spark') continue;
      const a = Math.min(1, p.life / (p.maxLife * 0.4));
      const ang = Math.atan2(p.vy, p.vx);
      daub(ctx, p.x, p.y, p.size * 2.6, p.size * 1.1, ang, rgba(p.color, a * 0.35));
      daub(ctx, p.x, p.y, p.size * 1.1, p.size * 0.7, ang, rgba(lighten(p.color, 0.5), a * 0.9));
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const p of this.particles) {
      if (p.kind !== 'confetti') continue;
      const a = Math.min(1, p.life / (p.maxLife * 0.4));
      const ang = p.rot;
      const sq = 0.35 + Math.abs(Math.cos(p.rot * 3)) * 0.65;
      daub(ctx, p.x + 1, p.y + 1.5, p.size * 0.9, p.size * 0.45 * sq, ang, rgba(p.color, a * 0.35));
      daub(ctx, p.x, p.y, p.size * 0.9, p.size * 0.45 * sq, ang, rgba(p.color, a));
      daub(ctx, p.x - p.size * 0.2, p.y - p.size * 0.1, p.size * 0.35, p.size * 0.15 * sq, ang, rgba(lighten(p.color, 0.5), a * 0.8));
    }
  }

  drawTexts(ctx: CanvasRenderingContext2D, font: string, stroke: string, style: ArtStyle = 'vector'): void {
    if (!this.texts.length) return;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    for (const t of this.texts) {
      const a = Math.min(1, t.life / (t.maxLife * 0.5));
      ctx.globalAlpha = a;
      styledText(ctx, t.text, t.x, t.y, t.color, stroke, style);
    }
    ctx.globalAlpha = 1;
  }
}

/**
 * 絵柄に合わせた文字。vector は縁取り、ink は紙色の縁と二重に引いたインク、paint は柔らかい影。
 * ctx.font / textAlign / lineWidth は呼び出し側で決める。
 */
export function styledText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, stroke: string, style: ArtStyle): void {
  if (style === 'paint') {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillText(text, x + 1, y + 2);
    ctx.fillText(text, x - 1, y + 2);
    ctx.fillText(text, x, y + 3);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
    return;
  }
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  if (style === 'ink') {
    // 二度描きしたような線
    const lw = ctx.lineWidth;
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = rgba(fill, 0.55);
    ctx.strokeText(text, x + 0.9, y + 0.6);
    ctx.lineWidth = lw;
  }
}

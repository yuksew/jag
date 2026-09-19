// 演出。きらめき・紙吹雪・落ちた球・浮かぶ文字。状態は Arena の中だけで持ち、core には触れない。
import { rgba } from './palette';

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

  /** 紙吹雪。x を中心に幅 spread から降らせる */
  confetti(x: number, y: number, spread: number, colors: readonly string[], n: number): void {
    for (let i = 0; i < n; i++) {
      const color = colors[Math.floor(this.rnd() * colors.length)] ?? colors[0] ?? '#fff';
      this.push({
        kind: 'confetti',
        x: x + (this.rnd() - 0.5) * spread,
        y: y + (this.rnd() - 0.5) * 20,
        vx: (this.rnd() - 0.5) * 220,
        vy: -60 - this.rnd() * 200,
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

  /** きらめきと紙吹雪。球より手前に描く */
  drawParticles(ctx: CanvasRenderingContext2D): void {
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

  drawTexts(ctx: CanvasRenderingContext2D, font: string, stroke: string): void {
    if (!this.texts.length) return;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    for (const t of this.texts) {
      const a = Math.min(1, t.life / (t.maxLife * 0.5));
      ctx.globalAlpha = a;
      ctx.strokeStyle = stroke;
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}

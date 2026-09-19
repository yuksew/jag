// 練習場の Canvas 描画。core の RunState / SaveState を読むだけで書き換えない。
import { inShowcase, showProgress, TUNING, toleranceAt, type RunState, type SaveState } from '../core';

export type FlashTone = 'ink' | 'warn' | 'bad';

export interface Flash {
  text: string;
  tone: FlashTone;
  at: number;
}

export interface ArenaText {
  showcase: string;
  showcaseIn: (n: number) => string;
  done: string;
  dropped: string;
  idle: string;
  /** 舞台のショーの進み具合 */
  showProgress: (beats: number, need: number) => string;
}

/** 球の色（index 順）。CSS 変数名 */
const BALL_COLORS = ['ivory', 'coral', 'sky', 'amber', 'ok', 'bad', 'muted'] as const;
const FLASH_MS = 600;
const FONT = '"Zen Kaku Gothic New","Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP",system-ui,sans-serif';

export class Arena {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly text: ArenaText,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context is unavailable');
    this.ctx = ctx;
    this.fit();
  }

  /** 表示幅に合わせて解像度を決める（DPR は 2 まで） */
  fit(): void {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.round(r.width);
    this.h = Math.round(r.width * 0.62);
    this.canvas.style.height = `${this.h}px`;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private css(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /** 手の位置。パッシングでは手 1 が相方（画面右）になる */
  private hands(run: RunState): [{ x: number; y: number }, { x: number; y: number }] {
    if (run.prop === 'passing') {
      return [
        { x: this.w * 0.3, y: this.h * 0.8 },
        { x: this.w * 0.78, y: this.h * 0.8 },
      ];
    }
    return [
      { x: this.w * 0.64, y: this.h * 0.8 },
      { x: this.w * 0.36, y: this.h * 0.8 },
    ];
  }

  /** 相方の姿（頭と胴）。手は通常の手の描画を使う */
  private drawPartner(x: number, y: number, ink: string, muted: string): void {
    const { ctx } = this;
    ctx.strokeStyle = muted;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 30, y - 70, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 30, y - 56);
    ctx.lineTo(x + 30, y + 4);
    ctx.stroke();
    ctx.strokeStyle = ink;
  }

  private drawClub(x: number, y: number, r: number, angle: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // 柄（下）と頭（上）。長さは球の半径の 4 倍
    ctx.beginPath();
    ctx.roundRect(-r * 0.25, -r * 0.4, r * 0.5, r * 2.2, r * 0.25);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -r * 1.1, r * 0.55, r * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  draw(now: number, run: RunState, state: SaveState, flash: Flash | null): void {
    const { ctx, w: W, h: H } = this;
    ctx.clearRect(0, 0, W, H);
    const hs = this.hands(run);
    const ink = this.css('--ink');
    const muted = this.css('--muted');
    const line = this.css('--line');
    const ring = this.css('--ring');
    const amber = this.css('--amber');

    // 床
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W * 0.2, H * 0.86);
    ctx.lineTo(W * 0.8, H * 0.86);
    ctx.stroke();

    // 相方
    if (run.prop === 'passing') this.drawPartner(hs[1].x, hs[1].y, ink, muted);

    // 手
    for (const h of hs) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(h.x, h.y + 6, 20, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }

    // 球
    const r = Math.max(10, W * 0.02);
    for (const b of run.balls) {
      let x: number;
      let y: number;
      if (b.flight) {
        const f = b.flight;
        const s = Math.min(1, (now - f.t0) / f.durationMs);
        const a = hs[f.from];
        const c = hs[f.to];
        const peak = Math.min(H * 0.42 * f.height, H * 0.74);
        const wobble = f.wobble * W * TUNING.flight.wobbleOffset;
        x = a.x + (c.x - a.x) * s + wobble * Math.sin(s * Math.PI);
        y = a.y - peak * 4 * s * (1 - s) - r;
        // 軌道
        ctx.strokeStyle = ring;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= 20; i++) {
          const q = i / 20;
          const px = a.x + (c.x - a.x) * q;
          const py = a.y - peak * 4 * q * (1 - q) - r;
          if (i) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        }
        ctx.stroke();
      } else {
        const h = hs[b.hand];
        const idx = run.hands[b.hand].indexOf(b.index);
        x = h.x + (idx ? -r * 1.4 : 0);
        y = h.y - r - 2 + (idx ? 4 : 0);
      }
      ctx.fillStyle = this.css(`--${BALL_COLORS[b.index % BALL_COLORS.length] ?? 'ivory'}`);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5;
      if (run.prop === 'club') {
        // クラブ: 滞空中は回転数ぶん回る。手にあるときは立てて持つ
        const s = b.flight ? Math.min(1, (now - b.flight.t0) / b.flight.durationMs) : 0;
        const angle = b.flight ? s * Math.PI * 2 * run.spins : 0;
        this.drawClub(x, y, r, angle);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // 拍の輪
    const cx = run.prop === 'passing' ? hs[0].x : W / 2;
    const cy = H * 0.8 + r * 0.2;
    const r0 = Math.max(18, W * 0.035);
    ctx.strokeStyle = muted;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.textAlign = 'center';
    if (run.on && run.next) {
      const n = run.next;
      const t = toleranceAt(run, n.k);
      const dt = n.at - now;
      if (!n.thrown) {
        const band = r0 * (t / run.intervalMs) * 2;
        ctx.fillStyle = ring;
        ctx.beginPath();
        ctx.arc(cx, cy, r0 + band, 0, Math.PI * 2);
        ctx.arc(cx, cy, Math.max(2, r0 - band), 0, Math.PI * 2, true);
        ctx.fill();
        const rr = r0 * (1 + (Math.max(0, dt) / run.intervalMs) * 2.2);
        ctx.strokeStyle = n.auto ? muted : amber;
        ctx.lineWidth = n.auto ? 1.5 : 3;
        if (n.auto) ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // ラン中の状態表示は左上（球の頂点と重ならない位置）
      ctx.textAlign = 'left';
      const sx = W * 0.04;
      const sy = H * 0.1;
      if (run.prop === 'stage') {
        const p = showProgress(run);
        ctx.fillStyle = amber;
        ctx.font = `700 14px ${FONT}`;
        ctx.fillText(this.text.showProgress(p.beats, p.need), sx, sy);
      } else if (inShowcase(n.k, run.showcaseAt)) {
        ctx.fillStyle = amber;
        ctx.font = `700 14px ${FONT}`;
        ctx.fillText(this.text.showcase, sx, sy);
      } else if (n.k >= run.showcaseAt - 8 && n.k < run.showcaseAt) {
        ctx.fillStyle = muted;
        ctx.font = `500 13px ${FONT}`;
        ctx.fillText(this.text.showcaseIn(run.showcaseAt - n.k), sx, sy);
      }
      ctx.textAlign = 'center';
    } else if (!run.on) {
      ctx.fillStyle = muted;
      ctx.font = `500 14px ${FONT}`;
      const msg = state.done ? this.text.done : run.ended ? this.text.dropped : this.text.idle;
      ctx.fillText(msg, cx, H * 0.12);
    }

    // 判定文字
    if (flash && now - flash.at < FLASH_MS) {
      ctx.globalAlpha = 1 - (now - flash.at) / FLASH_MS;
      ctx.fillStyle = flash.tone === 'bad' ? this.css('--bad') : flash.tone === 'warn' ? amber : ink;
      ctx.font = `900 18px ${FONT}`;
      ctx.fillText(flash.text, cx, cy + r0 + 28);
      ctx.globalAlpha = 1;
    }
  }
}

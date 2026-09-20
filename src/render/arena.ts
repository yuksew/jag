// 練習場の Canvas 描画。core の RunState / SaveState を読むだけで書き換えない。
// 演出用の状態（残像・粒・落ちた球・手の動き）はこのクラスの中だけで持つ。
import {
  initialHands,
  inShowcase,
  showProgress,
  throwingHand,
  TUNING,
  toleranceAt,
  type Ball,
  type Flight,
  type Hand,
  type PracticeMode,
  type RunEvent,
  type RunState,
  type SaveState,
} from '../core';
import { Audience, type HandsFrame } from './audience';
import { drawCurtains, drawSpotlight, drawStageLights, drawValance, FLOOR_Y, renderBackdrop } from './backdrop';
import { daub, inkCircle, inkStroke, lcg, wobblyCircle, wobblyEllipse, type Rnd } from './brush';
import { CharacterSprites, currentCharacter, watchCharacter, type CharacterId } from './character';
import { Effects, styledText } from './effects';
import { DISPLAY_FONT, loadFonts, NUMBER_FONT } from './fonts';
import { lighten, readPalette, rgba, watchPalette, type Palette } from './palette';
import { Acting, type BaseMood } from './pose';
import { Signage, type SignEnv } from './signage';
import { BallSprites, ClubSprites, drawFigure, figureColors, type HandPose, type Point, type SpriteEnv } from './sprites';
import { currentStyle, watchStyle, type ArtStyle } from './style';

declare global {
  interface Window {
    /** 描画時間の計測（style-shots が読む）。draw 1 回あたりの ms */
    __sankyuArenaStats?: { style: ArtStyle; frames: number; totalMs: number; maxMs: number };
  }
}

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
/** 残像の数と間隔 */
const TRAIL_STEPS = 5;
const TRAIL_GAP_MS = 26;
const SPOT_FADE_MS = 450;
const BURST_MS = 500;
const CURTAIN_MS = 1800;
/** 完走で幕を閉じてから上げるまでの間 */
const CURTAIN_HOLD_MS = 900;
const SHAKE_MS = 300;
/** 待機中にカメラを寄せる倍率と、寄る速さ */
const IDLE_ZOOM = 1.15;
const ZOOM_MS = 380;
/** 寄せの中心（描画高さに対する割合）。床の少し上を固定して上の空白を減らす */
const ZOOM_PIVOT_Y = 0.9;
/** 完走のカーテンコール: お辞儀の間隔、客席からの紙吹雪の間隔と上限 */
const BOW_PERIOD_MS = 4200;
const TOSS_GAP_MS = 110;
const TOSS_MAX = 90;
/** 路上: 拍手で手が上がる時間と 2 コマの切り替え、「見せた」の明るさが消える時間 */
const HANDS_UP_MS = 720;
const HANDS_FRAME_MS = 170;
const SHOWN_MS = 520;
/** 横断幕が降りてくる時間 */
const BANNER_ENTER_MS = 380;
/** ink のジッタを更新する間隔（フレーム） */
const JITTER_FRAMES = 8;
/** 投げの予備動作（拍のこの時間前から手が沈む） */
const ANTICIPATE_MS = 170;
/** 足の接地。手の基準からの距離（描画幅に対する割合） */
const FEET_BELOW_HANDS = 0.085;

export class Arena {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private pal: Palette;
  private palDirty = false;
  private style: ArtStyle;
  private character: CharacterId;
  private frame = 0;
  private backdrop: { key: string; canvas: HTMLCanvasElement } | null = null;
  private readonly ballSprites = new BallSprites();
  private readonly clubSprites = new ClubSprites();
  private readonly characterSprites = new CharacterSprites();
  private readonly acting = new Acting();
  private readonly partnerActing = new Acting(0.55);
  private readonly fx = new Effects();
  private readonly audience = new Audience();
  private readonly signage = new Signage();
  private readonly pending: RunEvent[] = [];
  private lastNow = -1;
  private prevOn = false;
  /** 球ごとの前フレームの滞空状態（投げ・キャッチの検出用） */
  private prevFlight: boolean[] = [];
  private readonly throwAt: [number, number] = [-1e9, -1e9];
  private readonly catchAt: [number, number] = [-1e9, -1e9];
  /** 落ちて床にある球（描画しない index） */
  private readonly hidden = new Set<number>();
  private dropPending = false;
  private shakeUntil = -1e9;
  private earlyAt = -1e9;
  private burstAt = -1e9;
  private spot = 0;
  /** 舞台の幕。1 = 開いている、0 = 閉じている */
  private curtain = 1;
  private curtainCloseAt = -1e9;
  private applauseSide = 1;
  /** カメラの寄せ（1 = ラン中の大きさ） */
  private zoom = 1;
  /** 路上: 最後の拍手と「見せた」の時刻 */
  private applauseAt = -1e9;
  private shownAt = -1e9;
  /** 横断幕を出し始めた時刻（出ていなければ −1） */
  private bannerSince = -1;
  /** 完走のカーテンコール */
  private curtainCall = false;
  private nextBowAt = 0;
  private lastTossAt = -1e9;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly text: ArenaText,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context is unavailable');
    this.ctx = ctx;
    this.pal = readPalette();
    this.style = currentStyle();
    this.character = currentCharacter();
    loadFonts();
    watchPalette(() => {
      this.palDirty = true;
    });
    watchStyle(() => {
      this.palDirty = true;
    });
    watchCharacter(() => {
      this.palDirty = true;
    });
    this.fit();
  }

  /**
   * 表示幅に合わせて解像度を決める（DPR は 2 まで）。
   * 高さは幅 × 0.62 を下限に、画面の残り（HUD と注釈を除く）まで伸ばす。縦に余裕があるほど高い投げが切れない
   */
  fit(): void {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.w = Math.round(r.width);
    const reserved = ['hud', 'foot'].reduce((sum, id) => sum + (document.getElementById(id)?.offsetHeight ?? 0), 0) + 12;
    const available = window.innerHeight - reserved;
    this.h = Math.round(Math.min(Math.max(r.width * 0.62, available), r.width * 1.05));
    this.canvas.style.height = `${this.h}px`;
    this.canvas.parentElement?.style.setProperty('--cv-h', `${this.h}px`);
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.backdrop = null;
    this.ballSprites.clear();
    this.clubSprites.clear();
    this.characterSprites.clear();
    this.audience.clear();
    this.signage.clear();
  }

  /** ランのイベントを演出に流す。次の draw で処理する */
  notify(events: readonly RunEvent[]): void {
    for (const e of events) this.pending.push(e);
  }

  /** 手の位置。パッシングでは手 1 が相方（画面右）になる */
  private hands(prop: PracticeMode): [Point, Point] {
    if (prop === 'passing') {
      return [
        { x: this.w * 0.3, y: this.h * 0.8 },
        { x: this.w * 0.78, y: this.h * 0.8 },
      ];
    }
    return [
      { x: this.w * 0.605, y: this.h * 0.8 },
      { x: this.w * 0.395, y: this.h * 0.8 },
    ];
  }

  /** 滞空中の球の位置。s は 0〜1 の進み */
  private flightPos(f: Flight, s: number, hs: [Point, Point], r: number): Point {
    const a = hs[f.from];
    const c = hs[f.to];
    const peak = Math.min(this.h * 0.42 * f.height, this.h * 0.74);
    const wobble = f.wobble * this.w * TUNING.flight.wobbleOffset;
    return {
      x: a.x + (c.x - a.x) * s + wobble * Math.sin(s * Math.PI),
      y: a.y - peak * 4 * s * (1 - s) - r,
    };
  }

  private ballColor(index: number): string {
    const name = BALL_COLORS[index % BALL_COLORS.length] ?? 'ivory';
    return this.pal[name];
  }

  /** 手の描画位置。拍に合わせて上下し、投げで上がり、キャッチで下がって閉じる */
  private handPoses(now: number, run: RunState, held: [number[], number[]], hs: [Point, Point]): [HandPose, HandPose] {
    const u = this.w;
    const reduce = this.pal.reduceMotion;
    const pose = (i: Hand): HandPose => {
      const base = hs[i];
      let dy = 0;
      let closed = 0;
      if (run.on && !reduce) {
        const phase = (now - run.t0) / run.intervalMs;
        dy += u * 0.004 * Math.sin(phase * Math.PI * 2 + i * Math.PI);
        // 投げの予備動作: 次の拍の手は少し前から沈み、拍で戻る
        const n = run.next;
        if (n && !n.thrown && throwingHand(n.k) === i) {
          const dtb = n.at - now;
          if (dtb > 0 && dtb < ANTICIPATE_MS) dy += u * 0.009 * Math.sin(Math.PI * (1 - dtb / ANTICIPATE_MS));
        }
        const st = now - this.throwAt[i];
        if (st >= 0) dy -= u * 0.016 * Math.exp(-st / 130);
        const ct = now - this.catchAt[i];
        if (ct >= 0) {
          dy += u * 0.01 * Math.exp(-ct / 150);
          closed = Math.exp(-ct / 240);
        }
      }
      if (held[i].length) closed = Math.max(closed, 0.4);
      return { p: { x: base.x, y: base.y + dy }, closed };
    };
    return [pose(0), pose(1)];
  }

  /** 溜まったイベントを演出に変える */
  private consumeEvents(now: number, hs: [Point, Point]): void {
    if (!this.pending.length) return;
    const { pal, fx, w: W, h: H } = this;
    const reduce = pal.reduceMotion;
    const confettiColors = [pal.coral, pal.sky, pal.amber, pal.ivory, pal.ok];
    for (const e of this.pending) {
      switch (e.type) {
        case 'throw': {
          if (e.grade === 'clean') this.acting.react('clean', now);
          if (e.grade === 'wobble') {
            this.shakeUntil = now + SHAKE_MS;
            this.acting.react('wobble', now, throwingHand(e.k) === 0 ? 1 : -1);
          } else if (!reduce) {
            const h = hs[throwingHand(e.k)];
            const color = e.grade === 'clean' ? pal.amber : e.grade === 'partner' ? pal.coral : pal.muted;
            fx.sparkle(h.x, h.y - W * 0.03, color, e.grade === 'clean' ? 8 : 4, e.grade === 'clean' ? 120 : 70);
          }
          break;
        }
        case 'early':
          this.earlyAt = now;
          this.shakeUntil = now + SHAKE_MS * 0.7;
          break;
        case 'clean':
          this.acting.react('bonus', now);
          this.partnerActing.react('bonus', now);
          if (!reduce) fx.confetti(W / 2, H * 0.12, W * 0.5, confettiColors, 40);
          break;
        case 'showcase-cleared':
          this.burstAt = now;
          this.acting.react('bonus', now);
          if (!reduce) fx.confetti(W / 2, H * 0.1, W * 0.7, confettiColors, 90);
          break;
        case 'flash7':
          this.burstAt = now;
          this.acting.react('bonus', now);
          if (!reduce) fx.confetti(W / 2, H * 0.08, W * 0.9, confettiColors, 120);
          break;
        case 'show-complete':
          this.burstAt = now;
          this.curtainCloseAt = now;
          this.acting.react('complete', now);
          this.partnerActing.react('complete', now);
          if (!reduce) fx.confetti(W / 2, H * 0.08, W * 0.9, confettiColors, 160);
          break;
        case 'applause': {
          this.acting.react('applause', now);
          this.applauseAt = now;
          this.applauseSide = -this.applauseSide;
          const x = W * (0.5 + this.applauseSide * 0.38) + (Math.random() - 0.5) * W * 0.08;
          fx.float(x, H * 0.84, `+${e.gain}`, pal.amber);
          break;
        }
        case 'shown':
          this.shownAt = now;
          this.acting.react('bonus', now);
          if (!reduce) fx.confetti(W / 2, H * 0.92, W * 0.9, confettiColors, 36, 520, 320);
          break;
        case 'drop':
          this.dropPending = true;
          this.acting.react('drop', now);
          this.partnerActing.react('drop', now);
          break;
        default:
          break;
      }
    }
    this.pending.length = 0;
  }

  /** 落球: 空中の球を床へ落とす */
  private startDrop(now: number, run: RunState, hs: [Point, Point], r: number): void {
    this.dropPending = false;
    for (const b of run.balls) {
      const f = b.flight;
      if (!f || this.hidden.has(b.index)) continue;
      const s = Math.min(1, (now - f.t0) / f.durationMs);
      const p = this.flightPos(f, s, hs, r);
      const ds = 0.02;
      const q = this.flightPos(f, Math.min(1, s + ds), hs, r);
      const k = 1000 / (f.durationMs * ds);
      let vx = (q.x - p.x) * k;
      let vy = (q.y - p.y) * k;
      // 取り損ねた球は手前に弾かれる
      vx = vx * 0.6 + (Math.random() - 0.5) * 120;
      vy = Math.min(vy, 0) * 0.5 + 40;
      this.hidden.add(b.index);
      this.fx.drop(b.index, p.x, p.y, vx, vy, r, this.ballColor(b.index));
    }
  }

  private drawProp(prop: PracticeMode, index: number, x: number, y: number, r: number, angle: number): void {
    const { ctx } = this;
    const env: SpriteEnv = { style: this.style, dpr: this.dpr, pal: this.pal };
    if (prop === 'club') {
      this.clubSprites.draw(ctx, x, y, r, angle, this.ballColor(index), env);
    } else {
      this.ballSprites.draw(ctx, x, y, r, this.ballColor(index), env);
    }
  }

  private outlinedText(text: string, x: number, y: number, fill: string, stroke: string): void {
    const { ctx } = this;
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    styledText(ctx, text, x, y, fill, stroke, this.style);
  }

  /** ink の揺れの種。数フレームごとに変わる（動きを減らす設定なら固定） */
  private jitterSeed(): number {
    return this.pal.reduceMotion ? 1 : Math.floor(this.frame / JITTER_FRAMES) + 1;
  }

  /** 拍の輪。絵柄ごとに線の質を変える。半径は判定と連動したまま */
  private ring(rnd: Rnd, cx: number, cy: number, r: number, color: string, width: number, glow: number, dashed: boolean): void {
    const { ctx, style } = this;
    if (style === 'ink') {
      inkCircle(ctx, rnd, cx, cy, r, { color, width: Math.max(1.2, width * 0.8), vary: 0.6 }, dashed ? 0.06 : 0.035);
      return;
    }
    if (style === 'paint') {
      if (glow > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(color, glow * 0.5);
        ctx.lineWidth = width * 3.2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      // 筆で描いた輪。太さが一周で変わる
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = rgba(k === 2 ? lighten(color, 0.35) : color, k === 0 ? 0.9 : 0.55);
        ctx.lineWidth = width * (k === 0 ? 1.3 : k === 1 ? 0.8 : 0.45);
        ctx.beginPath();
        const a0 = k * 2.1;
        ctx.arc(cx + (k - 1) * 0.6, cy + (k - 1) * 0.4, r, a0, a0 + Math.PI * (dashed ? 1.1 : 1.75));
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      return;
    }
    if (glow > 0) {
      ctx.strokeStyle = rgba(color, glow * 0.22);
      ctx.lineWidth = width * 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (dashed) ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** 拍の輪の許容帯 */
  private band(rnd: Rnd, cx: number, cy: number, r0: number, band: number): void {
    const { ctx, pal, style } = this;
    if (style === 'ink') {
      ctx.fillStyle = rgba(pal.amber, 0.16);
      ctx.beginPath();
      const outer = wobblyCircle(rnd, cx, cy, r0 + band, 0.03, 40);
      const inner = wobblyCircle(rnd, cx, cy, Math.max(2, r0 - band), 0.04, 40);
      for (let i = 0; i < outer.length; i++) {
        const p = outer[i] as Point;
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      for (let i = 0; i < inner.length; i++) {
        const p = inner[i] as Point;
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fill('evenodd');
      inkStroke(ctx, rnd, outer, { color: rgba(pal.ink, 0.5), width: 1.1, vary: 0.7, closed: true });
      return;
    }
    if (style === 'paint') {
      const g = ctx.createRadialGradient(cx, cy, Math.max(0, r0 - band), cx, cy, r0 + band);
      g.addColorStop(0, rgba(pal.amber, 0));
      g.addColorStop(0.5, rgba(pal.amber, 0.32));
      g.addColorStop(1, rgba(pal.amber, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r0 + band, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.fillStyle = pal.ring;
    ctx.beginPath();
    ctx.arc(cx, cy, r0 + band, 0, Math.PI * 2);
    ctx.arc(cx, cy, Math.max(2, r0 - band), 0, Math.PI * 2, true);
    ctx.fill();
    ctx.strokeStyle = rgba(pal.ink, 0.2);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r0 + band, 0, Math.PI * 2);
    ctx.stroke();
  }

  /** 床の影 */
  private groundShadow(rnd: Rnd, x: number, y: number, rx: number, ry: number): void {
    const { ctx, style, pal } = this;
    if (style === 'ink') {
      ctx.fillStyle = rgba(pal.ink, 0.18);
      ctx.beginPath();
      const pts = wobblyEllipse(rnd, x, y, rx, ry, 0.1, 16);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i] as Point;
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fill();
      return;
    }
    if (style === 'paint') {
      const g = ctx.createRadialGradient(x, y, 0, x, y, rx * 1.3);
      g.addColorStop(0, 'rgba(0,0,0,0.3)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, ry / rx);
      ctx.beginPath();
      ctx.arc(0, 0, rx * 1.3, 0, Math.PI * 2);
      ctx.restore();
      ctx.fill();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  draw(now: number, run: RunState, state: SaveState, flash: Flash | null): void {
    const t0 = performance.now();
    const dt = this.lastNow < 0 ? 16 : Math.min(50, Math.max(0, now - this.lastNow));
    this.lastNow = now;
    this.frame++;
    if (this.palDirty) {
      this.palDirty = false;
      this.pal = readPalette();
      this.style = currentStyle();
      this.character = currentCharacter();
      this.backdrop = null;
      this.ballSprites.clear();
      this.clubSprites.clear();
      this.characterSprites.clear();
      this.audience.clear();
      this.signage.clear();
    }
    const { ctx, w: W, h: H, pal, fx, style } = this;
    const reduce = pal.reduceMotion;
    const seed = this.jitterSeed();
    const rnd = lcg(seed);
    // ラン中は run の種目、待機中はタブで選んだ種目を映す。まだ一度も投げていなければ手持ちの球を並べる
    const prop: PracticeMode = run.on || run.balls.length ? run.prop : state.mode;
    // カーテンコール（完走後の待機）では道具を置いて礼をする
    const callIdle = prop === 'stage' && state.done && !run.on;
    const view = run.balls.length && !callIdle ? { balls: run.balls, held: run.hands } : idleBalls(callIdle ? 0 : state.balls);
    const hs = this.hands(prop);
    const r = Math.max(10, W * 0.02);
    const floorY = H * FLOOR_Y;
    const stage = prop === 'stage';

    // ラン開始で床の球を片付ける
    if (run.on && !this.prevOn) {
      fx.clearFallers();
      this.hidden.clear();
      this.prevFlight = [];
    }
    this.prevOn = run.on;

    const showcase = run.on && run.next !== null && inShowcase(run.next.k, run.showcaseAt);
    this.consumeEvents(now, hs);
    if (this.dropPending) this.startDrop(now, run, hs, r);

    // 投げ・キャッチの検出（手の動きに使う）
    if (run.on) {
      for (const b of run.balls) {
        const was = this.prevFlight[b.index] ?? false;
        const is = b.flight !== null;
        if (is && !was && b.flight) this.throwAt[b.flight.from] = now;
        if (!is && was) this.catchAt[b.hand] = now;
        this.prevFlight[b.index] = is;
      }
    }
    fx.update(reduce ? 0 : dt, floorY + H * 0.05, W);

    // 舞台の幕。完走で閉じ、少し置いて上がる（動きを減らす設定では上がった状態）
    this.curtain = stage ? curtainOpen(now - this.curtainCloseAt, state.done, reduce) : 1;

    // カーテンコール: 幕が上がりきったらお辞儀を繰り返し、客席から紙吹雪
    const callOn = stage && state.done && !run.on && this.curtain >= 0.999;
    if (callOn) {
      if (!this.curtainCall) {
        this.curtainCall = true;
        this.nextBowAt = now + 300;
      }
      if (!reduce && now >= this.nextBowAt) {
        this.acting.react('bow', now);
        this.nextBowAt = now + BOW_PERIOD_MS;
      }
      if (!reduce && now - this.lastTossAt > TOSS_GAP_MS && fx.particleCount < TOSS_MAX) {
        this.lastTossAt = now;
        const colors = [pal.coral, pal.sky, pal.amber, pal.ivory, pal.ok];
        fx.confetti(W * (0.08 + 0.84 * Math.random()), H * 0.98, W * 0.08, colors, 2, 620, 160);
      }
    } else {
      this.curtainCall = false;
    }

    // カメラ。待機中は主人公に寄せる（vector 以外の舞台は飾り幕が背景に焼いてあるので寄せない）
    const zoomTarget = run.on || (stage && style !== 'vector') ? 1 : IDLE_ZOOM;
    this.zoom = reduce ? zoomTarget : this.zoom + (zoomTarget - this.zoom) * Math.min(1, dt / ZOOM_MS);
    if (Math.abs(this.zoom - zoomTarget) < 0.002) this.zoom = zoomTarget;
    ctx.save();
    if (this.zoom !== 1) {
      ctx.translate(W / 2, H * ZOOM_PIVOT_Y);
      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-W / 2, -H * ZOOM_PIVOT_Y);
    }

    // 背景
    const key = `${style}|${prop}|${pal.dark ? 'd' : 'l'}|${W}x${H}`;
    if (!this.backdrop || this.backdrop.key !== key) {
      const split = style === 'vector';
      this.backdrop = { key, canvas: renderBackdrop(W, H, this.dpr, prop, pal, style, { audience: !split, valance: !split }) };
    }
    ctx.drawImage(this.backdrop.canvas, 0, 0, W, H);

    // 路上の客席（vector）。拍手で手が上がり、「見せた」で明るくなる
    if (style === 'vector' && prop === 'street') {
      const up = now - this.applauseAt;
      const frame: HandsFrame = up >= 0 && up < HANDS_UP_MS ? (reduce ? 1 : ((Math.floor(up / HANDS_FRAME_MS) % 2) + 1) as HandsFrame) : 0;
      const lit = now - this.shownAt;
      const bright = lit >= 0 && lit < SHOWN_MS ? 1 - lit / SHOWN_MS : 0;
      this.audience.draw(ctx, W, H, this.dpr, pal, frame, bright);
    }

    // 光。舞台は常に、見せ場はスポットライト、完走は明るく
    const wantSpot = showcase ? 1 : stage && run.on ? 0.55 : stage && state.done ? 0.9 : stage ? 0.25 : 0;
    this.spot = reduce ? wantSpot : this.spot + (wantSpot - this.spot) * Math.min(1, dt / SPOT_FADE_MS);
    if (stage) drawStageLights(ctx, W, H, pal, callOn ? 1.4 : 1, style);
    drawSpotlight(ctx, W, H, pal, W / 2, this.spot, showcase ? 1 : callOn ? 0.55 : 0.4, style, seed);

    // ジャグラー（と相方）
    const poses = this.handPoses(now, run, view.held, hs);
    const mood: BaseMood = run.on ? (showcase ? 'showcase' : 'run') : state.done ? 'done' : run.ended ? 'dropped' : 'idle';
    this.acting.setMood(mood);
    this.partnerActing.setMood(mood === 'showcase' ? 'run' : mood);
    // 一番高い球（視線の先）
    let top: Point | null = null;
    for (const b of view.balls) {
      const f = b.flight;
      if (!f || this.hidden.has(b.index)) continue;
      const p = this.flightPos(f, Math.min(1, (now - f.t0) / f.durationMs), hs, r);
      if (!top || p.y < top.y) top = p;
    }
    const beatPhase = run.on ? (((now - run.t0) / run.intervalMs) % 1 + 1) % 1 : null;
    const lookFrom = (hx: number, hy: number): [number, number] | null =>
      top ? [Math.max(-1, Math.min(1, (top.x - hx) / (W * 0.3))), Math.max(-1, Math.min(1, (top.y - hy) / (H * 0.35)))] : null;
    const feetY = hs[0].y + W * FEET_BELOW_HANDS;
    const headY = hs[0].y - W * 0.16;
    if (style === 'vector') {
      const base = { unit: W, handY: hs[0].y, feetY, pal, dpr: this.dpr, id: this.character };
      if (prop === 'passing') {
        const x0 = hs[0].x - W * 0.065;
        const x1 = hs[1].x + W * 0.065;
        const pose0 = this.acting.pose(now, { lookAt: lookFrom(x0, headY), beatPhase, reduceMotion: reduce });
        const pose1 = this.partnerActing.pose(now, { lookAt: lookFrom(x1, headY), beatPhase, reduceMotion: reduce });
        this.characterSprites.draw(ctx, { ...base, partner: false, x: x0, hands: [poses[0], null], facing: 1, pose: pose0 });
        this.characterSprites.draw(ctx, { ...base, partner: true, x: x1, hands: [null, poses[1]], facing: -1, pose: pose1 });
      } else {
        const pose = this.acting.pose(now, { lookAt: lookFrom(W / 2, headY), beatPhase, reduceMotion: reduce });
        this.characterSprites.draw(ctx, { ...base, partner: false, x: W / 2, hands: callIdle ? [null, null] : poses, facing: 0, pose });
      }
    } else if (prop === 'passing') {
      drawFigure(ctx, {
        x: hs[0].x - W * 0.065,
        handY: hs[0].y,
        unit: W,
        bottom: H,
        hands: [poses[0], null],
        facing: 1,
        colors: figureColors(pal, false, style),
        style,
        pal,
        seed,
      });
      drawFigure(ctx, {
        x: hs[1].x + W * 0.065,
        handY: hs[1].y,
        unit: W,
        bottom: H,
        hands: [null, poses[1]],
        facing: -1,
        colors: figureColors(pal, true, style),
        style,
        pal,
        seed: seed + 3,
      });
    } else {
      drawFigure(ctx, {
        x: W / 2,
        handY: hs[0].y,
        unit: W,
        bottom: H,
        hands: poses,
        facing: 0,
        colors: figureColors(pal, false, style),
        style,
        pal,
        seed,
      });
    }

    // 床に落ちた球
    for (const f of fx.fallers) {
      this.groundShadow(rnd, f.x, floorY + H * 0.05, f.r * 1.1, f.r * 0.35);
      this.drawProp(prop, f.index, f.x, f.y, f.r, prop === 'club' ? f.rot + Math.PI / 2 : 0);
    }

    // 手の中の球（滞空中の球より奥）
    for (const b of view.balls) {
      if (b.flight || this.hidden.has(b.index)) continue;
      const pose = poses[b.hand];
      const idx = view.held[b.hand].indexOf(b.index);
      const dir = b.hand === 0 ? -1 : 1;
      const x = pose.p.x + dir * Math.max(0, idx) * r * 1.25;
      const y = pose.p.y - r * 0.85 + Math.max(0, idx) * 2;
      this.drawProp(prop, b.index, x, y, r, 0);
    }

    // 滞空中の球: 軌道 → 残像 → 球
    for (const b of view.balls) {
      const f = b.flight;
      if (!f || this.hidden.has(b.index)) continue;
      const s = Math.min(1, (now - f.t0) / f.durationMs);
      const color = this.ballColor(b.index);
      if (s < 1) {
        // 軌道
        const a = hs[f.from];
        if (style === 'ink') {
          // 点線を手で打ったように、点の大きさと間隔を揺らす
          ctx.fillStyle = rgba(pal.ink, 0.45);
          for (let i = 1; i <= 18; i++) {
            const p = this.flightPos(f, (i + (rnd() - 0.5) * 0.3) / 18, hs, r);
            ctx.beginPath();
            ctx.arc(p.x + (rnd() - 0.5) * 2, p.y + (rnd() - 0.5) * 2, 0.9 + rnd() * 0.9, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (style === 'paint') {
          // 筆で点々と置いた軌道
          const fill = rgba(lighten(color, 0.25), 0.16);
          let prev = { x: a.x, y: a.y - r };
          for (let i = 1; i <= 14; i++) {
            const p = this.flightPos(f, i / 14, hs, r);
            daub(ctx, p.x, p.y, r * 0.28, r * 0.12, Math.atan2(p.y - prev.y, p.x - prev.x), fill);
            prev = p;
          }
        } else {
          ctx.strokeStyle = pal.ring;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 5]);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y - r);
          for (let i = 1; i <= 20; i++) {
            const p = this.flightPos(f, i / 20, hs, r);
            ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // 残像
        if (!reduce) {
          if (style === 'ink') {
            // スピード線: 進行方向の後ろへ 3 本
            const p0 = this.flightPos(f, s, hs, r);
            const p1 = this.flightPos(f, Math.max(0, s - 0.04), hs, r);
            const dx = p1.x - p0.x;
            const dy = p1.y - p0.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;
            for (let i = -1; i <= 1; i++) {
              const ox = nx * i * r * 0.55;
              const oy = ny * i * r * 0.55;
              const back = r * (1.4 + (rnd() - 0.5) * 0.6) * Math.min(1, s * 6);
              inkStroke(
                ctx,
                rnd,
                [
                  { x: p0.x + ox - (dx / len) * r * 0.6, y: p0.y + oy - (dy / len) * r * 0.6 },
                  { x: p0.x + ox - (dx / len) * r * 0.6 + (dx / len) * back, y: p0.y + oy - (dy / len) * r * 0.6 + (dy / len) * back },
                ],
                { color: rgba(pal.ink, 0.7), width: 1.3, vary: 0.5, taper: true },
              );
            }
          } else if (style === 'paint') {
            // 筆の滲み: 進行方向に伸びた楕円
            for (let i = TRAIL_STEPS; i >= 1; i--) {
              const tt = now - i * TRAIL_GAP_MS;
              if (tt <= f.t0) continue;
              const p = this.flightPos(f, (tt - f.t0) / f.durationMs, hs, r);
              const q = this.flightPos(f, (tt - f.t0 + TRAIL_GAP_MS) / f.durationMs, hs, r);
              daub(ctx, p.x, p.y, r * 1.2, r * 0.7 * (1 - 0.1 * i), Math.atan2(q.y - p.y, q.x - p.x), rgba(lighten(color, 0.2), 0.22 * (1 - i / (TRAIL_STEPS + 1))));
            }
          } else {
            for (let i = TRAIL_STEPS; i >= 1; i--) {
              const tt = now - i * TRAIL_GAP_MS;
              if (tt <= f.t0) continue;
              const p = this.flightPos(f, (tt - f.t0) / f.durationMs, hs, r);
              ctx.fillStyle = rgba(color, 0.3 * (1 - i / (TRAIL_STEPS + 1)));
              ctx.beginPath();
              ctx.arc(p.x, p.y, r * (1 - 0.09 * i), 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
      const p = this.flightPos(f, s, hs, r);
      let x = p.x;
      if (f.wobble && !reduce && s < 1) x += Math.sin(now * 0.05) * r * 0.2 * (1 - s);
      const angle = prop === 'club' ? s * Math.PI * 2 * run.spins : 0;
      this.drawProp(prop, b.index, x, p.y, r, angle);
    }

    // 拍の輪（半径・帯・縮みは判定と連動。見栄えだけ）
    const shake = !reduce && now < this.shakeUntil ? Math.sin(now * 0.07) * 3 * ((this.shakeUntil - now) / SHAKE_MS) : 0;
    const cx = (prop === 'passing' ? hs[0].x : W / 2) + shake;
    const cy = H * 0.8 + r * 0.2;
    const r0 = Math.max(18, W * 0.035);
    if (style === 'vector') {
      ctx.strokeStyle = rgba(pal.ink, pal.dark ? 0.12 : 0.07);
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(cx, cy, r0, 0, Math.PI * 2);
      ctx.stroke();
    }
    this.ring(rnd, cx, cy, r0, style === 'ink' ? rgba(pal.ink, 0.85) : pal.muted, 2, style === 'paint' ? 0.3 : 0, false);
    const early = now - this.earlyAt;
    if (early < 300) {
      this.ring(rnd, cx, cy, r0 + 4 + early * 0.05, rgba(pal.bad, 0.7 * (1 - early / 300)), 4, 0, false);
    }

    ctx.textAlign = 'center';
    if (run.on && run.next) {
      const n = run.next;
      const t = toleranceAt(run, n.k);
      const dtBeat = n.at - now;
      if (!n.thrown) {
        const band = r0 * (t / run.intervalMs) * 2;
        this.band(rnd, cx, cy, r0, band);
        const rr = r0 * (1 + (Math.max(0, dtBeat) / run.intervalMs) * 2.2);
        if (n.auto) {
          this.ring(rnd, cx, cy, rr, pal.muted, 1.5, 0, true);
        } else {
          this.ring(rnd, cx, cy, rr, pal.amber, 3, 1, false);
        }
      }
    }

    // 判定文字
    if (flash && now - flash.at < FLASH_MS) {
      const age = now - flash.at;
      const pop = reduce ? 1 : 1 + 0.25 * Math.exp(-age / 80);
      ctx.globalAlpha = 1 - age / FLASH_MS;
      ctx.font = `700 ${Math.round(19 * pop)}px ${DISPLAY_FONT}`;
      const color = flash.tone === 'bad' ? pal.bad : flash.tone === 'warn' ? pal.amber : pal.ink;
      const flashX = cx + (flash.tone === 'warn' ? shake : 0);
      this.outlinedText(flash.text, flashX,cy + r0 + 28 - (reduce ? 0 : (age / FLASH_MS) * 8), color, rgba(pal.panel, 0.85));
      ctx.globalAlpha = 1;
    }

    // 粒と浮かぶ文字
    if (!reduce) fx.drawParticles(ctx, style, rgba(pal.ink, 0.85));
    fx.drawTexts(ctx, `400 16px ${NUMBER_FONT}`, rgba(pal.panel, 0.85), style);

    // 見せ場クリアなどの閃光
    const burst = now - this.burstAt;
    if (burst < BURST_MS) {
      if (style === 'paint') ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(pal.amber, (style === 'paint' ? 0.5 : 0.3) * (1 - burst / BURST_MS));
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }

    // ここまでがカメラの寄せの対象。飾り幕・幕・看板は寄せない
    ctx.restore();

    // 舞台の飾り幕と幕
    if (stage) {
      if (style === 'vector') drawValance(ctx, W, H, pal);
      drawCurtains(ctx, W, H, pal, this.curtain, style, seed);
    }

    // 看板と状態文字（幕より手前）
    const env: SignEnv = { pal, style, dpr: this.dpr, reduceMotion: reduce };
    const stroke = rgba(pal.panel, 0.8);
    let bannerText: string | null = null;
    if (run.on && run.next) {
      const n = run.next;
      if (stage) {
        // ショーの進み具合は幕の上の電飾看板。電球は 4 拍ごとに入れ替わる
        const p = showProgress(run);
        this.signage.marquee(ctx, W, H, this.text.showProgress(p.beats, p.need), env, Math.floor(p.beats / 4));
      } else if (showcase) {
        bannerText = this.text.showcase;
      } else if (n.k >= run.showcaseAt - 8 && n.k < run.showcaseAt) {
        bannerText = this.text.showcaseIn(run.showcaseAt - n.k);
      }
    } else if (!run.on) {
      if (stage && state.done) {
        // 完走: 看板に「ショーは成立した」。幕が閉じている間は隠す
        if (this.curtain > 0.5) this.signage.marquee(ctx, W, H, this.text.done, env, reduce ? 0 : Math.floor(now / 300), reduce);
      } else {
        ctx.font = `500 14px ${DISPLAY_FONT}`;
        ctx.textAlign = 'center';
        const msg = state.done ? this.text.done : run.ended ? this.text.dropped : this.text.idle;
        this.outlinedText(msg, cx - shake, H * 0.12, pal.muted, stroke);
      }
    }
    if (bannerText !== null) {
      if (this.bannerSince < 0) this.bannerSince = now;
      this.signage.banner(ctx, W, H, bannerText, env, now, (now - this.bannerSince) / BANNER_ENTER_MS, showcase);
    } else {
      this.bannerSince = -1;
    }
    ctx.textAlign = 'center';

    // 描画時間の計測
    const ms = performance.now() - t0;
    const st = window.__sankyuArenaStats;
    if (st && st.style === style) {
      st.frames++;
      st.totalMs += ms;
      if (ms > st.maxMs) st.maxMs = ms;
    } else {
      window.__sankyuArenaStats = { style, frames: 1, totalMs: ms, maxMs: ms };
    }
  }
}

/** まだ投げていないときに手に並べる球 */
function idleBalls(count: number): { balls: Ball[]; held: [number[], number[]] } {
  const balls = initialHands(count).map((hand, index): Ball => ({ index, hand, flight: null }));
  const held: [number[], number[]] = [[], []];
  for (const b of balls) held[b.hand].push(b.index);
  return { balls, held };
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * 舞台の幕の開き（1 = 開いている）。完走（done）なら show-complete からの経過 t で
 * 閉じる → 少し止める → 上がる。動きを減らす設定では上がった 1 枚。
 */
function curtainOpen(t: number, done: boolean, reduce: boolean): number {
  if (!done || reduce || t < 0) return 1;
  if (t < CURTAIN_MS) return 1 - easeInOut(t / CURTAIN_MS);
  if (t < CURTAIN_MS + CURTAIN_HOLD_MS) return 0;
  if (t < CURTAIN_MS * 2 + CURTAIN_HOLD_MS) return easeInOut((t - CURTAIN_MS - CURTAIN_HOLD_MS) / CURTAIN_MS);
  return 1;
}

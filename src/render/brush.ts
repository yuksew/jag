// ink（手描き）と paint（塗り）用の描画部品。
// ジッタやノイズはここで作るが、呼び出し側がオフスクリーンにキャッシュするか、
// 低頻度で作り直した乱数（seed）を渡すことでフレームごとの計算を避ける。
import { darken, lighten, mix, parseColor, rgba, type RGBA } from './palette';

export type Rnd = () => number;

export interface Pt {
  x: number;
  y: number;
}

/** 決まった並びの乱数（線形合同法）。seed が同じなら同じ絵になる */
export function lcg(seed: number): Rnd {
  let s = (seed * 2654435761 + 12345) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 低周波の揺れ。t が 0〜1 を一周すると継ぎ目なく戻る（整数周期の正弦の和）。値は −1〜1 程度 */
export function makeWave(rnd: Rnd, octaves = 3): (t: number) => number {
  const comps: { k: number; p: number; a: number }[] = [];
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const a = 1 / (i + 1);
    comps.push({ k: 1 + Math.floor(rnd() * 3) + i * 2, p: rnd() * Math.PI * 2, a });
    norm += a;
  }
  return (t) => {
    let v = 0;
    for (const c of comps) v += c.a * Math.sin(t * Math.PI * 2 * c.k + c.p);
    return v / norm;
  };
}

/** 少し歪んだ円の点列。amp は半径に対する揺れの割合 */
export function wobblyCircle(rnd: Rnd, cx: number, cy: number, r: number, amp: number, n = 40): Pt[] {
  const wave = makeWave(rnd);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const rr = r * (1 + amp * wave(t));
    const a = t * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  return pts;
}

/** 少し歪んだ楕円の点列 */
export function wobblyEllipse(rnd: Rnd, cx: number, cy: number, rx: number, ry: number, amp: number, n = 40): Pt[] {
  const wave = makeWave(rnd);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const k = 1 + amp * wave(t);
    const a = t * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k });
  }
  return pts;
}

/** 点列を step 間隔で打ち直す（折れ線の各辺を分割） */
export function resample(pts: readonly Pt[], step: number, closed = false): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = pts[i] as Pt;
    const b = pts[(i + 1) % n] as Pt;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const seg = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < seg; k++) {
      const t = k / seg;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  if (!closed) out.push(pts[n - 1] as Pt);
  return out;
}

/** 点列を法線方向にゆらす（amp は px） */
export function wobble(rnd: Rnd, pts: readonly Pt[], amp: number, closed = false): Pt[] {
  const wave = makeWave(rnd);
  const n = pts.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i] as Pt;
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)] as Pt;
    const b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)] as Pt;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const d = amp * wave(i / n);
    out.push({ x: p.x - (dy / l) * d, y: p.y + (dx / l) * d });
  }
  return out;
}

/** 2 点を結ぶ揺れた線 */
export function wobblyLine(rnd: Rnd, a: Pt, b: Pt, amp: number, step = 8): Pt[] {
  return wobble(rnd, resample([a, b], step), amp);
}

/** 3 次ベジェを n 分割 */
export function bezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 12): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return out;
}

/** 2 次ベジェを n 分割 */
export function quad(p0: Pt, p1: Pt, p2: Pt, n = 10): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({ x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y });
  }
  return out;
}

export function tracePath(g: CanvasRenderingContext2D | Path2D, pts: readonly Pt[], closed: boolean): void {
  const p0 = pts[0];
  if (!p0) return;
  g.moveTo(p0.x, p0.y);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i] as Pt;
    g.lineTo(p.x, p.y);
  }
  if (closed) g.closePath();
}

export interface InkOptions {
  color: string;
  /** 基準の太さ（px） */
  width: number;
  /** 太さの揺れ（0〜1）。1 で 0〜2 倍 */
  vary?: number;
  closed?: boolean;
  /** 開いた線の両端を細くする */
  taper?: boolean;
}

/**
 * 太さが揺れるインクの線。点列に沿って幅の変わる帯を作り、塗りつぶす。
 * 閉じた線は外周と内周の 2 つのループを evenodd で塗る。
 */
export function inkStroke(g: CanvasRenderingContext2D, rnd: Rnd, pts: readonly Pt[], o: InkOptions): void {
  const n = pts.length;
  if (n < 2) return;
  const closed = o.closed ?? false;
  const vary = o.vary ?? 0.5;
  const wave = makeWave(rnd, 2);
  const left: Pt[] = new Array<Pt>(n);
  const right: Pt[] = new Array<Pt>(n);
  for (let i = 0; i < n; i++) {
    const p = pts[i] as Pt;
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)] as Pt;
    const b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)] as Pt;
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    let w = o.width * (1 + vary * wave(i / n));
    if (o.taper && !closed) {
      const t = i / (n - 1);
      w *= Math.sqrt(Math.min(1, t * 5, (1 - t) * 5));
    }
    w = Math.max(0.35, w) / 2;
    left[i] = { x: p.x - dy * w, y: p.y + dx * w };
    right[i] = { x: p.x + dy * w, y: p.y - dx * w };
  }
  g.fillStyle = o.color;
  g.beginPath();
  if (closed) {
    tracePath(g, left, true);
    tracePath(g, right, true);
    g.fill('evenodd');
  } else {
    tracePath(g, left, false);
    for (let i = n - 1; i >= 0; i--) {
      const p = right[i] as Pt;
      g.lineTo(p.x, p.y);
    }
    g.closePath();
    g.fill();
  }
}

/** 揺れた円をインクで一周 */
export function inkCircle(g: CanvasRenderingContext2D, rnd: Rnd, cx: number, cy: number, r: number, o: InkOptions, amp = 0.03): void {
  inkStroke(g, rnd, wobblyCircle(rnd, cx, cy, r, amp, Math.max(24, Math.min(72, Math.round(r * 1.2)))), { ...o, closed: true });
}

/** 揺れた線をインクで 1 本 */
export function inkLine(g: CanvasRenderingContext2D, rnd: Rnd, a: Pt, b: Pt, o: InkOptions, amp = 1.2): void {
  inkStroke(g, rnd, wobblyLine(rnd, a, b, amp), { taper: true, ...o, closed: false });
}

export interface HatchOptions {
  color: string;
  /** 線の向き（ラジアン） */
  angle: number;
  spacing: number;
  width?: number;
  /** 線を置く範囲。中心から法線方向のオフセット（px）。省略で全体 */
  range?: [number, number];
  /** 端点のずれ（px） */
  jitter?: number;
}

/**
 * ハッチング（斜線）。clip の内側に angle 方向の線を spacing 間隔で引く。
 * box は clip を含む矩形（線を引く範囲の見積もりに使う）。
 */
export function hatch(
  g: CanvasRenderingContext2D,
  rnd: Rnd,
  clip: Path2D,
  box: { x: number; y: number; w: number; h: number },
  o: HatchOptions,
): void {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const half = Math.hypot(box.w, box.h) / 2 + 2;
  const dx = Math.cos(o.angle);
  const dy = Math.sin(o.angle);
  const nx = -dy;
  const ny = dx;
  const [k0, k1] = o.range ?? [-half, half];
  const jit = o.jitter ?? 1.5;
  const w = o.width ?? 1;
  g.save();
  g.clip(clip);
  g.strokeStyle = o.color;
  g.lineCap = 'round';
  for (let k = k0; k <= k1; k += o.spacing * (0.85 + rnd() * 0.3)) {
    const ox = cx + nx * k;
    const oy = cy + ny * k;
    const len = half * (0.9 + rnd() * 0.2);
    g.lineWidth = w * (0.7 + rnd() * 0.6);
    g.beginPath();
    g.moveTo(ox - dx * len + (rnd() - 0.5) * jit, oy - dy * len + (rnd() - 0.5) * jit);
    g.lineTo(ox + dx * len + (rnd() - 0.5) * jit, oy + dy * len + (rnd() - 0.5) * jit);
    g.stroke();
  }
  g.restore();
}

/** 水彩の塗り。輪郭より少し外へはみ出し、縁が濃い */
export function wash(g: CanvasRenderingContext2D, pts: readonly Pt[], color: string, alpha: number, edge = 0.5): void {
  g.fillStyle = rgba(color, alpha);
  g.beginPath();
  tracePath(g, pts, true);
  g.fill();
  if (edge > 0) {
    g.strokeStyle = rgba(color, alpha * edge);
    g.lineWidth = 1.6;
    g.lineJoin = 'round';
    g.stroke();
  }
}

const paperCache = new Map<string, HTMLCanvasElement>();

/** 紙のテクスチャ（タイル）。斑点と繊維。ink 色を薄く置く */
export function paperTile(dpr: number, ink: string, dark: boolean): HTMLCanvasElement {
  const key = `${dpr}|${ink}|${dark ? 'd' : 'l'}`;
  const hit = paperCache.get(key);
  if (hit) return hit;
  const size = 192;
  const c = document.createElement('canvas');
  c.width = Math.ceil(size * dpr);
  c.height = Math.ceil(size * dpr);
  const g = c.getContext('2d');
  if (g) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rnd = lcg(91);
    const grain = parseColor(ink);
    for (let i = 0; i < 1400; i++) {
      const a = (dark ? 0.05 : 0.04) + rnd() * (dark ? 0.09 : 0.07);
      g.fillStyle = rgba(grain, a);
      const s = 0.5 + rnd() * 1.3;
      g.fillRect(rnd() * size, rnd() * size, s, s);
    }
    // 明るい斑点（紙の凹凸）
    g.fillStyle = dark ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 500; i++) {
      const s = 0.6 + rnd() * 1.6;
      g.fillRect(rnd() * size, rnd() * size, s, s);
    }
    // 繊維
    g.strokeStyle = rgba(grain, dark ? 0.08 : 0.06);
    g.lineWidth = 0.6;
    for (let i = 0; i < 70; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const a = rnd() * Math.PI;
      const l = 4 + rnd() * 14;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
  }
  paperCache.set(key, c);
  return c;
}

/** 紙のテクスチャを矩形に敷く */
export function paper(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dpr: number, ink: string, dark: boolean): void {
  const tile = paperTile(dpr, ink, dark);
  const pat = g.createPattern(tile, 'repeat');
  if (!pat) return;
  pat.setTransform(new DOMMatrix().scale(1 / dpr));
  g.fillStyle = pat;
  g.fillRect(x, y, w, h);
}

/** 筆跡（楕円 1 つ） */
export function daub(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, angle: number, fill: string): void {
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, Math.max(0.2, rx), Math.max(0.2, ry), angle, 0, Math.PI * 2);
  g.fill();
}

/** 筆のストローク。a から b へ短い楕円を重ねる。幅と位置が少し揺れる */
export function brushStroke(
  g: CanvasRenderingContext2D,
  rnd: Rnd,
  a: Pt,
  b: Pt,
  width: number,
  color: string,
  alpha: number,
  step = 0,
): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  const st = step || Math.max(2, width * 0.45);
  const n = Math.max(1, Math.ceil(len / st));
  const fill = rgba(color, alpha);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = width * (0.75 + rnd() * 0.4) * (0.7 + 0.3 * Math.sin(t * Math.PI));
    daub(
      g,
      a.x + dx * t + (rnd() - 0.5) * width * 0.15,
      a.y + dy * t + (rnd() - 0.5) * width * 0.15,
      w * 0.9,
      w * 0.5,
      ang + (rnd() - 0.5) * 0.3,
      fill,
    );
  }
}

/** 彩度と明るさを動かす（HSL）。paint で色の幅を広げるため */
export function vivid(c: RGBA | string, satMul: number, lightAdd: number): RGBA {
  const [r0, g0, b0, a] = typeof c === 'string' ? parseColor(c) : c;
  const r = r0 / 255;
  const g = g0 / 255;
  const b = b0 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;
  const d = max - min;
  if (d > 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  s = Math.min(1, Math.max(0, s * satMul));
  l = Math.min(1, Math.max(0, l + lightAdd));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t0: number): number => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255, a];
}

/** 塗りの「リムライト」色。色相を少し暖かい方へ寄せた明るい色 */
export function rimColor(c: RGBA | string, warm: string): RGBA {
  return lighten(mix(c, warm, 0.45), 0.35);
}

/** 塗りの影色。少し冷たく暗く */
export function shadeColor(c: RGBA | string, cool: string, amount = 0.35): RGBA {
  return darken(mix(c, cool, 0.3), amount);
}

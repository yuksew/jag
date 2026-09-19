// CSS 変数の色をまとめて読み、テーマ変更まで使い回す。毎フレーム getComputedStyle を呼ばない。

export type RGBA = [number, number, number, number];

const NAMES = ['bg', 'panel', 'panel2', 'ink', 'muted', 'line', 'amber', 'coral', 'sky', 'ivory', 'ok', 'bad', 'ring'] as const;
export type PaletteName = (typeof NAMES)[number];

export type Palette = Record<PaletteName, string> & {
  /** 背景が暗いテーマか */
  dark: boolean;
  /** パーティクル・残像・揺れを止めるか */
  reduceMotion: boolean;
};

const FALLBACK: Record<PaletteName, string> = {
  bg: '#E9E3D6',
  panel: '#F6F2EA',
  panel2: '#EDE6D8',
  ink: '#22343A',
  muted: '#66797E',
  line: '#D3C9B5',
  amber: '#B8791E',
  coral: '#D85A40',
  sky: '#3C8FA5',
  ivory: '#FBF6EA',
  ok: '#3E8C5C',
  bad: '#C2452C',
  ring: 'rgba(34,52,58,.18)',
};

function reducedMotionQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
}

function colorSchemeQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
}

export function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const out = {} as Record<PaletteName, string>;
  for (const n of NAMES) {
    const v = cs.getPropertyValue(`--${n}`).trim();
    out[n] = v || FALLBACK[n];
  }
  const reduce = document.documentElement.classList.contains('reduce-motion') || (reducedMotionQuery()?.matches ?? false);
  return { ...out, dark: luminance(parseColor(out.bg)) < 0.5, reduceMotion: reduce };
}

/**
 * テーマやモーション設定が変わったら onChange を呼ぶ。
 * data-theme 属性・class の変更と、OS のカラースキーム／モーション設定を見張る。
 */
export function watchPalette(onChange: () => void): void {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  colorSchemeQuery()?.addEventListener('change', onChange);
  reducedMotionQuery()?.addEventListener('change', onChange);
}

const cache = new Map<string, RGBA>();

/** #rgb / #rrggbb / #rrggbbaa / rgb() / rgba() を数値に。読めなければ灰色 */
export function parseColor(s: string): RGBA {
  const hit = cache.get(s);
  if (hit) return hit;
  let c: RGBA = [128, 128, 128, 1];
  const t = s.trim();
  if (t.startsWith('#')) {
    const h = t.slice(1);
    if (h.length === 3 || h.length === 4) {
      const p = (i: number): number => parseInt((h[i] ?? '0').repeat(2), 16);
      c = [p(0), p(1), p(2), h.length === 4 ? p(3) / 255 : 1];
    } else if (h.length === 6 || h.length === 8) {
      const p = (i: number): number => parseInt(h.slice(i, i + 2), 16);
      c = [p(0), p(2), p(4), h.length === 8 ? p(6) / 255 : 1];
    }
  } else {
    const m = /rgba?\(([^)]+)\)/.exec(t);
    if (m?.[1]) {
      const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      c = [parts[0] ?? 128, parts[1] ?? 128, parts[2] ?? 128, parts[3] ?? 1];
    }
  }
  cache.set(s, c);
  return c;
}

export function rgba(c: RGBA | string, alpha?: number): string {
  const [r, g, b, a] = typeof c === 'string' ? parseColor(c) : c;
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha ?? a})`;
}

/** a と b を t（0〜1）で混ぜる */
export function mix(a: RGBA | string, b: RGBA | string, t: number): RGBA {
  const x = typeof a === 'string' ? parseColor(a) : a;
  const y = typeof b === 'string' ? parseColor(b) : b;
  return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t, x[3] + (y[3] - x[3]) * t];
}

export function lighten(c: RGBA | string, t: number): RGBA {
  return mix(c, [255, 255, 255, 1], t);
}

export function darken(c: RGBA | string, t: number): RGBA {
  return mix(c, [0, 0, 0, 1], t);
}

function luminance([r, g, b]: RGBA): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

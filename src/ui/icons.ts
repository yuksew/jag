// UI の単色アイコン（インライン SVG、currentColor）。外部リソースを読まない（docs/ART.md）
import type { Branch, CurrencyKey, TabId } from '../core';

const wrap = (body: string, cls = ''): string =>
  `<svg class="ic${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

/** 通貨（キャッチ・クリーン・コア・体得点）と拍手 */
export const CURRENCY_ICON: Record<CurrencyKey | 'applause', string> = {
  // 手のひらに球
  catch: wrap('<circle cx="12" cy="6.5" r="3"/><path d="M4 14c2.5 0 4 1.5 5.5 3M4 14v6M4 14c0-1 .8-1.8 1.8-1.8H14c1.2 0 2 .8 2 2s-.8 2-2 2h-3.5M14 16.2l4.6-2.1c1-.5 2.1 0 2.4 1 .3.9-.2 1.8-1 2.2L13 20.5H9"/>'),
  // きらめき
  clean: wrap('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" fill="currentColor" stroke="none"/>'),
  // 六角の核
  core: wrap('<path d="M12 2.5l8 4.6v9.8l-8 4.6-8-4.6V7.1z"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>'),
  // 星（体得）
  sp: wrap('<path d="M12 2.8l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.7l-5.6 3.1 1.3-6.2L3 9.3l6.3-.7z"/>'),
  // 拍手
  applause: wrap('<path d="M7 11.5V6a1.6 1.6 0 013.2 0v4M10.2 10V4.6a1.6 1.6 0 013.2 0V10M13.4 10V5.6a1.6 1.6 0 013.2 0v6M16.6 11.6V8.4a1.6 1.6 0 013.2 0V15c0 3.9-2.9 6.5-6.6 6.5S6.6 19 6.6 15v-2.4a1.6 1.6 0 013.2 0"/><path d="M3 5l1.5 1.5M2.5 9H4.5M4 2.5l.7 2"/>'),
};

/** タブ */
export const TAB_ICON: Record<TabId, string> = {
  // 放物線と球
  practice: wrap('<path d="M4 18c2-9 6-13 8-13s6 4 8 13"/><circle cx="12" cy="5.5" r="2.2" fill="currentColor" stroke="none"/><path d="M3 20h18"/>'),
  // 人
  body: wrap('<circle cx="12" cy="5" r="2.6"/><path d="M6 11l4-1.5h4l4 1.5M10 9.5v11M14 9.5v11M10 15h4"/>'),
  // ノート
  record: wrap('<path d="M6 3.5h11.5a1 1 0 011 1v15a1 1 0 01-1 1H6a1.5 1.5 0 01-1.5-1.5V5A1.5 1.5 0 016 3.5z"/><path d="M8.5 8h6M8.5 11.5h6M8.5 15h4"/>'),
  // クラブ
  club: wrap('<path d="M13.5 3.5c1.6 0 2.8 1.4 2.4 3l-2.6 9.3-2.3-.7L12.8 6c.2-1.5-.1-2.5.7-2.5z"/><path d="M10.9 15.1l2.4.7-1.2 4.4a1.3 1.3 0 01-2.5-.7z"/><circle cx="8.6" cy="19.2" r="1.2"/>'),
  // 街灯
  street: wrap('<path d="M12 21V8M8 21h8"/><path d="M12 8c-2.5 0-4-1.5-4-4h8c0 2.5-1.5 4-4 4z"/><path d="M5 12l1.5-1M19 12l-1.5-1M4 8h2M18 8h2"/>'),
  // 往復の矢印
  passing: wrap('<path d="M4 9h13l-3-3M20 15H7l3 3"/>'),
  // 幕
  stage: wrap('<path d="M3 4h18M4 4v16M20 4v16"/><path d="M4 4c3 3 3 8 0 12M20 4c-3 3-3 8 0 12"/><path d="M8 4c1.5 2 2 4.5 2 6s-.5 4-2 6M16 4c-1.5 2-2 4.5-2 6s.5 4 2 6"/><path d="M7 20h10"/>'),
};

/** ツリーの系統 */
export const BRANCH_ICON: Record<Branch, string> = {
  hand: wrap('<path d="M8 13V5.5a1.5 1.5 0 013 0V11M11 11V4a1.5 1.5 0 013 0v7M14 11V5.5a1.5 1.5 0 013 0V13M17 13v-2a1.5 1.5 0 013 0v5c0 3.5-2.7 6-6.5 6S7 19.5 7 16v-3.5"/><path d="M8 13l-2.4-2.4a1.4 1.4 0 00-2 2L7 16"/>'),
  eye: wrap('<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="3"/>'),
  trunk: wrap('<circle cx="12" cy="4.5" r="2"/><path d="M12 7v6M8.5 9l3.5 2 3.5-2M12 13l-3 7M12 13l3 7"/>'),
  memory: wrap('<path d="M9 4.5a3 3 0 00-3 3 3 3 0 00-1.5 5.5A3 3 0 006 18a3 3 0 003 3h3V4.5zM15 4.5a3 3 0 013 3 3 3 0 011.5 5.5A3 3 0 0118 18a3 3 0 01-3 3h-3V4.5z"/>'),
  expr: wrap('<path d="M12 3.5l2 4 4.4.6-3.2 3.1.8 4.4-4-2.1-4 2.1.8-4.4L5.6 8.1 10 7.5z"/><path d="M4 18c2.5 2 5 3 8 3s5.5-1 8-3"/>'),
};

/** 鍵 */
export const LOCK_ICON = wrap('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/><circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none"/>', 'lock');
/** 開いた鍵 */
export const UNLOCK_ICON = wrap('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 017.6-1.7"/>', 'lock');
/** チェック（丸） */
export const CHECK_ICON = wrap('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/>', 'check');
/** 空の丸（未達） */
export const CIRCLE_ICON = wrap('<circle cx="12" cy="12" r="9"/>', 'check');
/** 完走のトロフィー */
export const TROPHY_ICON = wrap('<path d="M7 4h10v5a5 5 0 01-10 0z"/><path d="M7 6H4.5a2.5 2.5 0 002.5 4M17 6h2.5a2.5 2.5 0 01-2.5 4M12 14v3M8.5 20h7M10 17h4l1 3H9z"/>', 'trophy');
/** 封印 */
export const SEAL_ICON = wrap('<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12h6M12 9v6"/>');
/** 変換（矢印） */
export const CONVERT_ICON = wrap('<path d="M5 12h13l-4-4M18 12l-4 4"/>');
/** 設定の見出し用 */
export const SETTINGS_ICON: Record<'display' | 'sound' | 'input' | 'lang' | 'save', string> = {
  display: wrap('<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8 20h8M12 16.5V20"/>'),
  sound: wrap('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/>'),
  input: wrap('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h1M11 10h1M15 10h1M8 14h8"/>'),
  lang: wrap('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
  save: wrap('<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>'),
};

/**
 * サイトスワップの小さな図。数値ごとの山の高さを並べる。
 * 1 は手渡しなので低い弧、7 が最高。周期を 1 回ぶん描く（最低 3 山）。
 */
export function siteswapFigure(siteswap: readonly number[]): string {
  const W = 56;
  const H = 26;
  const base = H - 4;
  const n = Math.max(3, siteswap.length);
  const step = W / (n + 0.5);
  let d = '';
  let dots = '';
  for (let i = 0; i < n; i++) {
    const v = siteswap[i % siteswap.length] ?? 3;
    const x0 = step * (i + 0.5);
    const x1 = x0 + step * 0.9;
    const h = v <= 1 ? 3 : 4 + ((v - 1) / 6) * (base - 6);
    d += `M${x0.toFixed(1)} ${base}Q${((x0 + x1) / 2).toFixed(1)} ${(base - h * 2).toFixed(1)} ${x1.toFixed(1)} ${base}`;
    dots += `<circle cx="${x0.toFixed(1)}" cy="${base}" r="1.4"/>`;
  }
  return `<svg class="ss" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><g fill="currentColor">${dots}</g></svg>`;
}

/** 段階の点（●●○○○） */
export function levelDots(level: number, max: number): string {
  let h = '<span class="dots" aria-hidden="true">';
  for (let i = 0; i < max; i++) h += `<i class="${i < level ? 'on' : ''}"></i>`;
  return h + '</span>';
}

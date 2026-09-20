// UI の単色アイコン（インライン SVG、currentColor）。外部リソースを読まない（docs/ART.md）
// 絵柄は「サーカスの興行ポスターと切符」（docs/UI_DIRECTION.md）。通貨は「物」で描く
import type { Branch, CurrencyKey, TabId } from '../core';

const wrap = (body: string, cls = ''): string =>
  `<svg class="ic${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

/** 通貨（キャッチ・クリーン・コア・体得点）と拍手 */
export const CURRENCY_ICON: Record<CurrencyKey | 'applause', string> = {
  // 手のひらと、その上の球
  catch: wrap(
    '<circle cx="12.5" cy="5.6" r="3.1"/>' +
      '<path d="M4.5 13.2c0-1 .8-1.8 1.8-1.8h7.6c1.1 0 2 .9 2 2s-.9 2-2 2h-3.4"/>' +
      '<path d="M4.5 13.2v5.4c0 1.7 1.3 2.9 3 2.9h6.6c1.3 0 2.5-.7 3.1-1.8l2.4-4.1c.5-.9.2-2-.7-2.5-.8-.4-1.8-.1-2.3.7l-1.9 2.6"/>',
  ),
  // 星形の判子（押した跡）
  clean: wrap(
    '<path d="M12 3.6l2.4 5 5.5.6-4.1 3.8 1.1 5.4L12 15.7l-4.9 2.7 1.1-5.4-4.1-3.8 5.5-.6z" fill="currentColor" stroke="none"/>' +
      '<circle cx="12" cy="12" r="10" stroke-dasharray="2.2 2.4"/>',
  ),
  // 金貨（縁と内側の輪、真ん中に刻印）
  core: wrap(
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6" stroke-width="1.2"/>' +
      '<path d="M12 8.6l2 2-2 2-2-2z" fill="currentColor" stroke="none"/><path d="M9.5 15.4h5" stroke-width="1.2"/>',
  ),
  // リボン章（円章と 2 本のリボン）
  sp: wrap(
    '<circle cx="12" cy="8.6" r="5.6"/>' +
      '<path d="M12 5.4l.9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.5 2.1-.3z" fill="currentColor" stroke="none"/>' +
      '<path d="M9.2 13.4L7.6 21l4.4-2.2 4.4 2.2-1.6-7.6"/>',
  ),
  // 手袋 2 つ（拍手）
  applause: wrap(
    '<path d="M2.6 12.2V8.6a1.3 1.3 0 012.6 0v3.4M5.2 11.6V6.8a1.3 1.3 0 012.6 0v4.8M7.8 11.4V8a1.3 1.3 0 012.6 0v5.4c0 2.9-1.9 5-4.6 5-2.1 0-3.4-1.2-4.1-2.9L.9 13.3"/>' +
      '<path d="M21.4 12.2V8.6a1.3 1.3 0 00-2.6 0v3.4M18.8 11.6V6.8a1.3 1.3 0 00-2.6 0v4.8M16.2 11.4V8a1.3 1.3 0 00-2.6 0v5.4c0 2.9 1.9 5 4.6 5 2.1 0 3.4-1.2 4.1-2.9l.8-2.2"/>' +
      '<path d="M11 4.2l1 1.6M13 4.2l-1 1.6" stroke-width="1.4"/>',
  ),
};

/** タブ */
export const TAB_ICON: Record<TabId, string> = {
  // 放物線と球
  practice: wrap('<path d="M4 18c2-9 6-13 8-13s6 4 8 13"/><circle cx="12" cy="5.5" r="2.2" fill="currentColor" stroke="none"/><path d="M3 20h18"/>'),
  // 人
  body: wrap('<circle cx="12" cy="5" r="2.6"/><path d="M6 11l4-1.5h4l4 1.5M10 9.5v11M14 9.5v11M10 15h4"/>'),
  // 帳面
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
/** 朱印（達成の印。かすれた縁とチェック） */
export const STAMP_ICON = wrap(
  '<circle cx="12" cy="12" r="9.6" stroke-width="2" stroke-dasharray="7 1.6 3 1.2 9 1.4 5 1.1"/><path d="M7.6 12.4l3 3 5.8-6.4" stroke-width="2.2"/>',
  'stamp',
);
/** 完走のトロフィー（互換のため残す） */
export const TROPHY_ICON = wrap('<path d="M7 4h10v5a5 5 0 01-10 0z"/><path d="M7 6H4.5a2.5 2.5 0 002.5 4M17 6h2.5a2.5 2.5 0 01-2.5 4M12 14v3M8.5 20h7M10 17h4l1 3H9z"/>', 'trophy');
/** 封印 */
export const SEAL_ICON = wrap('<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12h6M12 9v6"/>');
/** 変換（矢印） */
export const CONVERT_ICON = wrap('<path d="M5 12h13l-4-4M18 12l-4 4"/>');
/** 投げ銭の帽子（山高帽を伏せた形） */
export const HAT_ICON = wrap('<path d="M3.5 14.5h17"/><path d="M6 14.5c0-4.5 2.4-8.5 6-8.5s6 4 6 8.5"/><path d="M6.5 14.5l.8 4c.2.9.9 1.5 1.8 1.5h5.8c.9 0 1.6-.6 1.8-1.5l.8-4"/><path d="M9 6.8c1-.6 2-.8 3-.8s2 .2 3 .8" stroke-width="1.2"/>');
/** 相方の顔（札に描く） */
export const PARTNER_ICON = wrap(
  '<circle cx="12" cy="11" r="7.5"/><path d="M6 8.5c1.5-2.5 3.5-3.5 6-3.5s4.5 1 6 3.5" stroke-width="1.4"/>' +
    '<circle cx="9.5" cy="11.2" r=".9" fill="currentColor" stroke="none"/><circle cx="14.5" cy="11.2" r=".9" fill="currentColor" stroke="none"/>' +
    '<path d="M9.5 14.2c.8.9 1.6 1.3 2.5 1.3s1.7-.4 2.5-1.3"/><path d="M5 21.5c1.5-1.8 4-2.8 7-2.8s5.5 1 7 2.8"/>',
);
/** 幕（見出しの飾り） */
export const CURTAIN_ICON = TAB_ICON.stage;
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

/** 段階の判子（押した分が琥珀インク） */
export function levelStamps(level: number, max: number): string {
  let h = '<span class="stamps" aria-hidden="true">';
  for (let i = 0; i < max; i++) h += `<i class="${i < level ? 'on' : ''}"></i>`;
  return h + '</span>';
}

/** 互換名（段階の点） */
export const levelDots = levelStamps;

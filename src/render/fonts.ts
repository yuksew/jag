// Canvas で使う書体。表示用（"Sankyu Display"）と数字用（"Sankyu Numbers"）は UI 側が
// src/assets/fonts/ に同梱して @font-face で定義する。Canvas の fillText は @font-face の読み込みを
// 起こさないので、document.fonts.load で先に読む。family が無くても後続のフォールバックで描ける。

const FALLBACK = '"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP",system-ui,sans-serif';

/** 本文（判定文字・浮かぶ数字） */
export const TEXT_FONT = `"Sankyu Text","Zen Kaku Gothic New",${FALLBACK}`;
/** 見出し・横断幕・看板 */
export const DISPLAY_FONT = `"Sankyu Display","Sankyu Text","Zen Kaku Gothic New",${FALLBACK}`;
/** 数字（欧文スラブ）。日本語は含まないので表示用へ落ちる */
export const NUMBER_FONT = `"Sankyu Numbers","Sankyu Display","Sankyu Text",${FALLBACK}`;

const SPECS = ['700 16px "Sankyu Display"', '400 16px "Sankyu Numbers"', '700 16px "Sankyu Text"', '400 16px "Sankyu Text"'];

let started = false;
let version = 0;

/**
 * 同梱書体の読み込みを始める（1 回だけ）。読み込めた書体があるたびに fontsVersion が進むので、
 * 文字を焼き込んだキャッシュはそれを見て作り直す。document.fonts が無い環境では何もしない。
 */
export function loadFonts(): void {
  if (started) return;
  started = true;
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!fonts || typeof fonts.load !== 'function') return;
  for (const spec of SPECS) {
    fonts
      .load(spec)
      .then((faces) => {
        if (faces.length) version++;
      })
      .catch(() => {
        // family が定義されていない、または読めない。フォールバックで描く
      });
  }
}

/** 読み込み済み書体の世代。変わったら文字入りのキャッシュを捨てる */
export function fontsVersion(): number {
  return version;
}

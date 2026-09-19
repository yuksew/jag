// 絵柄の切り替え。<html data-art-style="ink|paint"> を読む。無ければ 'vector'（現在の絵）。
// palette.ts と同じく MutationObserver で変更を拾い、キャッシュを捨てる合図を出す。

export type ArtStyle = 'vector' | 'ink' | 'paint';

const STYLES: readonly ArtStyle[] = ['vector', 'ink', 'paint'];

let cached: ArtStyle | null = null;

function read(): ArtStyle {
  const v = document.documentElement.dataset['artStyle'];
  return (STYLES as readonly string[]).includes(v ?? '') ? (v as ArtStyle) : 'vector';
}

/** 現在の絵柄。属性が変わるまで使い回す */
export function currentStyle(): ArtStyle {
  if (cached === null) cached = read();
  return cached;
}

/** data-art-style が変わったら onChange を呼ぶ（キャッシュはその場で捨てる） */
export function watchStyle(onChange: () => void): void {
  const mo = new MutationObserver(() => {
    const next = read();
    if (next === cached) return;
    cached = next;
    onChange();
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-art-style'] });
}

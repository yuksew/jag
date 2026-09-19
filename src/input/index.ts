// キーボード（Space / Enter）とポインタを 1 つの「投げる」に束ねる。
// ゲームパッドとオフセット補正は M3。
export interface ThrowInput {
  dispose(): void;
}

export function bindThrowInput(canvas: HTMLElement, onThrow: () => void): ThrowInput {
  const onPointer = (e: PointerEvent) => {
    e.preventDefault();
    onThrow();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code !== 'Space' && e.code !== 'Enter') return;
    // ボタンにフォーカスがある Enter はボタンに任せる
    if (e.code === 'Enter' && e.target instanceof HTMLButtonElement) return;
    if (e.repeat) return;
    e.preventDefault();
    onThrow();
  };
  canvas.addEventListener('pointerdown', onPointer);
  window.addEventListener('keydown', onKey);
  return {
    dispose() {
      canvas.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    },
  };
}

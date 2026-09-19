// キーボード（設定のキー）とポインタを 1 つの「投げる」に束ねる。
// ゲームパッドは gamepad.ts（毎フレーム poll）、オフセット補正は calibrate.ts。
export interface ThrowInput {
  setKeys(codes: readonly string[]): void;
  dispose(): void;
}

export function bindThrowInput(canvas: HTMLElement, onThrow: () => void, initialKeys: readonly string[]): ThrowInput {
  let keys = new Set(initialKeys);
  const onPointer = (e: PointerEvent) => {
    e.preventDefault();
    onThrow();
  };
  const onKey = (e: KeyboardEvent) => {
    if (!keys.has(e.code)) return;
    // ボタンにフォーカスがある Enter はボタンに任せる。入力欄では何もしない
    if (e.code === 'Enter' && e.target instanceof HTMLButtonElement) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (e.repeat) return;
    e.preventDefault();
    onThrow();
  };
  canvas.addEventListener('pointerdown', onPointer);
  window.addEventListener('keydown', onKey);
  return {
    setKeys(codes) {
      keys = new Set(codes);
    },
    dispose() {
      canvas.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    },
  };
}

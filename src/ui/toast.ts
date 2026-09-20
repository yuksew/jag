const SHOW_MS = 1900;

/** 札の色。clean = クリーン獲得、core = コア獲得、applause = 拍手、note = それ以外（紙色） */
export type ToastKind = 'note' | 'clean' | 'core' | 'applause';

/** 練習場の上に出る短い通知。「幕間の看板」— 紙の札が紐で降りて揺れる。出入りは CSS（.show の transition / animation） */
export class Toast {
  private timer: number | undefined;

  constructor(private readonly el: HTMLElement) {
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    this.el.innerHTML = '<span class="string"></span><span class="tag"></span>';
  }

  show(message: string, kind: ToastKind = 'note'): void {
    const tag = this.el.querySelector<HTMLElement>('.tag');
    if (tag) tag.textContent = message;
    else this.el.textContent = message;
    this.el.dataset['kind'] = kind;
    // 連続表示でも毎回「降りてくる」動きを見せる
    this.el.classList.remove('show');
    void this.el.offsetWidth;
    this.el.classList.add('show');
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.el.classList.remove('show'), SHOW_MS);
  }
}

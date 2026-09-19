const SHOW_MS = 1800;

/** 練習場の上に出る短い通知。出入りは CSS（.show の transition） */
export class Toast {
  private timer: number | undefined;

  constructor(private readonly el: HTMLElement) {
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
  }

  show(message: string): void {
    this.el.textContent = message;
    // 連続表示でも毎回「出る」動きを見せる
    this.el.classList.remove('show');
    void this.el.offsetWidth;
    this.el.classList.add('show');
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.el.classList.remove('show'), SHOW_MS);
  }
}

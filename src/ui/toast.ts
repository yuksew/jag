const SHOW_MS = 1800;

export class Toast {
  private timer: number | undefined;

  constructor(private readonly el: HTMLElement) {}

  show(message: string): void {
    this.el.textContent = message;
    this.el.classList.add('show');
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.el.classList.remove('show'), SHOW_MS);
  }
}

// ゲームパッド（Gamepad API）。毎フレーム poll して、ボタンの押し始めをイベントにする。
// 標準配置: 0 = A（南）、1 = B（東）、4 = LB、5 = RB
export interface GamepadHandlers {
  onThrow: () => void;
  onBack?: () => void;
  onTabPrev?: () => void;
  onTabNext?: () => void;
}

const BUTTON = { south: 0, east: 1, lb: 4, rb: 5 } as const;

export class GamepadInput {
  private readonly pressed = new Map<string, boolean>();
  /** 直近に何か押されたか（操作方法の自動判別に使う） */
  active = false;

  constructor(private readonly handlers: GamepadHandlers) {}

  poll(): void {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    for (const pad of pads) {
      if (!pad) continue;
      this.edge(pad, BUTTON.south, this.handlers.onThrow);
      this.edge(pad, BUTTON.east, this.handlers.onBack);
      this.edge(pad, BUTTON.lb, this.handlers.onTabPrev);
      this.edge(pad, BUTTON.rb, this.handlers.onTabNext);
    }
  }

  private edge(pad: Gamepad, index: number, handler: (() => void) | undefined): void {
    const key = `${pad.index}:${index}`;
    const b = pad.buttons[index];
    const down = b ? b.pressed || b.value > 0.5 : false;
    const was = this.pressed.get(key) ?? false;
    if (down && !was) {
      this.active = true;
      handler?.();
    }
    this.pressed.set(key, down);
  }
}

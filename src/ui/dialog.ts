// 最小のモーダル。セーブ復元の確認などに使う
export interface DialogChoice<T> {
  label: string;
  value: T;
  primary?: boolean;
}

export function askDialog<T>(message: string, choices: DialogChoice<T>[]): Promise<T> {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'dialog-back';
    const box = document.createElement('div');
    box.className = 'dialog';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    const p = document.createElement('p');
    p.className = 'msg';
    p.textContent = message;
    const actions = document.createElement('div');
    actions.className = 'actions';
    let primary: HTMLButtonElement | null = null;
    for (const c of choices) {
      const b = document.createElement('button');
      b.className = c.primary ? 'btn' : 'btn ghost';
      b.textContent = c.label;
      b.onclick = () => {
        back.remove();
        resolve(c.value);
      };
      if (c.primary) primary = b;
      actions.append(b);
    }
    box.append(p, actions);
    back.append(box);
    document.body.append(back);
    // Tab / Enter で選べるように、最初のフォーカスを主ボタンに置く
    (primary ?? actions.querySelector<HTMLButtonElement>('button'))?.focus();
  });
}

// 設定画面（モーダル）。表示・音・入力・言語・セーブ。
import { defaultSettings, type Lang, type Settings } from '../../electron/api';
import { LANGS, lang, t } from '../i18n';
import { esc } from './dom';
import { askDialog } from './dialog';

export interface SettingsActions {
  /** 設定が変わった（保存と反映は呼び出し側） */
  onChange(settings: Settings): void;
  /** 補正を始める。完了時に offsetMs を返す。null なら中止 */
  calibrate(onProgress: (taps: number, need: number) => void): Promise<number | null>;
  cancelCalibration(): void;
  deleteSave(): Promise<void>;
  changeLang(lang: Lang): void;
  /** ラン中か（言語切替を禁止する） */
  running(): boolean;
}

const SCALES = [100, 125, 150];

export class SettingsPanel {
  private root: HTMLElement | null = null;
  private settings: Settings = defaultSettings();
  private calibrating = false;

  constructor(private readonly actions: SettingsActions) {}

  get isOpen(): boolean {
    return this.root !== null;
  }

  open(settings: Settings): void {
    if (this.root) return;
    this.settings = structuredClone(settings);
    const back = document.createElement('div');
    back.className = 'dialog-back';
    const box = document.createElement('div');
    box.className = 'dialog settings';
    back.append(box);
    document.body.append(back);
    this.root = back;
    this.render();
  }

  close(): void {
    if (!this.root) return;
    if (this.calibrating) this.actions.cancelCalibration();
    this.calibrating = false;
    this.root.remove();
    this.root = null;
  }

  private commit(): void {
    this.actions.onChange(structuredClone(this.settings));
    this.render();
  }

  private render(): void {
    const box = this.root?.querySelector<HTMLElement>('.dialog');
    if (!box) return;
    const s = this.settings;
    const ts = t.settings;
    let h = `<div class="settings-head"><h2>${ts.open}</h2><button class="btn ghost" id="st-close">${ts.close}</button></div>`;

    h += `<h3>${ts.display.head}</h3><div class="row">`;
    h += `<label><input type="checkbox" id="st-fullscreen" ${s.display.fullscreen ? 'checked' : ''}> ${ts.display.fullscreen}</label>`;
    h += `<label>${ts.display.scale} <select id="st-scale">${SCALES.map((v) => `<option value="${v}" ${v === s.display.scale ? 'selected' : ''}>${v}%</option>`).join('')}</select></label>`;
    h += `<label><input type="checkbox" id="st-reduce" ${s.display.reduceMotion ? 'checked' : ''}> ${ts.display.reduceMotion}</label>`;
    h += '</div>';

    h += `<h3>${ts.sound.head}</h3><div class="row">`;
    h += `<label>${ts.sound.master} <input type="range" id="st-master" min="0" max="1" step="0.05" value="${s.sound.master}"></label>`;
    h += `<label>${ts.sound.sfx} <input type="range" id="st-sfx" min="0" max="1" step="0.05" value="${s.sound.sfx}"></label>`;
    h += `<label><input type="checkbox" id="st-click" ${s.sound.click ? 'checked' : ''}> ${ts.sound.click}</label>`;
    h += '</div>';

    h += `<h3>${ts.input.head}</h3><div class="row">`;
    h += `<div>${ts.input.offset}: <b id="st-offset">${esc(ts.input.offsetNote(s.input.offsetMs))}</b> `;
    if (this.calibrating) h += `<span id="st-cal-progress"></span> <button class="btn ghost" id="st-cal-cancel">${ts.input.calibrateCancel}</button>`;
    else h += `<button class="btn ghost" id="st-calibrate">${ts.input.calibrate}</button>`;
    h += '</div>';
    h += `<div>${ts.input.throwKey}: <b id="st-keys">${esc(s.input.throwKeys.join(' / '))}</b> <button class="btn ghost" id="st-key">${ts.input.pressKey}</button></div>`;
    h += `<p class="note">${esc(ts.input.keyNote)}<br>${esc(ts.input.gamepad)}</p>`;
    h += '</div>';

    h += `<h3>${ts.lang.head}</h3><div class="row">`;
    h += `<select id="st-lang" ${this.actions.running() ? 'disabled' : ''}>${LANGS.map((l) => `<option value="${l}" ${l === lang ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    h += `<p class="note">${esc(ts.lang.note)}</p></div>`;

    h += `<h3>${ts.save.head}</h3><div class="row"><button class="btn ghost" id="st-delete">${ts.save.delete}</button></div>`;

    box.innerHTML = h;
    this.bind(box);
  }

  private bind(box: HTMLElement): void {
    const q = <T extends HTMLElement>(id: string): T | null => box.querySelector<T>(`#${id}`);
    q<HTMLButtonElement>('st-close')?.addEventListener('click', () => this.close());
    q<HTMLInputElement>('st-fullscreen')?.addEventListener('change', (e) => {
      this.settings.display.fullscreen = (e.target as HTMLInputElement).checked;
      this.commit();
    });
    q<HTMLSelectElement>('st-scale')?.addEventListener('change', (e) => {
      this.settings.display.scale = Number((e.target as HTMLSelectElement).value);
      this.commit();
    });
    q<HTMLInputElement>('st-reduce')?.addEventListener('change', (e) => {
      this.settings.display.reduceMotion = (e.target as HTMLInputElement).checked;
      this.commit();
    });
    q<HTMLInputElement>('st-master')?.addEventListener('input', (e) => {
      this.settings.sound.master = Number((e.target as HTMLInputElement).value);
      this.actions.onChange(structuredClone(this.settings));
    });
    q<HTMLInputElement>('st-sfx')?.addEventListener('input', (e) => {
      this.settings.sound.sfx = Number((e.target as HTMLInputElement).value);
      this.actions.onChange(structuredClone(this.settings));
    });
    q<HTMLInputElement>('st-click')?.addEventListener('change', (e) => {
      this.settings.sound.click = (e.target as HTMLInputElement).checked;
      this.commit();
    });
    q<HTMLButtonElement>('st-calibrate')?.addEventListener('click', () => {
      this.calibrating = true;
      this.render();
      const progress = box.querySelector<HTMLElement>('#st-cal-progress');
      void this.actions
        .calibrate((taps, need) => {
          const el = this.root?.querySelector<HTMLElement>('#st-cal-progress');
          if (el) el.textContent = t.settings.input.calibrating(taps, need);
        })
        .then((offset) => {
          this.calibrating = false;
          if (offset !== null) {
            this.settings.input.offsetMs = offset;
            this.actions.onChange(structuredClone(this.settings));
          }
          this.render();
          if (offset !== null) {
            const el = this.root?.querySelector<HTMLElement>('#st-offset');
            if (el) el.textContent = t.settings.input.calibrateDone(offset);
          }
        });
      if (progress) progress.textContent = t.settings.input.calibrating(0, 8);
    });
    q<HTMLButtonElement>('st-cal-cancel')?.addEventListener('click', () => {
      this.actions.cancelCalibration();
      this.calibrating = false;
      this.render();
    });
    q<HTMLButtonElement>('st-key')?.addEventListener('click', () => {
      const b = q<HTMLButtonElement>('st-key');
      if (b) b.disabled = true;
      const once = (e: KeyboardEvent): void => {
        e.preventDefault();
        window.removeEventListener('keydown', once, true);
        if (e.code === 'Escape') {
          this.render();
          return;
        }
        this.settings.input.throwKeys = [e.code];
        this.commit();
      };
      window.addEventListener('keydown', once, true);
    });
    q<HTMLSelectElement>('st-lang')?.addEventListener('change', (e) => {
      const v = (e.target as HTMLSelectElement).value as Lang;
      if (v !== lang) this.actions.changeLang(v);
    });
    q<HTMLButtonElement>('st-delete')?.addEventListener('click', () => {
      void (async () => {
        const first = await askDialog(t.settings.save.confirm1, [
          { label: t.settings.save.delete, value: true },
          { label: t.buttons.cancel, value: false, primary: true },
        ]);
        if (!first) return;
        const second = await askDialog(t.settings.save.confirm2, [
          { label: t.settings.save.delete, value: true },
          { label: t.buttons.cancel, value: false, primary: true },
        ]);
        if (!second) return;
        await this.actions.deleteSave();
        this.close();
      })();
    });
  }
}

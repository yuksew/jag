// 設定画面（モーダル）。表示・音・入力・言語・セーブ。
import { defaultSettings, type Lang, type Settings } from '../../electron/api';
import { LANGS, lang, t } from '../i18n';
import { esc } from './dom';
import { askDialog } from './dialog';
import { SETTINGS_ICON } from './icons';

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
    const pct = (v: number): string => `${Math.round(v * 100)}%`;
    let h = `<div class="settings-head"><h2>${ts.open}</h2><button class="btn ghost" id="st-close">${ts.close}</button></div>`;

    h += `<section class="group"><h3>${SETTINGS_ICON.display}${ts.display.head}</h3><div class="row">`;
    h += `<label class="sw"><input type="checkbox" id="st-fullscreen" ${s.display.fullscreen ? 'checked' : ''}><span>${ts.display.fullscreen}</span></label>`;
    h += `<label class="sel"><span>${ts.display.scale}</span><select id="st-scale">${SCALES.map((v) => `<option value="${v}" ${v === s.display.scale ? 'selected' : ''}>${v}%</option>`).join('')}</select></label>`;
    h += `<label class="sw"><input type="checkbox" id="st-reduce" ${s.display.reduceMotion ? 'checked' : ''}><span>${ts.display.reduceMotion}</span></label>`;
    h += '</div></section>';

    h += `<section class="group"><h3>${SETTINGS_ICON.sound}${ts.sound.head}</h3><div class="row">`;
    h += `<label class="range"><span>${ts.sound.master}</span><input type="range" id="st-master" min="0" max="1" step="0.05" value="${s.sound.master}"><output id="st-master-v">${pct(s.sound.master)}</output></label>`;
    h += `<label class="range"><span>${ts.sound.sfx}</span><input type="range" id="st-sfx" min="0" max="1" step="0.05" value="${s.sound.sfx}"><output id="st-sfx-v">${pct(s.sound.sfx)}</output></label>`;
    h += `<label class="sw"><input type="checkbox" id="st-click" ${s.sound.click ? 'checked' : ''}><span>${ts.sound.click}</span></label>`;
    h += '</div></section>';

    h += `<section class="group"><h3>${SETTINGS_ICON.input}${ts.input.head}</h3><div class="row">`;
    h += `<div class="kv"><span>${ts.input.offset}</span><div class="val"><b id="st-offset">${esc(ts.input.offsetNote(s.input.offsetMs))}</b>`;
    if (this.calibrating) h += `<span class="cal" id="st-cal-progress"></span><button class="btn ghost" id="st-cal-cancel">${ts.input.calibrateCancel}</button>`;
    else h += `<button class="btn ghost" id="st-calibrate">${ts.input.calibrate}</button>`;
    h += '</div></div>';
    h += `<div class="kv"><span>${ts.input.throwKey}</span><div class="val"><b id="st-keys">${s.input.throwKeys.map((k) => `<kbd>${esc(k)}</kbd>`).join(' / ')}</b><button class="btn ghost" id="st-key">${ts.input.pressKey}</button></div></div>`;
    h += `<p class="note">${esc(ts.input.keyNote)}<br>${esc(ts.input.gamepad)}</p>`;
    h += '</div></section>';

    h += `<section class="group"><h3>${SETTINGS_ICON.lang}${ts.lang.head}</h3><div class="row">`;
    h += `<label class="sel"><select id="st-lang" ${this.actions.running() ? 'disabled' : ''}>${LANGS.map((l) => `<option value="${l}" ${l === lang ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
    h += `<p class="note">${esc(ts.lang.note)}</p></div></section>`;

    h += `<section class="group"><h3>${SETTINGS_ICON.save}${ts.save.head}</h3><div class="row"><button class="btn ghost danger" id="st-delete">${ts.save.delete}</button></div></section>`;

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
    const showPct = (id: string, v: number): void => {
      const o = q<HTMLOutputElement>(id);
      if (o) o.textContent = `${Math.round(v * 100)}%`;
    };
    q<HTMLInputElement>('st-master')?.addEventListener('input', (e) => {
      this.settings.sound.master = Number((e.target as HTMLInputElement).value);
      showPct('st-master-v', this.settings.sound.master);
      this.actions.onChange(structuredClone(this.settings));
    });
    q<HTMLInputElement>('st-sfx')?.addEventListener('input', (e) => {
      this.settings.sound.sfx = Number((e.target as HTMLInputElement).value);
      showPct('st-sfx-v', this.settings.sound.sfx);
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

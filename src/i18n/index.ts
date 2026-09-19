import type { Lang } from '../../electron/api';
import { loadSettingsSync } from '../platform/settings';
import { en } from './en';
import { ja, type Strings } from './ja';

export const LANGS: readonly Lang[] = ['ja', 'en'];

const TABLE: Record<Lang, Strings> = { ja, en };

/** 起動時に設定から決める。切り替えは設定を書いて再読み込み */
export const lang: Lang = loadSettingsSync().lang;
export const t: Strings = TABLE[lang];
export type { Strings };

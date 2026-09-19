// renderer の入口。描画・UI の移植は次の段階。
// ここでは core が読み込めることと、preload 経由の API が届くことだけを確認する。
import { fresh, SAVE_VERSION } from './core/state';
import { derived } from './core/tree';
import { platformApi } from './platform/api';

const app = document.getElementById('app');
if (app) {
  const api = platformApi();
  const state = fresh();
  const d = derived(state);
  const title = document.createElement('h1');
  title.textContent = '三球';
  const info = document.createElement('small');
  info.textContent = `v${api?.version ?? 'browser'} / save v${SAVE_VERSION} / 1拍 ${d.intervalMs}ms / 許容幅 ±${d.toleranceMs}ms`;
  app.append(title, info);
}

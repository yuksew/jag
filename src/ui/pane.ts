// 右側のタブ（練習場・身体・記録帳）。状態変更は actions 経由で core の関数を呼ぶ
import {
  BRANCHES,
  catchGain,
  derived,
  isMilestoneDone,
  isPatternUnlocked,
  level,
  MILESTONES,
  missingRequirements,
  nextCost,
  node,
  nodesIn,
  PATTERNS,
  patternsUpTo,
  prestigeRequirement,
  showcaseStart,
  TUNING,
  type NodeId,
  type PatternId,
  type RunState,
  type SaveState,
} from '../core';
import { t } from '../i18n';
import { byId, esc } from './dom';

export type Tab = 'practice' | 'body' | 'record';
const TABS: readonly Tab[] = ['practice', 'body', 'record'];

export interface PaneActions {
  selectPattern(id: PatternId): void;
  buy(id: NodeId): void;
  prestige(): void;
}

export class Pane {
  tab: Tab = 'practice';
  private readonly tabsEl = byId('tabs');
  private readonly paneEl = byId('pane');

  constructor(
    private readonly actions: PaneActions,
    private readonly onTabChange: (tab: Tab) => void,
  ) {
    this.tabsEl.innerHTML = TABS.map((id) => `<button data-tab="${id}" id="tab-${id}">${t.tabs[id]}</button>`).join('');
    for (const b of this.tabsEl.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
      b.onclick = () => {
        this.tab = b.dataset['tab'] as Tab;
        this.onTabChange(this.tab);
      };
    }
  }

  render(state: SaveState, run: RunState): void {
    for (const b of this.tabsEl.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
      b.classList.toggle('on', b.dataset['tab'] === this.tab);
    }
    byId('tab-record').classList.toggle('locked', !state.recordOpen);

    let h = '';
    if (this.tab === 'practice') h = this.practice(state);
    if (this.tab === 'body') h = this.body(state, run);
    if (this.tab === 'record') h = this.record(state);
    this.paneEl.innerHTML = h;
    this.bind(run);
  }

  private practice(state: SaveState): string {
    let h = `<h2>${t.practice.patternsHead}</h2><div class="pat">`;
    for (const p of patternsUpTo(state.balls)) {
      const on = p.id === state.pattern;
      const un = isPatternUnlocked(state, p.id);
      const lockText = p.unlockNode ? t.patternLocked(t.nodes[p.unlockNode].name) : '';
      h += `<button data-pat="${p.id}" class="${on ? 'on' : ''}" ${un ? '' : 'disabled'}>`;
      h += `<b>${esc(t.patterns[p.id].name)}</b><span>${esc(un ? t.patterns[p.id].desc : lockText)}</span></button>`;
    }
    h += '</div>';
    const P = PATTERNS[state.pattern];
    const D = derived(state);
    h += `<div class="note">${esc(
      t.practice.note({
        balls: P.balls,
        interval: D.intervalMs,
        tol: Math.round(D.toleranceMs * P.toleranceFactor),
        gain: catchGain(P, state.balls),
      }),
    )}<br>${esc(
      t.practice.note2({
        cleanEvery: TUNING.clean.everyBeats,
        bossAt: showcaseStart(state.core),
        bossLen: TUNING.showcase.lengthBeats,
      }),
    )}</div>`;
    h += `<div class="note">${esc(t.practice.patternClean(state.patClean[state.pattern] ?? 0))}</div>`;
    return h;
  }

  private body(state: SaveState, run: RunState): string {
    let h = '';
    for (const br of BRANCHES) {
      h += `<h2>${t.branches[br]}</h2>`;
      for (const n of nodesIn(br)) {
        const l = level(state, n.id);
        const cost = nextCost(state, n.id);
        const missing = missingRequirements(state, n.id);
        h += `<div class="node"><div class="n">${esc(t.nodes[n.id].name)}<em>${l}/${n.max}</em></div>`;
        h += `<div class="d">${esc(t.nodes[n.id].desc)}`;
        if (missing.length) {
          const list = missing.map((m) => t.requireItem(t.nodes[m.id].name, m.level)).join('、');
          h += `<div class="req">${esc(t.requires(list))}</div>`;
        }
        h += '</div>';
        if (!cost) h += `<button class="max" disabled>${t.buttons.learned}</button>`;
        else {
          const ok = missing.length === 0 && state[cost.currency] >= cost.amount;
          h += `<button data-buy="${n.id}" ${ok ? '' : 'disabled'}>${esc(t.cost(cost.amount, t.currency[cost.currency]))}</button>`;
        }
        h += '</div>';
      }
    }

    const pr = prestigeRequirement(state);
    h += '<div class="pres">';
    if (state.done) {
      h += `<p>${esc(t.prestige.done)}</p>`;
    } else if (pr.nextBalls !== null) {
      h += `<div class="n">${esc(t.prestige.head(pr.nextBalls))}</div>`;
      if (pr.isFinal) h += `<p>${esc(t.prestige.protoEnd)}</p>`;
      for (const x of pr.patterns) {
        h += `<p class="${x.ok ? 'ok' : ''}">${esc(t.prestige.needClean(t.patterns[x.id].name))} ${x.ok ? t.prestige.check : ''}</p>`;
      }
      h += `<p class="${pr.coreOk ? 'ok' : ''}">${esc(t.prestige.needCore(TUNING.balls.prestigeCoreCost))} ${pr.coreOk ? t.prestige.check : ''}</p>`;
      if (!pr.isFinal) h += `<p>${esc(t.prestige.effect)}</p>`;
      const label = pr.isFinal ? t.buttons.finish : t.buttons.prestige(pr.nextBalls, TUNING.balls.prestigeCoreCost);
      h += `<button class="btn" id="pres-btn" ${pr.ok && !run.on ? '' : 'disabled'}>${esc(label)}</button>`;
    }
    h += '</div>';
    return h;
  }

  private record(state: SaveState): string {
    if (!state.recordOpen) return `<p class="note">${esc(t.record.locked)}</p>`;
    let h = `<h2>${t.record.milestonesHead}</h2>`;
    for (const m of MILESTONES) {
      const d = isMilestoneDone(state, m.id);
      const cls = d ? 'done' : 'todo';
      const gains = Object.entries(m.give)
        .map(([k, v]) => t.gain(v, t.currency[k as keyof typeof t.currency]))
        .join('、');
      h += `<div class="milestone"><span class="${cls}">${esc(t.milestones[m.id] ?? m.id)}</span>`;
      h += `<span class="${cls}">${esc(gains)}${d ? ` ${t.prestige.check}` : ''}</span></div>`;
    }
    h += `<h2>${t.record.recordsHead}</h2>`;
    h += `<div class="milestone"><span>${t.record.totalCatches}</span><b>${state.totalCatches}</b></div>`;
    h += `<div class="milestone"><span>${t.record.best}</span><b>${esc(t.record.beats(state.bestRun))}</b></div>`;
    h += `<div class="milestone"><span>${t.record.runs}</span><b>${state.runs}</b></div>`;
    for (const id of Object.keys(PATTERNS) as PatternId[]) {
      const n = state.patClean[id];
      if (n) h += `<div class="milestone"><span>${esc(t.record.patternClean(t.patterns[id].name))}</span><b>${n}</b></div>`;
    }
    return h;
  }

  private bind(run: RunState): void {
    for (const b of this.paneEl.querySelectorAll<HTMLButtonElement>('[data-pat]')) {
      b.onclick = () => {
        if (run.on) return;
        this.actions.selectPattern(b.dataset['pat'] as PatternId);
      };
    }
    for (const b of this.paneEl.querySelectorAll<HTMLButtonElement>('[data-buy]')) {
      b.onclick = () => this.actions.buy(node(b.dataset['buy'] as NodeId).id);
    }
    const pb = this.paneEl.querySelector<HTMLButtonElement>('#pres-btn');
    if (pb) pb.onclick = () => this.actions.prestige();
  }
}

// 右側のタブ（練習場・身体・記録帳）。状態変更は actions 経由で core の関数を呼ぶ
import {
  applauseRate,
  ballEffects,
  BRANCHES,
  canConvert,
  isBranchOpen,
  isShown,
  manualYield,
  passCleans,
  passingPatterns,
  passRatio,
  streetPatterns,
  catchGain,
  clubCleans,
  clubPattern,
  isSpinUnlocked,
  SPINS,
  visibleTabs,
  type Spins,
  type TabId,
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

export type Tab = TabId;

export interface PaneActions {
  selectPattern(id: PatternId): void;
  selectClub(spins: Spins): void;
  selectStreet(id: PatternId): void;
  selectPassing(id: PatternId): void;
  convert(): void;
  buy(id: NodeId): void;
  prestige(): void;
}

export class Pane {
  tab: Tab = 'practice';
  private readonly tabsEl = byId('tabs');
  private readonly paneEl = byId('pane');
  private tabsKey = '';

  constructor(
    private readonly actions: PaneActions,
    private readonly onTabChange: (tab: Tab) => void,
  ) {}

  private renderTabs(state: SaveState): void {
    const tabs = visibleTabs(state);
    const key = tabs.map((x) => `${x.id}:${x.open ? 1 : 0}`).join(',');
    if (key !== this.tabsKey) {
      this.tabsKey = key;
      this.tabsEl.innerHTML = tabs
        .map((x) => `<button data-tab="${x.id}" id="tab-${x.id}" class="${x.open ? '' : 'locked'}">${t.tabs[x.id]}</button>`)
        .join('');
      for (const b of this.tabsEl.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
        b.onclick = () => {
          this.tab = b.dataset['tab'] as Tab;
          this.onTabChange(this.tab);
        };
      }
    }
    for (const b of this.tabsEl.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
      b.classList.toggle('on', b.dataset['tab'] === this.tab);
    }
  }

  render(state: SaveState, run: RunState): void {
    this.renderTabs(state);
    const open = visibleTabs(state).find((x) => x.id === this.tab)?.open ?? false;
    let h: string;
    if (!open) h = `<p class="note">${esc(t.tabLocked[this.tab] ?? '')}</p>`;
    else if (this.tab === 'practice') h = this.practice(state);
    else if (this.tab === 'body') h = this.body(state, run);
    else if (this.tab === 'record') h = this.record(state);
    else if (this.tab === 'club') h = this.club(state);
    else if (this.tab === 'street') h = this.street(state, run);
    else if (this.tab === 'passing') h = this.passing(state);
    else h = `<p class="note">${esc(t.tabLocked[this.tab] ?? '')}</p>`;
    this.paneEl.innerHTML = h;
    this.bind(run);
  }

  private passing(state: SaveState): string {
    const ids = passingPatterns(state);
    let h = `<h2>${t.passing.head}</h2><div class="pat">`;
    for (const id of ids) {
      const on = state.mode === 'passing' && state.pattern === id;
      h += `<button data-pass="${id}" class="${on ? 'on' : ''}"><b>${esc(t.patterns[id].name)}</b><span>${esc(t.patterns[id].desc)}</span></button>`;
    }
    h += '</div>';
    const id = state.mode === 'passing' ? state.pattern : (ids[0] ?? state.pattern);
    const P = PATTERNS[id];
    const D = derived(state);
    const eff = ballEffects(state.balls);
    h += `<div class="note">${esc(
      t.passing.note({
        balls: state.balls,
        interval: D.intervalMs,
        tol: Math.round(D.toleranceMs * P.toleranceFactor * eff.toleranceFactor),
        gain: catchGain(P, state.balls),
        passPct: Math.round(passRatio(P.siteswap) * 100),
      }),
    )}<br>${esc(t.passing.note2)}</div>`;
    h += `<div class="note">${esc(t.passing.cleanCount(passCleans(state, id)))}</div>`;
    return h;
  }

  private street(state: SaveState, run: RunState): string {
    const ids = streetPatterns(state);
    let h = `<h2>${t.street.head}</h2><div class="pat">`;
    for (const id of ids) {
      const on = state.mode === 'street' && state.pattern === id;
      const shown = isShown(state, id);
      h += `<button data-street="${id}" class="${on ? 'on' : ''}"><b>${esc(t.patterns[id].name)}</b>`;
      h += `<span>${shown ? `${t.street.shown} ${t.prestige.check}` : esc(t.patterns[id].desc)}</span></button>`;
    }
    h += '</div>';
    const rate = applauseRate(state);
    h += `<div class="note">${esc(t.street.rate(Math.round(rate * 1000) / 1000))}<br>${esc(t.street.rateNote(state.shown.length))}<br>${esc(t.street.perform)}</div>`;
    h += `<h2>${t.street.convertHead}</h2>`;
    h += `<button class="btn ghost" id="convert-btn" ${canConvert(state) && !run.on ? '' : 'disabled'}>${esc(t.street.convert(TUNING.street.manualChunk, manualYield(state)))}</button>`;
    h += `<div class="note">${esc(t.street.convertNote)}</div>`;
    return h;
  }

  private club(state: SaveState): string {
    let h = `<h2>${t.club.head}</h2><div class="pat">`;
    for (const sp of SPINS) {
      const on = state.mode === 'club' && state.spins === sp;
      const un = isSpinUnlocked(state, sp);
      const prev = sp > 1 ? t.club.spins[(sp - 1) as Spins].name : '';
      const lockText = t.club.locked(prev, TUNING.club.unlockCleans);
      h += `<button data-spin="${sp}" class="${on ? 'on' : ''}" ${un ? '' : 'disabled'}>`;
      h += `<b>${esc(t.club.spins[sp].name)}</b><span>${esc(un ? t.club.spins[sp].desc : lockText)}</span></button>`;
    }
    h += '</div>';
    const sp = state.mode === 'club' ? state.spins : 1;
    const P = clubPattern(state.balls, sp);
    const D = derived(state);
    const eff = ballEffects(state.balls);
    h += `<div class="note">${esc(
      t.club.note({
        balls: state.balls,
        interval: D.intervalMs,
        tol: Math.round(D.toleranceMs * P.toleranceFactor * eff.toleranceFactor),
        gain: catchGain(P, state.balls),
      }),
    )}<br>${esc(t.club.note2)}</div>`;
    h += `<div class="note">${esc(t.club.cleanCount(clubCleans(state, sp)))}</div>`;
    return h;
  }

  private practice(state: SaveState): string {
    let h = `<h2>${t.practice.patternsHead}</h2><div class="pat">`;
    for (const p of patternsUpTo(state.balls)) {
      const on = state.mode === 'ball' && p.id === state.pattern;
      const un = isPatternUnlocked(state, p.id);
      const lockText = p.unlockNode ? t.patternLocked(t.nodes[p.unlockNode].name) : '';
      h += `<button data-pat="${p.id}" class="${on ? 'on' : ''}" ${un ? '' : 'disabled'}>`;
      h += `<b>${esc(t.patterns[p.id].name)}</b><span>${esc(un ? t.patterns[p.id].desc : lockText)}</span></button>`;
    }
    h += '</div>';
    const P = PATTERNS[state.pattern];
    const D = derived(state);
    const eff = ballEffects(state.balls);
    h += `<div class="note">${esc(
      t.practice.note({
        balls: P.balls,
        interval: D.intervalMs,
        tol: Math.round(D.toleranceMs * P.toleranceFactor * eff.toleranceFactor),
        gain: catchGain(P, state.balls),
      }),
    )}<br>${esc(
      t.practice.note2({
        cleanEvery: eff.cleanEvery,
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
      if (!isBranchOpen(state, br)) continue;
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
    for (const b of this.paneEl.querySelectorAll<HTMLButtonElement>('[data-spin]')) {
      b.onclick = () => {
        if (run.on) return;
        this.actions.selectClub(Number(b.dataset['spin']) as Spins);
      };
    }
    for (const b of this.paneEl.querySelectorAll<HTMLButtonElement>('[data-street]')) {
      b.onclick = () => {
        if (run.on) return;
        this.actions.selectStreet(b.dataset['street'] as PatternId);
      };
    }
    for (const b of this.paneEl.querySelectorAll<HTMLButtonElement>('[data-pass]')) {
      b.onclick = () => {
        if (run.on) return;
        this.actions.selectPassing(b.dataset['pass'] as PatternId);
      };
    }
    const cb = this.paneEl.querySelector<HTMLButtonElement>('#convert-btn');
    if (cb) cb.onclick = () => this.actions.convert();
    for (const b of this.paneEl.querySelectorAll<HTMLButtonElement>('[data-buy]')) {
      b.onclick = () => this.actions.buy(node(b.dataset['buy'] as NodeId).id);
    }
    const pb = this.paneEl.querySelector<HTMLButtonElement>('#pres-btn');
    if (pb) pb.onclick = () => this.actions.prestige();
  }
}

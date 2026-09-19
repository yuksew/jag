// 右側のタブ（練習場・身体・記録帳・クラブ・路上・パッシング・舞台）。状態変更は actions 経由で core の関数を呼ぶ
import {
  applauseRate,
  ballEffects,
  BRANCHES,
  canConvert,
  isBranchOpen,
  isMasteryNode,
  isShown,
  manualYield,
  canOpenShow,
  canSeal,
  initialFatigue,
  isSealed,
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
  type CurrencyKey,
  type NodeId,
  type PatternId,
  type RunState,
  type SaveState,
} from '../core';
import { t } from '../i18n';
import { byId, esc } from './dom';
import {
  BRANCH_ICON,
  CHECK_ICON,
  CIRCLE_ICON,
  CONVERT_ICON,
  CURRENCY_ICON,
  levelDots,
  LOCK_ICON,
  SEAL_ICON,
  siteswapFigure,
  TAB_ICON,
  TROPHY_ICON,
} from './icons';

export type Tab = TabId;

export interface PaneActions {
  selectPattern(id: PatternId): void;
  selectClub(spins: Spins): void;
  selectStreet(id: PatternId): void;
  selectPassing(id: PatternId): void;
  openShow(): void;
  convert(): void;
  seal(id: PatternId): void;
  buy(id: NodeId): void;
  prestige(): void;
}

/** ラベルと値の並び（練習場のノートなど） */
type SpecRow = { k: string; v: string | number; hint?: string };

function spec(rows: SpecRow[]): string {
  let h = '<dl class="spec">';
  for (const r of rows) {
    h += `<div class="row"><dt>${esc(r.k)}</dt><dd><b>${esc(r.v)}</b>${r.hint ? `<small>${esc(r.hint)}</small>` : ''}</dd></div>`;
  }
  return h + '</dl>';
}

/** パターン選択のボタン。図 + 名前 + 説明。鍵付きは鍵アイコン */
function patternButton(attr: string, id: PatternId, on: boolean, unlocked: boolean, sub: string, badge = ''): string {
  const cls = [on ? 'on' : '', unlocked ? '' : 'locked'].filter(Boolean).join(' ');
  return (
    `<button ${attr}="${id}" class="${cls}" ${unlocked ? '' : 'disabled'} aria-pressed="${on}">` +
    `<span class="fig">${siteswapFigure(PATTERNS[id].siteswap)}</span>` +
    `<span class="pt"><b>${esc(t.patterns[id].name)}${badge}</b><span>${unlocked ? '' : LOCK_ICON}${esc(sub)}</span></span>` +
    `</button>`
  );
}

function statTiles(rows: [string, string | number][]): string {
  return `<div class="stats">${rows.map(([k, v]) => `<div class="stat-tile"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
}

function costLabel(currency: CurrencyKey, amount: number): string {
  return `${CURRENCY_ICON[currency]}${esc(t.cost(amount, t.currency[currency]))}`;
}

export class Pane {
  tab: Tab = 'practice';
  private readonly tabsEl = byId('tabs');
  private readonly paneEl = byId('pane');
  private tabsKey = '';

  constructor(
    private readonly actions: PaneActions,
    private readonly onTabChange: (tab: Tab) => void,
  ) {
    this.tabsEl.setAttribute('role', 'tablist');
  }

  private renderTabs(state: SaveState): void {
    const tabs = visibleTabs(state);
    const key = tabs.map((x) => `${x.id}:${x.open ? 1 : 0}`).join(',');
    if (key !== this.tabsKey) {
      this.tabsKey = key;
      this.tabsEl.classList.toggle('many', tabs.length >= 6);
      this.tabsEl.innerHTML = tabs
        .map(
          (x) =>
            `<button data-tab="${x.id}" id="tab-${x.id}" role="tab" class="${x.open ? '' : 'locked'}" title="${esc(x.open ? t.tabs[x.id] : (t.tabLocked[x.id] ?? ''))}">` +
            `<span class="ti">${TAB_ICON[x.id]}${x.open ? '' : `<span class="badge">${LOCK_ICON}</span>`}</span>` +
            `<span class="tl">${esc(t.tabs[x.id])}</span></button>`,
        )
        .join('');
      for (const b of this.tabsEl.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
        b.onclick = () => {
          this.tab = b.dataset['tab'] as Tab;
          this.onTabChange(this.tab);
        };
      }
    }
    for (const b of this.tabsEl.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
      const on = b.dataset['tab'] === this.tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    }
  }

  /** 開いているタブを前後に切り替える（ゲームパッドの LB / RB） */
  step(delta: number): void {
    const ids = [...this.tabsEl.querySelectorAll<HTMLButtonElement>('[data-tab]')].map((b) => b.dataset['tab'] as Tab);
    if (ids.length === 0) return;
    const i = Math.max(0, ids.indexOf(this.tab));
    const next = ids[(i + delta + ids.length) % ids.length];
    if (!next || next === this.tab) return;
    this.tab = next;
    this.onTabChange(this.tab);
  }

  render(state: SaveState, run: RunState): void {
    this.renderTabs(state);
    const open = visibleTabs(state).find((x) => x.id === this.tab)?.open ?? false;
    let h: string;
    if (!open) h = this.lockedBox(this.tab);
    else if (this.tab === 'practice') h = this.practice(state);
    else if (this.tab === 'body') h = this.body(state, run);
    else if (this.tab === 'record') h = this.record(state);
    else if (this.tab === 'club') h = this.club(state);
    else if (this.tab === 'street') h = this.street(state, run);
    else if (this.tab === 'passing') h = this.passing(state);
    else if (this.tab === 'stage') h = this.stage(state, run);
    else h = this.lockedBox(this.tab);
    this.paneEl.innerHTML = h;
    this.paneEl.dataset['tab'] = this.tab;
    this.bind(run);
  }

  private lockedBox(tab: Tab): string {
    return `<div class="locked-box">${LOCK_ICON}<p class="note">${esc(t.tabLocked[tab] ?? '')}</p></div>`;
  }

  private stage(state: SaveState, run: RunState): string {
    if (state.done) {
      let h = `<div class="hero">${TROPHY_ICON}<h2>${esc(t.stage.doneHead)}</h2><p>${esc(t.stage.doneBody)}</p></div>`;
      h += statTiles([
        [t.stage.stats.totalCatches, state.totalCatches],
        [t.stage.stats.runs, state.runs],
        [t.stage.stats.best, t.record.beats(state.bestRun)],
        [t.stage.stats.applause, state.applause],
        [t.stage.stats.shown, state.shown.length],
      ]);
      return h;
    }
    let h = `<h2>${TAB_ICON.stage}${esc(t.stage.head)}</h2>`;
    h += `<div class="card-box"><p class="note">${esc(t.stage.intro(TUNING.stage.showBeats))}</p>`;
    if (state.mode === 'stage') h += `<p class="note ok">${CHECK_ICON}${esc(t.stage.ready)}</p>`;
    h += `<button class="btn" id="show-btn" ${canOpenShow(state) && !run.on && state.mode !== 'stage' ? '' : 'disabled'}>${esc(t.stage.open)}</button></div>`;
    return h;
  }

  private passing(state: SaveState): string {
    const ids = passingPatterns(state);
    let h = `<h2>${TAB_ICON.passing}${esc(t.passing.head)}</h2><div class="pat">`;
    for (const id of ids) {
      const on = state.mode === 'passing' && state.pattern === id;
      h += patternButton('data-pass', id, on, true, t.patterns[id].desc);
    }
    h += '</div>';
    const id = state.mode === 'passing' ? state.pattern : (ids[0] ?? state.pattern);
    const P = PATTERNS[id];
    const D = derived(state);
    const eff = ballEffects(state.balls);
    h += spec([
      { k: t.spec.balls, v: t.spec.ballsValue(state.balls) },
      { k: t.spec.interval, v: t.spec.ms(D.intervalMs) },
      { k: t.spec.tol, v: t.spec.tolValue(Math.round(D.toleranceMs * P.toleranceFactor * eff.toleranceFactor)) },
      { k: t.spec.gain, v: t.spec.gainValue(catchGain(P, state.balls)) },
      { k: t.spec.pass, v: t.spec.pct(Math.round(passRatio(P.siteswap) * 100)) },
      { k: t.spec.passClean, v: passCleans(state, id), hint: t.spec.passCleanHint },
    ]);
    h += `<p class="note">${esc(t.passing.note2)}</p>`;
    return h;
  }

  private street(state: SaveState, run: RunState): string {
    const ids = streetPatterns(state);
    let h = `<h2>${TAB_ICON.street}${esc(t.street.head)}</h2><div class="pat">`;
    for (const id of ids) {
      const on = state.mode === 'street' && state.pattern === id;
      const shown = isShown(state, id);
      h += patternButton('data-street', id, on, true, shown ? t.street.shown : t.patterns[id].desc, shown ? `<span class="shown">${CHECK_ICON}</span>` : '');
    }
    h += '</div>';
    const rate = applauseRate(state);
    h += spec([
      { k: t.spec.applauseRate, v: Math.round(rate * 1000) / 1000 },
      { k: t.spec.shownCount, v: t.spec.shownValue(state.shown.length), hint: t.spec.shownHint },
    ]);
    h += `<p class="note">${esc(t.street.perform)}</p>`;
    h += `<h2>${CONVERT_ICON}${esc(t.street.convertHead)}</h2>`;
    h += `<div class="card-box"><button class="btn ghost" id="convert-btn" ${canConvert(state) && !run.on ? '' : 'disabled'}>${CURRENCY_ICON.catch}${esc(t.street.convert(TUNING.street.manualChunk, manualYield(state)))}</button>`;
    h += `<p class="note">${esc(t.street.convertNote)}</p></div>`;
    return h;
  }

  private club(state: SaveState): string {
    let h = `<h2>${TAB_ICON.club}${esc(t.club.head)}</h2><div class="pat">`;
    for (const sp of SPINS) {
      const on = state.mode === 'club' && state.spins === sp;
      const un = isSpinUnlocked(state, sp);
      const prev = sp > 1 ? t.club.spins[(sp - 1) as Spins].name : '';
      const sub = un ? t.club.spins[sp].desc : t.club.locked(prev, TUNING.club.unlockCleans);
      const cls = [on ? 'on' : '', un ? '' : 'locked'].filter(Boolean).join(' ');
      h += `<button data-spin="${sp}" class="${cls}" ${un ? '' : 'disabled'} aria-pressed="${on}">`;
      h += `<span class="fig spin">${siteswapFigure(clubPattern(state.balls, sp).siteswap)}<em>×${sp}</em></span>`;
      h += `<span class="pt"><b>${esc(t.club.spins[sp].name)}</b><span>${un ? '' : LOCK_ICON}${esc(sub)}</span></span></button>`;
    }
    h += '</div>';
    const sp = state.mode === 'club' ? state.spins : 1;
    const P = clubPattern(state.balls, sp);
    const D = derived(state);
    const eff = ballEffects(state.balls);
    h += spec([
      { k: t.tabs.club, v: t.spec.clubsValue(state.balls) },
      { k: t.spec.interval, v: t.spec.ms(D.intervalMs) },
      { k: t.spec.tol, v: t.spec.tolValue(Math.round(D.toleranceMs * P.toleranceFactor * eff.toleranceFactor)) },
      { k: t.spec.gain, v: t.spec.gainValue(catchGain(P, state.balls)) },
      { k: t.spec.spinClean, v: clubCleans(state, sp) },
    ]);
    h += `<p class="note">${esc(t.club.note2)}</p>`;
    return h;
  }

  private practice(state: SaveState): string {
    let h = `<h2>${TAB_ICON.practice}${esc(t.practice.patternsHead)}</h2><div class="pat">`;
    for (const p of patternsUpTo(state.balls)) {
      const on = state.mode === 'ball' && p.id === state.pattern;
      const un = isPatternUnlocked(state, p.id);
      const lockText = isSealed(state, p.id) ? t.seal.sealed : p.unlockNode ? t.patternLocked(t.nodes[p.unlockNode].name) : '';
      h += patternButton('data-pat', p.id, on, un, un ? t.patterns[p.id].desc : lockText);
    }
    h += '</div>';
    const P = PATTERNS[state.pattern];
    const D = derived(state);
    const eff = ballEffects(state.balls);
    h += spec([
      { k: t.spec.balls, v: t.spec.ballsValue(P.balls) },
      { k: t.spec.interval, v: t.spec.ms(D.intervalMs) },
      { k: t.spec.tol, v: t.spec.tolValue(Math.round(D.toleranceMs * P.toleranceFactor * eff.toleranceFactor)), hint: t.spec.tolHint },
      { k: t.spec.gain, v: t.spec.gainValue(catchGain(P, state.balls)) },
      { k: t.spec.cleanEvery, v: t.spec.cleanEveryValue(eff.cleanEvery) },
      { k: t.spec.showcase, v: t.spec.showcaseValue(showcaseStart(state.core), TUNING.showcase.lengthBeats), hint: t.spec.showcaseHint },
      { k: t.spec.patternClean, v: state.patClean[state.pattern] ?? 0 },
    ]);
    return h;
  }

  private body(state: SaveState, run: RunState): string {
    let h = '';
    for (const br of BRANCHES) {
      if (!isBranchOpen(state, br)) continue;
      h += `<h2 class="bh">${BRANCH_ICON[br]}${esc(t.branches[br])}</h2><div class="nodes">`;
      for (const n of nodesIn(br)) {
        const l = level(state, n.id);
        const cost = nextCost(state, n.id);
        const missing = missingRequirements(state, n.id);
        const ok = cost !== null && missing.length === 0 && state[cost.currency] >= cost.amount;
        const cls = ['node', isMasteryNode(n.id) ? 'mastery' : '', cost === null ? 'max' : ok ? 'can' : '', missing.length ? 'locked' : ''].filter(Boolean).join(' ');
        h += `<div class="${cls}"><div class="nh"><span class="n">${missing.length ? LOCK_ICON : ''}${esc(t.nodes[n.id].name)}</span>${levelDots(l, n.max)}<em>${l}/${n.max}</em></div>`;
        h += `<div class="d">${esc(t.nodes[n.id].desc)}</div>`;
        if (missing.length) {
          const list = missing.map((m) => t.requireItem(t.nodes[m.id].name, m.level)).join('、');
          h += `<div class="req">${esc(t.requires(list))}</div>`;
        }
        if (!cost) h += `<button class="max" disabled>${CHECK_ICON}${esc(t.buttons.learned)}</button>`;
        else h += `<button data-buy="${n.id}" ${ok ? '' : 'disabled'}>${costLabel(cost.currency, cost.amount)}</button>`;
        h += '</div>';
      }
      h += '</div>';
    }

    const pr = prestigeRequirement(state);
    h += '<div class="pres">';
    if (state.done) {
      h += `<p class="note">${CHECK_ICON}${esc(t.prestige.done)}</p>`;
    } else if (pr.isFinal || pr.nextBalls === null) {
      h += `<p class="note">${esc(t.prestige.final)}</p>`;
    } else {
      h += `<div class="n">${CURRENCY_ICON.sp}${esc(t.prestige.head(pr.nextBalls))}</div><ul class="checks">`;
      for (const x of pr.patterns) {
        h += `<li class="${x.ok ? 'ok' : ''}">${x.ok ? CHECK_ICON : CIRCLE_ICON}<span>${esc(t.prestige.needClean(t.patterns[x.id].name))}</span></li>`;
      }
      h += `<li class="${pr.coreOk ? 'ok' : ''}">${pr.coreOk ? CHECK_ICON : CIRCLE_ICON}<span>${esc(t.prestige.needCore(TUNING.balls.prestigeCoreCost))}</span></li></ul>`;
      h += `<p class="note">${esc(t.prestige.effect)}</p>`;
      h += `<button class="btn" id="pres-btn" ${pr.ok && !run.on ? '' : 'disabled'}>${esc(t.buttons.prestige(pr.nextBalls, TUNING.balls.prestigeCoreCost))}</button>`;
    }
    h += '</div>';
    return h;
  }

  private record(state: SaveState): string {
    if (!state.recordOpen) return `<div class="locked-box">${LOCK_ICON}<p class="note">${esc(t.record.locked)}</p></div>`;
    let h = `<h2>${TAB_ICON.record}${esc(t.record.milestonesHead)}</h2><ul class="ms">`;
    for (const m of MILESTONES) {
      const d = isMilestoneDone(state, m.id);
      const gains = Object.entries(m.give)
        .map(([k, v]) => `${CURRENCY_ICON[k as CurrencyKey]}${esc(t.gain(v, t.currency[k as CurrencyKey]))}`)
        .join('<i class="sep"></i>');
      h += `<li class="${d ? 'done' : 'todo'}">${d ? CHECK_ICON : CIRCLE_ICON}<span class="lb">${esc(t.milestones[m.id] ?? m.id)}</span><span class="gain">${gains}</span></li>`;
    }
    h += '</ul>';
    h += `<h2>${esc(t.record.recordsHead)}</h2>`;
    h += statTiles([
      [t.record.totalCatches, state.totalCatches],
      [t.record.best, t.record.beats(state.bestRun)],
      [t.record.runs, state.runs],
    ]);
    const cleans = (Object.keys(PATTERNS) as PatternId[]).filter((id) => state.patClean[id]);
    if (cleans.length) {
      h += '<ul class="ms cleans">';
      for (const id of cleans) {
        h += `<li>${CURRENCY_ICON.clean}<span class="lb">${esc(t.record.patternClean(t.patterns[id].name))}${isSealed(state, id) ? `<small>${esc(t.seal.sealed)}</small>` : ''}</span><b>${state.patClean[id]}</b></li>`;
      }
      h += '</ul>';
    }
    // 封印
    h += `<h2>${SEAL_ICON}${esc(t.seal.head)}</h2><p class="note">${esc(t.seal.intro)}</p>`;
    h += `<p class="note strong">${esc(t.seal.fatigueNow(state.balls, Math.round(initialFatigue(state) * 100) / 100))}</p>`;
    h += '<div class="nodes">';
    for (const id of cleans) {
      const sealed = isSealed(state, id);
      h += `<div class="node${sealed ? ' max' : ''}"><div class="nh"><span class="n">${esc(t.patterns[id].name)}</span><em>${esc(t.spec.ballsValue(PATTERNS[id].balls))}</em></div><div class="d">${esc(t.patterns[id].desc)}</div>`;
      if (sealed) h += `<button class="max" disabled>${SEAL_ICON}${esc(t.seal.sealed)}</button>`;
      else h += `<button data-seal="${id}" ${canSeal(state, id) ? '' : 'disabled'}>${SEAL_ICON}${esc(t.seal.button)}</button>`;
      h += '</div>';
    }
    h += '</div>';
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
    for (const b of this.paneEl.querySelectorAll<HTMLButtonElement>('[data-seal]')) {
      b.onclick = () => this.actions.seal(b.dataset['seal'] as PatternId);
    }
    const sb = this.paneEl.querySelector<HTMLButtonElement>('#show-btn');
    if (sb) sb.onclick = () => this.actions.openShow();
    const cb = this.paneEl.querySelector<HTMLButtonElement>('#convert-btn');
    if (cb) cb.onclick = () => this.actions.convert();
    for (const b of this.paneEl.querySelectorAll<HTMLButtonElement>('[data-buy]')) {
      b.onclick = () => this.actions.buy(node(b.dataset['buy'] as NodeId).id);
    }
    const pb = this.paneEl.querySelector<HTMLButtonElement>('#pres-btn');
    if (pb) pb.onclick = () => this.actions.prestige();
  }
}

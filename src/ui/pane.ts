// 右側のポスター（練習場・身体・記録帳・クラブ・路上・パッシング・舞台）。状態変更は actions 経由で core の関数を呼ぶ
// 見た目は「サーカスの興行ポスターと切符」（docs/UI_DIRECTION.md）。タブは切符、ペインは紙、身体は張り紙 + 判子、記録帳は番付
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
  HAT_ICON,
  levelStamps,
  LOCK_ICON,
  PARTNER_ICON,
  SEAL_ICON,
  siteswapFigure,
  STAMP_ICON,
  TAB_ICON,
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

/** ラベルと値の並び（「本日の稽古」ビラ） */
type SpecRow = { k: string; v: string | number; hint?: string };

/** 見出し帯（墨地に白抜き）+ 右へ伸びる罫線 */
function head(icon: string, text: string, cls = ''): string {
  return `<h2 class="${cls}"><span class="bd">${icon}${esc(text)}</span></h2>`;
}

/** 数値のビラ。短い値は大きなスラブ体のタイル、長い値は 1 行の項目 */
function flyer(rows: SpecRow[], title = t.spec.flyerHead): string {
  let h = `<div class="flyer"><div class="fh">${esc(title)}</div><div class="fr">`;
  for (const r of rows) {
    const long = String(r.v).length > 8;
    h += `<div class="ft${long ? ' wide' : ''}"><b>${esc(r.v)}</b><span>${esc(r.k)}${r.hint ? `<small>${esc(r.hint)}</small>` : ''}</span></div>`;
  }
  return h + '</div></div>';
}

/** 演目札（縦長、上に紐穴）。鍵付きは裏返し */
function patternButton(attr: string, id: PatternId, on: boolean, unlocked: boolean, sub: string, badge = ''): string {
  const cls = ['tag', on ? 'on' : '', unlocked ? '' : 'locked'].filter(Boolean).join(' ');
  return (
    `<button ${attr}="${id}" class="${cls}" ${unlocked ? '' : 'disabled'} aria-pressed="${on}">` +
    `<span class="hole"></span>` +
    `<span class="pt"><b>${esc(t.patterns[id].name)}${badge}</b></span>` +
    `<span class="fig">${siteswapFigure(PATTERNS[id].siteswap)}</span>` +
    `<span class="ds">${unlocked ? '' : LOCK_ICON}${esc(sub)}</span>` +
    `</button>`
  );
}

/** 番付の頭などに置く大きな数字 */
function bigStats(rows: [string, string | number][]): string {
  return `<div class="stats">${rows.map(([k, v]) => `<div class="stat-tile"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('')}</div>`;
}

function costLabel(currency: CurrencyKey, amount: number): string {
  return `${CURRENCY_ICON[currency]}${esc(t.cost(amount, t.currency[currency]))}`;
}

/** 右ペインの紙の色（タブごと）。stage = 深紅、street = 黒板、それ以外 = 紙 */
function venueOf(tab: Tab): 'stage' | 'street' | 'paper' {
  if (tab === 'stage') return 'stage';
  if (tab === 'street') return 'street';
  return 'paper';
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
            `<span class="tk">` +
            `<span class="ti">${x.open ? TAB_ICON[x.id] : LOCK_ICON}</span>` +
            `<span class="tl">${esc(t.tabs[x.id])}</span>` +
            `</span></button>`,
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
    // 紙の色。未解放のタブはふつうの紙、完走後の舞台は千秋楽（深紅）
    const venue = open ? venueOf(this.tab) : 'paper';
    this.paneEl.dataset['venue'] = venue;
    const poster = this.paneEl.parentElement;
    if (poster) {
      poster.dataset['venue'] = venue;
      poster.classList.toggle('finale', this.tab === 'stage' && open && state.done);
    }
    this.bind(run);
  }

  private lockedBox(tab: Tab): string {
    return `<div class="locked-box">${LOCK_ICON}<p class="note">${esc(t.tabLocked[tab] ?? '')}</p></div>`;
  }

  private stage(state: SaveState, run: RunState): string {
    if (state.done) {
      // 千秋楽ポスター: 表示用書体で大きく、下に 5 つの記録
      let h = `<div class="finale-poster"><div class="fn-top">${esc(t.stage.finale)}</div>`;
      h += `<h2 class="fn-title"><span>${esc(t.stage.doneHead)}</span></h2>`;
      h += `<p class="fn-body">${esc(t.stage.doneBody)}</p>`;
      h += bigStats([
        [t.stage.stats.totalCatches, state.totalCatches],
        [t.stage.stats.runs, state.runs],
        [t.stage.stats.best, t.record.beats(state.bestRun)],
        [t.stage.stats.applause, state.applause],
        [t.stage.stats.shown, state.shown.length],
      ]);
      return h + '</div>';
    }
    let h = head(TAB_ICON.stage, t.stage.head);
    h += `<div class="bill"><p class="note">${esc(t.stage.intro(TUNING.stage.showBeats))}</p>`;
    if (state.mode === 'stage') h += `<p class="note ok">${CHECK_ICON}${esc(t.stage.ready)}</p>`;
    h += `<button class="btn primary" id="show-btn" ${canOpenShow(state) && !run.on && state.mode !== 'stage' ? '' : 'disabled'}>${esc(t.stage.open)}</button></div>`;
    return h;
  }

  private passing(state: SaveState): string {
    const ids = passingPatterns(state);
    const id = state.mode === 'passing' ? state.pattern : (ids[0] ?? state.pattern);
    const P = PATTERNS[id];
    // 相方の札（顔）と、パス割合の吹き出し
    let h = `<div class="partner">${PARTNER_ICON}<span class="who">${esc(t.passing.partner)}</span><span class="bubble">${esc(`${t.spec.pass} ${t.spec.pct(Math.round(passRatio(P.siteswap) * 100))}`)}</span></div>`;
    h += head(TAB_ICON.passing, t.passing.head) + '<div class="pat">';
    for (const pid of ids) {
      const on = state.mode === 'passing' && state.pattern === pid;
      h += patternButton('data-pass', pid, on, true, t.patterns[pid].desc);
    }
    h += '</div>';
    const D = derived(state);
    const eff = ballEffects(state.balls);
    h += flyer([
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
    let h = head(TAB_ICON.street, t.street.head) + '<div class="pat">';
    for (const id of ids) {
      const on = state.mode === 'street' && state.pattern === id;
      const shown = isShown(state, id);
      h += patternButton('data-street', id, on, true, shown ? t.street.shown : t.patterns[id].desc, shown ? `<span class="shown">${STAMP_ICON}</span>` : '');
    }
    h += '</div>';
    const rate = applauseRate(state);
    h += flyer([
      { k: t.spec.applauseRate, v: Math.round(rate * 1000) / 1000 },
      { k: t.spec.shownCount, v: t.spec.shownValue(state.shown.length), hint: t.spec.shownHint },
    ]);
    h += `<p class="note">${esc(t.street.perform)}</p>`;
    h += head(CONVERT_ICON, t.street.convertHead);
    h += `<div class="bill"><button class="btn" id="convert-btn" ${canConvert(state) && !run.on ? '' : 'disabled'}>${HAT_ICON}${esc(t.street.convert(TUNING.street.manualChunk, manualYield(state)))}</button>`;
    h += `<p class="note">${esc(t.street.convertNote)}</p></div>`;
    return h;
  }

  private club(state: SaveState): string {
    let h = head(TAB_ICON.club, t.club.head) + '<div class="pat spins">';
    for (const sp of SPINS) {
      const on = state.mode === 'club' && state.spins === sp;
      const un = isSpinUnlocked(state, sp);
      const prev = sp > 1 ? t.club.spins[(sp - 1) as Spins].name : '';
      const sub = un ? t.club.spins[sp].desc : t.club.locked(prev, TUNING.club.unlockCleans);
      const cls = ['tag', on ? 'on' : '', un ? '' : 'locked'].filter(Boolean).join(' ');
      h += `<button data-spin="${sp}" class="${cls}" ${un ? '' : 'disabled'} aria-pressed="${on}">`;
      h += `<span class="hole"></span><span class="x">×${sp}</span>`;
      h += `<span class="pt"><b>${esc(t.club.spins[sp].name)}</b></span>`;
      h += `<span class="fig">${siteswapFigure(clubPattern(state.balls, sp).siteswap)}</span>`;
      h += `<span class="ds">${un ? '' : LOCK_ICON}${esc(sub)}</span></button>`;
    }
    h += '</div>';
    const sp = state.mode === 'club' ? state.spins : 1;
    const P = clubPattern(state.balls, sp);
    const D = derived(state);
    const eff = ballEffects(state.balls);
    h += flyer([
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
    let h = head(TAB_ICON.practice, t.practice.patternsHead) + '<div class="pat">';
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
    h += flyer([
      { k: t.spec.balls, v: t.spec.ballsValue(P.balls) },
      { k: t.spec.interval, v: t.spec.ms(D.intervalMs) },
      { k: t.spec.tol, v: t.spec.tolValue(Math.round(D.toleranceMs * P.toleranceFactor * eff.toleranceFactor)), hint: t.spec.tolHint },
      { k: t.spec.gain, v: t.spec.gainValue(catchGain(P, state.balls)) },
      { k: t.spec.patternClean, v: state.patClean[state.pattern] ?? 0 },
      { k: t.spec.cleanEvery, v: t.spec.cleanEveryValue(eff.cleanEvery) },
      { k: t.spec.showcase, v: t.spec.showcaseValue(showcaseStart(state.core), TUNING.showcase.lengthBeats), hint: t.spec.showcaseHint },
    ]);
    return h;
  }

  /** 身体: 5 系統を「張り紙」に、ノードは判子の列。体得は鎖線で下にぶら下がる */
  private body(state: SaveState, run: RunState): string {
    let h = '<div class="sheets">';
    for (const br of BRANCHES) {
      if (!isBranchOpen(state, br)) continue;
      h += `<section class="sheet"><h3>${BRANCH_ICON[br]}${esc(t.branches[br])}</h3>`;
      for (const n of nodesIn(br)) {
        const l = level(state, n.id);
        const cost = nextCost(state, n.id);
        const missing = missingRequirements(state, n.id);
        const ok = cost !== null && missing.length === 0 && state[cost.currency] >= cost.amount;
        const cls = ['node', isMasteryNode(n.id) ? 'mastery' : '', cost === null ? 'max' : ok ? 'can' : '', missing.length ? 'locked' : ''].filter(Boolean).join(' ');
        h += `<div class="${cls}"><div class="nh"><span class="n">${missing.length ? LOCK_ICON : ''}${esc(t.nodes[n.id].name)}</span>${levelStamps(l, n.max)}</div>`;
        h += `<div class="d">${esc(t.nodes[n.id].desc)}</div>`;
        if (missing.length) {
          const list = missing.map((m) => t.requireItem(t.nodes[m.id].name, m.level)).join('、');
          h += `<div class="req">${esc(t.requires(list))}</div>`;
        }
        if (!cost) h += `<button class="max" disabled>${esc(t.buttons.learned)}</button>`;
        else h += `<button data-buy="${n.id}" class="price" ${ok ? '' : 'disabled'}>${costLabel(cost.currency, cost.amount)}</button>`;
        h += '</div>';
      }
      h += '</section>';
    }
    h += '</div>';

    const pr = prestigeRequirement(state);
    h += '<div class="pres">';
    if (state.done) {
      h += `<p class="note">${CHECK_ICON}${esc(t.prestige.done)}</p>`;
    } else if (pr.isFinal || pr.nextBalls === null) {
      h += `<p class="note">${esc(t.prestige.final)}</p>`;
    } else {
      h += `<div class="n">${CURRENCY_ICON.sp}${esc(t.prestige.head(pr.nextBalls))}</div><ul class="checks">`;
      for (const x of pr.patterns) {
        h += `<li class="${x.ok ? 'ok' : ''}">${x.ok ? STAMP_ICON : CIRCLE_ICON}<span>${esc(t.prestige.needClean(t.patterns[x.id].name))}</span></li>`;
      }
      h += `<li class="${pr.coreOk ? 'ok' : ''}">${pr.coreOk ? STAMP_ICON : CIRCLE_ICON}<span>${esc(t.prestige.needCore(TUNING.balls.prestigeCoreCost))}</span></li></ul>`;
      h += `<p class="note">${esc(t.prestige.effect)}</p>`;
      h += `<button class="btn" id="pres-btn" ${pr.ok && !run.on ? '' : 'disabled'}>${esc(t.buttons.prestige(pr.nextBalls, TUNING.balls.prestigeCoreCost))}</button>`;
    }
    h += '</div>';
    return h;
  }

  /** 記録帳: 番付。頭に大きな数字、節目は達成順に大→小の帯、達成は朱印。封印は帯紙 */
  private record(state: SaveState): string {
    if (!state.recordOpen) return `<div class="locked-box">${LOCK_ICON}<p class="note">${esc(t.record.locked)}</p></div>`;
    let h = `<div class="banzuke"><div class="bz-title"><span>${esc(t.record.head)}</span></div>`;
    h += bigStats([
      [t.record.totalCatches, state.totalCatches],
      [t.record.best, t.record.beats(state.bestRun)],
      [t.record.runs, state.runs],
    ]);
    h += `<div class="bz-sub">${esc(t.record.milestonesHead)}</div><ol class="ms">`;
    MILESTONES.forEach((m, i) => {
      const d = isMilestoneDone(state, m.id);
      const gains = Object.entries(m.give)
        .map(([k, v]) => `${CURRENCY_ICON[k as CurrencyKey]}${esc(t.gain(v, t.currency[k as CurrencyKey]))}`)
        .join('<i class="sep"></i>');
      h += `<li class="${d ? 'done' : 'todo'}" style="--i:${i}">${d ? STAMP_ICON : CIRCLE_ICON}<span class="lb">${esc(t.milestones[m.id] ?? m.id)}</span><span class="gain">${gains}</span></li>`;
    });
    h += '</ol></div>';
    const cleans = (Object.keys(PATTERNS) as PatternId[]).filter((id) => state.patClean[id]);
    if (cleans.length) {
      h += `<div class="bz-sub">${esc(t.record.recordsHead)}</div><ul class="ms cleans">`;
      for (const id of cleans) {
        const sealed = isSealed(state, id);
        h += `<li class="${sealed ? 'sealed' : ''}">${CURRENCY_ICON.clean}<span class="lb">${esc(t.record.patternClean(t.patterns[id].name))}</span><b>${state.patClean[id]}</b>${sealed ? `<span class="obi">${esc(t.seal.sealed)}</span>` : ''}</li>`;
      }
      h += '</ul>';
    }
    // 封印
    h += head(SEAL_ICON, t.seal.head) + `<p class="note">${esc(t.seal.intro)}</p>`;
    h += `<p class="note strong">${esc(t.seal.fatigueNow(state.balls, Math.round(initialFatigue(state) * 100) / 100))}</p>`;
    h += '<div class="seals">';
    for (const id of cleans) {
      const sealed = isSealed(state, id);
      h += `<div class="node${sealed ? ' max sealed' : ''}"><div class="nh"><span class="n">${esc(t.patterns[id].name)}</span><em>${esc(t.spec.ballsValue(PATTERNS[id].balls))}</em></div><div class="d">${esc(t.patterns[id].desc)}</div>`;
      if (sealed) h += `<span class="obi">${esc(t.seal.sealed)}</span>`;
      else h += `<button data-seal="${id}" class="price" ${canSeal(state, id) ? '' : 'disabled'}>${SEAL_ICON}${esc(t.seal.button)}</button>`;
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

/**
 * The shop.
 *
 * The most complex panel, and the one that decides whether the game is pleasant
 * to play. Three things it has to get right:
 *
 * 1. **The button never lies.** Price, count and affordability all come from one
 *    `buyPlan` call per tile, in the same frame the click handler will use. There
 *    is no second code path that could quote a different number.
 *
 * 2. **The full production stack is explainable.** Hovering a building shows
 *    every multiplier currently applied and what the purchase would add, because
 *    a player staring at ×340 has to be able to find out where it came from.
 *
 * 3. **Rendering is keyed, not unconditional.** A filter change rebuilds the
 *    list; a purchase rebuilds only the tile that changed. Rebuilding everything
 *    on a timer is what makes a shop feel like it is stuttering.
 */

import {
  BUILDINGS, CLICK_UPGRADES, COOKIE_UPGRADES, MILESTONES,
  PRIMARY_TABS, PRESTIGE_UPGRADES, RESEARCH, SHOP_PANELS,
} from '../../../shared/balance.js';
import { fmt, fmtMult, fmtRate } from '../../../shared/format.js';
import { buyPlan, prestigePlan, prestigeStats } from '../../../shared/economy.js';
import { UI } from '../config.js';
import { delegate, el, fill, labelNode } from './dom.js';
import { hideTooltip, multiplierRows, showTooltip, tipRow } from './tooltip.js';
import { confirmDialog } from './dialog.js';

/** Which table each panel draws from, and how a tile in it is bought. */
const PANEL_SPECS = {
  buildings: { family: null, table: BUILDINGS },
  click: { family: 'click', table: CLICK_UPGRADES },
  cookies: { family: 'cookie', table: COOKIE_UPGRADES },
  research: { family: 'research', table: RESEARCH },
  prestige: { family: 'prestige', table: PRESTIGE_UPGRADES },
};

const FILTERS = {
  all: { label: 'All', test: () => true },
  affordable: { label: 'Affordable', test: (item, ctx) => ctx.affordable(item) && !ctx.owned(item) },
  owned: { label: 'Owned', test: (item, ctx) => ctx.owned(item) },
  locked: { label: 'Not owned', test: (item, ctx) => !ctx.owned(item) },
};

const state = {
  primary: 'production',
  panel: 'buildings',
  filter: 'all',
  search: '',
  searchTimer: 0,
  page: 1,
};

let game = null;
let refs = null;
/** id -> the live tile, so a purchase can repaint just that one. */
let tiles = new Map();

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

export function mountShop(controller) {
  game = controller;
  refs = {
    primaryStrip: document.getElementById('shop-primary'),
    subStrip: document.getElementById('shop-sub'),
    list: document.getElementById('shop-list'),
    resultCount: document.getElementById('shop-count'),
    search: document.getElementById('shop-search'),
    searchClear: document.getElementById('shop-search-clear'),
    buyRow: document.getElementById('buy-amount'),
    pageStrip: document.getElementById('page-strip'),
    pageLabel: document.getElementById('page-label'),
    pagePrev: document.getElementById('page-prev'),
    pageNext: document.getElementById('page-next'),
    filterChips: document.getElementById('shop-filters'),
  };

  fill(refs.primaryStrip, PRIMARY_TABS.map((tab) =>
    el('button.chip', {
      type: 'button',
      class: tab.id === state.primary ? 'is-active' : null,
      dataset: { primary: tab.id },
      on: { click: () => selectPrimary(tab.id) },
    }, [labelNode(tab.label)])));

  fill(refs.filterChips, Object.entries(FILTERS).map(([id, def]) =>
    el('button.chip.chip--sm', {
      type: 'button',
      class: id === state.filter ? 'is-active' : null,
      dataset: { filter: id },
      on: { click: () => selectFilter(id) },
    }, [labelNode(def.label)])));

  fill(refs.buyRow, [1, 10, 100, 'max'].map((amount) =>
    el('button.chip.chip--sm', {
      type: 'button',
      class: game.state.prefs.buyAmount === amount ? 'is-active' : null,
      dataset: { amount: String(amount) },
      text: amount === 'max' ? 'Max' : `×${amount}`,
      on: { click: () => selectBuyAmount(amount) },
    })));

  refs.search.addEventListener('input', (event) => {
    const value = event.target.value;
    refs.searchClear.classList.toggle('is-visible', value.length > 0);
    // Debounced: re-pricing sixty tiles on every keystroke is what makes a
    // search box feel laggy, and the player cannot read the results mid-type
    // anyway.
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => {
      state.search = value.trim().toLowerCase();
      state.page = 1;
      renderShop(game, game.now(), true);
    }, UI.searchDebounceMs);
  });

  refs.searchClear.addEventListener('click', () => {
    clearTimeout(state.searchTimer);
    state.search = '';
    refs.search.value = '';
    refs.searchClear.classList.remove('is-visible');
    state.page = 1;
    renderShop(game, game.now(), true);
    refs.search.focus();
  });

  refs.pagePrev.addEventListener('click', () => {
    state.page = Math.max(1, state.page - 1);
    renderShop(game, game.now(), true);
  });
  refs.pageNext.addEventListener('click', () => {
    state.page += 1;
    renderShop(game, game.now(), true);
  });

  // One delegated click handler for the whole list. Tiles are replaced on every
  // filter change, so per-tile listeners would have to be re-attached constantly.
  //
  // The id comes from `data-buy` on the button itself. The enclosing tile also
  // carries `data-id`, and reading that off the button instead yields `undefined`
  // -- which resolves to no such item and makes every purchase a silent no-op.
  delegate(refs.list, '[data-buy]', (node) => {
    const id = node.dataset.buy;
    if (state.panel === 'prestige') buyPrestige(id);
    else if (state.panel === 'buildings') buyBuilding(id);
    else buyUpgrade(PANEL_SPECS[state.panel].family, id);
  });

  delegate(refs.list, '.tile', (node, event) => {
    if (event.target.closest('[data-buy]')) return;
    // Tapping the tile body is a deliberate alias for the button, so a player
    // does not have to hit a small target.
    const button = node.querySelector('[data-buy]');
    if (button && !button.disabled) button.click();
  });

  selectPrimary(state.primary, { silent: true });
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

function selectPrimary(id, { silent = false } = {}) {
  state.primary = id;
  for (const chip of refs.primaryStrip.children) {
    chip.classList.toggle('is-active', chip.dataset.primary === id);
  }

  const subs = SHOP_PANELS.filter((p) => p.primary === id);
  fill(refs.subStrip, subs.map((panel) =>
    el('button.chip.chip--sm', {
      type: 'button',
      class: panel.id === state.panel ? 'is-active' : null,
      dataset: { panel: panel.id },
      on: { click: () => selectPanel(panel.id) },
    }, [labelNode(panel.label)])));

  // A primary tab whose panels have nothing in common with the current selection
  // switches to its first panel rather than showing an empty list.
  if (!subs.some((p) => p.id === state.panel)) {
    selectPanel(subs[0].id, { silent: true });
  } else {
    syncSubChips();
  }

  refs.buyRow.hidden = !currentPanel().buyAmount;
  if (!silent) renderShop(game, game.now(), true);
}

function selectPanel(id, { silent = false } = {}) {
  state.panel = id;
  state.page = 1;
  syncSubChips();
  refs.buyRow.hidden = !currentPanel().buyAmount;
  if (!silent) renderShop(game, game.now(), true);
}

function syncSubChips() {
  for (const chip of refs.subStrip.children) {
    chip.classList.toggle('is-active', chip.dataset.panel === state.panel);
  }
}

function selectFilter(id) {
  state.filter = id;
  state.page = 1;
  for (const chip of refs.filterChips.children) {
    chip.classList.toggle('is-active', chip.dataset.filter === id);
  }
  renderShop(game, game.now(), true);
}

function selectBuyAmount(amount) {
  game.setBuyAmount(amount);
  for (const chip of refs.buyRow.children) {
    chip.classList.toggle('is-active', chip.dataset.amount === String(amount));
  }
  renderShop(game, game.now(), true);
}

function currentPanel() {
  return SHOP_PANELS.find((p) => p.id === state.panel) ?? SHOP_PANELS[0];
}

// ---------------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------------

function buyBuilding(id) {
  const result = game.buyBuilding(id);
  if (result.ok) {
    // One tile, one repaint. Everything else on screen is still correct.
    repaintTile(id);
    refs.resultCount.textContent = resultCountText();
  }
}

function buyUpgrade(family, id) {
  const result = game.buyUpgrade(family, id);
  if (result.ok) {
    repaintTile(id);
    refs.resultCount.textContent = resultCountText();
  }
}

function buyPrestige(id) {
  const result = game.buyPrestige(id);
  if (result.ok) repaintTile(id);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** Full rebuild. `force` ignores the render gate. */
export function renderShop(controller, now, force = false) {
  if (!refs || game !== controller) return;
  hideTooltip();

  const spec = PANEL_SPECS[state.panel];
  const ctx = ownershipContext(spec, controller);
  let items = spec.table.filter((item) => matches(item, ctx, controller));

  if (state.panel === 'research') items = groupResearch(items);

  const pageSize = currentPanel().pageSize;
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  state.page = Math.min(Math.max(1, state.page), pages);

  const slice = items.slice((state.page - 1) * pageSize, state.page * pageSize);

  tiles = new Map();
  const rendered = slice.map((item) => {
    const tile = buildTile(item, spec, controller);
    if (tile) tiles.set(item.id, tile);
    return tile;
  }).filter(Boolean);

  fill(refs.list, rendered.length ? rendered : el('p.empty', {
    text: state.search || state.filter !== 'all'
      ? 'Nothing matches that.'
      : 'Nothing here yet.',
  }));

  refs.resultCount.textContent = resultCountText();
  renderPagination(items.length, pages);
}

function resultCountText() {
  const spec = PANEL_SPECS[state.panel];
  const ctx = ownershipContext(spec, game);
  const shown = spec.table.filter((item) => matches(item, ctx, game)).length;
  return `${shown} of ${spec.table.length}`;
}

function renderPagination(total, pages) {
  const needed = pages > 1;
  refs.pageStrip.hidden = !needed;
  if (!needed) return;

  const size = currentPanel().pageSize;
  const first = (state.page - 1) * size + 1;
  const last = Math.min(state.page * size, total);
  fill(refs.pageLabel,
    el('span.page-now', { text: `Page ${state.page} of ${pages}` }),
    el('span.page-range', { text: `${first}–${last} of ${total}` }));

  refs.pagePrev.disabled = state.page <= 1;
  refs.pageNext.disabled = state.page >= pages;
}

/** Owned / affordable predicates, one place per item kind. */
function ownershipContext(spec, controller) {
  const s = controller.state;
  const chips = s.chips;

  return {
    owned(item) {
      switch (spec.family) {
        case 'click': return s.upgrades.click[item.id] === true;
        case 'cookie': return s.upgrades.cookie[item.id] === true;
        case 'research': return s.upgrades.research[item.id] === true;
        case 'prestige': return (s.prestige[item.id] ?? 0) > 0;
        default: return (s.buildings[item.id] ?? 0) > 0;
      }
    },
    affordable(item) {
      switch (spec.family) {
        case 'click':
        case 'cookie':
        case 'research':
          return !this.owned(item) && s.cookies >= item.cost;
        case 'prestige':
          return !this.owned(item) || prestigePlan(s, item, s.prefs.buyAmount).affordable;
        default:
          return buyPlan(s, item, s.prefs.buyAmount).affordable;
      }
    },
  };
}

function matches(item, ctx, controller) {
  if (!FILTERS[state.filter].test(item, ctx)) return false;
  if (!state.search) return true;

  const haystack = `${item.name} ${item.description ?? ''} ${item.lore ?? ''}`.toLowerCase();
  return haystack.includes(state.search);
}

/** Insert a category heading before a research tile, collapsing repeats. */
function groupResearch(items) {
  const out = [];
  let lastGroup = null;
  for (const item of items) {
    const group = researchGroup(item);
    if (group && group !== lastGroup) {
      out.push({ __heading: group });
      lastGroup = group;
    }
    out.push(item);
  }
  return out;
}

function researchGroup(item) {
  if (item.kind === 'synergy') return 'Synergies';
  if (item.kind === 'kitten') return 'Kittens';
  if (item.kind === 'golden') return 'Golden cookies';
  return 'Technology';
}

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

function buildTile(item, spec, controller) {
  if (item.__heading) return el('h3.group-heading', { text: item.__heading });

  switch (spec.family) {
    case 'click': return upgradeTile(item, 'click', controller);
    case 'cookie': return upgradeTile(item, 'cookie', controller);
    case 'research': return upgradeTile(item, 'research', controller);
    case 'prestige': return prestigeTile(item, controller);
    default: return buildingTile(item, controller);
  }
}

function buildingTile(building, controller) {
  const s = controller.state;
  const plan = buyPlan(s, building, s.prefs.buyAmount);
  const owned = s.buildings[building.id] ?? 0;

  // The /sec delta is the number that makes a purchase decision obvious, and it
  // is free: `cps` accepts an ownership override and never touches the state.
  const delta = controller.previewBuildingGain(building, Math.max(1, plan.count));

  const tile = el('div.tile', {
    class: `tile--building${plan.affordable ? ' is-affordable' : ''}${owned ? ' is-owned' : ''}`,
    dataset: { id: building.id },
    on: {
      pointerenter: (e) => buildingTip(e.currentTarget, building, plan, controller),
      pointerleave: hideTooltip,
    },
  }, [
    el('span.tile-icon', { icon: building.icon, 'aria-hidden': 'true' }),
    el('div.tile-body', {}, [
      el('div.tile-name', {}, [
        building.name,
        el('span.tile-owned', { text: `×${owned}` }),
      ]),
      el('div.tile-desc', { text: building.description }),
      el('div.tile-stats', {}, [
        el('span', { text: `${fmtRate(building.cps)}/sec each` }),
        el('span.tile-delta', { class: delta > 0 ? 'is-up' : null, text: `${fmtSigned(delta)}/sec` }),
      ]),
    ]),
    el('div.tile-buy', {}, [
      el('span.tile-cost', { text: fmt(plan.count > 0 ? plan.total : plan.unit) }),
      el('button.btn.btn--buy', {
        type: 'button',
        dataset: { buy: building.id },
        disabled: !plan.affordable,
        text: buyLabel(plan, s.prefs.buyAmount),
      }),
    ]),
  ]);

  return tile;
}

function upgradeTile(item, family, controller) {
  const s = controller.state;
  const owned = s.upgrades[family][item.id] === true;
  const affordable = !owned && s.cookies >= item.cost;

  const tile = el('div.tile', {
    class: `tile--upgrade${owned ? ' is-owned' : ''}${affordable ? ' is-affordable' : ''}`,
    dataset: { id: item.id },
    on: {
      pointerenter: (e) => upgradeTip(e.currentTarget, item, family, controller),
      pointerleave: hideTooltip,
    },
  }, [
    el('span.tile-icon', { icon: item.icon, 'aria-hidden': 'true' }),
    el('div.tile-body', {}, [
      el('div.tile-name', { text: item.name }),
      el('div.tile-desc', { text: item.description }),
      el('div.tile-stats', { text: owned ? 'Purchased' : effectLine(item) }),
    ]),
    el('div.tile-buy', {}, [
      el('span.tile-cost', { text: owned ? '—' : fmt(item.cost) }),
      el('button.btn.btn--buy', {
        type: 'button',
        dataset: { buy: item.id },
        disabled: owned || !affordable,
        text: owned ? 'Owned' : 'Buy',
      }),
    ]),
  ]);

  return tile;
}

function prestigeTile(upgrade, controller) {
  const s = controller.state;
  const level = s.prestige[upgrade.id] ?? 0;
  const plan = prestigePlan(s, upgrade, s.prefs.buyAmount);
  const maxed = plan.maxed;

  const tile = el('div.tile', {
    class: `tile--prestige${maxed ? ' is-maxed' : ''}${plan.affordable ? ' is-affordable' : ''}`,
    dataset: { id: upgrade.id },
    on: {
      pointerenter: (e) => prestigeTip(e.currentTarget, upgrade, level, plan, controller),
      pointerleave: hideTooltip,
    },
  }, [
    el('span.tile-icon', { icon: upgrade.icon, 'aria-hidden': 'true' }),
    el('div.tile-body', {}, [
      el('div.tile-name', {}, [
        upgrade.name,
        el('span.tile-owned', { text: `Lv ${level}/${upgrade.maxLevel}` }),
      ]),
      el('div.tile-desc', { text: upgrade.description }),
      // A single flex child, because `.tile-stats` lays its children out with a
      // gap: three separate nodes would put half a space either side of the ✨.
      el('div.tile-stats', {}, [
        maxed
          ? 'Fully upgraded'
          : el('span', {}, [
            `${fmt(plan.want * upgrade.costPerLevel)} `,
            el('span', { icon: '✨', 'aria-hidden': 'true' }),
            ` for ${plan.want} level${plan.want === 1 ? '' : 's'}`,
          ]),
      ]),
    ]),
    el('div.tile-buy', {}, [
      // Same fallback as buildings: a Max plan the player cannot afford has a
      // total of zero, and "0" as the price of the next thing is the one number
      // on this tile that must never be a lie.
      el('span.tile-cost', { text: maxed ? 'MAX' : fmt(plan.want > 0 ? plan.cost : upgrade.costPerLevel) }),
      el('button.btn.btn--buy', {
        type: 'button',
        dataset: { buy: upgrade.id },
        disabled: maxed || !plan.affordable,
        text: maxed ? 'Maxed' : buyLabel(plan, s.prefs.buyAmount),
      }),
    ]),
  ]);

  return tile;
}

/** Repaint a single tile in place after a purchase. */
function repaintTile(id) {
  const old = tiles.get(id);
  const spec = PANEL_SPECS[state.panel];
  const item = spec.table.find((entry) => entry.id === id);

  if (!old || !item) {
    // The tile may have just changed filter membership -- purchasing the last
    // un-owned cookie upgrade while the "Not owned" filter is active removes it
    // from the list entirely. A rebuild is the honest response.
    renderShop(game, game.now(), true);
    return;
  }

  const fresh = buildTile(item, spec, game);
  if (!fresh) {
    renderShop(game, game.now(), true);
    return;
  }
  old.replaceWith(fresh);
  tiles.set(id, fresh);
}

// ---------------------------------------------------------------------------
// Labels and formatting helpers
// ---------------------------------------------------------------------------

function buyLabel(plan, amount) {
  if (amount === 'max') return plan.count > 0 ? `Max ×${plan.count}` : 'Max';
  return `Buy ×${plan.count}`;
}

function effectLine(item) {
  if (item.cpsBonus) return `+${item.cpsBonus}% production`;
  if (item.cpcBonus) return `+${item.cpcBonus} per click`;
  if (item.cpcMultiplier) return `×${item.cpcMultiplier} click power`;
  if (item.cpcPercent) return `+${Math.round(item.cpcPercent * 100)}% click power`;
  if (item.goldenChance) return `${Math.round(item.goldenChance * 100)}% golden per click`;
  if (item.unlocksGolden) return 'Unlocks golden cookies';
  if (item.kind === 'synergy') return 'Multiplies another building';
  if (item.buildingMult) return `×${item.buildingMult.multiplier} one building`;
  if (item.globalMult) return `×${item.globalMult} everything`;
  if (item.goldenSpeed) return `×${item.goldenSpeed} golden frequency`;
  if (item.perMilestone) return `+${Math.round(item.perMilestone * 100)}% per achievement`;
  return 'One-time';
}

function fmtSigned(n) {
  // Signed and truncated, so a delta never over-promises either.
  return n >= 0 ? `+${fmtRate(n)}` : `-${fmtRate(-n)}`;
}

// ---------------------------------------------------------------------------
// Tooltips
// ---------------------------------------------------------------------------

function buildingTip(node, building, plan, controller) {
  const d = controller.derived;
  const rows = [
    tipRow({ label: 'Owned', value: String(controller.state.buildings[building.id] ?? 0) }),
    tipRow({ label: 'Each', value: `${fmtRate(building.cps)}/sec` }),
    tipRow({ label: 'Next one', value: `${fmtRate(controller.previewBuildingGain(building, 1))}/sec`, tone: 'good' }),
  ];

  if (plan.affordable) {
    rows.push(tipRow({
      label: `Buying ×${plan.count}`,
      value: `${fmtRate(controller.previewBuildingGain(building, plan.count))}/sec`,
      tone: 'good',
    }));
    rows.push(tipRow({ label: 'Total cost', value: fmt(plan.total) }));
  } else {
    // With nothing affordable the Max plan is zero-length, so the only useful
    // figures are the price of the next one and how far short the player is.
    rows.push(tipRow({ label: 'Next one costs', value: fmt(plan.unit), tone: 'gold' }));
    rows.push(tipRow({
      label: 'Short by',
      value: fmt(plan.unit - controller.state.cookies),
      tone: 'bad',
    }));
    rows.push(tipRow({ label: 'You have', value: fmt(controller.state.cookies) }));
  }

  rows.push(
    '—',
    ...multiplierRows(d.mults, fmtMult),
    tipRow({ label: 'Current total', value: `${fmtMult(d.mults.total)}`, tone: 'gold' }),
  );

  showTooltip(node, {
    title: building.name,
    icon: building.icon,
    subtitle: building.lore,
    rows,
    footer: controller.state.prefs.buyAmount === 'max'
      ? 'Max: buys everything you can afford right now.'
      : 'Change the buy amount above the list.',
  });
}

function upgradeTip(node, item, family, controller) {
  const s = controller.state;
  const owned = s.upgrades[family][item.id] === true;

  const rows = [tipRow({ label: 'Cost', value: fmt(item.cost), tone: owned ? null : 'gold' })];

  if (owned) {
    rows.push('Already purchased.');
  } else {
    rows.push(tipRow({ label: 'You have', value: fmt(s.cookies) }));
    rows.push(tipRow({
      label: 'Short by',
      value: s.cookies >= item.cost ? '—' : fmt(item.cost - s.cookies),
      tone: s.cookies >= item.cost ? null : 'bad',
    }));
  }

  // Every upgrade's effect, stated as a concrete before/after where possible.
  if (item.cpsBonus) {
    const m = controller.derived.mults.cookie;
    rows.push('—');
    rows.push(tipRow({ label: 'Production multiplier', value: fmtMult(m) }));
    rows.push(tipRow({
      label: 'If bought',
      value: fmtMult(m + item.cpsBonus / 100),
      tone: 'good',
    }));
  }
  if (item.cpcMultiplier || item.cpcBonus || item.cpcPercent) {
    const c = controller.derived.click;
    const factor = (item.cpcMultiplier ?? 1) * (1 + (item.cpcPercent ?? 0));
    const bonus = item.cpcBonus ? ` +${item.cpcBonus}` : '';
    rows.push('—');
    rows.push(tipRow({ label: 'Per click now', value: fmtRate(c.value) }));
    rows.push(tipRow({ label: 'If bought', value: `${fmtRate((c.base + bonus) * factor)}`, tone: 'good' }));
  }
  if (item.unlocksGolden) rows.push('Golden cookies then appear on their own, roughly every two minutes.');
  if (item.goldenChance) {
    rows.push('—');
    rows.push(tipRow({ label: 'Chance per click', value: `${Math.round(item.goldenChance * 100)}%` }));
  }
  if (item.kind === 'synergy') {
    rows.push('—');
    rows.push(tipRow({ label: 'Source building', value: item.source }));
    rows.push(tipRow({ label: 'Per source owned', value: `${item.rate * 100}%` }));
    rows.push(tipRow({ label: 'You own', value: String(s.buildings[item.source] ?? 0) }));
  }
  if (item.buildingMult) {
    rows.push('—');
    rows.push(tipRow({ label: 'Building', value: item.buildingMult.target }));
    rows.push(tipRow({ label: 'Multiplier', value: `×${item.buildingMult.multiplier}` }));
  }
  if (item.perMilestone) {
    const mults = controller.derived.mults.kitten;
    rows.push('—');
    rows.push(tipRow({ label: 'Per achievement', value: `${item.perMilestone * 100}%` }));
    rows.push(tipRow({ label: 'You have', value: String(s.achievements.length) }));
    rows.push(tipRow({ label: 'Multiplier now', value: fmtMult(mults) }));
  }

  showTooltip(node, { title: item.name, icon: item.icon, rows });
}

function prestigeTip(node, upgrade, level, plan, controller) {
  const stats = prestigeStats(controller.state);
  const rows = [
    tipRow({ label: 'Level', value: `${level} / ${upgrade.maxLevel}` }),
    tipRow({ label: 'Cost per level', value: `${upgrade.costPerLevel} ✨`, tone: 'gold' }),
    '—',
    tipRow({ label: 'Chips held', value: `${fmt(controller.state.chips)} ✨`, tone: 'gold' }),
    tipRow({ label: 'Next ascension yields', value: `${controller.chipGain} ✨`, tone: 'good' }),
    tipRow({ label: 'Lifetime baked', value: fmt(controller.state.totalCookies) }),
  ];

  if (!plan.maxed) {
    rows.push('—');
    rows.push(tipRow({ label: `Buying ${plan.want} level${plan.want === 1 ? '' : 's'}`, value: `${fmt(plan.cost)} ✨`, tone: 'gold' }));
  }

  showTooltip(node, {
    title: upgrade.name,
    icon: upgrade.icon,
    subtitle: upgrade.lore,
    rows,
    footer: upgrade.description,
  });
}

// ---------------------------------------------------------------------------
// Ascension control
// ---------------------------------------------------------------------------

/**
 * The Ascend control, mounted into the settings panel.
 *
 * It lives there rather than inside the prestige list because it is the only
 * irreversible action in the game, and burying it as the first row of a
 * paginated list is how players lose a run by accident.
 *
 * Returns its own render function rather than rendering once and being done: the
 * button's enabled state depends on lifetime cookies, which rise constantly, and
 * a button rendered once at mount stays disabled for the rest of the session.
 */
export function mountAscend(controller) {
  const host = document.getElementById('ascend-bar');
  if (!host) return () => {};

  const render = () => {
    const gain = controller.chipGain;
    const enabled = gain > 0;

    fill(host,
      el('div.ascend-info', {}, [
        el('div.ascend-title', { text: 'Ascend' }),
        el('div.ascend-sub', { text: enabled
          ? `Reset your empire for ${gain} Heavenly Chip${gain === 1 ? '' : 's'}.`
          : `Bake ${fmt(1e12)} lifetime cookies to earn your first chip.` }),
        el('div.ascend-sub', {}, [
          el('span', {}, [
            `You hold ${fmt(controller.state.chips)} `,
            el('span', { icon: '✨', 'aria-hidden': 'true' }),
            ` · ${controller.state.ascensions} ascension${controller.state.ascensions === 1 ? '' : 's'}`,
          ]),
        ]),
      ]),
      el('button.btn.btn--ascend', {
        type: 'button',
        text: enabled ? `Ascend (+${gain})` : 'Locked',
        disabled: !enabled,
        on: { click: () => confirmAscend(controller) },
      }),
    );
  };

  controller.events.on('ascended', render);
  render();
  return render;
}

async function confirmAscend(controller) {
  const gain = controller.chipGain;
  if (gain <= 0) return;

  const milestones = MILESTONES.filter((m) => controller.state.achievements.length >= m.count);

  const body = [
    el('p', { text: `You will bank ${gain} Heavenly Chip${gain === 1 ? '' : 's'} and your empire resets to nothing.` }),
    el('p.keep', { text: 'Kept: achievements, ascension upgrades, chips, garden, market, themes and skins.' }),
    el('p.lose', { text: 'Lost: every cookie, building, upgrade and unlocked ability.' }),
    el('p.keep', { text: `You currently hold ${fmt(controller.state.chips)} chips and ${milestones.length} milestone bonus${milestones.length === 1 ? '' : 'es'}.` }),
  ];

  const ok = await confirmDialog('Ascend?', body, {
    confirmLabel: `Ascend for ${gain}`,
    tone: 'danger',
    icon: '✨',
  });
  if (ok) controller.ascend();
}

// ---------------------------------------------------------------------------
// Public helpers used by main.js
// ---------------------------------------------------------------------------

export function refreshShop() {
  renderShop(game, game.now(), true);
}

export function syncBuyAmountChips() {
  for (const chip of refs.buyRow.children) {
    chip.classList.toggle('is-active', chip.dataset.amount === String(game.state.prefs.buyAmount));
  }
}

/**
 * The save-state shape, and the only sanctioned way to create one.
 *
 * The rule this module enforces by construction: **every collection is a plain
 * object keyed by id, never an array.** Arrays of `{id, owned}` get reordered by
 * JSON round-trips, dropped by hand-edits, and go stale the moment an item is
 * added to the balance tables. Keyed records mean a save from an older version
 * loads with the new items present and at zero, which is what a player expects.
 *
 * There is exactly one mutable game state in the app; it is created here and
 * nowhere else.
 */

import {
  ABILITIES, BALANCE_VERSION, BUILDINGS, CLICK_UPGRADES, COOKIE_SKINS, COOKIE_UPGRADES,
  GARDEN, MARKET, PRESTIGE_UPGRADES, RESEARCH, STOCKS, THEME_BY_ID, THEMES,
} from './balance.js';
import { prestigeStats } from './economy.js';

/** A state good enough to save at any moment, with every collection populated. */
export function createState(now = Date.now()) {
  return {
    version: BALANCE_VERSION,
    createdAt: now,
    lastSeenAt: now,
    playMs: 0,

    // --- wallet ---
    cookies: 0,
    totalCookies: 0,
    totalClicks: 0,

    // --- ascension ---
    chips: 0,
    totalChips: 0,
    ascensions: 0,
    prestige: Object.fromEntries(PRESTIGE_UPGRADES.map((u) => [u.id, 0])),

    // --- content progress ---
    buildings: Object.fromEntries(BUILDINGS.map((b) => [b.id, 0])),
    upgrades: {
      click: Object.fromEntries(CLICK_UPGRADES.map((u) => [u.id, false])),
      cookie: Object.fromEntries(COOKIE_UPGRADES.map((u) => [u.id, false])),
      research: Object.fromEntries(RESEARCH.map((u) => [u.id, false])),
    },
    achievements: [],

    // --- timed effects ---
    buffs: [],
    abilities: Object.fromEntries(ABILITIES.map((a) => [
      a.id, { unlocked: false, cooldownUntil: 0, activeUntil: 0 },
    ])),
    /** Golden cookies currently on screen: {id, until}. */
    goldens: [],
    goldenUntil: 0,

    // --- minigames ---
    garden: {
      plotCount: GARDEN.basePlots,
      plots: new Array(GARDEN.basePlots).fill(null),
    },
    market: STOCKS.map((s) => ({
      symbol: s.symbol,
      price: s.startPrice,
      shares: 0,
      history: [s.startPrice],
    })),
    marketLastTick: 0,

    // --- stats / prefs ---
    stats: {
      harvests: 0,
      trades: 0,
      goldenClicked: 0,
      bestCps: 0,
      clicksSinceGolden: 0,
      ascensionsTotal: 0,
    },
    prefs: {
      theme: 'lagoon',
      fontScale: 1,
      reduceMotion: false,
      buyAmount: 1,
      ownedSkins: ['classic'],
      skin: 'classic',
      themesUsed: ['lagoon'],
    },
  };
}

/**
 * Re-shape a state after new content has been added to the balance tables.
 *
 * Runs on every load. Fills in any id the state has never heard of and drops
 * any id that no longer exists, so a save from three versions ago is still
 * loadable. Mutates and returns the same object for convenience at the call
 * site.
 */
export function reconcileState(state) {
  if (!Array.isArray(state.buffs)) state.buffs = [];
  if (!Array.isArray(state.achievements)) state.achievements = [];
  if (!Array.isArray(state.market)) state.market = [];

  // Negative balances are not a state the game can represent: every price check
  // is `cookies >= cost`, so a negative balance would let a player "afford"
  // things while owing the game cookies. Clamping here means the invariant holds
  // for any state that passes through here, not only for ones `save.load` built.
  state.cookies = clampNumber(state.cookies, 0);
  state.totalCookies = clampNumber(state.totalCookies, 0);
  state.totalClicks = clampNumber(state.totalClicks, 0, Math.floor);
  state.chips = clampNumber(state.chips, 0);
  state.totalChips = clampNumber(state.totalChips, 0);
  state.ascensions = clampNumber(state.ascensions, 0, Math.floor);

  state.version = BALANCE_VERSION;

  // Nested objects are normalised first. This function is called on loaded saves
  // and on states assembled by hand, and reaching `state.garden.plotCount` on a
  // save whose `garden` was null throws instead of repairing -- which is exactly
  // the case reconciliation exists to handle.
  for (const key of ['prefs', 'stats', 'garden', 'market']) {
    if (!state[key] || typeof state[key] !== 'object') {
      state[key] = structuredClone(createState(0)[key]);
    }
  }
  if (!state.upgrades || typeof state.upgrades !== 'object') {
    state.upgrades = structuredClone(createState(0).upgrades);
  }

  // Records: add missing, drop unknown.
  state.prestige = reconcileRecord(state.prestige, PRESTIGE_UPGRADES, () => 0);
  state.buildings = reconcileRecord(state.buildings, BUILDINGS, () => 0);
  state.abilities = reconcileRecord(state.abilities, ABILITIES, () => ({
    unlocked: false, cooldownUntil: 0, activeUntil: 0,
  }));

  for (const family of ['click', 'cookie', 'research']) {
    const table = {
      click: CLICK_UPGRADES, cookie: COOKIE_UPGRADES, research: RESEARCH,
    }[family];
    state.upgrades[family] = reconcileRecord(state.upgrades[family], table, () => false);
  }

  // The garden's plot count comes from a prestige upgrade, so it is recomputed
  // rather than trusted. It also gates how many plots are actually tracked:
  // a player who bought two more plots before a save was downgraded to none
  // would otherwise keep orphaned plants.
  state.garden.plotCount = clampPlots(state);
  state.garden.plots = fitPlots(state.garden.plots, state.garden.plotCount);

  // Cosmetics must resolve to something that exists.
  const { prefs } = state;
  prefs.ownedSkins = [...new Set(['classic', ...(prefs.ownedSkins ?? [])])]
    .filter((id) => COOKIE_SKINS.some((s) => s.id === id));
  if (!prefs.ownedSkins.includes(prefs.skin)) prefs.skin = 'classic';
  prefs.theme = THEME_BY_ID[prefs.theme] ? prefs.theme : 'lagoon';
  prefs.themesUsed = [...new Set(['lagoon', ...(prefs.themesUsed ?? [])])]
    .filter((id) => THEMES.some((t) => t.id === id));
  prefs.fontScale = clampFontScale(prefs.fontScale);
  prefs.buyAmount = sanitizeBuyAmount(prefs.buyAmount);

  // Market rows are keyed by symbol because the table order is not guaranteed to
  // survive a hand-edited save.
  const kept = new Map((state.market ?? []).map((m) => [m.symbol, m]));
  state.market = STOCKS.map((def) => {
    const prev = kept.get(def.symbol);
    return {
      symbol: def.symbol,
      price: Number.isFinite(prev?.price) && prev.price > 0 ? prev.price : def.startPrice,
      shares: Number.isFinite(prev?.shares) ? Math.max(0, Math.min(def.maxShares, Math.floor(prev.shares))) : 0,
      history: Array.isArray(prev?.history)
        ? prev.history.filter((p) => Number.isFinite(p) && p > 0).slice(-MARKET.historyLength)
        : [def.startPrice],
    };
  });
  if (!state.market[0].history.length) state.market[0].history.push(STOCKS[0].startPrice);

  return state;
}

function reconcileRecord(existing, table, makeDefault) {
  const out = {};
  const known = new Set(table.map((it) => it.id));
  for (const it of table) {
    const prev = existing?.[it.id];
    out[it.id] = prev === undefined || prev === null ? makeDefault() : prev;
  }
  // Preserve nothing unknown: an id that left the game has no meaning.
  for (const key of Object.keys(existing ?? {})) {
    if (!known.has(key)) delete existing[key];
  }
  return out;
}

function clampPlots(state) {
  const fromUpgrades = prestigeStats(state).gardenPlots;
  return Math.max(GARDEN.basePlots, Math.min(GARDEN.basePlots * 2, fromUpgrades));
}

function fitPlots(plots, count) {
  const arr = Array.isArray(plots) ? plots.slice(0, count) : [];
  while (arr.length < count) arr.push(null);
  return arr.map((p) => (p && typeof p === 'object' && typeof p.seedId === 'string' ? p : null));
}

function clampFontScale(scale) {
  const v = Number(scale);
  if (!Number.isFinite(v)) return 1;
  return Math.min(1.3, Math.max(0.85, Math.round(v * 100) / 100));
}

function clampNumber(value, min, round = Math.floor) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, round(n));
}

/** 'max' or a positive integer; anything else falls back to 1. */
export function sanitizeBuyAmount(amount) {
  if (amount === 'max') return 'max';
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(1000, Math.floor(n));
}

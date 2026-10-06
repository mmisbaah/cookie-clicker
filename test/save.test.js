import test from 'node:test';
import assert from 'node:assert/strict';
import { afterEach, beforeEach } from 'node:test';

import {
  ABILITIES, BALANCE_VERSION, BUILDINGS, COOKIE_UPGRADES, PERSISTENCE, PRESTIGE_UPGRADES,
  RESEARCH, STOCKS, THEMES,
} from '../shared/balance.js';
import { chipsGain, cps, derived } from '../shared/economy.js';
import { harvest, plant } from '../shared/garden.js';
import { createState, reconcileState, sanitizeBuyAmount } from '../shared/state.js';
import { exportSave, importSave, load, save, wipe } from '../shared/save.js';

const NOW = 1_700_000_000_000;

/**
 * A minimal in-memory Storage. Installed on globalThis before importing save.js
 * so the module's storage probe resolves to something real.
 */
function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    get length() { return map.size; },
    clear: () => map.clear(),
  };
}

let store;

beforeEach(() => {
  store = memoryStorage();
  globalThis.localStorage = store;
  globalThis.sessionStorage = memoryStorage();
});

afterEach(() => {
  delete globalThis.localStorage;
  delete globalThis.sessionStorage;
  wipe();
});

// ---------------------------------------------------------------------------
// reconcileState
// ---------------------------------------------------------------------------

test('a fresh state already satisfies the reconciler', () => {
  const s = createState(NOW);
  const after = reconcileState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(Object.keys(after.buildings).sort(), BUILDINGS.map((b) => b.id).sort());
  assert.deepEqual(Object.keys(after.prestige).sort(), PRESTIGE_UPGRADES.map((p) => p.id).sort());
  assert.deepEqual(Object.keys(after.abilities).sort(), ABILITIES.map((a) => a.id).sort());
  assert.equal(after.garden.plotCount, 6);
  assert.equal(after.garden.plots.length, 6);
});

test('reconcileState adds content added since the save was written', () => {
  // Simulates a balance update that adds a new building to a player mid-run.
  const s = createState(NOW);
  delete s.buildings.portal;
  delete s.prestige.gardenExpansion;
  delete s.upgrades.research.timeCompression;

  reconcileState(s);
  assert.equal(s.buildings.portal, 0, 'the new building appears, owned zero');
  assert.equal(s.prestige.gardenExpansion, 0);
  assert.equal(s.upgrades.research.timeCompression, false);
});

test('reconcileState drops content that has been removed', () => {
  const s = createState(NOW);
  s.buildings.demolishedFactory = 500;
  s.prestige.retiredUpgrade = 9;
  reconcileState(s);

  assert.equal('demolishedFactory' in s.buildings, false);
  assert.equal('retiredUpgrade' in s.prestige, false);
});

test('reconcileState repairs hostile values', () => {
  const s = createState(NOW);
  s.cookies = -5000;
  s.totalClicks = NaN;
  s.prefs.theme = 'not-a-theme';
  s.prefs.skin = 'not-a-skin';
  s.prefs.ownedSkins = ['classic', 'not-a-skin'];
  s.prefs.fontScale = 99;
  s.prefs.buyAmount = -3;
  s.buffs = 'not an array';
  s.achievements = null;
  s.stats = null;
  s.garden = null;
  s.market = 'garbage';

  reconcileState(s);

  assert.equal(s.cookies, 0, 'a negative balance is clamped, not honoured');
  assert.ok(Number.isFinite(s.totalClicks));
  assert.equal(s.prefs.theme, 'lagoon');
  assert.equal(s.prefs.skin, 'classic');
  assert.deepEqual(s.prefs.ownedSkins, ['classic']);
  assert.ok(s.prefs.fontScale <= 1.3);
  assert.deepEqual(s.buffs, []);
  assert.ok(Array.isArray(s.achievements));
  assert.ok(s.stats && typeof s.stats.harvests === 'number');
  assert.equal(s.garden.plotCount, 6);
  assert.equal(s.market.length, STOCKS.length);
});

test('garden plot count follows the prestige level, not the saved value', () => {
  const s = createState(NOW);
  s.prestige.gardenExpansion = 3;
  s.garden.plotCount = 6;
  s.garden.plots = [null];

  reconcileState(s);
  assert.equal(s.garden.plotCount, 9);
  assert.equal(s.garden.plots.length, 9, 'plots are fitted to the count');
  assert.deepEqual(s.garden.plots, new Array(9).fill(null));

  // Downgrading the save drops the extra plots rather than orphaning them.
  s.prestige.gardenExpansion = 0;
  reconcileState(s);
  assert.equal(s.garden.plotCount, 6);
  assert.equal(s.garden.plots.length, 6);
});

test('market rows are rebuilt from the table order and clamped', () => {
  const s = createState(NOW);
  s.market = [
    { symbol: 'GOLD', price: -5, shares: 9999, history: [-1, 0, 2000] },
    { symbol: 'FAKE', price: 10, shares: 1, history: [10] },
  ];
  reconcileState(s);

  assert.deepEqual(s.market.map((m) => m.symbol), STOCKS.map((x) => x.symbol));
  assert.ok(s.market.every((m) => m.price > 0));
  assert.ok(s.market.every((m) => m.shares >= 0));
  assert.ok(s.market.every((m) => m.history.every((p) => p > 0)));
  assert.ok(s.market.every((m) => m.history.length > 0), 'every row needs at least one price');
});

test('sanitizeBuyAmount accepts only max or a positive integer', () => {
  assert.equal(sanitizeBuyAmount('max'), 'max');
  assert.equal(sanitizeBuyAmount(1), 1);
  assert.equal(sanitizeBuyAmount(10), 10);
  assert.equal(sanitizeBuyAmount(3.7), 3);
  assert.equal(sanitizeBuyAmount(0), 1);
  assert.equal(sanitizeBuyAmount(-5), 1);
  assert.equal(sanitizeBuyAmount('nonsense'), 1);
  assert.equal(sanitizeBuyAmount(1e9), 1000);
  assert.equal(sanitizeBuyAmount(null), 1);
});

// ---------------------------------------------------------------------------
// Round trip
// ---------------------------------------------------------------------------

test('a full run survives a save and load unchanged', () => {
  const s = createState(NOW);
  s.cookies = 123_456;
  s.totalCookies = 9.87e12;
  s.totalClicks = 4321;
  s.chips = 17;
  s.totalChips = 20;
  s.ascensions = 3;
  s.prestige.heavenlyBoost = 12;
  s.buildings.grandma = 250;
  s.buildings.factory = 4;
  s.upgrades.click.strongerFinger = true;
  s.upgrades.cookie.honey = true;
  s.upgrades.research.grandmaSynergy = true;
  s.abilities.frenzy.unlocked = true;
  s.achievements = ['firstClick', 'jar'];
  s.stats.harvests = 12;
  s.stats.goldenClicked = 7;
  s.prefs.theme = 'forest';
  s.prefs.ownedSkins = ['classic', 'star'];
  s.prefs.skin = 'star';
  s.prefs.buyAmount = 'max';
  plant(s, 0, 'corn', NOW, 500);
  s.garden.plots[1] = { seedId: 'pumpkin', plantedAt: NOW, readyAt: NOW + 300_000, lockedCps: 500 };
  s.market[2].shares = 6;
  s.market[2].price = 1234;
  s.buffs = [{ kind: 'cpsMult', mult: 7, until: NOW + 20_000 }];

  const before = cps(s, NOW);
  assert.ok(save(s, NOW).ok);
  assert.ok(store.getItem(PERSISTENCE.storageKey), 'the run reached storage');

  const { state: loaded, fresh, repairs } = load(NOW + 1000);
  assert.equal(fresh, false);
  assert.deepEqual(repairs, []);

  assert.equal(loaded.cookies, s.cookies);
  assert.equal(loaded.totalCookies, s.totalCookies);
  assert.equal(loaded.totalClicks, s.totalClicks);
  assert.equal(loaded.chips, s.chips);
  assert.equal(loaded.totalChips, s.totalChips);
  assert.equal(loaded.ascensions, s.ascensions);
  assert.equal(loaded.prestige.heavenlyBoost, 12);
  assert.equal(loaded.buildings.grandma, 250);
  assert.equal(loaded.upgrades.research.grandmaSynergy, true);
  assert.equal(loaded.abilities.frenzy.unlocked, true);
  assert.deepEqual(loaded.achievements, ['firstClick', 'jar']);
  assert.equal(loaded.stats.harvests, 12);
  assert.equal(loaded.prefs.theme, 'forest');
  assert.equal(loaded.prefs.skin, 'star');
  assert.equal(loaded.prefs.buyAmount, 'max');
  assert.equal(loaded.garden.plots[0].seedId, 'corn');
  assert.equal(loaded.garden.plots[1].seedId, 'pumpkin');
  assert.equal(loaded.market[2].shares, 6);
  assert.equal(loaded.market[2].price, 1234);

  // The headline invariant: production is identical across the round trip.
  assert.ok(Math.abs(cps(loaded, NOW) - before) < 1e-9);
  assert.equal(chipsGain(loaded), chipsGain(s));
});

test('the buff survives only while it is still live', () => {
  const s = createState(NOW);
  s.buildings.grandma = 100;
  s.buffs = [{ kind: 'cpsMult', mult: 7, until: NOW + 30_000 }];
  save(s, NOW);

  const live = load(NOW + 1000);
  assert.equal(live.state.buffs.length, 1);

  // Compare against the same save with the buff removed, not against a different
  // timestamp -- both timestamps are inside the buff, so both are boosted.
  const unbuffed = structuredClone(live.state);
  unbuffed.buffs = [];
  assert.ok(Math.abs(cps(live.state, NOW + 1000) / cps(unbuffed, NOW + 1000) - 7) < 1e-9,
    'the buff loaded from disk is still multiplying production');

  const dead = load(NOW + 60_000);
  assert.equal(dead.state.buffs.length, 0, 'expired buffs are dropped on load');
});

test('an expired crop still ripens after the round trip', () => {
  const s = createState(NOW);
  s.cookies = 1e9;
  plant(s, 0, 'carrot', NOW, 1000);
  save(s, NOW);

  const { state } = load(NOW + 60_000);
  const r = harvest(state, 0, NOW + 60_000);
  assert.ok(r.ok, 'a crop does not stop growing because the page was closed');
  assert.equal(r.amount, 10_000);
});

test('save stamps lastSeenAt so offline earnings can be computed on load', () => {
  const s = createState(NOW);
  save(s, NOW + 5_000);
  const { state } = load(NOW + 5_000);
  assert.equal(state.lastSeenAt, NOW + 5_000);
  assert.equal(state.version, BALANCE_VERSION);
});

// ---------------------------------------------------------------------------
// Corruption and absence
// ---------------------------------------------------------------------------

test('a fresh install reports fresh rather than throwing', () => {
  const result = load(NOW);
  assert.equal(result.fresh, true);
  assert.equal(result.fromBackup, false);
  assert.equal(result.state.cookies, 0);
  assert.deepEqual(Object.keys(result.state.buildings).sort(), BUILDINGS.map((b) => b.id).sort());
  assert.equal(store.getItem(PERSISTENCE.storageKey), null);
});

test('a corrupt primary is skipped in favour of a fresh state', () => {
  store.setItem(PERSISTENCE.storageKey, '{not json at all');
  const result = load(NOW);
  assert.equal(result.fresh, true);
  assert.ok(result.state);
});

test('a corrupt primary falls back to the backup', () => {
  // A write interrupted by a closed tab leaves unparseable JSON in the primary.
  // The backup is the only surviving copy of the run.
  const s = createState(NOW);
  s.cookies = 500_000;
  save(s, NOW); // writes primary + backup
  save(s, NOW + 1000); // rotates the previous primary into the backup

  store.setItem(PERSISTENCE.storageKey, '{"cookies": 1, tru');

  const result = load(NOW + 2000);
  assert.equal(result.fromBackup, true);
  assert.equal(result.state.cookies, 500_000, 'the run was recovered intact');
});

test('nonsense field values are coerced and reported, never thrown', () => {
  store.setItem(PERSISTENCE.storageKey, JSON.stringify({
    cookies: 'lots', totalClicks: -12, chips: NaN, buffs: 'nope',
    achievements: { not: 'an array' }, buildings: null, upgrades: 5,
    version: 1,
  }));

  const { state, repairs } = load(NOW);
  assert.equal(state.cookies, 0);
  assert.equal(state.totalClicks, 0);
  assert.equal(state.chips, 0);
  assert.deepEqual(state.buffs, []);
  assert.ok(Array.isArray(state.achievements));
  assert.ok(Object.keys(state.buildings).length, 'building record rebuilt');
  assert.ok(repairs.some((r) => r.includes('version')), 'the version bump is reported');
});

test('a malformed buff cannot produce NaN production', () => {
  store.setItem(PERSISTENCE.storageKey, JSON.stringify({
    buildings: { grandma: 10 },
    buffs: [{ kind: 'cpsMult', mult: 'seven' }, null, { mult: 2 }, { kind: 'cpsMult', mult: 3, until: NOW + 999 }],
  }));

  const { state } = load(NOW);
  assert.ok(Number.isFinite(cps(state, NOW)), 'a bad multiplier must not poison the pipeline');
  for (const buff of state.buffs) assert.ok(Number.isFinite(buff.mult));
});

test('storage being unavailable is survivable', () => {
  const boom = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('SecurityError'); },
    removeItem() { throw new Error('SecurityError'); },
  };
  globalThis.localStorage = boom;
  globalThis.sessionStorage = boom;

  const s = createState(NOW);
  const result = save(s, NOW);
  assert.ok(result.ok === false || result.ok === true, 'must return, not throw');

  const loaded = load(NOW);
  assert.ok(loaded.state, 'a game with no storage still boots');
  assert.equal(loaded.fresh, true);
});

test('wipe removes the save and restores the fresh state', () => {
  const s = createState(NOW);
  s.cookies = 999;
  save(s, NOW);
  save(s, NOW + 1);
  assert.ok(store.getItem(PERSISTENCE.storageKey));

  assert.equal(wipe(), true);
  assert.equal(store.getItem(PERSISTENCE.storageKey), null);
  assert.equal(load(NOW).fresh, true);
});

test('save does not mutate the state it is given', () => {
  const s = createState(NOW);
  const before = JSON.stringify(s);
  save(s, NOW);
  // lastSeenAt is deliberately stamped; nothing else may move.
  const after = JSON.parse(JSON.stringify(s));
  delete after.lastSeenAt;
  const original = JSON.parse(before);
  delete original.lastSeenAt;
  assert.deepEqual(after, original);
});

// ---------------------------------------------------------------------------
// Import / export
// ---------------------------------------------------------------------------

test('an exported save round-trips through the clipboard format', () => {
  const s = createState(NOW);
  s.cookies = 987_654;
  s.totalCookies = 4.2e15;
  s.buildings.portal = 3;
  s.prefs.theme = 'void';
  s.achievements = ['firstClick', 'jar', 'cps100'];

  const blob = exportSave(s);
  assert.ok(blob.startsWith('CC1.'), 'the magic prefix identifies the payload');

  const result = importSave(blob, NOW);
  assert.ok(result.ok);
  assert.equal(result.state.cookies, 987_654);
  assert.equal(result.state.buildings.portal, 3);
  assert.equal(result.state.prefs.theme, 'void');
  assert.equal(result.state.totalChips, s.totalChips);
});

test('a malformed import is refused with a reason, not half-applied', () => {
  assert.match(importSave('', NOW).error, /Nothing to import/);
  assert.match(importSave(null, NOW).error, /Nothing to import/);
  assert.match(importSave('hello world', NOW).error, /does not look like/);
  assert.match(importSave('CC1.!!!not-base64!!!', NOW).error, /damaged/);
  assert.match(importSave('CC1.' + btoa('{"cookies":'), NOW).error, /damaged/);
  assert.match(importSave('CC1.' + btoa('not json'), NOW).error, /damaged/);
  assert.equal(importSave('x'.repeat(600_000), NOW).ok, false, 'an absurd blob is refused');
});

test('a valid but ancient import is repaired rather than rejected', () => {
  // An import from before several balance updates: unknown keys, missing fields,
  // and a version that no longer exists.
  const blob = 'CC1.' + btoa(JSON.stringify({
    version: 1, cookies: 4200, buildings: { grandma: 10, demolishedThing: 5 },
    upgrades: { click: { strongerFinger: true } }, totalClicks: 99,
  }));
  const result = importSave(blob, NOW);
  assert.ok(result.ok);
  assert.equal(result.state.cookies, 4200);
  assert.equal(result.state.buildings.grandma, 10);
  assert.equal(result.state.buildings.demolishedThing, undefined);
  assert.equal(result.state.upgrades.cookie.choco, false, 'missing families rebuilt');
  assert.equal(result.state.prefs.theme, 'lagoon');
  assert.ok(result.repairs.length > 0);
});

test('unicode in a save survives the base64 round trip', () => {
  // Export goes through btoa, which throws on anything above U+00FF. Themes and
  // names are ASCII today, but a save imported from a localised build is not
  // guaranteed to be.
  const s = createState(NOW);
  s.stats = { ...s.stats };
  const blob = exportSave({ ...s, playerName: 'Ærøskøbing 🍪' });
  const result = importSave(blob, NOW);
  assert.equal(result.state.playerName, 'Ærøskøbing 🍪');
});

// ---------------------------------------------------------------------------
// Cross-version
// ---------------------------------------------------------------------------

test('a save from a different balance version loads with a repair note', () => {
  const s = createState(NOW);
  s.cookies = 111;
  s.version = BALANCE_VERSION - 1;
  store.setItem(PERSISTENCE.storageKey, JSON.stringify(s));

  const { state, repairs } = load(NOW);
  assert.equal(state.cookies, 111, 'the run is preserved');
  assert.equal(state.version, BALANCE_VERSION);
  assert.ok(repairs.some((r) => r.includes('balance version')));
});

test('themes added after a save are usable immediately', () => {
  const s = createState(NOW);
  s.prefs.theme = 'candy';
  s.prefs.themesUsed = ['classic', 'candy'];
  store.setItem(PERSISTENCE.storageKey, JSON.stringify(s));

  const { state } = load(NOW);
  assert.equal(state.prefs.theme, 'candy');
  assert.ok(THEMES.some((t) => t.id === state.prefs.theme));

  // ...and one that does not exist falls back rather than rendering nothing.
  state.prefs.theme = 'retired-theme';
  reconcileState(state);
  assert.equal(state.prefs.theme, 'lagoon');
});

test('derived production is identical before and after a save round trip', () => {
  // The single most important property of the persistence layer, stated as one
  // assertion: nothing about the economy may depend on where the state lives.
  const s = createState(NOW);
  s.cookies = 1e9;
  for (const b of BUILDINGS) s.buildings[b.id] = 7;
  for (const u of COOKIE_UPGRADES) s.upgrades.cookie[u.id] = true;
  for (const r of RESEARCH) s.upgrades.research[r.id] = true;
  s.prestige.heavenlyBoost = 25;
  s.prestige.bulkDiscount = 15;
  s.achievements = ['firstClick', 'jar', 'cps100'];
  s.prefs.ownedSkins = ['classic', 'diamond'];
  s.prefs.skin = 'diamond';

  const before = derived(s, NOW);
  save(s, NOW);
  const { state } = load(NOW + 5_000);
  const after = derived(state, NOW);

  assert.equal(after.cps, before.cps);
  assert.equal(after.cpc, before.cpc);
  assert.equal(after.chipsGain, before.chipsGain);
  assert.deepEqual(after.buildingCps, before.buildingCps);
  assert.deepEqual(after.mults, before.mults);
});

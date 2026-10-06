import test from 'node:test';
import assert from 'node:assert/strict';

import { ACHIEVEMENTS, COOKIE_SKINS, MILESTONES, SEEDS } from '../shared/balance.js';
import {
  achievementSummary, pruneAchievements, syncAchievements,
} from '../shared/achievements.js';
import { createState } from '../shared/state.js';

const NOW = 1_700_000_000_000;
const ALL_IDS = ACHIEVEMENTS.map((a) => a.id);

// A derived bundle shaped like the one economy.derived() returns.
const flat = () => ({ cps: 0, cpc: 1 });

/** State with every achievement condition satisfied. */
function maxedState() {
  const s = createState(NOW);
  s.totalClicks = 2e6;
  s.totalCookies = 1e18;
  s.ascensions = 25;
  s.totalChips = 150;
  s.stats = { ...s.stats, harvests: 200, trades: 100, goldenClicked: 60 };
  for (const b of ['cursor', 'grandma', 'farm', 'mine', 'factory', 'bank', 'temple', 'portal']) {
    s.buildings[b] = 100;
  }
  for (const family of ['click', 'cookie', 'research']) {
    for (const id of Object.keys(s.upgrades[family])) s.upgrades[family][id] = true;
  }
  for (const a of Object.keys(s.abilities)) s.abilities[a].unlocked = true;
  s.garden.plotCount = 12;
  for (let i = 0; i < 12; i++) s.garden.plots[i] = { seedId: 'carrot', plantedAt: NOW, readyAt: NOW + 1 };
  for (const row of s.market) row.shares = row.symbol === 'GOLD' ? 5 : 1;
  s.prefs.themesUsed = ['classic', 'midnight', 'ember', 'forest'];
  s.prefs.ownedSkins = COOKIE_SKINS.map((k) => k.id);
  s.prefs.skin = 'cosmic';
  return s;
}

// ---------------------------------------------------------------------------

test('a fresh state has earned nothing', () => {
  const s = createState(NOW);
  assert.equal(syncAchievements(s, NOW, flat).length, 0);
  assert.equal(s.achievements.length, 0);
  assert.equal(achievementSummary(s).got, 0);
});

test('syncAchievements awards exactly the newly satisfied ids', () => {
  const s = createState(NOW);
  s.totalClicks = 1;
  const fresh = syncAchievements(s, NOW, flat);
  assert.deepEqual(fresh.map((a) => a.id), ['firstClick']);
  assert.deepEqual(s.achievements, ['firstClick']);
});

test('syncAchievements is idempotent and never re-awards', () => {
  const s = createState(NOW);
  s.totalClicks = 1;
  syncAchievements(s, NOW, flat);
  assert.equal(syncAchievements(s, NOW, flat).length, 0, 'a second pass must award nothing');
  assert.equal(s.achievements.length, 1, 'and must not duplicate the entry');

  // And the list stays in table order however it was earned.
  s.totalCookies = 1e9;
  s.totalClicks = 2000;
  syncAchievements(s, NOW, flat);
  const order = s.achievements.map((id) => ALL_IDS.indexOf(id));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'stable table order');
  assert.equal(new Set(s.achievements).size, s.achievements.length);
});

test('a maxed state earns every achievement exactly once', () => {
  const s = maxedState();
  const d = { cps: 1e9, cpc: 1000 };
  const fresh = syncAchievements(s, NOW, () => d);

  const missing = ACHIEVEMENTS.filter((a) => !s.achievements.includes(a.id));
  assert.deepEqual(missing.map((a) => a.id), [], `unreachable: ${missing.map((a) => a.id)}`);
  assert.equal(fresh.length, ACHIEVEMENTS.length);
  assert.equal(s.achievements.length, ACHIEVEMENTS.length);

  // Nothing left to award on a second pass.
  assert.equal(syncAchievements(s, NOW, () => d).length, 0);
});

test('every achievement is individually reachable and not trivially true', () => {
  // Guards the two failure modes that are invisible in normal play: a condition
  // that can never be true, and one that is true on an empty save.
  const empty = createState(NOW);
  const d = { cps: 0, cpc: 1 };
  for (const a of ACHIEVEMENTS) {
    assert.notEqual(a.check(empty, d), true, `${a.id} is true on a fresh save`);
    assert.equal(typeof a.check(maxedState(), { cps: 1e12, cpc: 1e6 }), 'boolean',
      `${a.id} must return a boolean`);
  }
});

test('a throwing predicate is contained and does not block the others', () => {
  const s = createState(NOW);
  s.totalClicks = 1;
  const good = ACHIEVEMENTS[1];
  const original = good.check;
  good.check = () => { throw new Error('boom'); };
  try {
    const fresh = syncAchievements(s, NOW, flat);
    assert.deepEqual(fresh.map((a) => a.id), ['firstClick'], 'the healthy achievement still lands');
    assert.equal(s.achievements.includes('firstClick'), true);
  } finally {
    good.check = original;
  }
});

test('a non-boolean truthy return does not unlock anything', () => {
  const s = createState(NOW);
  const a = ACHIEVEMENTS[0];
  const original = a.check;
  a.check = () => 'yes';
  try {
    assert.equal(syncAchievements(s, NOW, flat).length, 0, 'strict === true, not truthiness');
  } finally {
    a.check = original;
  }
});

test('production-based achievements read the derived bundle, not raw buildings', () => {
  // 100 grandmas produce 100/sec on their own, but the achievement must read the
  // number the game actually uses. With a prestige or research multiplier in play
  // the two diverge, and it is the derived figure the player sees in the HUD.
  const s = createState(NOW);
  s.buildings.grandma = 100;

  const ids = (cps) => syncAchievements(s, NOW, () => ({ cps, cpc: 1 })).map((a) => a.id);

  const below = ids(99);
  assert.equal(below.includes('cps100'), false, 'must not unlock below the threshold');
  assert.ok(below.includes('bulkBuyer'), 'the 100-grandma count is its own achievement');

  // Each pass sees the current rate, so the tiers have to be crossed in order --
  // and a rate that satisfies two thresholds at once unlocks both in one pass.
  assert.deepEqual(
    ids(100).filter((id) => id.startsWith('cps')),
    ['cps100'],
  );
  assert.deepEqual(
    ids(20_000).filter((id) => id.startsWith('cps')),
    ['cps10k'],
  );
  assert.deepEqual(
    ids(2e6).filter((id) => id.startsWith('cps')),
    ['cps1m'],
  );
  assert.equal(s.achievements.length, new Set(s.achievements).size, 'still no duplicates');
});

test('milestones are reported as next/earned with no gap between them', () => {
  // The awards panel renders straight from this, so a milestone that is neither
  // "next" nor "earned" would show as an unstyled badge with no explanation.
  const total = ACHIEVEMENTS.length;

  for (let got = 0; got <= total; got++) {
    const view = achievementSummary({ ...createState(NOW), achievements: ACHIEVEMENTS.slice(0, got) });

    const expectedEarned = MILESTONES.filter((m) => m.count <= got);
    assert.deepEqual(view.earned.map((m) => m.count), expectedEarned.map((m) => m.count),
      `earned milestones wrong at ${got}`);

    const expectedNext = MILESTONES.find((m) => m.count > got) ?? null;
    assert.equal(view.next?.count ?? null, expectedNext?.count ?? null,
      `next milestone wrong at ${got}`);

    // Never both, never neither.
    assert.equal(view.earned.some((m) => view.next === m), false);
    assert.equal(view.pct, Math.round((got / total) * 100));
  }

  assert.equal(MILESTONES.length, 3);
});

test('achievementSummary groups and counts without unlocking anything', () => {
  const s = createState(NOW);
  s.achievements = ['firstClick', 'jar'];
  const sum = achievementSummary(s);

  assert.equal(sum.got, 2);
  assert.equal(sum.total, ACHIEVEMENTS.length);
  assert.equal(sum.pct, Math.round((2 / ACHIEVEMENTS.length) * 100));
  assert.equal(sum.next.count, MILESTONES[0].count);
  assert.equal(sum.earned.length, 0);
  assert.ok(sum.groups.length > 1, 'achievements are grouped by category');
  assert.equal(sum.groups.flatMap((g) => g.items).length, ACHIEVEMENTS.length);
  assert.equal(sum.groups.flatMap((g) => g.items).filter((i) => i.unlocked).length, 2);

  s.achievements = ALL_IDS.slice();
  const full = achievementSummary(s);
  assert.equal(full.pct, 100);
  assert.equal(full.next, null);
  assert.equal(full.earned.length, MILESTONES.length);
});

test('pruneAchievements drops ids that no longer exist', () => {
  const s = createState(NOW);
  s.achievements = ['firstClick', 'aRetiredAchievement', 'jar'];
  pruneAchievements(s);
  assert.deepEqual(s.achievements, ['firstClick', 'jar']);
});

test('an empty achievement record is handled without throwing', () => {
  const s = createState(NOW);
  s.achievements = null;
  const fresh = syncAchievements(s, NOW, flat);
  assert.deepEqual(fresh.map((a) => a.id), []);
  assert.ok(Array.isArray(s.achievements));
});

test('garden achievements count the plots the player actually has', () => {
  const s = createState(NOW);
  s.garden.plots[0] = { seedId: 'carrot', plantedAt: NOW, readyAt: NOW + 1 };
  const ids = syncAchievements(s, NOW, flat).map((a) => a.id);
  assert.equal(ids.includes('fullPlot'), false, 'one planted plot is not a full garden');

  for (let i = 1; i < s.garden.plotCount; i++) {
    s.garden.plots[i] = { seedId: 'corn', plantedAt: NOW, readyAt: NOW + 1 };
  }
  assert.ok(syncAchievements(s, NOW, flat).some((a) => a.id === 'fullPlot'));
});

test('seed table sanity: every seed is a slower-or-equal better-or-equal trade', () => {
  // A garden where a long crop pays less than a short one is never planted, and
  // the whole minigame collapses to carrots.
  for (let i = 1; i < SEEDS.length; i++) {
    assert.ok(SEEDS[i].growMs > SEEDS[i - 1].growMs, `${SEEDS[i].id} grows no slower`);
    assert.ok(SEEDS[i].yieldMult > SEEDS[i - 1].yieldMult, `${SEEDS[i].id} pays no more`);
  }
  // And yield per hour must increase, or there is no reason to wait.
  const perHour = SEEDS.map((s) => s.yieldMult / (s.growMs / 3_600_000));
  for (let i = 1; i < perHour.length; i++) {
    assert.ok(perHour[i] >= perHour[i - 1], `${SEEDS[i].id} is not worse per hour`);
  }
});

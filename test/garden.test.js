import test from 'node:test';
import assert from 'node:assert/strict';

import { GARDEN, SEEDS } from '../shared/balance.js';
import {
  gardenSummary, harvest, plant, plotInfo, ripenAll, seedCost, seedYield,
} from '../shared/garden.js';
import { createState } from '../shared/state.js';

const NOW = 1_700_000_000_000;
const CARROT = SEEDS[0];
const STAR = SEEDS[SEEDS.length - 1];

function stateWith(cookies) {
  const s = createState(NOW);
  s.cookies = cookies;
  return s;
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

test('seed price is a multiple of production, not a fixed number', () => {
  assert.equal(seedCost(CARROT, 100), 2_000);
  assert.equal(seedCost(CARROT, 1), 20);
  // At zero production the seed still costs one cookie and pays out nothing, so
  // a fresh save can use the panel without being able to farm it.
  assert.equal(seedCost(CARROT, 0), 1);
  assert.equal(seedYield(CARROT, 0), 0);
});

test('planting is always a net loss, so there is no arbitrage loop', () => {
  // If yield >= cost the player could farm the garden infinitely by replanting,
  // which makes every other content layer pointless. Zero production is the
  // dangerous case: a "minimum one cookie" floor on both sides is an infinite
  // money glitch.
  for (const seed of SEEDS) {
    for (const cps of [0, 1, 1e3, 1e9, 1e15]) {
      assert.ok(seedYield(seed, cps) < seedCost(seed, cps),
        `${seed.id} at ${cps}/sec pays back more than it costs`);
    }
  }
  assert.ok(GARDEN.costFactor > 1);
});

test('yield per hour improves with every seed', () => {
  const perHour = SEEDS.map((s) => s.yieldMult / (s.growMs / 3_600_000));
  for (let i = 1; i < perHour.length; i++) {
    assert.ok(perHour[i] > perHour[i - 1], `${SEEDS[i].id} is not worth waiting for`);
  }
});

// ---------------------------------------------------------------------------
// plotInfo
// ---------------------------------------------------------------------------

test('plotInfo reports empty, growing and ready off absolute timestamps', () => {
  assert.equal(plotInfo(null, NOW).state, 'empty');

  const plot = { seedId: 'carrot', plantedAt: NOW, readyAt: NOW + 30_000, lockedCps: 1 };
  const growing = plotInfo(plot, NOW);
  assert.equal(growing.state, 'growing');
  assert.equal(growing.progress, 0);
  assert.equal(growing.remainingMs, 30_000);

  const half = plotInfo(plot, NOW + 15_000);
  assert.ok(Math.abs(half.progress - 0.5) < 1e-9);

  assert.equal(plotInfo(plot, NOW + 29_999).state, 'growing', 'not ready one ms early');
  assert.equal(plotInfo(plot, NOW + 30_000).state, 'ready');
  assert.equal(plotInfo(plot, NOW + 999_999).state, 'ready', 'and stays ready');
});

test('plotInfo survives a clock that jumped backwards', () => {
  // Device clock corrections must not produce negative progress bars.
  const plot = { seedId: 'carrot', plantedAt: NOW, readyAt: NOW + 30_000, lockedCps: 1 };
  const back = plotInfo(plot, NOW - 60_000);
  assert.equal(back.state, 'growing');
  assert.equal(back.progress, 0);
  assert.equal(back.remainingMs, 90_000);
});

test('plotInfo flags a seed that no longer exists', () => {
  const plot = { seedId: 'retiredSeed', plantedAt: NOW, readyAt: NOW + 1, lockedCps: 1 };
  assert.equal(plotInfo(plot, NOW).state, 'unknown');
});

// ---------------------------------------------------------------------------
// Planting
// ---------------------------------------------------------------------------

test('plant debits the quoted cost and fills the plot', () => {
  const s = stateWith(10_000);
  const r = plant(s, 0, 'carrot', NOW, 100);

  assert.ok(r.ok);
  assert.equal(r.cost, seedCost(CARROT, 100));
  assert.equal(s.cookies, 10_000 - r.cost);
  assert.equal(s.garden.plots[0].seedId, 'carrot');
  assert.equal(s.garden.plots[0].readyAt, NOW + CARROT.growMs);
  assert.equal(s.garden.plots[0].lockedCps, 100);
});

test('plant refuses for machine-readable reasons', () => {
  const s = stateWith(1e12);
  assert.ok(plant(s, 0, 'carrot', NOW, 100).ok, 'precondition: plot 0 is now occupied');

  assert.equal(plant(s, 0, 'corn', NOW, 100).reason, 'occupied', 'already growing');
  assert.equal(plant(s, 1, 'notASeed', NOW, 100).reason, 'no-seed');
  assert.equal(plant(s, 99, 'carrot', NOW, 100).reason, 'no-plot');
  assert.equal(plant(s, -1, 'carrot', NOW, 100).reason, 'no-plot');
  assert.equal(plant(s, 1.5, 'carrot', NOW, 100).reason, 'no-plot', 'a fractional index is not a plot');
  assert.equal(s.garden.plots[0].seedId, 'carrot', 'the refused attempts changed nothing');

  const poor = stateWith(1);
  assert.equal(plant(poor, 0, 'carrot', NOW, 100).reason, 'too-expensive');
  assert.equal(poor.garden.plots[0], null, 'a refused plant must leave the plot empty');
  assert.equal(poor.cookies, 1, 'and must not debit');
});

test('a crop keeps growing while the tab is closed', () => {
  // The whole reason plots store readyAt instead of a countdown: no catch-up
  // logic, correct across a save/load and a closed tab.
  const s = stateWith(10_000);
  plant(s, 0, 'carrot', NOW, 100);

  const eightHoursLater = NOW + 8 * 3_600_000;
  assert.equal(plotInfo(s.garden.plots[0], eightHoursLater).state, 'ready');

  const r = harvest(s, 0, eightHoursLater);
  assert.ok(r.ok);
  assert.equal(r.amount, seedYield(CARROT, 100));
});

// ---------------------------------------------------------------------------
// Harvesting
// ---------------------------------------------------------------------------

test('harvest pays out and frees the plot', () => {
  const s = stateWith(10_000);
  plant(s, 0, 'carrot', NOW, 100);
  const afterPlant = s.cookies;

  assert.deepEqual(harvest(s, 0, NOW + 29_999), { ok: false, reason: 'growing' });
  assert.equal(s.garden.plots[0].seedId, 'carrot', 'an early click must not consume the crop');

  const r = harvest(s, 0, NOW + 30_000);
  assert.ok(r.ok);
  assert.equal(s.cookies, afterPlant + seedYield(CARROT, 100));
  assert.equal(s.totalCookies, seedYield(CARROT, 100));
  assert.equal(s.garden.plots[0], null);
  assert.equal(s.stats.harvests, 1);
});

test('harvest pays the rate locked in at planting, not the current rate', () => {
  // Otherwise a player could leave crops in the ground across a big upgrade and
  // collect a harvest that had nothing to do with the risk they took.
  const s = stateWith(1e12);
  plant(s, 0, 'corn', NOW, 10);
  const expected = seedYield(SEEDS[1], 10);

  // Production grows 1000x while the crop sits there.
  const r = harvest(s, 0, NOW + SEEDS[1].growMs);
  assert.equal(r.amount, expected);
});

test('an empty or missing plot is not an error worth crashing on', () => {
  const s = stateWith(0);
  assert.deepEqual(harvest(s, 0, NOW), { ok: false, reason: 'empty' });
  assert.deepEqual(harvest(s, 5, NOW), { ok: false, reason: 'empty' });
});

test('a crop whose seed was deleted is cleared rather than trapping the plot', () => {
  const s = stateWith(10_000);
  s.garden.plots[0] = { seedId: 'retiredSeed', plantedAt: NOW, readyAt: NOW + 1, lockedCps: 1 };
  const r = harvest(s, 0, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unknown-seed');
  assert.equal(s.garden.plots[0], null, 'the plot is reclaimed');
});

test('a buffed seed grants its buff on harvest', () => {
  const s = stateWith(1e12);
  plant(s, 0, 'starFruit', NOW, 1e6);
  const r = harvest(s, 0, NOW + STAR.growMs);

  assert.ok(r.ok);
  assert.ok(r.buff, 'star fruit must pay out its buff');
  assert.equal(r.buff.mult, 1.05);
  assert.equal(r.buff.until, NOW + STAR.growMs + STAR.buff.durationMs);
  assert.equal(s.buffs.length, 1);
});

// ---------------------------------------------------------------------------
// Bulk and summary
// ---------------------------------------------------------------------------

test('ripenAll ripens growing plots and leaves ready ones alone', () => {
  const s = stateWith(1e12);
  plant(s, 0, 'grape', NOW, 1000);
  plant(s, 1, 'carrot', NOW, 1000);

  const n = ripenAll(s, NOW);
  assert.equal(n, 2);
  assert.equal(plotInfo(s.garden.plots[0], NOW).state, 'ready');
  assert.equal(plotInfo(s.garden.plots[1], NOW).state, 'ready');
  assert.equal(ripenAll(s, NOW), 0, 'already ripe, nothing to do');

  // An empty plot is not a target.
  assert.equal(ripenAll(stateWith(0), NOW), 0);
});

test('gardenSummary counts every plot exactly once', () => {
  const s = stateWith(1e12);
  plant(s, 0, 'carrot', NOW, 100);   // growing
  plant(s, 1, 'pumpkin', NOW, 100);  // growing
  ripenAll(s, NOW);                   // now 2 ready

  const sum = gardenSummary(s, NOW);
  assert.deepEqual(sum, { empty: 4, growing: 0, ready: 2, broken: 0, total: 6 });
  assert.equal(sum.empty + sum.growing + sum.ready + sum.broken, sum.total);

  // A plot with a dead seed is counted as broken, never silently dropped -- the
  // counts have to add up or the header lies about the garden's contents.
  s.garden.plots[2] = { seedId: 'gone', plantedAt: NOW, readyAt: NOW + 1 };
  const broken = gardenSummary(s, NOW);
  assert.equal(broken.broken, 1);
  assert.equal(broken.empty + broken.growing + broken.ready + broken.broken, 6);
});

test('gardenSummary honours an expanded plot count', () => {
  const s = stateWith(0);
  s.garden.plotCount = 9;
  s.garden.plots.length = 9;
  assert.equal(gardenSummary(s, NOW).total, 9);
  assert.equal(gardenSummary(s, NOW).empty, 9);
});

test('harvesting resets nothing about the lifetime harvest counter', () => {
  // The counter is a stat, not garden state: a save/load or an ascension must
  // not be able to re-trigger "Green Thumb" or "Market Gardener".
  const s = stateWith(1e12);
  plant(s, 0, 'carrot', NOW, 100);
  harvest(s, 0, NOW + 30_000);
  s.stats.harvests = 7;
  assert.equal(s.stats.harvests, 7);
  assert.equal(s.garden.plots[0], null);
});

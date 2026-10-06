import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ASCENSION, BUILDINGS, CLICK_UPGRADES, COOKIE_UPGRADES, PRESTIGE_UPGRADES, RESEARCH,
} from '../shared/balance.js';
import {
  MAX_EXPLICIT_BUY, achievementMult, applyBuyPlan, applyPrestigePlan, ascend, baseCps,
  bulkCost, buyPlan, chipsGain, clickPower, cleanBuffs, cps, derived, liveBuffs,
  maxAffordable, prestigePlan, prestigeStats, productionMults, unitCost,
} from '../shared/economy.js';
import { createState } from '../shared/state.js';

const NOW = 1_700_000_000_000;
const CURSOR = BUILDINGS[0];
const GRANDMA = BUILDINGS[1];
const FARM = BUILDINGS[2];

/** State with a cookie balance and some buildings already owned. */
function stateWith(cookies = 0, owned = {}) {
  const s = createState(NOW);
  s.cookies = cookies;
  for (const [id, n] of Object.entries(owned)) s.buildings[id] = n;
  return s;
}

// ---------------------------------------------------------------------------
// Costs
// ---------------------------------------------------------------------------

test('unitCost follows the 1.15 growth curve and never returns zero', () => {
  assert.equal(unitCost(CURSOR, 0), 15);
  assert.equal(unitCost(CURSOR, 1), 17);          // floor(15 * 1.15)
  assert.equal(unitCost(CURSOR, 10), 60);         // floor(15 * 1.15^10) = 60.68
  // At high owned counts a 0.5x discount can floor to zero; the guard is what
  // keeps a building from being free forever.
  assert.equal(unitCost(CURSOR, 0, 0.01), 1);
});

test('bulkCost sums the geometric series, not the rounded unit prices', () => {
  // The closed form deliberately differs from a loop over unitCost by up to
  // (n - 1) cookies, because unitCost rounds each rung and the series does not.
  // Asserted rather than papered over: it is a real, if tiny, semantic choice.
  let naive = 0;
  for (let i = 0; i < 4; i++) naive += unitCost(CURSOR, i);
  const closed = bulkCost(CURSOR, 4, 0);
  assert.equal(closed, 74, 'floor(15 * (1.15^4 - 1) / 0.15)');
  assert.equal(naive, 73, 'the per-unit sum rounds each rung down first');
  assert.ok(closed - naive < 4, 'the gap is bounded by one cookie per rung');

  assert.equal(bulkCost(CURSOR, 0, 0), 0);
  assert.equal(bulkCost(CURSOR, 1, 7), unitCost(CURSOR, 7));
});

test('bulkCost applies the discount to the whole ladder, not per unit', () => {
  const half = bulkCost(CURSOR, 5, 0, 0.5);
  const full = bulkCost(CURSOR, 5, 0, 1);
  // Every price is linear in the discount, so the total is too. If a future
  // change made the discount non-linear this test is the one that catches it.
  assert.equal(half, Math.floor(full * 0.5));
});

test('bulkCost is never cheaper than one cookie per unit', () => {
  // Without the floor, a heavy discount on a cheap building can round the sum
  // below the unit count, so "Buy x10" reads as costing less than "Buy x1".
  const cheap = { baseCost: 1, costGrowth: 1.15 };
  assert.ok(bulkCost(cheap, 10, 0, 0.01) >= 10);
});

test('maxAffordable finds the largest count that fits the budget', () => {
  // Brute force is the oracle here; the implementation bisects.
  const check = (building, budget, owned) => {
    let best = 0;
    for (let n = 1; n < 5000; n++) {
      if (bulkCost(building, n, owned) <= budget) best = n;
      else break;
    }
    return best;
  };
  for (const owned of [0, 1, 7, 40, 130]) {
    for (const budget of [0, 14, 15, 100, 1e4, 1e7, 1e12]) {
      assert.equal(
        maxAffordable(CURSOR, budget, owned),
        check(CURSOR, budget, owned),
        `owned=${owned} budget=${budget}`,
      );
    }
  }
});

test('maxAffordable returns 0 rather than a negative or fractional count', () => {
  assert.equal(maxAffordable(CURSOR, 0, 0), 0);
  assert.equal(maxAffordable(CURSOR, -5, 0), 0);
  assert.equal(maxAffordable(CURSOR, 14, 0), 0, 'one cookie short of the first cursor');
  // A budget larger than the price of the entire ladder still returns a whole
  // number rather than Infinity or a float.
  const huge = maxAffordable(CURSOR, 1e300, 0);
  assert.ok(Number.isInteger(huge));
  assert.ok(huge > 0);
  assert.ok(bulkCost(CURSOR, huge, 0) <= 1e300, 'the answer must be affordable by construction');
  assert.ok(bulkCost(CURSOR, huge + 1, 0) > 1e300, 'and maximal');
});

test('buyPlan resolves the amount selector into a quotable price', () => {
  const s = stateWith(1_000);

  const one = buyPlan(s, CURSOR, 1);
  assert.equal(one.count, 1);
  assert.equal(one.total, 15);
  assert.ok(one.affordable);

  const max = buyPlan(s, CURSOR, 'max');
  assert.equal(max.count, maxAffordable(CURSOR, 1_000, 0));
  assert.equal(max.total, bulkCost(CURSOR, max.count, 0));
  assert.ok(max.affordable);
  assert.ok(s.cookies >= max.total, 'max must never quote more than the player has');
});

test('buyPlan clamps a silly explicit amount instead of trusting it', () => {
  const s = stateWith(1e300);
  const plan = buyPlan(s, CURSOR, 1e12);
  assert.equal(plan.count, MAX_EXPLICIT_BUY);
  // 100k cursors up a 1.15 ladder costs more than the largest representable
  // double, so the quote is Infinity -- which fmt() renders as a glyph and
  // applyBuyPlan refuses. That is the correct answer, not a crash.
  assert.equal(plan.total, Infinity);
  assert.equal(plan.affordable, false);

  // An amount that is large but actually payable goes through normally.
  const ok = buyPlan(s, CURSOR, 1000);
  assert.ok(Number.isFinite(ok.total));
  assert.ok(ok.affordable);
  assert.equal(applyBuyPlan(s, CURSOR, ok), 1000);
});

test('buyPlan reports an unaffordable plan instead of a negative one', () => {
  const s = stateWith(10);
  const plan = buyPlan(s, GRANDMA, 1); // costs 100
  assert.equal(plan.count, 1);
  assert.equal(plan.total, 100);
  assert.equal(plan.affordable, false);
});

test('applyBuyPlan debits exactly the quoted total', () => {
  const s = stateWith(1_000);
  const plan = buyPlan(s, CURSOR, 10);
  const bought = applyBuyPlan(s, CURSOR, plan);
  assert.equal(bought, 10);
  assert.equal(s.buildings.cursor, 10);
  assert.equal(s.cookies, 1_000 - plan.total);

  // A second refusal must not debit anything.
  applyBuyPlan(s, CURSOR, { count: 10, total: 1e12, affordable: false });
  assert.equal(s.cookies, 1_000 - plan.total, 'an unaffordable plan must be a no-op');
});

// ---------------------------------------------------------------------------
// Production
// ---------------------------------------------------------------------------

test('baseCps sums owned buildings at their listed output', () => {
  const s = stateWith(0, { cursor: 10, grandma: 5, farm: 2 });
  const expected = 10 * CURSOR.cps + 5 * GRANDMA.cps + 2 * FARM.cps;
  assert.ok(Math.abs(baseCps(s) - expected) < 1e-9);
});

test('production is zero with no buildings, whatever else is bought', () => {
  const s = createState(NOW);
  for (const u of COOKIE_UPGRADES) s.upgrades.cookie[u.id] = true;
  assert.equal(cps(s, NOW), 0, 'multipliers on nothing are still nothing');
});

test('cookie upgrades are additive percentage points, not compounding', () => {
  const s = stateWith(0, { grandma: 100 });
  const baseline = cps(s, NOW);

  s.upgrades.cookie.choco = true;    // +1%
  const afterChoco = cps(s, NOW);
  assert.ok(Math.abs(afterChoco / baseline - 1.01) < 1e-9);

  s.upgrades.cookie.peanut = true;   // +2%
  const afterPeanut = cps(s, NOW);
  assert.ok(Math.abs(afterPeanut / baseline - 1.03) < 1e-9, '+1 then +2 must be +3, not +3.02');
});

test('global research multipliers compound', () => {
  const s = stateWith(0, { grandma: 10 });
  const baseline = cps(s, NOW);
  s.upgrades.research.quantumOvens = true;   // x1.25
  s.upgrades.research.cookieSingularity = true; // x1.5
  assert.ok(Math.abs(cps(s, NOW) / baseline - 1.25 * 1.5) < 1e-9);
});

test('a synergy reads the live count of its source building', () => {
  // This is the property that makes Farm Synergy a bet rather than a flat bonus.
  const s = stateWith(0, { grandma: 10 });
  s.upgrades.research.grandmaSynergy = true; // +1% per farm
  assert.ok(Math.abs(cps(s, NOW) / baseCps(s) - 1) < 1e-9, 'worth nothing with zero farms');

  s.buildings.farm = 50;
  const grandmaBefore = GRANDMA.cps * 10;
  // 1 + 50 * 0.01 = 1.5x on the grandmas only.
  assert.ok(Math.abs(baseCps(s) - (grandmaBefore * 1.5 + FARM.cps * 50)) < 1e-9);

  s.buildings.farm = 100;
  assert.ok(baseCps(s) > 0);
  assert.ok(Math.abs(baseCps(s) / (grandmaBefore * 2 + FARM.cps * 100) - 1) < 1e-9);

  // A synergy changes the *building* multiplier, not the global stack -- so the
  // global multiplier is untouched and the two effects stay independent.
  assert.ok(Math.abs(productionMults(s, NOW).total - 1) < 1e-9);
});

test('kitten research scales with the number of achievements', () => {
  const s = stateWith(0, { grandma: 10 });
  s.upgrades.research.kittenHelpers = true; // +2% per achievement
  assert.ok(Math.abs(productionMults(s, NOW).kitten - 1) < 1e-9, 'no achievements, no bonus');

  s.achievements = ['jar', 'pantry', 'millionaire'];
  assert.ok(Math.abs(productionMults(s, NOW).kitten - 1.06) < 1e-9);

  // Two kitten upgrades stack additively rather than multiplying 1.02 * 1.05.
  s.upgrades.research.kittenWorkers = true;
  assert.ok(Math.abs(productionMults(s, NOW).kitten - (1 + 3 * 0.02 + 3 * 0.05)) < 1e-9);
});

test('achievements give 2% each plus milestone multipliers', () => {
  assert.equal(achievementMult(0), 1);
  assert.ok(Math.abs(achievementMult(4) - 1.08) < 1e-9);

  // 5 unlocks crosses Bronze: (1 + 0.10) * 1.10
  assert.ok(Math.abs(achievementMult(5) - 1.10 * 1.10) < 1e-9);
  // 15 unlocks crosses all three, and they multiply.
  assert.ok(Math.abs(achievementMult(15) - 1.30 * 1.10 * 1.25 * 1.50) < 1e-9);
});

test('equipped skin adds its bonus and an unowned skin does not apply', () => {
  const s = stateWith(0, { grandma: 10 });
  const base = cps(s, NOW);
  s.prefs.skin = 'cosmic'; // +10%
  assert.ok(Math.abs(cps(s, NOW) / base - 1.10) < 1e-9);

  s.prefs.skin = 'not-a-real-skin';
  assert.ok(Math.abs(cps(s, NOW) - base) < 1e-9, 'an unknown skin must contribute exactly 1');
});

test('an override previews production without mutating the state', () => {
  const s = stateWith(0, { grandma: 10 });
  const before = JSON.stringify(s.buildings);
  const now = cps(s, NOW);
  const withOneMore = cps(s, NOW, { id: 'grandma', owned: 11 });
  assert.ok(withOneMore > now);
  assert.equal(JSON.stringify(s.buildings), before, 'the override must not write through');
});

// ---------------------------------------------------------------------------
// Buffs
// ---------------------------------------------------------------------------

test('buffs multiply while live and stop counting once expired', () => {
  const s = stateWith(0, { grandma: 10 });
  const base = cps(s, NOW); // measured *before* the buff exists
  s.buffs.push({ kind: 'cpsMult', mult: 7, until: NOW + 30_000 });

  assert.ok(Math.abs(cps(s, NOW) - base * 7) < 1e-6);
  assert.equal(liveBuffs(s, NOW).length, 1);
  assert.equal(liveBuffs(s, NOW + 30_001).length, 0);
  assert.ok(Math.abs(cps(s, NOW + 30_001) - base) < 1e-6);
});

test('two live buffs compound and click buffs do not touch production', () => {
  const s = stateWith(0, { grandma: 10 });
  const base = cps(s, NOW);
  s.buffs.push({ kind: 'cpsMult', mult: 7, until: NOW + 1_000 });
  s.buffs.push({ kind: 'cpsMult', mult: 2, until: NOW + 1_000 });
  s.buffs.push({ kind: 'clickMult', mult: 77, until: NOW + 1_000 });

  assert.ok(Math.abs(cps(s, NOW) - base * 14) < 1e-6, 'two cps buffs multiply, click buff ignored');
  assert.ok(Math.abs(clickPower(s, NOW).value - 77) < 1e-9, 'click buff applies to click power');
});

test('cleanBuffs drops only what has expired', () => {
  const s = createState(NOW);
  s.buffs = [
    { kind: 'cpsMult', mult: 2, until: NOW - 1 },
    { kind: 'cpsMult', mult: 3, until: NOW + 10_000 },
    { kind: 'clickMult', mult: 4, until: NOW - 5 },
  ];
  const dropped = cleanBuffs(s, NOW);
  assert.equal(dropped, 2);
  assert.equal(s.buffs.length, 1);
  assert.equal(s.buffs[0].mult, 3);
});

// ---------------------------------------------------------------------------
// Click power
// ---------------------------------------------------------------------------

test('click upgrades add, multiply and percent in the documented order', () => {
  const s = createState(NOW);
  assert.equal(clickPower(s, NOW).value, 1);

  s.upgrades.click.strongerFinger = true;   // +1
  assert.equal(clickPower(s, NOW).value, 2);

  s.upgrades.click.doubleClick = true;      // x2
  assert.equal(clickPower(s, NOW).value, 4, 'the bonus is added before the multiplier');

  s.upgrades.click.overclockedThumb = true; // +50%
  assert.equal(clickPower(s, NOW).value, 6);

  s.upgrades.click.ambidextrous = true;     // x2 again
  assert.equal(clickPower(s, NOW).value, 12);
});

test('golden chance accumulates and goldens stay locked without the radar', () => {
  const s = createState(NOW);
  assert.equal(clickPower(s, NOW).goldensUnlocked, false);
  assert.equal(clickPower(s, NOW).goldenChance, 0);

  s.upgrades.click.thumbOfFortune = true;
  assert.ok(Math.abs(clickPower(s, NOW).goldenChance - 0.05) < 1e-12);
  assert.equal(clickPower(s, NOW).goldensUnlocked, false, 'chance is not permission');

  s.upgrades.click.goldenRadar = true;
  assert.equal(clickPower(s, NOW).goldensUnlocked, true);
});

// ---------------------------------------------------------------------------
// Prestige
// ---------------------------------------------------------------------------

test('prestige levels resolve into the documented effects', () => {
  const s = createState(NOW);
  assert.deepEqual(prestigeStats(s), {
    cpsPercent: 0, cpcPercent: 0, costDiscount: 1,
    offlineEfficiency: 0.5, offlineCapMs: 2 * 3_600_000,
    goldenDelay: 1, ascensionCookies: 0, gardenPlots: 6,
  });

  s.prestige.heavenlyBoost = 20;
  s.prestige.divineFingers = 5;
  s.prestige.bulkDiscount = 10;
  s.prestige.dreamBakery = 4;
  s.prestige.goldenLuck = 5;
  s.prestige.sugarRush = 3;
  s.prestige.timeCapsule = 2;
  s.prestige.gardenExpansion = 2;

  const p = prestigeStats(s);
  assert.ok(Math.abs(p.cpsPercent - 0.20) < 1e-12);
  assert.ok(Math.abs(p.cpcPercent - 0.50) < 1e-12);
  assert.ok(Math.abs(p.costDiscount - 0.90) < 1e-12);
  assert.ok(Math.abs(p.offlineEfficiency - 0.70) < 1e-12);
  assert.ok(Math.abs(p.goldenDelay - 0.75) < 1e-12);
  assert.equal(p.ascensionCookies, 3_000_000);
  assert.equal(p.offlineCapMs, 4 * 3_600_000);
  assert.equal(p.gardenPlots, 8);
});

test('cost discount and golden luck respect their floors', () => {
  const s = createState(NOW);
  s.prestige.bulkDiscount = 25; // max level: 1 - 0.25 = 0.75, floor 0.5 unused
  assert.ok(Math.abs(prestigeStats(s).costDiscount - 0.75) < 1e-12);

  // Drive it past the floor via a hand-edited save.
  s.prestige.bulkDiscount = 80;
  assert.equal(prestigeStats(s).costDiscount, 0.5, 'floored at 50%');

  s.prestige.goldenLuck = 10;
  assert.ok(Math.abs(prestigeStats(s).goldenDelay - 0.5) < 1e-12);
  s.prestige.goldenLuck = 99;
  assert.equal(prestigeStats(s).goldenDelay, 0.3, 'floored at 30% faster');
});

test('offline efficiency saturates at 100%', () => {
  const s = createState(NOW);
  s.prestige.dreamBakery = 10; // 0.5 + 0.5 = 1.0
  assert.equal(prestigeStats(s).offlineEfficiency, 1);
  s.prestige.dreamBakery = 50; // hand-edited past the cap
  assert.equal(prestigeStats(s).offlineEfficiency, 1);
});

test('prestigePlan respects the level cap and the chip balance', () => {
  const s = createState(NOW);
  s.chips = 25;
  const boost = PRESTIGE_UPGRADES.find((u) => u.id === 'heavenlyBoost');

  const p = prestigePlan(s, boost, 'max');
  assert.equal(p.want, 25);
  assert.equal(p.cost, 25);
  assert.ok(p.affordable);

  s.prestige.heavenlyBoost = boost.maxLevel - 2;
  const nearCap = prestigePlan(s, boost, 'max');
  assert.equal(nearCap.want, 2, 'cannot buy past maxLevel');
  assert.ok(nearCap.maxed === false);

  s.prestige.heavenlyBoost = boost.maxLevel;
  const capped = prestigePlan(s, boost, 'max');
  assert.equal(capped.want, 0);
  assert.ok(capped.maxed);
});

test('applyPrestigePlan debits chips and refuses to overspend', () => {
  const s = createState(NOW);
  s.chips = 10;
  const boost = PRESTIGE_UPGRADES.find((u) => u.id === 'heavenlyBoost');
  const plan = prestigePlan(s, boost, 3);
  assert.equal(applyPrestigePlan(s, boost, plan), 3);
  assert.equal(s.chips, 7);
  assert.equal(s.prestige.heavenlyBoost, 3);

  assert.equal(applyPrestigePlan(s, boost, { want: 99, cost: 99, level: 3 }), 0);
  assert.equal(s.chips, 7);
});

test('chipsGain uses the cube-root curve and never double-counts banked chips', () => {
  assert.equal(chipsGain(stateWith(0)), 0);
  assert.ok(ASCENSION.firstChipCookies > 0);

  const at1 = createState(NOW);
  at1.totalCookies = 1e12;
  assert.equal(chipsGain(at1), 1);

  // 8e12 -> cbrt(8) = 2
  const at8 = createState(NOW);
  at8.totalCookies = 8e12;
  assert.equal(chipsGain(at8), 2);

  // Already banked 2, so only the increment is offered.
  const banked = createState(NOW);
  banked.totalCookies = 8e12;
  banked.totalChips = 2;
  assert.equal(chipsGain(banked), 0);

  // Ascension does not wipe lifetime cookies, so the curve keeps climbing.
  const later = createState(NOW);
  later.totalCookies = 27e12;
  assert.equal(chipsGain(later), 3);
});

// ---------------------------------------------------------------------------
// Ascension
// ---------------------------------------------------------------------------

test('ascend wipes the run and keeps the account', () => {
  const s = stateWith(5_000, { grandma: 50, cursor: 10 });
  s.upgrades.click.strongerFinger = true;
  s.upgrades.cookie.choco = true;
  s.upgrades.research.quantumOvens = true;
  s.abilities.frenzy = { unlocked: true, cooldownUntil: NOW + 1000, activeUntil: NOW + 1000 };
  s.prestige.heavenlyBoost = 12;
  s.chips = 4;
  s.achievements = ['jar'];
  s.totalCookies = 8e12;
  s.garden.plots[0] = { seedId: 'carrot', plantedAt: NOW, readyAt: NOW + 30_000, lockedCps: 1 };
  s.market[0].shares = 3;
  s.prefs.theme = 'ember';
  s.prefs.sugarRushNever = undefined;

  s.prestige.sugarRush = 2;
  const gained = ascend(s, NOW, 2);

  assert.equal(gained, 2);
  assert.equal(s.chips, 6);
  assert.equal(s.totalChips, 2);
  assert.equal(s.ascensions, 1);
  assert.equal(s.stats.ascensionsTotal, 1);

  // Wiped.
  assert.equal(s.cookies, 2_000_000, 'Sugar Rush seeds the new run');
  assert.equal(s.buildings.grandma, 0);
  assert.equal(s.buildings.cursor, 0);
  assert.equal(s.upgrades.click.strongerFinger, false);
  assert.equal(s.upgrades.cookie.choco, false);
  assert.equal(s.upgrades.research.quantumOvens, false);
  assert.deepEqual(s.abilities.frenzy, { unlocked: false, cooldownUntil: 0, activeUntil: 0 });
  assert.equal(s.buffs.length, 0);

  // Kept.
  assert.equal(s.prestige.heavenlyBoost, 12);
  assert.equal(s.achievements.length, 1);
  assert.equal(s.totalCookies, 8e12, 'lifetime cookies drive the chip curve');
  assert.equal(s.garden.plots[0].seedId, 'carrot', 'the garden survives');
  assert.equal(s.market[0].shares, 3, 'the portfolio survives');
  assert.equal(s.prefs.theme, 'ember');
});

test('ascend without Sugar Rush starts from zero', () => {
  const s = stateWith(1e9, { grandma: 100 });
  ascend(s, NOW, 1);
  assert.equal(s.cookies, 0);
});

// ---------------------------------------------------------------------------
// derived
// ---------------------------------------------------------------------------

test('derived is internally consistent and allocates no mutation', () => {
  const s = stateWith(1e6, { cursor: 25, grandma: 40, farm: 50 });
  s.upgrades.research.grandmaSynergy = true;
  const before = JSON.stringify(s);
  const d = derived(s, NOW);

  assert.ok(Math.abs(d.base * d.mults.total - d.cps) < 1e-6);
  assert.ok(Math.abs(d.cps - cps(s, NOW)) < 1e-9);
  assert.equal(d.cpc, clickPower(s, NOW).value);
  assert.equal(d.chipsGain, chipsGain(s));
  assert.equal(JSON.stringify(s), before, 'derived must not touch the state');

  // Per-building contributions must sum to the base, or the shop tiles would
  // disagree with the HUD.
  const sum = Object.values(d.buildingCps).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - d.base) < 1e-6);

  // And the synergy must be visible in the grandma tile specifically.
  assert.ok(d.buildingCps.grandma > GRANDMA.cps * 40, 'synergy is missing from the breakdown');
});

test('every research and upgrade row is reachable from the derived stack', () => {
  // A guard against a data row being written with a field name nothing reads:
  // buy every research upgrade and assert the multipliers actually moved.
  const s = stateWith(0, { cursor: 10, grandma: 10, farm: 10, mine: 10, factory: 10, bank: 10, temple: 10 });
  const before = derived(s, NOW);
  for (const r of RESEARCH) s.upgrades.research[r.id] = true;
  const after = derived(s, NOW);
  assert.ok(after.cps > before.cps, 'no research had any effect at all');
  assert.ok(after.mults.buffCps === 1, 'no research grants a permanent buff');

  for (const u of CLICK_UPGRADES) s.upgrades.click[u.id] = true;
  const clicked = clickPower(s, NOW);
  assert.ok(clicked.value > 1);
  assert.equal(clicked.goldensUnlocked, true);
  assert.ok(clicked.goldenChance > 0);
});

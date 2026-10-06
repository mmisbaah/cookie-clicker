import test from 'node:test';
import assert from 'node:assert/strict';

import { ABILITIES, GOLDEN } from '../shared/balance.js';
import {
  applyGoldenEffect, clickGolden, expectedGoldenIntervalMs, goldensUnlocked, liveGoldens,
  nextDelayMs, summonGolden, weightedPick,
} from '../shared/golden.js';
import { activateAbility, abilityStatus, cleanAbilities, unlockAbility } from '../shared/abilities.js';
import { applyEffect, isKnownEffect } from '../shared/effects.js';
import { ripenAll } from '../shared/garden.js';
import { createRng } from '../shared/rng.js';
import { createState } from '../shared/state.js';

const NOW = 1_700_000_000_000;

/**
 * The context handed to an effect. These two callbacks are what lets abilities.js
 * stay free of garden and golden-cookie imports.
 */
function ctxFor(state, now) {
  return {
    now,
    cps: 1000,
    cpc: 5,
    summonGolden: (count, when) => summonGolden(state, when ?? now, count),
    ripenAll: (when) => ripenAll(state, when ?? now),
  };
}

function unlockedState() {
  const s = createState(NOW);
  s.abilities.frenzy.unlocked = true;
  s.upgrades.click.goldenRadar = true;
  // Comfortably past every unlockCost, so tests about abilities are not gated on
  // affordability unless affordability is what they are testing.
  s.cookies = 1e12;
  return s;
}

/** Six crops that are all still growing at `now`. */
function sowGrapes(state, now) {
  for (let i = 0; i < state.garden.plotCount; i++) {
    state.garden.plots[i] = { seedId: 'grape', plantedAt: now, readyAt: now + 900_000, lockedCps: 1 };
  }
}

// ---------------------------------------------------------------------------
// The effect vocabulary
// ---------------------------------------------------------------------------

test('every effect descriptor in the tables is one the runtime knows', () => {
  // The failure this catches: someone adds a golden cookie effect with a typo in
  // `kind`, and it silently does nothing forever.
  for (const ability of ABILITIES) {
    assert.ok(isKnownEffect(ability.effect),
      `ability ${ability.id} has unknown effect kind ${ability.effect?.kind}`);
  }
  for (const effect of GOLDEN.effects) {
    assert.ok(isKnownEffect(effect.effect),
      `golden ${effect.id} has unknown effect kind ${effect.effect?.kind}`);
  }
});

test('an unknown effect kind is a reported no-op, not a crash', () => {
  const s = createState(NOW);
  const summary = applyEffect(s, { kind: 'nonsense' });
  assert.equal(summary.kind, 'none');
  assert.equal(s.cookies, 0);
  assert.equal(applyEffect(s, undefined).kind, 'none');
  assert.equal(applyEffect(s, null).kind, 'none');
});

test('the buff kind honours its kind, not just its multiplier', () => {
  const s = createState(NOW);
  applyEffect(s, { kind: 'buff', buff: 'cpsMult', mult: 3, durationMs: 1000 }, { now: NOW });
  applyEffect(s, { kind: 'buff', buff: 'clickMult', mult: 5, durationMs: 1000 }, { now: NOW });
  assert.deepEqual(s.buffs, [
    { kind: 'cpsMult', mult: 3, until: NOW + 1000 },
    { kind: 'clickMult', mult: 5, until: NOW + 1000 },
  ]);
});

test('the cookies kind credits lifetime as well as the balance', () => {
  const s = createState(NOW);
  const summary = applyEffect(s, { kind: 'cookies', seconds: 300 }, { now: NOW, cps: 1000 });
  assert.equal(summary.amount, 300_000);
  assert.equal(s.cookies, 300_000);
  assert.equal(s.totalCookies, 300_000, 'lifetime total drives the ascension chip curve');
});

// ---------------------------------------------------------------------------
// Gating
// ---------------------------------------------------------------------------

test('goldens do not exist until the radar is bought', () => {
  const s = createState(NOW);
  assert.equal(goldensUnlocked(s), false);
  assert.equal(nextDelayMs(s, createRng(1)), null, 'no delay is scheduled at all');

  s.upgrades.click.goldenRadar = true;
  assert.equal(goldensUnlocked(s), true);
  assert.ok(nextDelayMs(s, createRng(1)) > 0);
});

// ---------------------------------------------------------------------------
// Spawning
// ---------------------------------------------------------------------------

test('a summoned golden is on screen until it expires', () => {
  const s = createState(NOW);
  summonGolden(s, NOW, 1);

  assert.equal(s.goldens.length, 1);
  assert.equal(liveGoldens(s, NOW).length, 1);
  assert.equal(liveGoldens(s, NOW + GOLDEN.onScreenMs - 1).length, 1);
  assert.equal(liveGoldens(s, NOW + GOLDEN.onScreenMs).length, 0, 'expires exactly on time');
});

test('several goldens can coexist with distinct ids and positions', () => {
  const s = createState(NOW);
  summonGolden(s, NOW, 3);
  assert.equal(s.goldens.length, 3);
  assert.equal(new Set(s.goldens.map((g) => g.id)).size, 3, 'ids must be unique');

  // Positions are persisted, so they must be inside the viewport.
  for (const g of s.goldens) {
    assert.ok(g.x >= 0 && g.x <= 100, `x=${g.x}`);
    assert.ok(g.y >= 0 && g.y <= 100, `y=${g.y}`);
  }
  assert.equal(liveGoldens(s, NOW).length, 3);
});

test('positions vary between spawns so goldens do not stack in a lattice', () => {
  const s = createState(NOW);
  summonGolden(s, NOW, 1, 1);
  summonGolden(s, NOW, 1, 2);
  summonGolden(s, NOW, 1, 3);
  assert.equal(new Set(s.goldens.map((g) => `${g.x},${g.y}`)).size, 3);
});

// ---------------------------------------------------------------------------
// Clicking
// ---------------------------------------------------------------------------

test('clicking a golden applies its effect and removes it', () => {
  const s = unlockedState();
  summonGolden(s, NOW, 1);
  const before = s.cookies;
  const r = clickGolden(s, s.goldens[0].id, NOW, ctxFor(s, NOW), createRng(1));

  assert.ok(r);
  assert.ok(r.label.length > 0);
  assert.equal(s.goldens.length, 0);
  assert.equal(s.stats.goldenClicked, 1);
  assert.ok(s.cookies >= before, 'every effect is non-negative');
});

test('clicking a golden removes exactly that one', () => {
  const s = unlockedState();
  summonGolden(s, NOW, 3);
  const target = s.goldens[1].id;

  clickGolden(s, target, NOW, ctxFor(s, NOW), createRng(1));
  assert.equal(s.goldens.length, 2);
  assert.equal(s.goldens.some((g) => g.id === target), false);
});

test('clicking an already-collected golden is a no-op, not a double payout', () => {
  // A double tap on a phone fires twice; the second must find nothing rather
  // than paying out twice.
  const s = unlockedState();
  summonGolden(s, NOW, 1);
  const id = s.goldens[0].id;

  const first = clickGolden(s, id, NOW, ctxFor(s, NOW), createRng(1));
  const after = JSON.stringify({ c: s.cookies, t: s.totalCookies, b: s.buffs, g: s.goldens });
  const second = clickGolden(s, id, NOW, ctxFor(s, NOW), createRng(1));

  assert.ok(first);
  assert.equal(second, null);
  assert.equal(JSON.stringify({ c: s.cookies, t: s.totalCookies, b: s.buffs, g: s.goldens }), after);
  assert.equal(s.stats.goldenClicked, 1);
});

test('every golden effect is reachable and all of them do something', () => {
  const s = unlockedState();
  const seen = new Set();

  for (let seed = 0; seed < 300; seed++) {
    summonGolden(s, NOW, 1, seed);
    const before = JSON.stringify({ c: s.cookies, t: s.totalCookies, b: s.buffs, g: s.goldens });
    const r = clickGolden(s, s.goldens[0].id, NOW, ctxFor(s, NOW), createRng(seed));
    seen.add(r.effect.id);
    assert.notEqual(
      JSON.stringify({ c: s.cookies, t: s.totalCookies, b: s.buffs, g: s.goldens }), before,
      `effect ${r.effect.id} changed nothing`);
  }
  assert.deepEqual([...seen].sort(), GOLDEN.effects.map((e) => e.id).sort(),
    'every effect must appear over 300 draws');
});

test('the luck effect scales with production', () => {
  const s = unlockedState();
  const before = s.cookies;
  applyGoldenEffect(s, 'lucky', ctxFor(s, NOW));
  assert.equal(s.cookies - before, Math.floor(1000 * 900));

  const big = unlockedState();
  const beforeBig = big.cookies;
  applyGoldenEffect(big, 'lucky', { ...ctxFor(big, NOW), cps: 1e6 });
  assert.equal(big.cookies - beforeBig, Math.floor(1e6 * 900));
});

test('buff effects expire on their own schedule', () => {
  const s = unlockedState();
  applyGoldenEffect(s, 'frenzy', ctxFor(s, NOW));
  assert.deepEqual(s.buffs, [{ kind: 'cpsMult', mult: 7, until: NOW + 60_000 }]);
});

test('weightedPick respects weights and always returns something', () => {
  const items = [{ id: 'a', weight: 1 }, { id: 'b', weight: 0 }, { id: 'c', weight: 3 }];

  const counts = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < 400; i++) counts[weightedPick(items, createRng(i)).id]++;
  assert.equal(counts.b, 0, 'a zero weight must never be chosen');
  assert.ok(counts.c > counts.a, 'the heavier item wins more often');

  // Boundary draws must not fall off the end.
  assert.ok(weightedPick(items, () => 1));
  assert.ok(weightedPick(items, () => 0));
  assert.ok(weightedPick([{ id: 'only' }], () => 0.999));
});

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

test('Time Compression halves the wait, Golden Luck shortens it further', () => {
  const s = unlockedState();
  // Averaged over 400 draws. The tolerance is roughly three standard errors of
  // the sample mean, not a fudge factor: the interval is uniform over 130s, so
  // its standard deviation is ~37.5s and 400 draws land within seconds of the
  // midpoint.
  const measure = () => {
    let total = 0;
    for (let i = 0; i < 400; i++) total += nextDelayMs(s, createRng(i));
    return total / 400;
  };
  const TOL = 10_000;

  const plain = measure();
  assert.ok(Math.abs(plain - (GOLDEN.baseDelayMs + GOLDEN.jitterMs / 2)) < TOL,
    `expected the base+jitter midpoint, got ${plain}`);

  s.upgrades.research.timeCompression = true;
  const compressed = measure();
  assert.ok(Math.abs(compressed - plain / 2) < TOL, 'research halves the interval');

  s.prestige.goldenLuck = 5; // 25% faster
  assert.ok(Math.abs(measure() - compressed * 0.75) < TOL);
});

test('the delay never drops below the floor', () => {
  const s = unlockedState();
  s.upgrades.research.timeCompression = true;
  s.prestige.goldenLuck = 10;
  for (let i = 0; i < 200; i++) {
    assert.ok(nextDelayMs(s, createRng(i)) >= GOLDEN.minDelayMs);
  }
});

test('the reported interval matches the scheduled delay', () => {
  // The stats panel shows expectedGoldenIntervalMs; if it disagreed with
  // nextDelayMs the "one every ~2 minutes" claim would be a lie.
  assert.equal(expectedGoldenIntervalMs(createState(NOW)), null,
    'nothing scheduled while the radar is unowned');

  const s = unlockedState();
  const midpoint = GOLDEN.baseDelayMs + GOLDEN.jitterMs / 2;
  assert.equal(expectedGoldenIntervalMs(s), midpoint);

  s.upgrades.research.timeCompression = true;
  assert.equal(expectedGoldenIntervalMs(s), midpoint / 2);
});

// ---------------------------------------------------------------------------
// Abilities
// ---------------------------------------------------------------------------

test('a locked ability reports its price and cannot fire', () => {
  const s = createState(NOW);
  s.cookies = 10;

  const frenzy = ABILITIES[0];
  const st = abilityStatus(s, frenzy, NOW);
  assert.equal(st.status, 'locked');
  assert.equal(st.canFire, false, 'unaffordable');
  assert.equal(st.label, String(frenzy.unlockCost));

  assert.deepEqual(unlockAbility(s, 'frenzy'), { ok: false, reason: 'too-expensive' });
  assert.deepEqual(activateAbility(s, 'frenzy', ctxFor(s, NOW)), { ok: false, reason: 'locked' });
  assert.equal(s.cookies, 10, 'a refused unlock must not debit');
});

test('unlocking pays once, starts no cooldown, and cannot be repeated', () => {
  const s = createState(NOW);
  s.cookies = 1e6;
  const frenzy = ABILITIES[0];

  assert.deepEqual(unlockAbility(s, 'frenzy'), { ok: true, unlocked: true });
  assert.equal(s.cookies, 1e6 - frenzy.unlockCost);
  assert.equal(s.abilities.frenzy.cooldownUntil, 0, 'usable immediately, not on a timer');

  assert.deepEqual(unlockAbility(s, 'frenzy'), { ok: false, reason: 'already-unlocked' });
  assert.deepEqual(unlockAbility(s, 'nope'), { ok: false, reason: 'no-such-ability' });

  const st = abilityStatus(s, frenzy, NOW);
  assert.equal(st.status, 'ready');
  assert.equal(st.canFire, true);
});

test('firing starts the cooldown and the bar reports it counting down', () => {
  const s = unlockedState();
  const frenzy = ABILITIES[0];

  const fired = activateAbility(s, 'frenzy', ctxFor(s, NOW));
  assert.ok(fired.ok);
  assert.equal(s.abilities.frenzy.cooldownUntil, NOW + frenzy.cooldownMs);
  assert.equal(s.abilities.frenzy.activeUntil, NOW + frenzy.durationMs);

  const during = abilityStatus(s, frenzy, NOW + 1000);
  assert.equal(during.status, 'active');
  assert.equal(during.canFire, false);
  assert.equal(during.activeRemainingMs, frenzy.durationMs - 1000);
  assert.ok(during.progress > 0 && during.progress < 1);

  // A timed effect cannot be stacked on itself.
  assert.deepEqual(activateAbility(s, 'frenzy', ctxFor(s, NOW)),
    { ok: false, reason: 'already-active' });

  const after = abilityStatus(s, frenzy, NOW + frenzy.durationMs);
  assert.equal(after.status, 'cooldown', 'still cooling down after the effect ends');
  assert.ok(after.cdRemainingMs > 0);

  const ready = abilityStatus(s, frenzy, NOW + frenzy.cooldownMs + 1);
  assert.equal(ready.status, 'ready');
  assert.equal(ready.progress, 1);
});

test('an instant ability is on cooldown with no active window', () => {
  const s = createState(NOW);
  s.cookies = 1e9;
  unlockAbility(s, 'cookieRain');

  const before = s.cookies;
  const r = activateAbility(s, 'cookieRain', ctxFor(s, NOW));
  assert.ok(r.ok);
  assert.equal(s.cookies - before, 1000 * 300);
  assert.equal(s.abilities.cookieRain.activeUntil, 0);

  const st = abilityStatus(s, ABILITIES.find((a) => a.id === 'cookieRain'), NOW);
  assert.equal(st.status, 'cooldown');
  assert.deepEqual(activateAbility(s, 'cookieRain', ctxFor(s, NOW)),
    { ok: false, reason: 'cooldown' });
});

test('Chrono Warp clears cooldowns, then goes on its own cooldown', () => {
  const s = unlockedState();
  unlockAbility(s, 'chronoWarp');

  // Put the *other* abilities on cooldown. Chrono Warp itself must be ready to
  // fire, or this would just be testing the cooldown check.
  for (const id of Object.keys(s.abilities)) {
    if (id !== 'chronoWarp') s.abilities[id].cooldownUntil = NOW + 60_000;
  }

  const r = activateAbility(s, 'chronoWarp', ctxFor(s, NOW));
  assert.ok(r.ok, `expected to fire, got: ${r.reason}`);

  const warp = ABILITIES.find((a) => a.id === 'chronoWarp');
  for (const id of Object.keys(s.abilities)) {
    if (id === 'chronoWarp') {
      // Its own effect clears its own timer, but activation then sets it -- so it
      // is not free to spam.
      assert.equal(s.abilities[id].cooldownUntil, NOW + warp.cooldownMs,
        'chrono warp must still come back around');
    } else {
      assert.equal(s.abilities[id].cooldownUntil, 0, `${id} was cleared`);
    }
  }
});

test('Harvest Rush ripens every crop, and says so when there is nothing to ripen', () => {
  const s = unlockedState();
  unlockAbility(s, 'harvestRush');

  const empty = activateAbility(s, 'harvestRush', ctxFor(s, NOW));
  assert.ok(empty.ok, 'firing with an empty garden is allowed');
  assert.equal(empty.summary.count, 0);
  assert.match(empty.summary.label, /nothing growing/);

  sowGrapes(s, NOW);
  s.abilities.harvestRush.cooldownUntil = 0;
  const full = activateAbility(s, 'harvestRush', ctxFor(s, NOW));
  assert.equal(full.summary.count, s.garden.plotCount);
  assert.match(full.summary.label, /ripened/);
  for (const plot of s.garden.plots) assert.equal(plot.readyAt, NOW);
});

test('Golden Touch is a route to a golden that does not need the radar', () => {
  const s = createState(NOW);
  s.cookies = 1e12;
  assert.equal(goldensUnlocked(s), false, 'the radar is not owned');
  assert.equal(nextDelayMs(s, createRng(1)), null, 'so none are scheduled');

  unlockAbility(s, 'goldenTouch');
  const r = activateAbility(s, 'goldenTouch', ctxFor(s, NOW));
  assert.equal(r.summary.count, 1);
  assert.equal(s.goldens.length, 1, 'the ability bypasses the radar entirely');
});

test('an ability and a golden granting the same buff share one implementation', () => {
  // The point of routing both through effects.js: they cannot drift apart in
  // behaviour. They deliberately differ in duration -- the table says 30s and
  // 60s respectively -- so only the kind and multiplier are comparable.
  const fromCookie = unlockedState();
  applyGoldenEffect(fromCookie, 'frenzy', ctxFor(fromCookie, NOW));

  const fromBar = unlockedState();
  activateAbility(fromBar, 'frenzy', ctxFor(fromBar, NOW));

  assert.equal(fromCookie.buffs.length, 1);
  assert.equal(fromBar.buffs.length, 1);
  assert.equal(fromCookie.buffs[0].kind, fromBar.buffs[0].kind);
  assert.equal(fromCookie.buffs[0].mult, fromBar.buffs[0].mult);

  // Each duration comes from its own table row.
  const ability = ABILITIES.find((a) => a.id === 'frenzy');
  assert.equal(fromBar.buffs[0].until, NOW + ability.durationMs);
  assert.equal(fromCookie.buffs[0].until, NOW + GOLDEN.effects.find((e) => e.id === 'frenzy').effect.durationMs);
});

test('an ability description matches the multiplier it actually applies', () => {
  // Loose data and effects drift apart silently otherwise: an ability promising
  // x7 and delivering x5 is only discoverable by reading the source.
  for (const ability of ABILITIES) {
    const claimed = ability.description.match(/×(\d+(?:\.\d+)?)/)?.[1];
    if (claimed === undefined) continue;
    assert.equal(ability.effect.mult, Number(claimed),
      `${ability.id} promises x${claimed} and applies x${ability.effect.mult}`);
  }
});

test('an ability with a duration always grants a buff, and one without never does', () => {
  const s = unlockedState();

  for (const ability of ABILITIES) {
    sowGrapes(s, NOW);
    unlockAbility(s, ability.id);
    const before = s.buffs.length;
    const r = activateAbility(s, ability.id, ctxFor(s, NOW));
    assert.ok(r.ok, `${ability.id} failed to activate: ${r.reason}`);

    if (ability.durationMs > 0) {
      assert.equal(s.buffs.length, before + 1, `${ability.id} has a duration but granted no buff`);
      assert.equal(s.buffs.at(-1).until, NOW + ability.durationMs);
    } else {
      assert.equal(s.buffs.length, before, `${ability.id} is instant but left a buff running`);
    }
  }
});

test('cleanAbilities drops dead active markers and absurd cooldowns', () => {
  const s = createState(NOW);
  s.abilities.harvestRush.activeUntil = NOW + 1_000_000; // instant ability, never active
  s.abilities.chronoWarp.cooldownUntil = NOW + 10 * 365 * 24 * 3_600_000; // a year+ is corruption

  const changed = cleanAbilities(s, NOW);
  assert.equal(changed, 2);
  assert.equal(s.abilities.harvestRush.activeUntil, 0);
  assert.equal(s.abilities.chronoWarp.cooldownUntil, 0);
  assert.equal(cleanAbilities(s, NOW), 0, 'idempotent');
});

test('a save missing an ability record cannot be activated', () => {
  const s = unlockedState();
  delete s.abilities.chronoWarp;
  assert.deepEqual(activateAbility(s, 'chronoWarp', ctxFor(s, NOW)),
    { ok: false, reason: 'no-such-ability' });
});

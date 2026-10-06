/**
 * Golden cookies.
 *
 * Three separate things share this file because they share one piece of state:
 *
 *   - `summonGolden`   puts a golden on screen
 *   - `clickGolden`    resolves it into a random effect and cleans up
 *   - `nextDelayMs`    how long until the next one is scheduled
 *
 * Goldens live in `state.goldens` as absolute timestamps so that several can be
 * on screen at once and the Golden Touch ability can stack with a scheduled one.
 * Scheduling uses an absolute `goldenUntil` rather than a `setTimeout`, for the
 * same reason the garden uses absolute times: the page does not own the clock.
 */

import { GOLDEN, RESEARCH } from './balance.js';
import { applyEffect } from './effects.js';
import { prestigeStats } from './economy.js';
import { hashSeed } from './rng.js';

/** A golden is on screen if its `until` has not passed. */
export function liveGoldens(state, now) {
  return (state.goldens ?? []).filter((g) => g.until > now);
}

/**
 * Put `count` golden cookies on screen, spread apart so they do not overlap.
 *
 * Positions are stored in the state (not the DOM) so that a save taken while one
 * is visible puts it back in the same place.
 */
export function summonGolden(state, now, count = 1, seed = now) {
  for (let i = 0; i < count; i++) {
    const n = state.goldens.length;
    const id = `g${n}-${(hashSeed(seed, i) % 1e6).toString(36)}`;
    state.goldens.push({
      id,
      // A coarse grid of slots keeps two goldens from landing on top of each
      // other; the jitter is what stops them sitting in a visible lattice.
      x: 12 + (hashSeed(id, 'x') % 68),
      y: 18 + (hashSeed(id, 'y') % 52),
      bornAt: now,
      until: now + GOLDEN.onScreenMs,
    });
  }
  return count;
}

/**
 * Click a golden: roll an effect, apply it, remove the golden.
 *
 * The effect goes through `applyEffect`, the same path an ability uses, so a
 * Frenzy from a golden cookie and a Frenzy from the ability bar are provably the
 * same multiplier.
 *
 * @returns {{label:string, effect:object, summary:object}|null} null if the id
 *          is unknown -- a second click on a golden the first click already
 *          collected finds nothing and must pay out nothing.
 */
export function clickGolden(state, goldenId, now, ctx, rng) {
  const idx = (state.goldens ?? []).findIndex((g) => g.id === goldenId);
  if (idx === -1) return null;
  const golden = state.goldens[idx];

  const effect = weightedPick(GOLDEN.effects, rng);
  const summary = applyEffect(state, effect.effect, ctx);

  state.goldens.splice(idx, 1);
  state.stats.goldenClicked += 1;
  state.stats.clicksSinceGolden = 0;
  state.goldenUntil = 0;
  return { label: effect.label, effect, summary, golden };
}

export function weightedPick(items, rng) {
  let total = 0;
  for (const it of items) total += it.weight ?? 1;
  let roll = rng() * total;
  for (const it of items) {
    roll -= it.weight ?? 1;
    if (roll <= 0) return it;
  }
  return items[items.length - 1];
}

/**
 * Apply a named golden-cookie effect directly.
 *
 * Exists so a golden cookie and an ability that grant the same thing can be
 * compared in a test without going through a random roll.
 */
export function applyGoldenEffect(state, effectId, ctx) {
  const effect = GOLDEN.effects.find((e) => e.id === effectId);
  if (!effect) return null;
  return { label: effect.label, summary: applyEffect(state, effect.effect, ctx) };
}

/** Goldens enabled at all -- requires the Radar click upgrade. */
export function goldensUnlocked(state) {
  return state.upgrades.click.goldenRadar === true;
}

/**
 * Delay until the next golden should appear.
 *
 * Three things scale it: the base jitter, the Time Compression research, and the
 * Golden Luck prestige upgrade. `goldensUnlocked` gates it entirely -- without
 * the Radar, this returns null and nothing is ever scheduled.
 */
export function nextDelayMs(state, rng) {
  if (!goldensUnlocked(state)) return null;
  const base = GOLDEN.baseDelayMs + rng() * GOLDEN.jitterMs;
  const speed = timeCompression(state);
  const luck = prestigeStats(state).goldenDelay;
  return Math.max(GOLDEN.minDelayMs, (base / speed) * luck);
}

/** Golden cookies per unit time, for the stats panel. */
export function expectedGoldenIntervalMs(state) {
  if (!goldensUnlocked(state)) return null;
  const base = GOLDEN.baseDelayMs + GOLDEN.jitterMs / 2;
  return (base / timeCompression(state)) * prestigeStats(state).goldenDelay;
}

/**
 * ×2 per Time Compression level.
 *
 * Read off the research table by its `goldenSpeed` field rather than by id, so
 * a future "golden cookies also appear more often" research needs no edit here.
 */
function timeCompression(state) {
  let speed = 1;
  for (const r of RESEARCH) {
    if (state.upgrades.research[r.id] && r.goldenSpeed) speed *= r.goldenSpeed;
  }
  return speed;
}

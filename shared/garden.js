/**
 * The garden.
 *
 * Plots hold absolute timestamps -- `plantedAt` and `readyAt` -- never a
 * countdown. This is the single most important decision in the module: growth
 * therefore continues correctly while the tab is closed, across a save/load, and
 * across a device clock change, with no catch-up loop and nothing to reconcile.
 * A crop's maturity is a fact about the world, not a timer the page owns.
 */

import { GARDEN, SEED_BY_ID } from './balance.js';
import { grantCookies } from './effects.js';

/**
 * The cookies a crop is worth at a given production rate.
 *
 * Both the price and the payout derive from this one number, which is what makes
 * "planting is never profitable" a structural property rather than a balance
 * number someone has to remember to keep true: cost is `value * costFactor`
 * with costFactor > 1, so cost > yield holds at every rate, including zero.
 */
function seedValue(seed, cps) {
  return Math.max(0, Math.floor(Math.max(0, cps) * seed.yieldMult));
}

/** Seed price. Scales with production so the garden stays relevant. */
export function seedCost(seed, cps) {
  // The floor of 1 means a save with no production can still plant something,
  // which is worth more than the zero it would pay out.
  return Math.max(1, Math.floor(seedValue(seed, cps) * GARDEN.costFactor));
}

/** Harvest payout. Always strictly less than what planting cost. */
export function seedYield(seed, cps) {
  return seedValue(seed, cps);
}

/**
 * Describe one plot.
 * @returns {{state:'empty'|'growing'|'ready'|'unknown', ...}}
 */
export function plotInfo(plot, now) {
  if (!plot) return { state: 'empty', progress: 0, remainingMs: 0 };
  const seed = SEED_BY_ID[plot.seedId];
  if (!seed) return { state: 'unknown', progress: 0, remainingMs: 0 };

  const total = Math.max(1, plot.readyAt - plot.plantedAt);
  const elapsed = now - plot.plantedAt;
  const progress = Math.min(1, Math.max(0, elapsed / total));

  if (now >= plot.readyAt) {
    return { state: 'ready', seed, progress: 1, remainingMs: 0, readyAt: plot.readyAt };
  }
  return {
    state: 'growing', seed, progress,
    remainingMs: plot.readyAt - now,
    readyAt: plot.readyAt,
  };
}

/** Aggregate counts for the panel header. */
export function gardenSummary(state, now) {
  let empty = 0;
  let growing = 0;
  let ready = 0;
  let broken = 0;
  for (let i = 0; i < state.garden.plotCount; i++) {
    const info = plotInfo(state.garden.plots[i], now);
    if (info.state === 'empty') empty++;
    else if (info.state === 'ready') ready++;
    else if (info.state === 'growing') growing++;
    else broken++;
  }
  return { empty, growing, ready, broken, total: state.garden.plotCount };
}

/**
 * Plant a seed.
 * @returns {{ok:boolean, reason?:string, cost?:number}}
 *
 * Mutates `state`. `reason` is a machine-readable string so the UI can decide
 * between a toast and a silent ignore, rather than the caller parsing prose.
 */
export function plant(state, plotIndex, seedId, now, cps) {
  // Bounds are checked against plotCount, not against the contents of the slot.
  // An empty plot is stored as `null`, so testing the slot for truthiness
  // rejects exactly the plots a player is trying to fill.
  if (!Number.isInteger(plotIndex) || plotIndex < 0 || plotIndex >= state.garden.plotCount) {
    return { ok: false, reason: 'no-plot' };
  }
  if (state.garden.plots[plotIndex]) return { ok: false, reason: 'occupied' };

  const seed = SEED_BY_ID[seedId];
  if (!seed) return { ok: false, reason: 'no-seed' };

  const cost = seedCost(seed, cps);
  if (state.cookies < cost) return { ok: false, reason: 'too-expensive', cost };

  state.cookies -= cost;
  state.garden.plots[plotIndex] = {
    seedId,
    plantedAt: now,
    readyAt: now + seed.growMs,
    // Production at planting is baked in so that harvesting after a big upgrade
    // does not retroactively inflate the reward, and harvesting before one does
    // not punish the player for leaving.
    lockedCps: Math.max(0, cps),
  };
  return { ok: true, cost, seed };
}

/**
 * Harvest a ripe plot.
 * @returns {{ok:boolean, reason?:string, amount?:number, buff?:object}}
 */
export function harvest(state, plotIndex, now) {
  const plot = state.garden.plots[plotIndex];
  if (!plot) return { ok: false, reason: 'empty' };

  const info = plotInfo(plot, now);
  if (info.state === 'unknown') {
    // A seed that no longer exists in the table: clear the plot rather than
    // trapping the player behind a tile they can neither read nor harvest.
    state.garden.plots[plotIndex] = null;
    return { ok: false, reason: 'unknown-seed' };
  }
  if (info.state !== 'ready') return { ok: false, reason: 'growing' };

  const seed = info.seed;
  const amount = seedYield(seed, plot.lockedCps ?? 0);
  grantCookies(state, amount);
  state.stats.harvests += 1;
  state.garden.plots[plotIndex] = null;

  let buff = null;
  if (seed.buff) {
    buff = { kind: seed.buff.kind, mult: seed.buff.mult, until: now + seed.buff.durationMs };
    state.buffs.push({ kind: buff.kind, mult: buff.mult, until: buff.until });
  }
  return { ok: true, amount, seed, buff };
}

/** Ripen everything at once -- used by the Harvest Rush ability. */
export function ripenAll(state, now) {
  let n = 0;
  for (let i = 0; i < state.garden.plotCount; i++) {
    const plot = state.garden.plots[i];
    if (plot && plot.readyAt > now) {
      plot.readyAt = now;
      n++;
    }
  }
  return n;
}

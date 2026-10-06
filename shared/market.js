/**
 * The market.
 *
 * A mean-reverting random walk, one step every MARKET.tickMs.
 *
 * Why reversion rather than a pure random walk: with pure drift, COOK trends up
 * forever until it hits the clamp, which makes "wait" the correct answer to
 * every trade and turns the minigame into a sleep timer. With pure noise and no
 * drift, every price is a coin flip. The pull term -- each step moves a fraction
 * of the way back toward `startPrice` -- gives the market a tradeable baseline
 * while still letting a lucky streak feel like a streak.
 *
 * Tick count is derived from elapsed time rather than accumulated by a timer, so
 * a backgrounded tab catches up correctly on return instead of drifting.
 */

import { MARKET, STOCK_BY_ID } from './balance.js';

/** Fractional change since `lookback` ticks ago. 0 when there is no history. */
export function priceChange(row, lookback = 6) {
  const h = row.history;
  if (h.length < 2) return 0;
  const idx = Math.max(0, h.length - 1 - lookback);
  const then = h[idx];
  if (!(then > 0)) return 0;
  return (row.price - then) / then;
}

/** Portfolio totals for the panel header. */
export function portfolioValue(state) {
  let cost = 0;
  let shares = 0;
  for (const row of state.market) {
    cost += row.price * row.shares;
    shares += row.shares;
  }
  return { cost, shares };
}

/**
 * Advance the market by one step for one symbol.
 *
 * Split out from `tickMarket` so a test can walk a single symbol deterministically.
 * `rng` is required -- no Math.random() anywhere in this module.
 */
export function stepPrice(row, def, rng) {
  const reversion = MARKET.meanReversion * (row.price - def.startPrice) / def.startPrice;
  const shock = (rng() * 2 - 1) * def.volatility;
  let next = row.price * (1 + MARKET.drift - reversion + shock);

  const lo = def.startPrice * MARKET.minPriceRatio;
  const hi = def.startPrice * MARKET.maxPriceRatio;
  // Clamping rather than reflecting: a player who buys at the ceiling should not
  // be handed a free crash to buy into.
  next = Math.min(hi, Math.max(lo, next));
  return Math.max(1, next);
}

/**
 * Advance every symbol by `steps` ticks.
 *
 * @returns true if any price moved, so the caller knows whether to re-render.
 */
export function tickMarket(state, steps, rng) {
  if (steps <= 0) return false;
  for (let s = 0; s < steps; s++) {
    for (const row of state.market) {
      const def = STOCK_BY_ID[row.symbol];
      if (!def) continue;
      row.price = stepPrice(row, def, rng);
      row.history.push(row.price);
      if (row.history.length > MARKET.historyLength) row.history.shift();
    }
  }
  return true;
}

/**
 * How many whole ticks are owed since `lastTick`.
 *
 * Capped at `maxSteps` so that a device that was asleep for a week does not
 * spend a noticeable pause replaying 33,600 ticks on the main thread. Beyond a
 * few dozen ticks the price is as good as re-randomised anyway.
 */
export function dueSteps(lastTick, now, maxSteps = 24) {
  if (!lastTick) return 0;
  const elapsed = now - lastTick;
  if (elapsed < MARKET.tickMs) return 0;
  return Math.min(maxSteps, Math.floor(elapsed / MARKET.tickMs));
}

/**
 * Buy shares.
 *
 * Partial fills are avoided on purpose: the button says "Buy 5" and either
 * five shares are bought or the purchase is refused. A partial buy would make
 * the displayed share count disagree with the label the player just clicked.
 *
 * @returns {{ok:boolean, reason?:string, filled?:number, cost?:number}}
 */
export function buyShares(state, symbol, qty, now, rng) {
  const row = state.market.find((m) => m.symbol === symbol);
  const def = STOCK_BY_ID[symbol];
  if (!row || !def) return { ok: false, reason: 'no-such-stock' };

  const want = Math.max(1, Math.floor(qty));
  const room = def.maxShares - row.shares;
  if (room <= 0) return { ok: false, reason: 'max-shares' };
  if (want > room) return { ok: false, reason: 'not-enough-room', room };

  // Charge the *worst* price in the fill range so a mid-fill price movement can
  // never make the trade cost more than the player was quoted.
  const cost = Math.ceil(row.price * want);
  if (state.cookies < cost) return { ok: false, reason: 'too-expensive', cost };

  state.cookies -= cost;
  row.shares += want;
  state.stats.trades += 1;
  state.marketLastTick = tickMarketClock(state.marketLastTick, now);
  return { ok: true, filled: want, cost };
}

/**
 * Sell shares.
 *
 * Only one unit can be sold per click, deliberately. The share cap is low and
 * the price moves on a visible timer, so selling the entire position in one
 * click would let a player skip the market they are playing.
 */
export function sellShare(state, symbol, now) {
  const row = state.market.find((m) => m.symbol === symbol);
  if (!row) return { ok: false, reason: 'no-such-stock' };
  if (row.shares < 1) return { ok: false, reason: 'none-owned' };

  const revenue = Math.floor(row.price);
  row.shares -= 1;
  state.cookies += revenue;
  state.totalCookies += revenue;
  state.stats.trades += 1;
  state.marketLastTick = tickMarketClock(state.marketLastTick, now);
  return { ok: true, revenue };
}

/** After a trade, prices resume from now rather than replaying elapsed time. */
function tickMarketClock(lastTick, now) {
  return lastTick && now - lastTick < MARKET.tickMs ? lastTick : now;
}

/**
 * Seconds until the next price change, for the countdown label.
 *
 * A market that has never ticked is reported as a full interval away rather than
 * as "0s", which would read as "prices are changing right now" and then not
 * change for a quarter of an hour.
 */
export function nextTickIn(state, now) {
  if (!state.marketLastTick) return MARKET.tickMs;
  const elapsed = now - state.marketLastTick;
  return Math.max(0, MARKET.tickMs - elapsed);
}

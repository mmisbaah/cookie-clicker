import test from 'node:test';
import assert from 'node:assert/strict';

import { MARKET, STOCKS, STOCK_BY_ID } from '../shared/balance.js';
import {
  buyShares, dueSteps, nextTickIn, portfolioValue, priceChange, sellShare, stepPrice,
  tickMarket,
} from '../shared/market.js';
import { createRng } from '../shared/rng.js';
import { createState } from '../shared/state.js';

const NOW = 1_700_000_000_000;

/** A state with prices pinned at their starting values. */
function marketState() {
  const s = createState(NOW);
  s.marketLastTick = 0;
  return s;
}

/** A deterministic stream that always returns the same values. */
const fixed = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const COOK = STOCK_BY_ID.COOK;
const GOLD = STOCK_BY_ID.GOLD;

// ---------------------------------------------------------------------------
// Price walk
// ---------------------------------------------------------------------------

test('a single step moves the price and stays inside the clamps', () => {
  const row = { price: COOK.startPrice, history: [COOK.startPrice] };

  // rng() === 1 gives the maximum upward shock.
  const up = stepPrice(row, COOK, fixed(1));
  assert.ok(up > COOK.startPrice, 'a maximal shock must raise the price');

  // rng() === 0 gives the maximal downward shock.
  const down = stepPrice(row, COOK, fixed(0));
  assert.ok(down < COOK.startPrice);

  // The clamps hold no matter how many steps run.
  let p = COOK.startPrice;
  for (let i = 0; i < 5000; i++) {
    p = stepPrice({ price: p }, COOK, fixed(i % 2 ? 1 : 0));
    assert.ok(p >= COOK.startPrice * MARKET.minPriceRatio - 1e-6, `floor breached at ${p}`);
    assert.ok(p <= COOK.startPrice * MARKET.maxPriceRatio + 1e-6, `ceiling breached at ${p}`);
    assert.ok(p >= 1, 'a price is never below one cookie');
  }
});

test('the walk is deterministic for a given random stream', () => {
  // Two fresh states fed the same stream must end up identical, or the market
  // cannot be reasoned about in a test or replayed from a save.
  const a = marketState();
  const b = marketState();
  const streamA = createRng(12345);
  const streamB = createRng(12345);

  tickMarket(a, 20, streamA);
  tickMarket(b, 20, streamB);
  assert.deepEqual(a.market, b.market);

  const c = marketState();
  tickMarket(c, 20, createRng(999));
  assert.notDeepEqual(a.market, c.market, 'a different seed must give a different walk');
});

test('prices mean-revert toward their starting value', () => {
  // Without the pull term a lucky drift runs away and every trade decision
  // becomes "wait", which is the failure mode this test exists to prevent.
  const s = marketState();
  const row = s.market[0];
  row.price = COOK.startPrice * 10; // shoved far above the baseline

  for (let i = 0; i < 2000; i++) row.price = stepPrice(row, COOK, createRng(i));

  assert.ok(
    Math.abs(row.price - COOK.startPrice) < COOK.startPrice * 3,
    `price drifted to ${row.price.toFixed(0)} and never came back`,
  );
});

test('history is capped at MARKET.historyLength', () => {
  const s = marketState();
  tickMarket(s, MARKET.historyLength * 3, createRng(7));
  for (const row of s.market) {
    assert.equal(row.history.length, MARKET.historyLength);
    assert.ok(row.price > 0);
  }
});

test('tickMarket with no steps changes nothing', () => {
  const s = marketState();
  const before = JSON.stringify(s.market);
  assert.equal(tickMarket(s, 0, createRng(1)), false);
  assert.equal(tickMarket(s, -5, createRng(1)), false);
  assert.equal(JSON.stringify(s.market), before);
});

// ---------------------------------------------------------------------------
// Ticking
// ---------------------------------------------------------------------------

test('dueSteps derives ticks from elapsed time, not from a timer', () => {
  assert.equal(dueSteps(0, NOW), 0, 'a never-ticked market owes nothing');
  assert.equal(dueSteps(NOW, NOW + 1_000), 0);
  assert.equal(dueSteps(NOW, NOW + MARKET.tickMs), 1);
  assert.equal(dueSteps(NOW, NOW + MARKET.tickMs * 3 + 500), 3, 'partial ticks are not owed yet');

  // A week asleep: capped, so returning does not stall the main thread.
  const week = MARKET.tickMs * 24 * 60 * 7;
  assert.equal(dueSteps(NOW, NOW + week, 24), 24);
  assert.equal(nextTickIn({ marketLastTick: NOW }, NOW), MARKET.tickMs);
  assert.equal(nextTickIn({ marketLastTick: NOW }, NOW + MARKET.tickMs + 5), 0);

  // A market that has never ticked is a full interval away, not zero: "0s" would
  // read as "prices are moving right now" and then not move for 15 minutes.
  assert.equal(nextTickIn({ marketLastTick: 0 }, NOW), MARKET.tickMs);
});

// ---------------------------------------------------------------------------
// Trading
// ---------------------------------------------------------------------------

test('buy debits exactly the quoted price and takes the shares', () => {
  const s = marketState();
  s.cookies = 100_000;

  const r = buyShares(s, 'COOK', 5, NOW, createRng(1));
  assert.ok(r.ok);
  assert.equal(r.filled, 5);
  assert.equal(r.cost, Math.ceil(COOK.startPrice * 5));
  assert.equal(s.cookies, 100_000 - r.cost);
  assert.equal(s.market[0].shares, 5);
  assert.equal(s.stats.trades, 1);
});

test('buy refuses cleanly rather than partially filling', () => {
  const s = marketState();

  assert.equal(buyShares(s, 'NOPE', 1, NOW, createRng(1)).reason, 'no-such-stock');

  s.cookies = 10;
  assert.equal(buyShares(s, 'COOK', 1, NOW, createRng(1)).reason, 'too-expensive');
  assert.equal(s.market[0].shares, 0, 'no partial fill');
  assert.equal(s.cookies, 10);

  // Asking for more than the cap allows is refused with the room reported, so the
  // UI can grey out the button instead of silently buying a smaller amount.
  s.cookies = 1e9;
  const over = buyShares(s, 'COOK', 99, NOW, createRng(1));
  assert.equal(over.reason, 'not-enough-room');
  assert.equal(over.room, COOK.maxShares);
  assert.equal(s.market[0].shares, 0);
});

test('the share cap cannot be exceeded by repeated buying', () => {
  const s = marketState();
  s.cookies = 1e12;

  for (let i = 0; i < 40; i++) buyShares(s, 'COOK', 5, NOW, createRng(i));

  assert.equal(s.market[0].shares, COOK.maxShares);
  assert.equal(buyShares(s, 'COOK', 1, NOW, createRng(1)).reason, 'max-shares');
});

test('sell returns one share at the current price and banks lifetime cookies', () => {
  const s = marketState();
  s.cookies = 0;
  s.market[0].shares = 3;

  const r = sellShare(s, 'COOK', NOW);
  assert.ok(r.ok);
  assert.equal(r.revenue, COOK.startPrice);
  assert.equal(s.cookies, COOK.startPrice);
  assert.equal(s.totalCookies, COOK.startPrice, 'selling counts toward lifetime for the chip curve');
  assert.equal(s.market[0].shares, 2);
  assert.equal(s.stats.trades, 1);

  assert.equal(sellShare(s, 'NOPE', NOW).reason, 'no-such-stock');
});

test('buying and selling both count as a trade', () => {
  const s = marketState();
  s.cookies = 1e6;
  buyShares(s, 'COOK', 1, NOW, createRng(1));
  sellShare(s, 'COOK', NOW);
  assert.equal(s.stats.trades, 2);
});

test('selling the last share then trying again is refused', () => {
  const s = marketState();
  s.market[0].shares = 1;
  assert.ok(sellShare(s, 'COOK', NOW).ok);
  assert.equal(sellShare(s, 'COOK', NOW).reason, 'none-owned');
  assert.equal(s.market[0].shares, 0);
});

test('a trade resets the tick clock only when the window has passed', () => {
  const s = marketState();
  s.cookies = 1e6;
  s.marketLastTick = NOW - 5_000;

  // Trading 10s into a 15s window leaves the remaining 5s intact, so the price
  // the player is waiting on still arrives when they were told it would.
  const r = buyShares(s, 'COOK', 1, NOW, createRng(1));
  assert.ok(r.ok, 'precondition: the trade went through');
  assert.equal(s.marketLastTick, NOW - 5_000, 'clock preserved inside the window');

  // Trading much later than a tick window restarts from now rather than owing a
  // backlog the player never watched play out.
  const stale = marketState();
  stale.cookies = 1e6;
  stale.marketLastTick = NOW - 10 * MARKET.tickMs;
  buyShares(stale, 'COOK', 1, NOW, createRng(1));
  assert.equal(stale.marketLastTick, NOW);
});

// ---------------------------------------------------------------------------
// Readouts
// ---------------------------------------------------------------------------

test('priceChange reports a fraction over the requested window', () => {
  // history's last entry is the current price (tickMarket pushes it), so a
  // lookback of n compares against the price n ticks ago.
  const row = { price: 110, history: [100, 100, 100, 100, 110] };
  assert.ok(Math.abs(priceChange(row, 4) - 0.1) < 1e-9, 'four ticks ago it was 100');
  assert.ok(Math.abs(priceChange(row, 1) - 0.1) < 1e-9, 'one tick ago it was also 100');
  assert.ok(Math.abs(priceChange(row, 8) - 0.1) < 1e-9, 'a lookback longer than the history clamps to the oldest entry');

  const falling = { price: 90, history: [100, 110, 90] };
  assert.ok(Math.abs(priceChange(falling, 2) - -0.1) < 1e-9);
  assert.equal(priceChange({ price: 1, history: [] }, 4), 0, 'no history, no change');
  assert.equal(priceChange({ price: 1, history: [1] }, 4), 0);
  assert.equal(priceChange({ price: 1, history: [0, 1] }, 4), 0, 'a zero price must not divide by zero');
});

test('portfolioValue totals the position at current prices', () => {
  const s = marketState();
  assert.deepEqual(portfolioValue(s), { cost: 0, shares: 0 });

  s.market[0].shares = 2;             // 2 x 100
  s.market[1].shares = 4;             // 4 x 250
  const v = portfolioValue(s);
  assert.equal(v.cost, 200 + 1000);
  assert.equal(v.shares, 6);
});

test('every stock is tradeable and the price ladder is sane', () => {
  for (let i = 1; i < STOCKS.length; i++) {
    assert.ok(STOCKS[i].startPrice > STOCKS[i - 1].startPrice,
      `${STOCKS[i].symbol} is not priced above ${STOCKS[i - 1].symbol}`);
    assert.ok(STOCKS[i].volatility >= STOCKS[i - 1].volatility,
      `${STOCKS[i].symbol} is not riskier than the cheaper one`);
    assert.ok(STOCKS[i].maxShares >= 1);
  }
  // The table and a fresh state's rows must agree on order and symbols, or the
  // panel would label the wrong price with the wrong ticker.
  const s = marketState();
  assert.deepEqual(s.market.map((m) => m.symbol), STOCKS.map((x) => x.symbol));
  assert.deepEqual(s.market.map((m) => m.price), STOCKS.map((x) => x.startPrice));
});

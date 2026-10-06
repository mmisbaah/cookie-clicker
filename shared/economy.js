/**
 * Production mathematics.
 *
 * Everything here is a pure function of (state, now). Nothing mutates state,
 * nothing reads the clock, nothing touches the DOM. That is the whole design
 * brief, and it is what makes the game testable: a test can build a state, jump
 * `now` forward three hours, and assert on the exact production rate without
 * waiting or stubbing timers.
 *
 * The multiplier stack, in the order it is applied:
 *
 *   baseCps        sum of owned buildings x their own research multipliers
 *   x cookieMult   additive percentage points from cookie upgrades
 *   x researchMult outright multipliers from tech research
 *   x kittenMult   per-achievement multipliers from kitten research
 *   x buffCps      temporary golden-cookie and ability multipliers
 *   x prestigeCps  heavenly-boost levels
 *   x achMult      +2% per achievement, then milestone multipliers
 *   x skinMult     the equipped cookie skin
 *   = cps
 *
 * The two rules that make this survive being balanced:
 *   1. Every multiplier defaults to exactly 1 and multiplies. No additive term
 *      ever joins another additive term by accident.
 *   2. Multipliers are *not* baked into the building total. They are recomputed
 *      from the upgrade tables every time production is read, so buying an
 *      upgrade later retroactively applies to buildings already owned.
 */

import {
  ABILITIES, ASCENSION, BUILDINGS, CLICK_UPGRADES, COOKIE_SKINS, COOKIE_UPGRADES,
  GARDEN, MILESTONES, PRESTIGE, PRESTIGE_UPGRADES, RESEARCH, ACHIEVEMENT_CPS_PER,
} from './balance.js';

/** Explicit buys are capped so a fat-fingered ×1000 cannot lock the tab. */
export const MAX_EXPLICIT_BUY = 100_000;

// ---------------------------------------------------------------------------
// Building costs
// ---------------------------------------------------------------------------

/** Price of the next single unit, after the prestige cost discount. */
export function unitCost(building, owned, discount = 1) {
  const raw = building.baseCost * discount * Math.pow(building.costGrowth, owned);
  return Math.max(1, Math.floor(raw));
}

/**
 * Total price of `count` units bought back to back.
 *
 * Closed form (geometric series) rather than a loop. At ×Max against a building
 * with 4,000 owned the loop version would run 4,000 pow() calls per tile per
 * keystroke in the shop search box; this is one pow().
 *
 * The discount is applied once, to the whole ladder, rather than per unit. That
 * is the intended reading of "buildings cost 1% less" and it keeps the series
 * closed-form -- discounting each unit separately would not change the total
 * anyway, since every unit's price scales linearly with `discount`.
 */
export function bulkCost(building, count, owned, discount = 1) {
  const n = Math.floor(count);
  if (n <= 0) return 0;
  const base = building.baseCost * discount;
  const g = building.costGrowth;
  const ladder = g === 1
    ? base * n
    : base * Math.pow(g, owned) * (Math.pow(g, n) - 1) / (g - 1);
  // Never cheaper than one cookie per unit; without this a 0.5x discount on a
  // cheap building can round the sum below the number of units, which reads as
  // "Buy ×10" costing less than "Buy ×1".
  return Math.max(n, Math.floor(ladder));
}

/**
 * Largest affordable count at `owned`, via doubling then bisection.
 *
 * Doubling first keeps the search range at log2(affordable) instead of
 * guessing an upper bound. The hard cap is not a limit on what a player can
 * buy -- a rich player buys more than this every second -- it only stops the
 * probe from wandering into exponent territory if a balance value goes wrong.
 */
export function maxAffordable(building, budget, owned, discount = 1) {
  if (!(budget > 0)) return 0;
  if (unitCost(building, owned, discount) > budget) return 0;

  let lo = 1;
  let hi = 2;
  while (bulkCost(building, hi, owned, discount) <= budget && hi < 1e7) {
    lo = hi;
    hi *= 2;
  }
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (bulkCost(building, mid, owned, discount) <= budget) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Resolve a buy-amount selector into a concrete, priced plan.
 *
 * The single place where "what does the player actually get when they press
 * Buy" is decided. The shop tile, the affordability badge and the purchase
 * handler all call this, which is what guarantees the button never quotes a
 * price it cannot honour and never quietly buys a different amount than it said.
 */
export function buyPlan(state, building, amount) {
  const discount = prestigeStats(state).costDiscount;
  const owned = state.buildings[building.id] ?? 0;
  const count = amount === 'max'
    ? maxAffordable(building, state.cookies, owned, discount)
    : Math.max(1, Math.min(Math.floor(amount) || 1, MAX_EXPLICIT_BUY));

  const unit = unitCost(building, owned, discount);
  const total = bulkCost(building, count, owned, discount);
  return { count, owned, unit, total, affordable: count > 0 && state.cookies >= total };
}

/** Apply a plan produced by `buyPlan`. Returns units actually bought. */
export function applyBuyPlan(state, building, plan) {
  if (!plan || plan.count <= 0 || state.cookies < plan.total) return 0;
  state.cookies -= plan.total;
  state.buildings[building.id] = (state.buildings[building.id] ?? 0) + plan.count;
  return plan.count;
}

// ---------------------------------------------------------------------------
// Prestige
// ---------------------------------------------------------------------------

/**
 * Resolve prestige upgrade levels into concrete numbers.
 *
 * Driven off the `effect.stat` field in PRESTIGE_UPGRADES rather than a switch
 * per upgrade, so adding an upgrade means adding a row to the table and adding
 * a reducer below -- not editing three separate places.
 */
const PRESTIGE_MODES = {
  cpsPercent: (lvl, e) => lvl * e.perLevel,
  cpcPercent: (lvl, e) => lvl * e.perLevel,
  costDiscount: (lvl, e) => Math.max(e.min ?? 0, 1 - lvl * e.perLevel),
  offlineEfficiency: (lvl, e) => Math.min(e.max ?? 1, e.base + lvl * e.perLevel),
  goldenDelay: (lvl, e) => Math.max(e.min ?? 0, 1 + lvl * e.perLevel),
  ascensionCookies: (lvl, e) => lvl * e.perLevel,
  offlineCapMs: (lvl, e) => PRESTIGE.baseOfflineCapMs + lvl * e.perLevel,
  gardenPlots: (lvl, e) => GARDEN.basePlots + lvl * e.perLevel,
};

/** @returns resolved prestige effects for the whole state. */
export function prestigeStats(state) {
  const out = {
    cpsPercent: 0,
    cpcPercent: 0,
    costDiscount: PRESTIGE.baseCostDiscount,
    offlineEfficiency: PRESTIGE.baseOfflineEfficiency,
    offlineCapMs: PRESTIGE.baseOfflineCapMs,
    goldenDelay: 1,
    ascensionCookies: 0,
    gardenPlots: GARDEN.basePlots,
  };
  for (const upgrade of PRESTIGE_UPGRADES) {
    const level = state.prestige?.[upgrade.id] ?? 0;
    if (!level) continue;
    const reduce = PRESTIGE_MODES[upgrade.effect.stat];
    if (reduce) out[upgrade.effect.stat] = reduce(level, upgrade.effect);
  }
  return out;
}

/** Level, cap, and a priced plan for one prestige upgrade. */
export function prestigePlan(state, upgrade, amount) {
  const level = Math.max(0, Math.min(upgrade.maxLevel, state.prestige?.[upgrade.id] ?? 0));
  const room = upgrade.maxLevel - level;
  let want;
  if (amount === 'max') {
    want = Math.min(room, Math.floor(state.chips / upgrade.costPerLevel));
  } else {
    want = Math.min(room, Math.max(1, Math.floor(amount) || 1));
  }
  const cost = want * upgrade.costPerLevel;
  return { level, room, want, cost, maxed: room <= 0, affordable: want > 0 && state.chips >= cost };
}

export function applyPrestigePlan(state, upgrade, plan) {
  if (!plan || plan.want <= 0 || state.chips < plan.cost) return 0;
  state.chips -= plan.cost;
  state.prestige[upgrade.id] = plan.level + plan.want;
  return plan.want;
}

/** Heavenly Chips the player would bank by ascending right now. */
export function chipsGain(state) {
  return ASCENSION.gain(state.totalCookies, state.totalChips);
}

/**
 * Reset the run, keep the account.
 *
 * Everything that was bought with cookies is gone; everything bought with chips
 * stays. `totalCookies` deliberately survives, because the chip curve is
 * computed from lifetime cookies -- resetting it would make every ascension
 * after the first worth zero.
 */
export function ascend(state, now, gain) {
  const chips = Math.max(0, Math.floor(gain));
  state.chips += chips;
  state.totalChips += chips;
  state.ascensions += 1;
  state.stats.ascensionsTotal += 1;

  for (const b of BUILDINGS) state.buildings[b.id] = 0;
  for (const u of CLICK_UPGRADES) state.upgrades.click[u.id] = false;
  for (const u of COOKIE_UPGRADES) state.upgrades.cookie[u.id] = false;
  for (const r of RESEARCH) state.upgrades.research[r.id] = false;
  for (const a of ABILITIES) {
    state.abilities[a.id] = { unlocked: false, cooldownUntil: 0, activeUntil: 0 };
  }

  state.buffs = [];
  state.goldens = [];
  state.goldenUntil = 0;
  state.cookies = prestigeStats(state).ascensionCookies;
  state.lastSeenAt = now;
  return chips;
}

// ---------------------------------------------------------------------------
// Buffs
// ---------------------------------------------------------------------------

/** Buffs that have not expired. Pure -- does not clean up the state. */
export function liveBuffs(state, now) {
  return (state.buffs ?? []).filter((b) => b.until > now);
}

/** Drop expired buffs. Mutates only `state.buffs`. */
export function cleanBuffs(state, now) {
  const before = state.buffs?.length ?? 0;
  state.buffs = liveBuffs(state, now);
  return before - state.buffs.length;
}

// ---------------------------------------------------------------------------
// Multiplier stack
// ---------------------------------------------------------------------------

/**
 * Per-building multipliers from research.
 *
 * Synergies read the *current* count of their source building, so a synergy is
 * worth nothing until the source is owned and grows as it is. That is the
 * intended incentive: Farm Synergy is a bet on Mines.
 */
export function buildingMultipliers(state) {
  const mults = Object.fromEntries(BUILDINGS.map((b) => [b.id, 1]));
  for (const r of RESEARCH) {
    if (!state.upgrades.research[r.id]) continue;
    if (r.kind === 'synergy') {
      const source = state.buildings[r.source] ?? 0;
      mults[r.target] *= 1 + source * r.rate;
    } else if (r.buildingMult) {
      mults[r.buildingMult.target] *= r.buildingMult.multiplier;
    }
  }
  return mults;
}

/** Sum of owned buildings before any global multiplier. */
export function baseCps(state, mults = buildingMultipliers(state), overrideId, overrideOwned) {
  let total = 0;
  for (const b of BUILDINGS) {
    const owned = b.id === overrideId ? overrideOwned : (state.buildings[b.id] ?? 0);
    if (owned > 0) total += b.cps * owned * mults[b.id];
  }
  return total;
}

/** (1 + 2% per achievement) x milestone multipliers. */
export function achievementMult(count) {
  let m = 1 + count * ACHIEVEMENT_CPS_PER;
  for (const ms of MILESTONES) if (count >= ms.count) m *= ms.mult;
  return m;
}

/**
 * The full production multiplier stack, split out.
 *
 * Returning the pieces rather than one product is deliberate: the shop tooltip
 * and the stats panel both display the stack, and a single opaque `cps` number
 * cannot explain a 400× production figure to a player who just bought one
 * building.
 */
export function productionMults(state, now) {
  const prestige = prestigeStats(state);

  let cookie = 1;
  for (const u of COOKIE_UPGRADES) if (state.upgrades.cookie[u.id]) cookie += u.cpsBonus / 100;

  let research = 1;
  for (const r of RESEARCH) {
    if (state.upgrades.research[r.id] && r.globalMult) research *= r.globalMult;
  }

  let kitten = 1;
  for (const r of RESEARCH) {
    if (state.upgrades.research[r.id] && r.perMilestone) {
      kitten += (state.achievements?.length ?? 0) * r.perMilestone;
    }
  }

  const buffs = liveBuffs(state, now);
  let buffCps = 1;
  let buffClick = 1;
  for (const b of buffs) {
    if (b.kind === 'cpsMult') buffCps *= b.mult;
    else if (b.kind === 'clickMult') buffClick *= b.mult;
  }

  const ach = achievementMult(state.achievements?.length ?? 0);
  const skin = 1 + (COOKIE_SKINS.find((s) => s.id === state.prefs?.skin)?.cpsBonus ?? 0);
  const prestigeCps = 1 + prestige.cpsPercent;
  const prestigeCpc = 1 + prestige.cpcPercent;

  return {
    cookie, research, kitten, buffCps, buffClick, ach, skin, prestigeCps, prestigeCpc,
    total: cookie * research * kitten * buffCps * prestigeCps * ach * skin,
    buffs,
  };
}

/**
 * Cookies per second.
 *
 * `override` pretends a building has a different count without touching state,
 * which is how the shop shows "this one buys you +4.2K/sec" without a save /
 * mutate / recalculate / restore dance on every render.
 */
export function cps(state, now, override) {
  const mults = buildingMultipliers(state);
  const owned = override ? override.id : undefined;
  const base = baseCps(state, mults, owned, override?.owned);
  return base * productionMults(state, now).total;
}

/**
 * Cookies per click, plus the two click-only upgrade aggregates the click
 * handler needs: golden-cookie drop chance, and whether goldens are unlocked at
 * all.
 */
export function clickPower(state, now) {
  let base = 1;
  let mult = 1;
  let percent = 0;
  let goldenChance = 0;
  let goldensUnlocked = false;

  for (const u of CLICK_UPGRADES) {
    if (!state.upgrades.click[u.id]) continue;
    if (u.cpcBonus) base += u.cpcBonus;
    if (u.cpcMultiplier) mult *= u.cpcMultiplier;
    if (u.cpcPercent) percent += u.cpcPercent;
    if (u.goldenChance) goldenChance += u.goldenChance;
    if (u.unlocksGolden) goldensUnlocked = true;
  }

  const m = productionMults(state, now);
  return {
    value: base * mult * (1 + percent) * m.prestigeCpc * m.buffClick,
    base,
    mult: mult * (1 + percent) * m.prestigeCpc * m.buffClick,
    goldenChance,
    goldensUnlocked,
    buffClick: m.buffClick,
  };
}

/**
 * Everything the UI needs about production, computed once.
 *
 * The game loop calls this every frame and the renderers read from it, so the
 * numbers in the HUD, the shop tiles and the ascension panel can never disagree
 * with each other.
 */
export function derived(state, now) {
  const mults = productionMults(state, now);
  const buildingMult = buildingMultipliers(state);
  const base = baseCps(state, buildingMult);
  const click = clickPower(state, now);
  const prestige = prestigeStats(state);

  return {
    base,
    buildingMult,
    mults,
    cps: base * mults.total,
    cpc: click.value,
    click,
    prestige,
    chipsGain: chipsGain(state),
    achievements: state.achievements?.length ?? 0,
    /** Per-second CPS contribution of each building, for shop tiles. */
    buildingCps: Object.fromEntries(
      BUILDINGS.map((b) => [b.id, b.cps * (state.buildings[b.id] ?? 0) * buildingMult[b.id]]),
    ),
  };
}

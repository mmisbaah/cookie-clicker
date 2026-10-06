/**
 * Effect application.
 *
 * Golden cookies and abilities both hand out the same handful of things: a timed
 * multiplier, a lump sum of cookies, a golden cookie, ripened crops, cleared
 * cooldowns. This module is the single implementation of each, and the balance
 * tables store only *descriptors*.
 *
 * Why descriptors rather than functions in the data tables:
 *
 *   - `balance.js` is then genuinely pure data. A table you cannot `JSON.stringify`
 *     cannot be diffed, snapshotted, or loaded in a test without importing half
 *     the game's behaviour.
 *   - The effect vocabulary is closed and small, so "what can a golden cookie do"
 *     is answerable by reading this file rather than by auditing every `apply`.
 *   - An ability and a golden cookie that grant the same thing are then provably
 *     the same code, and a fix to one fixes the other.
 */

/** Credit cookies to both the spendable balance and the lifetime total. */
export function grantCookies(state, amount) {
  const n = Math.max(0, Math.floor(Number.isFinite(amount) ? amount : 0));
  state.cookies += n;
  state.totalCookies += n;
  return n;
}

/**
 * The effect kinds an entry in the balance tables may declare.
 *
 * Each takes the same `(state, effect, ctx)` signature and returns a short
 * summary the UI can show in a toast. An unknown kind is a no-op that reports
 * itself, so a balance row written by hand cannot crash a save load.
 */
const KINDS = {
  /** `buff` -- push a timed multiplier. */
  buff(state, effect, ctx) {
    const until = ctx.now + effect.durationMs;
    state.buffs.push({ kind: effect.buff, mult: effect.mult, until });
    return {
      kind: effect.buff,
      label: `${effect.buff === 'cpsMult' ? 'Production' : 'Click power'} ×${effect.mult} for ${Math.round(effect.durationMs / 1000)}s`,
      until,
    };
  },

  /** `cookies` -- an instant lump sum, sized from live production. */
  cookies(state, effect, ctx) {
    const amount = grantCookies(state, Math.floor((ctx.cps ?? 0) * effect.seconds));
    return { kind: 'cookies', label: `+${amount} cookies`, amount };
  },

  /** `golden` -- put golden cookies on screen. */
  golden(state, effect, ctx) {
    const count = ctx.summonGolden ? ctx.summonGolden(effect.count ?? 1, ctx.now) : 0;
    return { kind: 'golden', label: `${count} golden cookie${count === 1 ? '' : 's'} incoming`, count };
  },

  /** `ripen` -- finish every growing crop. */
  ripen(state, effect, ctx) {
    const count = ctx.ripenAll ? ctx.ripenAll(ctx.now) : 0;
    return { kind: 'ripen', label: count ? `${count} crop${count === 1 ? '' : 's'} ripened` : 'nothing growing', count };
  },

  /** `resetCooldowns` -- clear every ability timer, including the caller's. */
  resetCooldowns(state, effect, ctx) {
    for (const id of Object.keys(state.abilities)) state.abilities[id].cooldownUntil = 0;
    return { kind: 'resetCooldowns', label: 'All cooldowns cleared' };
  },
};

/**
 * Apply a descriptor from the balance tables.
 *
 * @param {object} state  mutated in place
 * @param {object} effect a descriptor: {kind, ...}
 * @param {object} ctx    {now, cps, summonGolden?, ripenAll?}
 * @returns {{kind:string, label:string}} a summary for the UI
 */
export function applyEffect(state, effect, ctx = {}) {
  const when = { now: Date.now(), ...ctx };
  const fn = effect && KINDS[effect.kind];
  if (!fn) {
    return { kind: 'none', label: 'nothing happened' };
  }
  return fn(state, effect, when);
}

/** True when a descriptor is one this build knows how to apply. */
export function isKnownEffect(effect) {
  return !!effect && typeof effect.kind === 'string' && effect.kind in KINDS;
}

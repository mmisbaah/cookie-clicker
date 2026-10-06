/**
 * Abilities: unlocking, cooldowns, activation.
 *
 * Two states, not one. An ability is *locked* until the player pays its
 * `unlockCost` once; after that it is *unlocked* and can be re-fired on a
 * cooldown forever. Conflating the two is the usual source of bugs here -- a
 * player who cannot afford an ability and a player whose ability is on cooldown
 * both show a disabled button, but only one of them can fix it by waiting.
 *
 * Timers are absolute. Nothing here schedules anything: the game loop asks
 * `abilityStatus` what to draw, and the only mutation points are unlock and
 * activate.
 */

import { ABILITIES, ABILITY_BY_ID } from './balance.js';
import { applyEffect } from './effects.js';

/** @returns the ability definition, or null. */
export function getAbility(id) {
  return ABILITY_BY_ID[id] ?? null;
}

/**
 * Everything the ability bar needs to render one slot.
 *
 * Returns a discriminated `status` rather than a pile of booleans so the caller
 * cannot accidentally treat "locked" as "ready".
 *
 * @returns {{ability, status, locked, cdRemainingMs, activeRemainingMs,
 *            progress, canFire, label}}
 *   status: 'locked' | 'ready' | 'cooldown' | 'active'
 *   progress: 0..1 fill for the cooldown/active bar
 */
export function abilityStatus(state, ability, now) {
  const record = state.abilities[ability.id] ?? { unlocked: false, cooldownUntil: 0, activeUntil: 0 };

  if (!record.unlocked) {
    return {
      ability,
      status: 'locked',
      locked: true,
      cdRemainingMs: 0,
      activeRemainingMs: 0,
      progress: 0,
      canFire: state.cookies >= ability.unlockCost,
      label: `${ability.unlockCost}`,
    };
  }

  const active = ability.durationMs > 0 && record.activeUntil > now;
  const cd = record.cooldownUntil - now;

  if (active) {
    return {
      ability,
      status: 'active',
      locked: false,
      cdRemainingMs: Math.max(0, cd),
      activeRemainingMs: record.activeUntil - now,
      // Fills as the effect runs down, so the bar empties when it expires.
      progress: 1 - (record.activeUntil - now) / ability.durationMs,
      canFire: false,
      label: `${Math.ceil((record.activeUntil - now) / 1000)}s`,
    };
  }

  if (cd > 0) {
    return {
      ability,
      status: 'cooldown',
      locked: false,
      cdRemainingMs: cd,
      activeRemainingMs: 0,
      // Empties toward ready, which is the direction players expect from a
      // cooldown ring.
      progress: 1 - cd / ability.cooldownMs,
      canFire: false,
      label: `${Math.ceil(cd / 1000)}s`,
    };
  }

  return {
    ability,
    status: 'ready',
    locked: false,
    cdRemainingMs: 0,
    activeRemainingMs: 0,
    progress: 1,
    canFire: true,
    label: '',
  };
}

/** Status for every ability, in bar order. */
export function allAbilityStatuses(state, now) {
  return ABILITIES.map((a) => abilityStatus(state, a, now));
}

/**
 * Pay to unlock an ability.
 *
 * @returns {{ok:boolean, reason?:string}}
 */
export function unlockAbility(state, abilityId) {
  const ability = getAbility(abilityId);
  if (!ability) return { ok: false, reason: 'no-such-ability' };

  const record = state.abilities[ability.id];
  if (!record) return { ok: false, reason: 'no-such-ability' };
  if (record.unlocked) return { ok: false, reason: 'already-unlocked' };
  if (state.cookies < ability.unlockCost) return { ok: false, reason: 'too-expensive' };

  state.cookies -= ability.unlockCost;
  record.unlocked = true;
  // Unlocking does not start the cooldown. The player paid for the ability and
  // should be able to fire it immediately -- starting it on a timer would make
  // the unlock feel like it was ignored.
  record.cooldownUntil = 0;
  record.activeUntil = 0;
  return { ok: true, unlocked: true };
}

/**
 * Fire an already-unlocked ability.
 *
 * @param {object} ctx  {now, cps, summonGolden?, ripenAll?} -- the callbacks an
 *                      effect may need, so this module never imports the garden
 *                      or the golden-cookie scheduler itself.
 * @returns {{ok:boolean, reason?:string, summary?:object}}
 */
export function activateAbility(state, abilityId, ctx) {
  const ability = getAbility(abilityId);
  if (!ability) return { ok: false, reason: 'no-such-ability' };

  const now = ctx.now;
  const record = state.abilities[ability.id];
  // A save whose `abilities` record lost an entry must not throw here. The
  // reconciler fills these in on load; this is the second line of defence for a
  // state assembled some other way (a test, a console poke, an import).
  if (!record) return { ok: false, reason: 'no-such-ability' };
  if (!record.unlocked) return { ok: false, reason: 'locked' };

  // A re-triggerable effect (duration 0, no cooldown worth speaking of) is
  // allowed while active; a buff is not. `durationMs > 0` is the discriminator.
  if (ability.durationMs > 0 && record.activeUntil > now) {
    return { ok: false, reason: 'already-active' };
  }
  if (record.cooldownUntil > now) return { ok: false, reason: 'cooldown' };

  const summary = applyEffect(state, ability.effect, ctx);
  if (summary.kind === 'none') return { ok: false, reason: 'no-effect' };

  record.cooldownUntil = now + ability.cooldownMs;
  if (ability.durationMs > 0) record.activeUntil = now + ability.durationMs;
  else record.activeUntil = 0;

  return { ok: true, summary };
}

/** Drop expired `activeUntil` markers so a save does not carry dead timers. */
export function cleanAbilities(state, now) {
  let changed = 0;
  for (const ability of ABILITIES) {
    const record = state.abilities[ability.id];
    if (!record) continue;
    if (ability.durationMs === 0 && record.activeUntil !== 0) {
      record.activeUntil = 0;
      changed++;
    }
    if (record.cooldownUntil > now + 365 * 24 * 3_600_000) {
      // A cooldown further out than a year is a corrupted value, not a timer.
      record.cooldownUntil = 0;
      changed++;
    }
  }
  return changed;
}

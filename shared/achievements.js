/**
 * Achievement evaluation.
 *
 * All achievements live in ACHIEVEMENTS as pure predicates over the state. This
 * module is the one place that runs them, and it has two rules that the rest of
 * the game relies on:
 *
 *   1. Unlocking is permanent and idempotent. `syncAchievements` reconciles the
 *      unlocked list against the table without ever re-awarding.
 *   2. A predicate that throws cannot take down the game loop. Achievements are
 *      evaluated on a timer, so one bad condition would otherwise wedge
 *      production every second until reload.
 */

import { ACHIEVEMENTS, MILESTONES } from './balance.js';
import { derived } from './economy.js';

/**
 * Evaluate every achievement and return the newly-earned ones.
 *
 * Mutates `state.achievements`. Returns the new definitions *in table order* so
 * a batch of five simultaneous unlocks always toasts in a stable, meaningful
 * sequence rather than the order the predicate loop happened to hit them.
 *
 * `derive` is injectable: the caller passes an already-computed derived bundle
 * so that a frame which needs both production and achievements does not compute
 * production twice.
 */
export function syncAchievements(state, now, derive = derived) {
  // Normalise up front rather than only on a successful award. A save whose
  // achievements field was null or a non-array would otherwise leave the
  // invariant false, and the "nothing was awarded" path is exactly the one that
  // never gets to fix it.
  if (!Array.isArray(state.achievements)) state.achievements = [];

  const have = new Set(state.achievements);
  if (have.size >= ACHIEVEMENTS.length) return [];

  const d = derive(state, now);
  const ctx = { cps: d.cps, cpc: d.cpc, now };
  const fresh = [];

  for (const a of ACHIEVEMENTS) {
    if (have.has(a.id)) continue;
    let ok = false;
    try {
      ok = a.check(state, ctx) === true;
    } catch {
      // A broken predicate must not stop the others from being evaluated, and
      // must never surface as an error dialog mid-bake.
      ok = false;
    }
    if (ok) {
      have.add(a.id);
      fresh.push(a);
    }
  }

  if (fresh.length) {
    state.achievements = ACHIEVEMENTS.filter((a) => have.has(a.id)).map((a) => a.id);
  }
  return fresh;
}

/**
 * Drop achievements that no longer exist in the table.
 *
 * Only reachable through a hand-edited or older save. Cheaper to tolerate than
 * to guard against everywhere that reads `state.achievements`.
 */
export function pruneAchievements(state) {
  const known = new Set(ACHIEVEMENTS.map((a) => a.id));
  state.achievements = (state.achievements ?? []).filter((id) => known.has(id));
  return state;
}

/**
 * Progress summary for the awards panel.
 *
 * The single source of truth for "what has this player earned": the panel reads
 * this rather than recounting, so the display and the milestone rules cannot
 * drift apart.
 */
export function achievementSummary(state) {
  const total = ACHIEVEMENTS.length;
  const got = (state.achievements ?? []).length;
  const groups = [];
  for (const a of ACHIEVEMENTS) {
    let g = groups.find((x) => x.label === a.group);
    if (!g) groups.push(g = { label: a.group, items: [] });
    g.items.push({ ...a, unlocked: (state.achievements ?? []).includes(a.id) });
  }
  return {
    total,
    got,
    pct: total ? Math.round((got / total) * 100) : 0,
    groups,
    next: MILESTONES.find((m) => got < m.count) ?? null,
    earned: MILESTONES.filter((m) => got >= m.count),
  };
}

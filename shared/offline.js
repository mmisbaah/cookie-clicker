/**
 * Offline earnings.
 *
 * Two subtleties here, and both of them are the reason this module exists
 * separately from the main loop.
 *
 * 1. **Timed buffs are integrated, not smeared.** The obvious implementation --
 *    take the production rate at the moment the player left and multiply it by
 *    the gap -- pays a 30-second Frenzy for a four-hour absence. That is both
 *    wrong and exploitable: leave just after a golden cookie, close the tab, come
 *    back. So the gap is split at every buff expiry and each slice is paid at the
 *    multiplier that was actually live during it.
 *
 * 2. **The cap is reported.** A cap the player cannot see is indistinguishable
 *    from a bug, so the welcome-back panel shows the uncapped figure whenever the
 *    two differ.
 */

import { TIMING } from './balance.js';
import { derived, liveBuffs, prestigeStats } from './economy.js';

/**
 * The part of the production rate that does not vary over time.
 *
 * Everything except the buffs. The buff multiplier changes over the course of an
 * absence, which is exactly why it cannot be folded in here.
 */
function steadyRate(d) {
  const m = d.mults;
  return d.base * m.cookie * m.research * m.kitten * m.prestigeCps * m.ach * m.skin;
}

/**
 * Integrate production over a span, honouring buff expiries inside it.
 *
 * Walks the span in slices, breaking at each `until` of a live production buff.
 * The loop advances strictly forward and consumes one buff boundary per
 * iteration, so it terminates on the number of buffs -- usually zero, giving a
 * single slice.
 *
 * @param {object} state
 * @param {number} from   absolute start timestamp
 * @param {number} durationMs
 * @returns {number} cookies produced, unrounded
 */
export function integrateCookies(state, from, durationMs) {
  const span = Math.max(0, durationMs);
  if (span <= 0) return 0;

  const rate = steadyRate(derived(state, from));
  if (!(rate > 0) || !Number.isFinite(rate)) return 0;

  let produced = 0;
  let cursor = from;
  const end = from + span;

  while (cursor < end) {
    let mult = 1;
    let next = end;
    for (const buff of liveBuffs(state, cursor)) {
      if (buff.kind !== 'cpsMult') continue;
      mult *= buff.mult;
      // Only buffs still in the future can end the current slice.
      if (buff.until > cursor && buff.until < next) next = buff.until;
    }
    produced += rate * mult * ((next - cursor) / 1000);
    cursor = next;
  }

  return produced;
}

/**
 * Work out what the player earned while away.
 *
 * Pure: does not touch the state.
 *
 * @returns {{awayMs, grantedMs, cookies, capped, efficiency, lostMs, cps,
 *            averageCps, thresholdMs}}
 */
export function offlineReport(state, now) {
  const awayMs = Math.max(0, now - (state.lastSeenAt ?? now));
  const prestige = prestigeStats(state);
  const efficiency = prestige.offlineEfficiency;
  const capMs = prestige.offlineCapMs;
  const from = state.lastSeenAt ?? now;

  // The rate at the moment they left, which is the number the player remembers
  // seeing in the HUD. Reported even when nothing is granted.
  const departureCps = derived(state, from).cps;

  if (awayMs < TIMING.minOfflineMs) {
    return {
      awayMs, grantedMs: 0, cookies: 0, capped: false,
      efficiency, lostMs: 0, cps: departureCps, averageCps: departureCps,
      thresholdMs: TIMING.minOfflineMs,
    };
  }

  const grantedMs = Math.min(awayMs, capMs);
  const gross = integrateCookies(state, from, grantedMs);
  const cookies = Math.floor(gross * efficiency);

  return {
    awayMs,
    grantedMs,
    cookies,
    capped: awayMs > capMs,
    efficiency,
    lostMs: Math.max(0, awayMs - grantedMs),
    cps: departureCps,
    // What was actually paid per second, which will be lower than `cps` if a
    // buff lapsed. The welcome-back panel shows both when they differ.
    averageCps: grantedMs > 0 ? (gross / (grantedMs / 1000)) * efficiency : 0,
    thresholdMs: TIMING.minOfflineMs,
  };
}

/**
 * Apply an offline report to the state.
 *
 * Returns the same report so the caller can render it. Only coins move: buffs
 * are timed off absolute timestamps, so one that would have expired while away
 * is simply not live when the game resumes. No special handling needed.
 */
export function applyOffline(state, report) {
  if (report.cookies > 0) {
    state.cookies += report.cookies;
    state.totalCookies += report.cookies;
  }
  return report;
}

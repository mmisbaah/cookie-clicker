/**
 * Number and duration formatting.
 *
 * The cookie counter in this game passes through 1e18 within a single prestige
 * loop, so every one of these has to survive values that are not finite and
 * values that are absurdly large without printing "NaN" or "1e+21" at a player.
 */

/**
 * Terse number formatting: 1.23K, 4.5M, 1.2Qa, ... 
 *
 * Deliberately three significant figures. An idle game's whole interface is
 * ratios between numbers ("this costs 40% of what I have"), so precision past
 * three digits is noise that costs horizontal space in a phone-width column.
 *
 * Non-finite and negative inputs are clamped rather than thrown, because the
 * CPS pipeline multiplies a dozen user-chosen multipliers together and can
 * produce Infinity during a balance experiment. Showing "∞" is honest; showing
 * "NaN" in a player's HUD is a bug report.
 */
export function fmt(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '0';
  if (n === Infinity) return '∞';
  if (n === -Infinity) return '-∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 1000) return String(Math.floor(n));

  const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  const tier = Math.floor(Math.log10(n) / 3);
  if (tier >= SUFFIX.length) return n.toExponential(2);

  const scaled = n / Math.pow(1000, tier);
  // Truncate, never round.
  //
  // This is the most load-bearing decision in the file. The same formatter
  // prices shop buttons and reports balances, and rounding upward means a
  // player holding 123,500 sees a button reading "Buy x1 - 124K" with the
  // button greyed out and no way to work out why. Truncating can only ever
  // *understate* a price, which costs a confused moment; rounding can refuse a
  // purchase the player can plainly afford, which is the most common complaint
  // about incremental games.
  const truncated = Math.floor(scaled * 10) / 10;
  const body = truncated >= 100 ? String(Math.floor(truncated)) : truncated.toFixed(1);
  return body + SUFFIX[tier];
}

/** Signed variant for deltas: +12%, -4%, +3.1M. */
export function fmtSigned(n, body = fmt) {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return sign + body(Math.abs(n));
}

/**
 * Format a *rate* -- cookies per second, cookies per click.
 *
 * `fmt` deliberately truncates to whole numbers so a price never reads high, but
 * that makes it useless here: a fresh save produces 0.1 cookies a second, and a
 * HUD reading "0/sec" next to a cookie that visibly does nothing is the single
 * most confusing first thirty seconds in the game.
 *
 * So rates get their own rule. Below 100 the value keeps two significant figures,
 * and it never rounds *up* past a whole number -- the same "never promise more
 * than there is" property `fmt` has. (`toFixed` rounds, so the digit is dropped
 * before formatting rather than after.)
 *
 *   0        -> "0"
 *   0.1      -> "0.1"
 *   0.212    -> "0.21"
 *   4.25     -> "4.2"
 *   99.99    -> "99"
 *   100      -> "100"
 *   1234     -> "1.2K"
 */
export function fmtRate(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '0';
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '0';
  if (n <= 0) return '0';
  if (n >= 100) return fmt(n);
  if (n >= 10) return String(Math.floor(n));
  if (n >= 1) return (Math.floor(n * 10) / 10).toFixed(1);
  return String(Math.floor(n * 100) / 100);
}

/** Signed percentage from a ratio: 0.123 -> "+12.3%". */
export function fmtPct(ratio, digits = 1) {
  const pct = ratio * 100;
  const sign = pct > 0 ? '+' : pct < 0 ? '-' : '';
  return `${sign}${Math.abs(pct).toFixed(digits)}%`;
}

/** Multiplier from a ratio: 1.25 -> "×1.25". */
export function fmtMult(ratio) {
  return '×' + (Math.round(ratio * 100) / 100).toString();
}

/** Plain grouped integer, for click counts and share counts. */
export function fmtInt(n) {
  const v = Math.floor(Number.isFinite(n) ? n : 0);
  return v.toLocaleString('en-US');
}

/**
 * Coarse duration: 45s, 2m 10s, 3h 04m, 2d 5h.
 *
 * Two units max. Grow times are read at a glance while deciding what to plant,
 * and a third unit only makes the number longer without making it more useful.
 */
export function fmtDuration(ms) {
  if (!Number.isFinite(ms)) return '—';
  const neg = ms < 0;
  let s = Math.floor(Math.abs(ms) / 1000);
  if (s < 60) return (neg ? '-' : '') + s + 's';
  const m = Math.floor(s / 60);
  s %= 60;
  if (m < 60) return (neg ? '-' : '') + m + 'm' + (s ? ' ' + s + 's' : '');
  const h = Math.floor(m / 60);
  if (h < 24) return (neg ? '-' : '') + h + 'h ' + String(m % 60).padStart(2, '0') + 'm';
  const d = Math.floor(h / 24);
  return (neg ? '-' : '') + d + 'd ' + (h % 24) + 'h';
}

/** Clock-style stopwatch for playtime: 0h 04m 12s. */
export function fmtPlaytime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s`;
}

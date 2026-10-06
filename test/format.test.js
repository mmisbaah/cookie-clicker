import test from 'node:test';
import assert from 'node:assert/strict';

import { fmt, fmtDuration, fmtPlaytime, fmtPct, fmtMult, fmtRate } from '../shared/format.js';

// ---------------------------------------------------------------------------
// fmt
// ---------------------------------------------------------------------------

test('fmt leaves sub-thousand values as plain integers', () => {
  assert.equal(fmt(0), '0');
  assert.equal(fmt(7), '7');
  assert.equal(fmt(999), '999');
  // Floor, not round: a counter showing 999.9 cookies must not read "1000".
  assert.equal(fmt(999.9), '999');
});

test('fmt switches tiers at powers of a thousand', () => {
  assert.equal(fmt(1000), '1.0K');
  assert.equal(fmt(1500), '1.5K');
  assert.equal(fmt(99_999), '99.9K');
  assert.equal(fmt(100_000), '100K');
  assert.equal(fmt(1e6), '1.0M');
  assert.equal(fmt(1e9), '1.0B');
  assert.equal(fmt(1e12), '1.0T');
  assert.equal(fmt(1e15), '1.0Qa');
  assert.equal(fmt(1e18), '1.0Qi');
  assert.equal(fmt(1e21), '1.0Sx');
});

test('fmt truncates rather than rounds, so a price never reads high', () => {
  // The whole reason this is not `toFixed`. A button that says 124K must be
  // buyable by anyone holding 123,456.
  assert.equal(fmt(123_456), '123K');
  assert.equal(fmt(123_999), '123K');
  assert.equal(fmt(1_999_999), '1.9M');
  // ...and a balance is never inflated past what the player actually holds.
  assert.equal(fmt(99_950), '99.9K');
});

test('fmt gives three significant figures, then stops adding digits', () => {
  assert.equal(fmt(1234), '1.2K');
  assert.equal(fmt(12_345), '12.3K');
  assert.equal(fmt(123_456), '123K');
  // Past the suffix table it falls back to exponent form rather than lying.
  assert.equal(fmt(1e33), '1.0Dc');
  assert.equal(fmt(1e36), '1.00e+36');
});

test('fmt survives the numbers an idle game actually produces', () => {
  // The whole reason these are defensive: production is a product of a dozen
  // user-chosen multipliers and can reach Infinity during a balance experiment.
  assert.equal(fmt(NaN), '0');
  assert.equal(fmt(Infinity), '∞');
  assert.equal(fmt(-Infinity), '-∞');
  assert.equal(fmt(undefined), '0');
  assert.equal(fmt(-1500), '-1.5K');
  assert.equal(fmt(1e300), '1.00e+300');
});

test('fmt does not mis-tier on floating point boundaries', () => {
  // 999_999.9 is the classic offender: log10(n)/3 rounds the tier *down*, so a
  // number that is nearly a million gets scaled as if it were thousands. Every
  // assertion here is about which suffix it lands in, not the decimal.
  assert.equal(fmt(999_999.9), '999K', 'nearly a million, but still in the K tier');
  assert.equal(fmt(999_999), '999K');
  assert.equal(fmt(999_400), '999K', 'three significant figures, so the decimal goes');
  assert.equal(fmt(1_000_000), '1.0M', 'and the tier flips exactly at the boundary');

  // Below 100 in a tier there is room for the decimal.
  assert.equal(fmt(99_499), '99.4K');
  assert.equal(fmt(99_500), '99.5K');
});

// ---------------------------------------------------------------------------
// Multipliers, percentages, durations
// ---------------------------------------------------------------------------

test('fmtRate keeps small rates legible instead of rounding them to zero', () => {
  // A fresh save makes 0.1 cookies a second. A HUD reading "0/sec" while the
  // cookie does nothing visible is the most confusing thing in a game's first
  // thirty seconds.
  assert.equal(fmtRate(0), '0');
  assert.equal(fmtRate(0.1), '0.1');
  assert.equal(fmtRate(0.212), '0.21');
  assert.equal(fmtRate(0.005), '0');
  assert.equal(fmtRate(1), '1.0');
  assert.equal(fmtRate(4.25), '4.2');
  assert.equal(fmtRate(9.99), '9.9');
});

test('fmtRate truncates rather than rounding, like fmt', () => {
  // Never promise more per second than actually arrives.
  assert.equal(fmtRate(99.99), '99', 'not "100"');
  assert.equal(fmtRate(4.29), '4.2', 'not "4.3"');
  assert.equal(fmtRate(0.999), '0.99');
});

test('fmtRate hands off to fmt above 100 and survives junk', () => {
  assert.equal(fmtRate(100), '100');
  assert.equal(fmtRate(1234), '1.2K');
  assert.equal(fmtRate(1e9), '1.0B');
  assert.equal(fmtRate(NaN), '0');
  assert.equal(fmtRate(undefined), '0');
  assert.equal(fmtRate(-5), '0');
  assert.equal(fmtRate(Infinity), '∞');
});

test('fmtPct and fmtMult handle sign and rounding', () => {
  assert.equal(fmtPct(0), '0.0%', 'zero gets no sign');
  assert.equal(fmtPct(0.123), '+12.3%');
  assert.equal(fmtPct(-0.045), '-4.5%');
  assert.equal(fmtPct(1.5, 0), '+150%');
  assert.equal(fmtMult(1), '×1');
  assert.equal(fmtMult(1.25), '×1.25');
  assert.equal(fmtMult(86.4), '×86.4');
});

test('fmtDuration shows at most two units', () => {
  assert.equal(fmtDuration(0), '0s');
  assert.equal(fmtDuration(45_000), '45s');
  assert.equal(fmtDuration(59_999), '59s');
  assert.equal(fmtDuration(60_000), '1m');
  assert.equal(fmtDuration(130_000), '2m 10s');
  assert.equal(fmtDuration(3_599_999), '59m 59s');
  assert.equal(fmtDuration(3_600_000), '1h 00m');
  assert.equal(fmtDuration(7_260_000), '2h 01m');
  assert.equal(fmtDuration(90_000_000), '1d 1h');
  assert.equal(fmtDuration(-45_000), '-45s');
  assert.equal(fmtDuration(NaN), '—');
});

test('fmtPlaytime is zero-padded like a clock', () => {
  assert.equal(fmtPlaytime(0), '0h 00m 00s');
  assert.equal(fmtPlaytime(3_661_000), '1h 01m 01s');
  assert.equal(fmtPlaytime(-5_000), '0h 00m 00s', 'negative elapsed time clamps to zero');
});

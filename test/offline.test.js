import test from 'node:test';
import assert from 'node:assert/strict';

import { TIMING } from '../shared/balance.js';
import { integrateCookies, offlineReport, applyOffline } from '../shared/offline.js';
import { createState } from '../shared/state.js';

const NOW = 1_700_000_000_000;
const MINUTE = 60_000;

function awayState(cps = 1000) {
  const s = createState(NOW);
  s.lastSeenAt = NOW;
  s.cookies = 500;
  s.buildings.grandma = cps; // 1 cps each
  return s;
}

// ---------------------------------------------------------------------------

test('a gap under the threshold grants nothing at all', () => {
  const s = awayState();
  const report = offlineReport(s, NOW + TIMING.minOfflineMs - 1);

  assert.equal(report.grantedMs, 0);
  assert.equal(report.cookies, 0);
  assert.ok(report.awayMs > 0, 'the gap is still reported for display');
  assert.equal(report.capped, false);
});

test('a gap inside the cap pays in full', () => {
  const s = awayState(1000); // 1000 cps
  const report = offlineReport(s, NOW + 3_600_000); // one hour

  assert.equal(report.efficiency, 0.5, 'base offline efficiency is half');
  assert.equal(report.grantedMs, 3_600_000);
  assert.equal(report.capped, false);
  assert.equal(report.lostMs, 0);
  assert.equal(report.cookies, Math.floor(1000 * 3600 * 0.5));
});

test('the cap applies and reports what was lost', () => {
  const s = awayState(1000);
  s.prestige.dreamBakery = 10; // efficiency 1.0

  const report = offlineReport(s, NOW + 24 * 3_600_000); // a full day
  assert.equal(report.efficiency, 1);
  assert.equal(report.capped, true, 'a cap the player cannot see is indistinguishable from a bug');
  assert.equal(report.grantedMs, 2 * 3_600_000, 'the two-hour base cap');
  assert.ok(report.lostMs > 0, 'the dropped time is reported, not hidden');
  assert.equal(report.awayMs - report.grantedMs, report.lostMs);
  assert.equal(report.cookies, Math.floor(1000 * 7200 * 1));
});

test('the cap grows with Time Capsule', () => {
  const s = awayState(1000);
  const week = 7 * 24 * 3_600_000;

  const before = offlineReport(s, NOW + week);
  assert.equal(before.grantedMs, 2 * 3_600_000, 'the two-hour base cap');

  s.prestige.timeCapsule = 12;
  const after = offlineReport(s, NOW + week);
  assert.equal(after.grantedMs, (2 + 12) * 3_600_000);
  assert.ok(after.cookies > before.cookies);
});

test('Dream Bakery raises the rate paid, not the cap', () => {
  const s = awayState(1000);
  const hour = offlineReport(s, NOW + 3_600_000);

  s.prestige.dreamBakery = 10;
  const better = offlineReport(s, NOW + 3_600_000);

  assert.ok(Math.abs(better.cookies / hour.cookies - 2) < 0.01);
  assert.equal(better.grantedMs, hour.grantedMs, 'both fit inside the cap');
});

test('a short buff is paid for its own length, not for the whole absence', () => {
  // The bug this pins down: taking the departure rate and multiplying by the gap
  // pays a 30-second Frenzy for four hours. Leave just after a golden cookie,
  // close the tab, and it was worth 7x production overnight.
  const s = awayState(1000); // 1000 cps steady
  s.buffs.push({ kind: 'cpsMult', mult: 7, until: NOW + 30_000 });

  const oneHour = 3_600_000; // inside the two-hour base cap, so this is only about buffs
  const report = offlineReport(s, NOW + oneHour);

  // 30s at 7000/s, then the remainder at 1000/s, all at half efficiency.
  const expectedGross = 7000 * 30 + 1000 * (oneHour / 1000 - 30);
  assert.equal(report.capped, false);
  assert.equal(report.cookies, Math.floor(expectedGross * 0.5));
  assert.equal(report.lostMs, 0);

  // A naive "departure rate x gap" implementation would have paid 7x this.
  assert.ok(report.cookies < (7000 * oneHour / 1000) * 0.5 / 3,
    'a 30s buff must not pay for the whole hour');

  // And the reported average must be far below the departure rate, which is the
  // number a naive implementation would have used.
  assert.ok(report.averageCps < report.cps * 0.2,
    `average ${report.averageCps.toFixed(0)} should be far under departure ${report.cps.toFixed(0)}`);
});

test('a buff covering the whole absence is paid in full', () => {
  const s = awayState(1000);
  s.buffs.push({ kind: 'cpsMult', mult: 7, until: NOW + 10 * 3_600_000 });

  const report = offlineReport(s, NOW + 3_600_000);
  assert.equal(report.cookies, Math.floor(7000 * 3600 * 0.5));
  assert.ok(Math.abs(report.averageCps - 7000 * 0.5) < 1);
});

test('a click buff contributes nothing to offline production', () => {
  const s = awayState(1000);
  s.buffs.push({ kind: 'clickMult', mult: 77, until: NOW + 10 * 3_600_000 });
  const withBuff = offlineReport(s, NOW + 3_600_000);
  assert.equal(withBuff.cookies, Math.floor(1000 * 3600 * 0.5));
});

test('several overlapping buffs are integrated in order', () => {
  const s = awayState(1000);
  s.buffs.push({ kind: 'cpsMult', mult: 2, until: NOW + 60_000 });
  s.buffs.push({ kind: 'cpsMult', mult: 3, until: NOW + 120_000 });

  // 60s at 6x, 60s at 3x, remainder at 1x.
  const report = offlineReport(s, NOW + 3_600_000);
  const gross = 6000 * 60 + 3000 * 60 + 1000 * (3600 - 120);
  assert.equal(report.cookies, Math.floor(gross * 0.5));
});

test('a buff already expired when the player left is ignored entirely', () => {
  const s = awayState(1000);
  s.buffs.push({ kind: 'cpsMult', mult: 7, until: NOW - 1 });
  const report = offlineReport(s, NOW + 3_600_000);
  assert.equal(report.cookies, Math.floor(1000 * 3600 * 0.5));
});

test('integrateCookies is exact and terminates with no buffs at all', () => {
  const s = awayState(1000);
  assert.equal(integrateCookies(s, NOW, 3_600_000), 1000 * 3600);
  assert.equal(integrateCookies(s, NOW, 0), 0);
  assert.equal(integrateCookies(s, NOW, -5), 0);

  // Many buffs, all expiring at distinct times: the walk must still terminate.
  for (let i = 1; i <= 200; i++) {
    s.buffs.push({ kind: 'cpsMult', mult: 1.001, until: NOW + i * 1000 });
  }
  const total = integrateCookies(s, NOW, 3_600_000);
  assert.ok(Number.isFinite(total));
  assert.ok(total > 1000 * 3600, '200 stacked buffs must pay more than the base rate');
});

test('the departure rate is reported even when nothing is granted', () => {
  const s = awayState(1000);
  s.buffs.push({ kind: 'cpsMult', mult: 7, until: NOW + 60_000 });
  const report = offlineReport(s, NOW + 1000); // under the threshold
  assert.equal(report.grantedMs, 0);
  assert.equal(report.cookies, 0);
  assert.ok(Math.abs(report.cps - 7000) < 1e-6, 'the HUD number the player remembers');
});

test('a future lastSeenAt grants nothing instead of paying backwards', () => {
  // A device clock that jumped forward, then back, on load.
  const s = awayState(1000);
  s.lastSeenAt = NOW + 3_600_000;
  const report = offlineReport(s, NOW);

  assert.equal(report.awayMs, 0);
  assert.equal(report.cookies, 0);
  assert.ok(report.cookies >= 0);
});

test('zero production grants zero offline cookies', () => {
  const s = createState(NOW);
  s.lastSeenAt = NOW - 10 * 3_600_000;
  const report = offlineReport(s, NOW);
  assert.equal(report.cps, 0);
  assert.equal(report.cookies, 0);
});

test('applyOffline credits both the balance and the lifetime total', () => {
  const s = awayState(1000);
  const before = { c: s.cookies, t: s.totalCookies };
  const report = offlineReport(s, NOW + 3_600_000);
  applyOffline(s, report);

  assert.equal(s.cookies, before.c + report.cookies);
  assert.equal(s.totalCookies, before.t + report.cookies);
});

test('expired buffs need no offline handling because they are timestamped', () => {
  const s = awayState(1000);
  s.buffs.push({ kind: 'cpsMult', mult: 7, until: NOW + 60_000 });
  s.lastSeenAt = NOW;

  // A 4 hour gap: the buff expired while away.
  applyOffline(s, offlineReport(s, NOW + 4 * 3_600_000));
  // Nothing to reconcile -- the stored `until` is simply in the past.
  assert.equal(s.buffs.length, 1, 'the buff record is left for the live filter to drop');
  assert.ok(s.buffs[0].until < NOW + 4 * 3_600_000);
});

// ---------------------------------------------------------------------------
// Repeated interruptions
//
// `lastSeenAt` is stamped on every save, not on every tab switch, which is what
// makes a player who alt-tabs every thirty seconds still accumulate offline
// earnings. Simulated here by advancing lastSeenAt only at autosave points.
// ---------------------------------------------------------------------------

/** The state a save would have left behind, `now` seconds after departure. */
const savedAt = (departed, now, cps = 1000) => {
  const s = awayState(cps);
  s.createdAt = departed;
  s.lastSeenAt = departed;
  return { state: s, at: now };
};

test('repeated short absences never add up to a grant', () => {
  // Five forty-second naps: five minutes away in total, but every individual gap
  // is under the 60s threshold, so nothing is granted. Gaps are measured one at a
  // time; they do not accumulate across tab switches.
  const { state } = savedAt(NOW, NOW);
  let total = 0;
  for (let i = 1; i <= 5; i++) {
    const later = NOW + i * 40_000;
    total += offlineReport(state, later).cookies;
    state.lastSeenAt = later; // the autosave that ends the absence
  }
  assert.equal(total, 0, '5 x 40s gaps are each under the threshold');
  assert.equal(state.lastSeenAt, NOW + 200_000);
});

test('a gap of exactly the threshold is granted', () => {
  const { state } = savedAt(NOW, NOW);
  const report = offlineReport(state, NOW + TIMING.minOfflineMs);
  assert.ok(report.awayMs >= report.thresholdMs);
  assert.ok(report.cookies > 0, 'the boundary is inclusive');
});

test('a long absence measured from the last save, not the last switch', () => {
  // The interesting case: away for two hours, but the tab was briefly focused
  // twenty minutes ago. The grant must measure from the *save*, which is the
  // furthest point back that is actually known.
  const { state } = savedAt(NOW, NOW);

  // No save happened: the whole gap counts.
  const full = offlineReport(state, NOW + 2 * 3_600_000);
  assert.equal(full.awayMs, 2 * 3_600_000);

  // A save 20 minutes in, then the player walks away for another 100 minutes.
  state.lastSeenAt = NOW + 20 * MINUTE;
  const tail = offlineReport(state, NOW + 2 * 3_600_000);
  assert.equal(tail.awayMs, 100 * MINUTE, 'measured from the last save');
  assert.ok(tail.cookies < full.cookies);
});
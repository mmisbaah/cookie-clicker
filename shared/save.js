/**
 * Save serialisation.
 *
 * The format is deliberately boring: `localStorage` holds one key containing
 * JSON, plus a mirrored copy in `sessionStorage` as a fallback for the case
 * where storage is blocked or the quota is exhausted mid-write.
 *
 * Two robustness rules, both learned the hard way by incremental games:
 *
 *   1. **Never let a bad save brick the game.** Every field is validated and
 *      coerced on load; `load` returns a report of what it had to repair rather
 *      than throwing. A player who edited a number into nonsense gets a working
 *      save and a warning, not a white screen.
 *   2. **Never lose the last good save.** Writes go to a backup key first; if the
 *      primary is found corrupt on load, the backup is tried.
 */

import { BALANCE_VERSION, PERSISTENCE } from './balance.js';
import { createState, reconcileState } from './state.js';
import { pruneAchievements } from './achievements.js';
import { cleanBuffs } from './economy.js';

const BACKUP_KEY = `${PERSISTENCE.storageKey}.bak`;

/**
 * Resolve a Web Storage area, or null.
 *
 * `globalThis` rather than `window` so this module imports cleanly under
 * `node --test`, where there is no window.
 *
 * The probe write is not paranoia: Safari in private mode exposes `localStorage`
 * as a working object that throws on `setItem`.
 */
function storage(kind) {
  try {
    const s = globalThis[kind];
    if (!s) return null;
    const probe = '__cc_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/**
 * The two storage areas, resolved fresh on every call.
 *
 * Deliberately not cached in module scope. A cached handle outlives everything
 * that could invalidate it -- the user clearing site data, a test installing its
 * own storage, a browser swapping the backing store -- and the module then reads
 * and writes an object nothing else can see, silently losing saves. Resolution
 * is one property access plus a tiny probe write, a few times a minute at most.
 */
function stores() {
  return { primary: storage('localStorage'), backup: storage('sessionStorage') };
}

/**
 * Write the state.
 * @returns {{ok:boolean, at:number, where:string}}
 */
export function save(state, now = Date.now()) {
  state.lastSeenAt = now;
  state.playMs = (state.playMs ?? 0);
  state.version = BALANCE_VERSION;

  let payload;
  try {
    payload = JSON.stringify(state);
  } catch (err) {
    console.warn('[cookie-clicker] save failed to serialise', err);
    return { ok: false, at: now, where: 'none' };
  }

  const { primary: p, backup: b } = stores();
  if (!p) return { ok: false, at: now, where: 'none' };

  // Keep the previous good save before overwriting. A write that is interrupted
  // halfway (tab closed mid-JSON) leaves an unparseable primary; the backup is
  // then the only copy of the run.
  try {
    const existing = p.getItem(PERSISTENCE.storageKey);
    if (existing && isParseable(existing)) {
      b?.setItem(BACKUP_KEY, existing);
      if (b && b !== p) p.setItem(BACKUP_KEY, existing);
    }
  } catch { /* backup is best-effort */ }

  try {
    p.setItem(PERSISTENCE.storageKey, payload);
    return { ok: true, at: now, where: 'primary' };
  } catch (err) {
    // Most likely QuotaExceededError. Try to make room by dropping the backup.
    try {
      p.removeItem(BACKUP_KEY);
      p.setItem(PERSISTENCE.storageKey, payload);
      return { ok: true, at: now, where: 'primary-no-backup' };
    } catch {
      console.warn('[cookie-clicker] save failed', err);
      return { ok: false, at: now, where: 'none' };
    }
  }
}

function isParseable(text) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and repair the save.
 *
 * @returns {{state:object, fresh:boolean, repairs:string[], fromBackup:boolean}}
 *          Always returns a usable state -- callers never need a try/catch.
 */
export function load(now = Date.now()) {
  const { primary: p, backup: b } = stores();
  const attempts = [];

  if (p) attempts.push({ text: p.getItem(PERSISTENCE.storageKey), backup: false });
  if (b) attempts.push({ text: b.getItem(BACKUP_KEY) ?? b.getItem(PERSISTENCE.storageKey), backup: true });

  for (const attempt of attempts) {
    if (!attempt.text) continue;
    const parsed = safeParse(attempt.text);
    if (!parsed) {
      console.warn('[cookie-clicker] save was corrupt, skipping');
      continue;
    }
    const { state, repairs } = hydrate(parsed, now);
    if (state) return { state, fresh: false, repairs, fromBackup: attempt.backup };
  }

  return { state: createState(now), fresh: true, repairs: [], fromBackup: false };
}

function safeParse(text) {
  try {
    const o = JSON.parse(text);
    return o && typeof o === 'object' ? o : null;
  } catch {
    return null;
  }
}

/**
 * Coerce arbitrary parsed JSON into a valid state.
 * @returns {{state:object|null, repairs:string[]}}
 */
function hydrate(raw, now) {
  const repairs = [];
  const base = createState(now);
  const s = { ...base, ...raw };

  // Numbers: anything not a finite number becomes the default.
  const num = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : (repairs.push(`bad number ${JSON.stringify(v)}`), fallback);
  };
  s.cookies = Math.max(0, num(s.cookies, 0));
  s.totalCookies = Math.max(0, num(s.totalCookies, 0));
  s.totalClicks = Math.max(0, Math.floor(num(s.totalClicks, 0)));
  s.chips = Math.max(0, num(s.chips, 0));
  s.totalChips = Math.max(0, num(s.totalChips, 0));
  s.ascensions = Math.max(0, Math.floor(num(s.ascensions, 0)));
  s.createdAt = num(s.createdAt, now);
  s.lastSeenAt = num(s.lastSeenAt, now);
  s.playMs = Math.max(0, num(s.playMs, 0));

  if (!Array.isArray(s.buffs)) {
    repairs.push('buffs was not a list');
    s.buffs = [];
  }
  if (!Array.isArray(s.achievements)) {
    repairs.push('achievements was not a list');
    s.achievements = [];
  }
  if (!s.stats || typeof s.stats !== 'object') s.stats = { ...base.stats };
  if (!s.prefs || typeof s.prefs !== 'object') s.prefs = { ...base.prefs };
  if (!s.garden || typeof s.garden !== 'object') s.garden = { ...base.garden };
  if (!s.upgrades || typeof s.upgrades !== 'object') s.upgrades = { ...base.upgrades };
  if (!s.abilities || typeof s.abilities !== 'object') s.abilities = { ...base.abilities };
  if (!s.prestige || typeof s.prestige !== 'object') s.prestige = { ...base.prestige };
  if (!s.buildings || typeof s.buildings !== 'object') s.buildings = { ...base.buildings };

  // Buffs are the one place where a bad entry would break arithmetic downstream.
  s.buffs = s.buffs
    .filter((b) => b && typeof b === 'object' && Number.isFinite(Number(b.mult)))
    .map((b) => ({
      kind: b.kind === 'clickMult' ? 'clickMult' : 'cpsMult',
      mult: Number(b.mult),
      until: Number.isFinite(Number(b.until)) ? Number(b.until) : 0,
    }));

  if (raw.version !== undefined && raw.version !== BALANCE_VERSION) {
    repairs.push(`balance version ${raw.version} -> ${BALANCE_VERSION}`);
  }

  pruneAchievements(s);
  reconcileState(s);
  cleanBuffs(s, now);

  return { state: s, repairs };
}

/** Wipe the save. Returns false if storage was unavailable. */
export function wipe() {
  const { primary: p, backup: b } = stores();
  try {
    p?.removeItem(PERSISTENCE.storageKey);
    p?.removeItem(BACKUP_KEY);
    b?.removeItem(BACKUP_KEY);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Import / export
// ---------------------------------------------------------------------------

/**
 * Encode a state for the clipboard.
 *
 * Base64 of JSON, prefixed with a short magic string. The prefix does two jobs:
 * it identifies the blob for a player pasting it into the wrong box, and it
 * leaves the first few characters as `eyJ` so a base64 blob is still recognisable
 * as the save it is.
 */
export function exportSave(state) {
  const json = JSON.stringify(state);
  return `CC1.${btoa(unescape(encodeURIComponent(json)))}`;
}

/**
 * Decode an exported blob.
 * @returns {{ok:boolean, state?:object, error?:string}}
 */
export function importSave(text, now = Date.now()) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return { ok: false, error: 'Nothing to import.' };
  if (trimmed.length > PERSISTENCE.maxImportChars) {
    return { ok: false, error: 'That is far too large to be a save file.' };
  }
  if (!trimmed.startsWith('CC1.')) {
    return { ok: false, error: 'That does not look like a cookie-clicker save.' };
  }
  let json;
  try {
    json = decodeURIComponent(escape(atob(trimmed.slice(4))));
  } catch {
    return { ok: false, error: 'The save data is damaged and could not be decoded.' };
  }
  const parsed = safeParse(json);
  if (!parsed) return { ok: false, error: 'The save data is damaged and could not be read.' };

  const { state, repairs } = hydrate(parsed, now);
  return { ok: true, state, repairs };
}

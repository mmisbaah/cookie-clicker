/**
 * Settings and stats.
 *
 * Mostly readouts, plus the three destructive actions in the game: reset visual
 * settings, start over, and import a save. Each is behind a confirmation that
 * names the consequence in the button as well as the body, because the confirm
 * dialog is not where a player's eye goes when they are hunting for a reset.
 */

import { ACHIEVEMENTS, BALANCE_VERSION } from '../../../shared/balance.js';
import { exportSave, importSave, wipe } from '../../../shared/save.js';
import { fmt, fmtInt, fmtPlaytime, fmtRate } from '../../../shared/format.js';
import { expectedGoldenIntervalMs } from '../../../shared/golden.js';
import { el, fill, labelNode } from './dom.js';
import { alertDialog, confirmDialog, promptDialog } from './dialog.js';
import { toast } from './toast.js';

let game = null;
let refs = null;

export function mountSettings(controller) {
  game = controller;
  refs = {
    stats: document.getElementById('stats-body'),
    resetVisual: document.getElementById('reset-visual'),
    exportBtn: document.getElementById('export-save'),
    importBtn: document.getElementById('import-save'),
    newGame: document.getElementById('new-game'),
  };

  refs.resetVisual?.addEventListener('click', resetVisuals);
  refs.exportBtn?.addEventListener('click', doExport);
  refs.importBtn?.addEventListener('click', doImport);
  refs.newGame?.addEventListener('click', doNewGame);

  renderStats(controller);
}

export function renderStats(controller) {
  if (!refs?.stats) return;
  const s = controller.state;
  const d = controller.derived;

  const goldenInterval = expectedGoldenIntervalMs(s);

  fill(refs.stats,
    stat('Total cookies baked', fmt(s.totalCookies)),
    stat('Cookies in hand', fmt(s.cookies)),
    stat('Production', `${fmtRate(d.cps)}/sec`),
    stat('Best production', `${fmtRate(s.stats.bestCps ?? 0)}/sec`),
    stat('Per click', fmtRate(d.cpc)),
    stat('Clicks', fmtInt(s.totalClicks)),
    stat('Achievements', `${s.achievements.length} / ${ACHIEVEMENTS.length}`),
    stat('Heavenly chips', `✨ ${fmt(s.chips)} (${fmt(s.totalChips)} earned)`),
    stat('Ascensions', String(s.ascensions)),
    stat('Harvests', fmtInt(s.stats.harvests)),
    stat('Trades', fmtInt(s.stats.trades)),
    stat('Golden cookies', fmtInt(s.stats.goldenClicked)),
    stat('Golden frequency', goldenInterval ? `about every ${Math.round(goldenInterval / 1000)}s` : 'locked'),
    stat('Offline efficiency', `${Math.round(d.prestige.offlineEfficiency * 100)}%`),
    stat('Offline cap', `${Math.round(d.prestige.offlineCapMs / 3_600_000)}h`),
    stat('Time played', fmtPlaytime(controller.playtimeMs())),
    stat('Save version', String(BALANCE_VERSION)),
  );
}

function stat(label, value) {
  return el('div.stat', {}, [
    el('span.stat-label', { text: label }),
    el('span.stat-value', {}, [labelNode(value)]),
  ]);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Reset the appearance preferences.
 *
 * Only writes state. `main.js` subscribes to the preference events and does the
 * painting, so this needs no DOM work of its own -- and cannot drift out of sync
 * with the normal way of changing a theme.
 */
function resetVisuals() {
  const prefs = game.state.prefs;
  prefs.theme = 'lagoon';
  prefs.fontScale = 1;
  prefs.reduceMotion = false;
  prefs.ownedSkins = ['classic'];
  prefs.skin = 'classic';
  prefs.themesUsed = ['lagoon'];

  game.setTheme('lagoon');
  game.setSkin('classic');
  game.setFontScale(1);
  game.setReduceMotion(false);
  game.save();

  toast('Visual settings reset', { kind: 'plain', icon: '🎨' });
}

async function doExport() {
  const blob = exportSave(game.state);
  try {
    await navigator.clipboard.writeText(blob);
    toast('Save copied to the clipboard', { kind: 'good', icon: '📋' });
  } catch {
    // Clipboard access is blocked in plenty of contexts. Showing the blob in a
    // dialog the player can select from is better than a failure toast.
    await alertDialog('Export save', el('textarea.input', { rows: 8, readonly: true }, [blob]), '📤');
  }
}

async function doImport() {
  const text = await promptDialog('Import save',
    'Paste a save exported from this game. This replaces your current run.',
    { placeholder: 'CC1.…', multiline: true, confirmLabel: 'Import' });
  if (!text) return;

  const result = importSave(text, game.now());
  if (!result.ok) {
    await alertDialog('Import failed', result.error, '⚠️');
    return;
  }

  const ok = await confirmDialog('Replace your run?',
    `This save holds ${fmt(result.state.totalCookies)} lifetime cookies and ${result.state.achievements.length} achievements. Your current run will be replaced.`,
    { confirmLabel: 'Replace', tone: 'danger' });
  if (!ok) return;

  game.state = result.state;
  game.invalidate();
  game.save();
  toast('Save imported', { kind: 'good', icon: '✅' });
  window.dispatchEvent(new CustomEvent('cookie-clicker:reloaded'));
}

async function doNewGame() {
  const ok = await confirmDialog('Start over?',
    'Every cookie, building, upgrade and ascension is deleted. This cannot be undone.',
    { confirmLabel: 'Delete everything', tone: 'danger', icon: '🗑️' });
  if (!ok) return;

  wipe();
  location.reload();
}

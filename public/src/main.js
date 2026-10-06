/**
 * Application entry point.
 *
 * Boot order is explicit and matters:
 *
 *   load save -> construct Game -> mount UI -> wire input -> start the loop
 *
 * The save has to exist before the Game, because the Game owns the state and the
 * UI reads production figures from it during mounting -- a shop that renders once
 * with a zeroed state and then corrects itself a frame later is visible as a
 * flash of "0 cookies" on every load.
 *
 * The loop is a single requestAnimationFrame chain that calls `game.tick(now)` and
 * then each view's render function against its own throttle. `game.tick` is the
 * only thing that advances the simulation; nothing here adds cookies.
 */

import { ABILITIES } from '../../shared/balance.js';
import { fmt, fmtDuration, fmtPct } from '../../shared/format.js';
import { load } from '../../shared/save.js';
import { createState } from '../../shared/state.js';

import { REFRESH } from './config.js';
import { Game } from './sim/game.js';
import { play, playClickThrottled, setSoundEnabled } from './sim/audio.js';

import { $, delegate, el } from './ui/dom.js';
import { hydrateIcons } from './ui/icon.js';
import { closePage, isOpen, registerPage, togglePage } from './ui/pages.js';
import { dismissDialog, isDialogOpen } from './ui/dialog.js';
import { achievementToast, crumbs, floatGain, offlineToast, toast } from './ui/toast.js';
import { hideTooltip } from './ui/tooltip.js';

import { mountHud, renderHudFast, renderHudSlow } from './ui/hud.js';
import { mountAbilityBar, renderAbilityBar } from './ui/abilities.js';
import { mountAscend, mountShop, refreshShop, syncBuyAmountChips } from './ui/shop.js';
import { mountGarden, renderGarden } from './ui/garden.js';
import { mountMarket, renderMarket } from './ui/market.js';
import { mountAwards, renderAwards } from './ui/awards.js';
import {
  applyFontScale, applyReduceMotion, applySkin, applyTheme, mountLook, renderLook,
} from './ui/look.js';
import { mountSettings, renderStats } from './ui/settings.js';

// ---------------------------------------------------------------------------

const game = new Game({ state: loadState(), now: () => Date.now(), seed: (Date.now() ^ 0x5f3759df) >>> 0 });

let cookieFace = null;
/**
 * The Ascend control's repaint, kept so the settings panel can refresh it.
 * It is separate from `renderStats` because it also has to stay correct while the
 * panel is closed -- the button is the one thing in the game whose enabled state
 * a player watches while they are off buying buildings.
 */
let renderAscend = () => {};
/** Per-view last-render timestamps, so each view runs at its own rate. */
const clocks = { badges: 0, ability: 0, garden: 0, market: 0, stats: 0 };

function loadState() {
  const result = load(Date.now());
  if (result.fresh) return createState(Date.now());
  if (result.repairs.length) {
    // Surfaced after mount, so it can use the toast layer.
    queueMicrotask(() => {
      for (const repair of result.repairs) console.warn('[cookie-clicker] repaired save:', repair);
      toast('Save repaired', { kind: 'plain', icon: '🛠️' });
    });
  }
  if (result.fromBackup) {
    queueMicrotask(() => toast('Recovered from backup', { kind: 'plain', icon: '♻️' }));
  }
  return result.state;
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function boot() {
  applyTheme(game.state.prefs.theme);
  applySkin(game.state.prefs.skin);
  applyFontScale(game.state.prefs.fontScale);
  applyReduceMotion(game.state.prefs.reduceMotion);

  cookieFace = $('[data-cookie-face]');

  // The markup in index.html is the one content that is not built by `el()`, so
  // its icons are swapped in here rather than at creation. Doing it before the
  // mounts means nothing below ever sees an undrawn label.
  hydrateIcons();

  mountHud();
  mountAbilityBar(game);
  mountShop(game);
  mountGarden(game);
  mountMarket(game);
  mountAwards(game);
  mountLook(game);
  mountSettings(game);
  renderAscend = mountAscend(game);
  registerPanels();
  wireInput();
  wireEvents();

  // Resume before the first frame so the welcome-back panel reports a gap that
  // the player actually experienced, rather than one the first tick swallowed.
  const report = game.resume();
  if (report.cookies > 0) {
    offlineToast(report, fmt, fmtDuration, fmtPct);
  } else if (report.awayMs >= report.thresholdMs) {
    toast(`Welcome back — nothing was baking while you were away.`, { kind: 'plain', icon: '👋' });
  }

  syncBuyAmountChips();

  // Two loops, deliberately.
  //
  // `frame` drives rendering and is scheduled by requestAnimationFrame, which
  // browsers pause in a background tab -- correctly, since there is nothing to
  // draw. The problem for an *idle* game is that pausing rAF also pauses
  // production, so the run would sit frozen until the player came back and then
  // collect one lump sum.
  //
  // The backstop keeps the simulation advancing on a timer. Browsers throttle
  // background timers to roughly once a minute, which is the right order of
  // magnitude for this. It calls `tick` and never renders, and `tick` is
  // idempotent with respect to elapsed time -- it works out how far the clock has
  // moved since its last call -- so the two loops cannot double-count. A second
  // call in the same millisecond adds zero cookies.
  requestAnimationFrame(frame);
  setInterval(() => game.tick(Date.now()), 1000);
}

function registerPanels() {
  registerPage('shop', () => refreshShop());
  registerPage('play', () => { renderGarden(game, game.now(), true); renderMarket(game, game.now()); });
  registerPage('awards', () => renderAwards(game));
  registerPage('look', () => renderLook(game));
  registerPage('settings', () => renderStats(game));
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function wireInput() {
  // Clicking the cookie. `pointerdown` rather than `click`: on a touch screen
  // `click` waits for the tap to be recognised as deliberate, which adds a
  // perceptible delay to the single most-repeated action in the game.
  //
  // Bound to the cookie itself, not to the stage. On the stage it would also fire
  // for every tap on the ability bar and the nav, so buying an ability would
  // silently bake a cookie as well.
  const cookie = $('#cookie');
  cookie.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    const now = game.now();
    const box = cookieFace.getBoundingClientRect();
    const { gain, golden } = game.click({
      x: event.clientX - box.left,
      y: event.clientY - box.top,
    });

    // Viewport coordinates, not cookie-face coordinates: `click-layer` is a
    // fixed overlay on the viewport, and `crumbs` reads the same space.
    floatGain(`+${fmt(gain)}`, event.clientX, event.clientY);
    crumbs(event.clientX, event.clientY);
    playClickThrottled(now);
    if (golden) toast('A golden cookie appeared!', { kind: 'gold', icon: '🌟', duration: 2200 });
  });

  // Golden cookies position themselves as percentages of `#goldens`, which is
  // stage-sized, so delegating at the document level is what lets a click land
  // however the layout has been rearranged.
  delegate(document.body, '.golden', (node) => game.clickGolden(node.dataset.golden));

  // Nav.
  delegate($('#nav'), '.nav-btn', (node) => {
    const id = node.dataset.page;
    const opened = togglePage(id);
    for (const btn of $('#nav').children) {
      btn.classList.toggle('is-active', opened && btn === node);
    }
  });

  // Five panels share one back-button class, so this is delegated from the
  // document rather than bound to one element by id.
  delegate(document.body, '[data-back]', () => {
    closePage();
    for (const btn of $('#nav').children) btn.classList.remove('is-active');
  });

  $('#pause')?.addEventListener('click', () => {
    game.save();
    document.body.classList.add('is-paused');
    $('#pause-screen').hidden = false;
  });
  $('#resume')?.addEventListener('click', () => {
    document.body.classList.remove('is-paused');
    $('#pause-screen').hidden = true;
    game.resume();
  });

  $('#dialog-layer').addEventListener('click', (event) => {
    // Backdrop dismissal. Only a click that lands on the backdrop itself -- a
    // click inside the dialog must not close it.
    if (event.target.id === 'dialog-layer') dismissDialog();
  });

  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', hideTooltip);

  // Backgrounded tabs. `visibilitychange` is the reliable one: `beforeunload`
  // does not fire on mobile Safari when a tab is merely switched away from.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      game.suspend();
    } else {
      game.resume();
      hideTooltip();
    }
  });
  window.addEventListener('pagehide', () => game.suspend());
  window.addEventListener('beforeunload', () => game.suspend());

  // Import replaces the whole state object, so every view that caches anything
  // derived from it has to be told.
  window.addEventListener('cookie-clicker:reloaded', () => {
    refreshShop();
    syncBuyAmountChips();
    renderLook(game);
    renderAwards(game);
    renderStats(game);
    renderGarden(game, game.now(), true);
    renderMarket(game, game.now());
    renderAbilityBar(game, game.now());
    renderHudSlow(game, game.now());
  });
}

function onKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (isDialogOpen()) {
    if (event.key === 'Escape') dismissDialog();
    return;
  }

  const typing = event.target instanceof HTMLElement
    && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA');

  if (event.key === 'Escape') {
    if (closePage()) {
      for (const btn of $('#nav').children) btn.classList.remove('is-active');
    } else {
      hideTooltip();
    }
    return;
  }

  if (typing) return;

  // Ability hotkeys, indexed against the current ability table rather than a
  // count baked into this file -- a save can carry more ids than the build has.
  const index = Number(event.key);
  if (Number.isInteger(index) && index >= 1 && index <= ABILITIES.length) {
    const ability = ABILITIES[index - 1];
    event.preventDefault();
    game.useAbility(ability.id);
  }
}

// ---------------------------------------------------------------------------
// Game events
// ---------------------------------------------------------------------------

function wireEvents() {
  game.events.on('sound', (name) => {
    if (name === 'click') return; // handled at the pointer, for throttling
    play(name);
  });

  game.events.on('achievements', (fresh) => {
    // Each award is +2%; the card shows the running total so the bonus never has
    // to be computed by the player.
    const totalPercent = game.state.achievements.length * 2;
    for (const achievement of fresh) achievementToast(achievement, totalPercent);
    if (fresh.length >= 3) {
      toast(`${fresh.length} achievements unlocked`, { kind: 'gold', icon: '🏅' });
    }
  });

  game.events.on('offline', (report) => {
    if (report.cookies > 0) offlineToast(report, fmt, fmtDuration, fmtPct);
  });

  game.events.on('goldens-changed', renderGoldens);
  game.events.on('golden-clicked', (result) => {
    floatGain(result.label, window.innerWidth / 2, window.innerHeight / 3, 'purple');
  });

  // Appearance is applied from here, not from the panel that changes it.
  //
  // Previously `chooseTheme` called `applyTheme` itself, which meant the only
  // way the page ever changed theme was by tapping the Look panel: a set from an
  // imported save, a settings reset, or the console updated the state and left
  // the DOM showing the old colours. Subscribing to the events makes the rule
  // "whoever changes the preference does not paint it", which cannot be got
  // wrong by adding a sixth way to change a theme later.
  game.events.on('theme-changed', (theme) => applyTheme(theme.id));
  game.events.on('skin-changed', (skin) => applySkin(skin.id));
  game.events.on('font-scale-changed', applyFontScale);
  game.events.on('reduce-motion-changed', applyReduceMotion);

  game.events.on('skin-unlocked', (skin) => {
    toast(`${skin.name} unlocked`, { kind: 'gold', icon: skin.icon });
  });

  game.events.on('ability-unlocked', ({ ability }) => {
    toast(`${ability.name} unlocked — press ${ability.key}`, { kind: 'gold', icon: ability.icon });
  });

  game.events.on('ability-fired', ({ ability, summary }) => {
    toast(summary.label ?? ability.name, { kind: 'plain', icon: ability.icon, duration: 2200 });
  });

  game.events.on('harvested', (result) => {
    toast(`Harvested ${result.seed.name} for ${fmt(result.amount)}`, { kind: 'good', icon: result.seed.icon, duration: 2400 });
  });

  game.events.on('traded', (result) => {
    if (result.revenue) toast(`Sold for ${fmt(result.revenue)}`, { kind: 'good', icon: '💸', duration: 2000 });
  });

  game.events.on('denied', ({ reason }) => {
    play('deny');
    if (reason === 'too-expensive' || reason === 'not-enough-chips') return; // visible enough on the tile
    toast(reason === 'cooldown' ? 'Still on cooldown' : 'Not available yet', { kind: 'bad', duration: 1600 });
  });

  game.events.on('save-failed', () => {
    toast('Could not save — storage may be full or blocked', { kind: 'bad', icon: '⚠️', duration: 6000 });
  });

  game.events.on('ascended', ({ gain }) => {
    toast(`Ascended for ${gain} Heavenly Chip${gain === 1 ? '' : 's'}`, { kind: 'gold', icon: '✨', duration: 5000 });
    closePage();
    refreshShop();
  });

  // Goldens that were on screen when the page loaded.
  renderGoldens();
}

/** Draw the floating golden cookies from state, one node per entry. */
function renderGoldens() {
  const host = $('#goldens');
  if (!host) return;

  const live = game.state.goldens.filter((g) => g.until > game.now());
  const wanted = new Set(live.map((g) => g.id));

  for (const node of [...host.children]) {
    if (!wanted.has(node.dataset.golden)) node.remove();
  }

  for (const golden of live) {
    if (host.querySelector(`[data-golden="${golden.id}"]`)) continue;
    host.append(el('button.golden', {
      type: 'button',
      dataset: { golden: golden.id, label: '🌟' },
      'aria-label': 'Golden cookie',
      style: { left: `${golden.x}%`, top: `${golden.y}%` },
      icon: '🌟',
    }));
  }
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

/**
 * The frame loop.
 *
 * Note the deliberate absence of the `requestAnimationFrame` timestamp. That value
 * is a `performance.now()`-based elapsed time since page load, while every clock
 * in the game -- production, crop maturity, cooldowns, save timestamps -- is a
 * `Date.now()` epoch value. Feeding one to the other makes a carrot planted "in
 * the future by 56 years" and stalls production to a halt, so rAF is used only
 * to schedule and `game.now()` supplies the time.
 */
function frame() {
  const now = game.now();
  game.tick(now);

  // Per-frame: three text nodes.
  renderHudFast(game);

  // Golden expiry is a state change, not a render, so it is checked on the same
  // slow clock as everything else.
  if (now - clocks.badges >= REFRESH.badges) {
    clocks.badges = now;
    renderHudSlow(game, now);
    renderGoldens();
    renderAscend();
  }

  if (now - clocks.ability >= REFRESH.ability) {
    clocks.ability = now;
    renderAbilityBar(game, now);
  }

  // The garden and the market only tick while their panel is open. A hidden panel
  // re-rendering four times a second is pure waste; the state is still advancing
  // underneath, so opening the panel shows the truth.
  if (isOpen('play')) {
    if (now - clocks.garden >= REFRESH.garden) {
      clocks.garden = now;
      renderGarden(game, now);
    }
    if (now - clocks.market >= REFRESH.market) {
      clocks.market = now;
      renderMarket(game, now);
    }
  }

  if (isOpen('settings') && now - clocks.stats >= REFRESH.stats) {
    clocks.stats = now;
    renderStats(game);
  }

  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------

/** Handy for poking at state from the console. */
window.cookie = { game, play, setSoundEnabled, togglePage, closePage, refreshShop };

boot();

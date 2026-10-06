/**
 * The heads-up display: cookie count, production rate, buff chips, and the nav
 * badges.
 *
 * The cookie counter is the one element in the game that updates every single
 * frame, so it is written as a direct `textContent` assignment against cached
 * nodes -- no innerHTML, no template, no re-render. Everything else here runs on
 * the throttle from `config.js`.
 */

import { fmt, fmtDuration, fmtRate } from '../../../shared/format.js';
import { ACHIEVEMENTS } from '../../../shared/balance.js';
import { gardenSummary } from '../../../shared/garden.js';
import { el, fill } from './dom.js';

const nodes = {};

export function mountHud() {
  nodes.cookies = document.getElementById('hud-cookies');
  nodes.cps = document.getElementById('hud-cps');
  nodes.cpc = document.getElementById('hud-cpc');
  nodes.lifetime = document.getElementById('hud-lifetime');
  nodes.buffs = document.getElementById('hud-buffs');  nodes.badges = {
    shop: document.getElementById('badge-shop'),
    play: document.getElementById('badge-play'),
    awards: document.getElementById('badge-awards'),
  };
}

/**
 * Per-frame: three text nodes.
 *
 * The rate uses `fmtRate` rather than `fmt` -- see its comment. A player at 0.2
 * cookies a second needs to see "0.2", not "0".
 */
export function renderHudFast(game) {
  const d = game.derived;
  nodes.cookies.textContent = fmt(game.state.cookies);
  nodes.cps.textContent = fmtRate(d.cps);
  nodes.cpc.textContent = fmtRate(d.cpc);
}

/** On the badge throttle: buff chips, the lifetime counter, and the nav counts. */
export function renderHudSlow(game, now) {
  // Lifetime changes at the same rate as the balance but is only ever read as a
  // "how far have I come" figure, so it does not need a per-frame write.
  nodes.lifetime.textContent = fmt(game.state.totalCookies);
  renderBuffs(game, now);
  renderBadges(game, now);
}

function renderBuffs(game, now) {
  const live = game.derived.mults.buffs;
  if (!live.length) {
    if (nodes.buffs.childElementCount) fill(nodes.buffs);
    return;
  }

  // Rebuilt wholesale, but only when the set or the rounded seconds change --
  // otherwise a 60s buff would rewrite its chip sixty times.
  const key = live.map((b) => `${b.kind}${b.mult}${Math.ceil((b.until - now) / 1000)}`).join('|');
  if (nodes.buffs.dataset.key === key) return;
  nodes.buffs.dataset.key = key;

  fill(nodes.buffs, live.map((buff) => {
    const seconds = Math.max(0, Math.ceil((buff.until - now) / 1000));
    const isClick = buff.kind === 'clickMult';
    return el('span.buff-chip', { class: isClick ? 'buff-chip--click' : 'buff-chip--cps' }, [
      // One flex child holding symbol and multiplier together: `.buff-chip` has
      // a `gap`, and letting those be two children would open a gap in the
      // middle of "⚡×7".
      el('span', {}, [
        el('span.buff-symbol', { icon: isClick ? '⚡' : '🌀', 'aria-hidden': 'true' }),
        `×${buff.mult}`,
      ]),
      el('span.buff-time', { text: fmtDuration(buff.until - now) }),
    ]);
  }));
}

function renderBadges(game, now) {
  const affordable = game.affordableCount();
  setBadge(nodes.badges.shop, affordable > 0 ? (affordable > 99 ? '99+' : String(affordable)) : null);

  const ready = gardenSummary(game.state, now).ready;
  setBadge(nodes.badges.play, ready > 0 ? String(ready) : null);

  const got = game.state.achievements.length;
  const total = ACHIEVEMENTS.length;
  setBadge(nodes.badges.awards, got > 0 ? `${Math.round((got / total) * 100)}%` : null);
}

function setBadge(node, text) {
  if (!node) return;
  const value = text ?? '';
  if (node.textContent === value) return;
  node.textContent = value;
  node.classList.toggle('is-visible', value !== '');
}

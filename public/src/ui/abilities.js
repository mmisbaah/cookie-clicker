/**
 * The ability bar.
 *
 * The one piece of UI that has to be legible at a glance while the player is
 * also watching the cookie, so each slot carries four pieces of state in a fixed
 * place: what it is, whether it is available, why not, and how long until it is.
 *
 * Rendering is keyed off `abilityStatus`, which already returns a discriminated
 * status. The renderer never re-derives availability -- if the bar says an
 * ability is ready, it is because the same function the click handler consulted
 * said so.
 */

import { ABILITIES } from '../../../shared/balance.js';
import { fmt } from '../../../shared/format.js';
import { el, fill } from './dom.js';
import { showTooltip, tipRow, hideTooltip } from './tooltip.js';

let bar = null;
let game = null;
let slots = new Map();

export function mountAbilityBar(controller) {
  game = controller;
  bar = document.getElementById('ability-bar');
  if (!bar) return;

  fill(bar, ABILITIES.map((ability) => {
    const slot = el('button.ability', {
      type: 'button',
      dataset: { ability: ability.id },
      'aria-label': ability.name,
      on: {
        click: () => game.useAbility(ability.id),
        pointerenter: (e) => describe(e.currentTarget, ability),
        pointerleave: hideTooltip,
        focus: (e) => describe(e.currentTarget, ability),
        blur: hideTooltip,
      },
    }, [
      el('span.ability-key', { text: ability.key, 'aria-hidden': 'true' }),
      el('span.ability-icon', { icon: ability.icon, 'aria-hidden': 'true' }),
      el('span.ability-name', { text: ability.name }),
      el('span.ability-status'),
      el('span.ability-bar', {}, [el('span.ability-bar-fill')]),
    ]);
    slots.set(ability.id, {
      root: slot,
      status: slot.querySelector('.ability-status'),
      fill: slot.querySelector('.ability-bar-fill'),
    });
    return slot;
  }));

  renderAbilityBar(game, game.now());
}

/** @param {number} now */
export function renderAbilityBar(controller, now) {
  if (!bar) return;
  for (const status of controller.abilityStates(now)) {
    const slot = slots.get(status.ability.id);
    if (!slot) continue;

    slot.root.className = `ability ability--${status.status}`;
    slot.root.disabled = false; // locked-but-affordable stays clickable to buy

    // Locked: show the price, and whether it is within reach.
    if (status.locked) {
      slot.status.textContent = fmt(Number(status.label));
      slot.root.classList.toggle('is-affordable', status.canFire);
      slot.fill.style.transform = 'scaleX(0)';
      slot.root.setAttribute('aria-label',
        `${status.ability.name}: unlock for ${fmt(status.ability.unlockCost)} cookies`);
      continue;
    }

    slot.root.classList.remove('is-affordable');
    slot.status.textContent = status.status === 'ready' ? '' : status.label;
    slot.fill.style.transform = `scaleX(${status.progress.toFixed(3)})`;
    slot.root.setAttribute('aria-label',
      `${status.ability.name}: ${status.status}${status.label ? `, ${status.label}` : ''}`);
  }
}

/** The tooltip content for one slot, including why it cannot be used. */
function describe(node, ability) {
  const state = game.state.abilities[ability.id];
  const status = game.abilityStates(game.now()).find((s) => s.ability.id === ability.id);

  const rows = [tipRow({ label: 'Effect', value: ability.description })];

  if (!state?.unlocked) {
    rows.push(tipRow({ label: 'Unlock cost', value: fmt(ability.unlockCost), tone: 'gold' }));
    rows.push(tipRow({
      label: 'Can afford',
      value: status?.canFire ? 'yes' : 'not yet',
      tone: status?.canFire ? 'good' : 'bad',
    }));
    rows.push('Unlocking is permanent. After that it recharges.');
  } else {
    rows.push(tipRow({ label: 'Cooldown', value: `${Math.round(ability.cooldownMs / 1000)}s` }));
    if (status.status === 'cooldown') {
      rows.push(tipRow({ label: 'Ready in', value: status.label, tone: 'bad' }));
    } else if (status.status === 'active') {
      rows.push(tipRow({ label: 'Active for', value: status.label, tone: 'good' }));
    } else {
      rows.push(tipRow({ label: 'Status', value: 'ready', tone: 'good' }));
    }
  }

  showTooltip(node, {
    title: ability.name,
    icon: ability.icon,
    subtitle: `Key ${ability.key}`,
    rows,
    footer: 'Press the number key, or tap.',
  });
}

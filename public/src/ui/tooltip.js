/**
 * The hover tooltip.
 *
 * This exists mostly to answer one question the shop otherwise cannot: *why is
 * my production 400× what it was?* A building tile says "+1400/sec each" and the
 * HUD says "1.2M/sec" and the player has no way to connect them. The tooltip
 * shows the full multiplier stack, the breakdown of a bulk purchase, and the
 * exact /sec delta of the thing they are about to buy.
 *
 * A single shared node, repositioned. Per-element tooltips would mean one hidden
 * div per tile, and tiles are created and destroyed on every filter change.
 */

import { MULTIPLIER_ROWS } from '../config.js';
import { el, fill } from './dom.js';

const node = document.getElementById('tooltip');
let visible = false;
let anchor = null;

/**
 * @param {Element|null} target the element the tooltip points at
 * @param {{title:string, icon?:string, subtitle?:string, rows?:Array, footer?:string}} content
 */
export function showTooltip(target, content) {
  if (!target || !content) return hideTooltip();

  const rows = (content.rows ?? []).filter(Boolean);
  fill(node,
    el('div.tip-head', {}, [
      content.icon ? el('span.tip-icon', { icon: content.icon, 'aria-hidden': 'true' }) : null,
      el('div', {}, [
        el('div.tip-title', { text: content.title }),
        content.subtitle ? el('div.tip-sub', { text: content.subtitle }) : null,
      ]),
    ]),
    rows.length ? el('div.tip-rows', {}, rows.map(tipRow)) : null,
    content.footer ? el('div.tip-foot', { text: content.footer }) : null,
  );

  anchor = target;
  visible = true;
  node.classList.add('is-visible');
  position();
}

/**
 * A tooltip row.
 *
 * Idempotent on purpose. `showTooltip` maps its `rows` array through this, and
 * the callers build their rows with it too -- so without the Node check every
 * row gets rendered, then rendered *again* from a DOM element, whose `.label`
 * and `.value` are undefined. That produced a correctly-shaped tooltip with
 * thirteen empty lines in it, which is exactly what it did.
 *
 * Accepts a descriptor `{label, value, tone}`, a plain string (rendered as a
 * dimmed note), or an already-built Node (returned unchanged).
 */
export function tipRow(row) {
  if (row instanceof Node) return row;
  if (typeof row === 'string') return el('div.tip-note', { text: row });
  return el('div.tip-row', {}, [
    el('span.tip-label', { text: row.label }),
    el('span.tip-value', { class: row.tone ? `tip-value--${row.tone}` : null, text: row.value }),
  ]);
}

/**
 * Render the production multiplier stack as tooltip rows.
 * Only multipliers that are actually doing something are listed.
 */
export function multiplierRows(mults, fmtMult) {
  return MULTIPLIER_ROWS
    .filter((row) => Math.abs(mults[row.key] - 1) > 1e-9)
    .map((row) => tipRow({ label: `${row.label} (${row.hint})`, value: fmtMult(mults[row.key]) }));
}

export function hideTooltip() {
  if (!visible) return;
  visible = false;
  anchor = null;
  node.classList.remove('is-visible');
}

/** Keep the tooltip inside the viewport as the pointer moves. */
function position() {
  if (!visible || !anchor) return;

  const pad = 10;
  const box = anchor.getBoundingClientRect();
  const tip = node.getBoundingClientRect();

  // Prefer above the anchor; flip below when there is no room.
  let top = box.top - tip.height - pad;
  if (top < pad) top = box.bottom + pad;

  let left = box.left + box.width / 2 - tip.width / 2;
  left = Math.max(pad, Math.min(left, window.innerWidth - tip.width - pad));

  // Clamp vertically too, for a tall tooltip near the bottom of a phone screen.
  top = Math.max(pad, Math.min(top, window.innerHeight - tip.height - pad));

  node.style.left = `${Math.round(left)}px`;
  node.style.top = `${Math.round(top)}px`;
}

window.addEventListener('scroll', hideTooltip, { passive: true, capture: true });
window.addEventListener('resize', hideTooltip);

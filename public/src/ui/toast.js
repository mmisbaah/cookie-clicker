/**
 * Transient notifications: toasts, achievement cards, and the floating
 * "+12" that rises off the cookie on every click.
 *
 * One container, one removal timer each, and a hard cap on how many cards can be
 * on screen. The cap matters more than it looks: achievements are awarded in
 * batches (unlocking a building tier can satisfy five at once), and an unbounded
 * stack covers the shop the player is trying to read.
 */

import { UI } from '../config.js';
import { el } from './dom.js';

const host = document.getElementById('toasts');
const MAX_CARDS = 3;

/** @param {string} kind visual treatment: good, bad, gold, purple, plain */
export function toast(text, { kind = 'plain', icon = '', duration = UI.toastMs } = {}) {
  const node = el('div.toast', { class: `toast--${kind}`, role: 'status' }, [
    icon ? el('span.toast-icon', { icon, 'aria-hidden': 'true' }) : null,
    el('span.toast-text', { text }),
  ]);
  host.append(node);
  scheduleRemoval(node, duration);
  return node;
}

/** An achievement card, with the running total CPS bonus it contributed. */
export function achievementToast(achievement, totalPercent) {
  while (host.querySelectorAll('.toast--achievement').length >= MAX_CARDS) {
    host.firstElementChild?.remove();
  }

  const node = el('div.toast.toast--achievement', { role: 'status' }, [
    el('span.toast-icon', { icon: achievement.icon, 'aria-hidden': 'true' }),
    el('div.toast-body', {}, [
      el('div.toast-title', { text: achievement.name }),
      el('div.toast-sub', { text: `+2% production · total +${totalPercent}%` }),
    ]),
  ]);
  host.append(node);
  scheduleRemoval(node, UI.toastMs);
  return node;
}

/** The welcome-back panel's summary. */
export function offlineToast(report, fmt, fmtDuration, fmtPct) {
  const lines = [
    `Away for ${fmtDuration(report.awayMs)}`,
    `Production ran at ${fmt(report.averageCps)}/sec`,
  ];
  if (report.efficiency < 1) lines.push(`Offline efficiency ${fmtPct(report.efficiency, 0).replace('+', '')}`);
  if (report.capped) lines.push(`Capped: ${fmtDuration(report.lostMs)} not counted`);

  const node = el('div.toast.toast--offline', { role: 'status' }, [
    el('span.toast-icon', { icon: '🌙', 'aria-hidden': 'true' }),
    el('div.toast-body', {}, [
      el('div.toast-title', { text: `+${fmt(report.cookies)} cookies` }),
      ...lines.map((line) => el('div.toast-sub', { text: line })),
    ]),
  ]);
  host.append(node);
  scheduleRemoval(node, UI.toastMs + 1500);
  return node;
}

/**
 * The number that floats up from the cookie.
 *
 * Pooled and animated with the Web Animations API rather than a CSS class per
 * node: at ten clicks a second a class-per-node approach is ten element
 * creations and ten forced layouts a second, on the interaction path that has to
 * feel best.
 *
 * `x`/`y` are **viewport** coordinates (`event.clientX/clientY`), because
 * `click-layer` is a fixed overlay and therefore shares the viewport's origin.
 * Reading the layer's box here instead would cost a layout read per click.
 */
const clickLayer = document.getElementById('click-layer');

export function floatGain(text, x, y, tone = 'gold') {
  const node = el('span.float-gain', {
    class: `float-gain--${tone}`,
    text,
    style: { left: `${x}px`, top: `${y}px` },
  });
  clickLayer.append(node);

  const anim = node.animate(
    [
      { transform: 'translate(-50%, -50%) scale(0.85)', opacity: 0 },
      { transform: 'translate(-50%, -90%) scale(1)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%, -190%) scale(1.15)', opacity: 0 },
    ],
    { duration: 850, easing: 'cubic-bezier(.2,.7,.3,1)' },
  );
  anim.onfinish = () => node.remove();
  anim.oncancel = () => node.remove();
  return node;
}

// Crumbs read the skin's own dough colours, so a chocolate bar skin throws dark
// shards and a plain cookie throws pale ones, without the effect knowing
// anything about skins.
const CRUMB_TONES = [
  'var(--cookie-b)',
  'var(--cookie-a)',
  'color-mix(in oklab, var(--cookie-b) 68%, #170a02)',
];

const motionReduced = () =>
  document.documentElement.classList.contains('reduce-motion') ||
  matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The crumbs a click knocks loose, thrown outward and then pulled down.
 *
 * Pure decoration, so this is the one piece of click feedback that stands down
 * for reduced motion. The floating number still rises either way: it is the
 * answer to "did that register?", and taking it away would take the feedback
 * with it.
 *
 * @param {number} x viewport left of the impact
 * @param {number} y viewport top of the impact
 */
export function crumbs(x, y) {
  if (motionReduced()) return;

  const count = 6 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    const node = el('span.crumb', {
      style: {
        left: `${x}px`,
        top: `${y}px`,
        width: `${2 + Math.random() * 4}px`,
        height: `${2 + Math.random() * 3}px`,
        background: CRUMB_TONES[i % CRUMB_TONES.length],
      },
    });
    clickLayer.append(node);

    // Evenly spaced angles would read as a firework. Jittering the angle and
    // the reach is what makes it look like something broke.
    const angle = Math.random() * Math.PI * 2;
    const reach = 26 + Math.random() * 52;
    const dx = Math.cos(angle) * reach;
    const dy = Math.sin(angle) * reach * 0.7 - 16;
    const spin = Math.round((Math.random() * 2 - 1) * 540);

    const anim = node.animate(
      [
        { transform: 'translate(-50%, -50%) translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: `translate(-50%, -50%) translate(${(dx * 0.7).toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${(spin * 0.6) | 0}deg)`, opacity: 1, offset: 0.4 },
        { transform: `translate(-50%, -50%) translate(${dx.toFixed(1)}px, ${(dy + 74).toFixed(1)}px) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: 520 + Math.random() * 340, easing: 'cubic-bezier(.25,.6,.4,1)' },
    );
    anim.onfinish = () => node.remove();
    anim.oncancel = () => node.remove();
  }
}

function scheduleRemoval(node, ms) {
  setTimeout(() => {
    if (!node.isConnected) return;
    const fade = node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' });
    fade.onfinish = () => node.remove();
  }, ms);
}

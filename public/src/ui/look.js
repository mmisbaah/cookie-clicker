/**
 * The Look panel: themes, cookie skins, text size, motion.
 *
 * Every change here applies immediately and is saved. That matters more than it
 * sounds: a theme preview that needs an "apply" button means the player is
 * choosing blind, and the theme is the one piece of this game that is purely for
 * them.
 *
 * Themes are applied by writing CSS custom properties onto the document element,
 * so a new theme is one row in the balance table and no CSS at all.
 */

import { COOKIE_SKINS, THEMES } from '../../../shared/balance.js';
import { fmt } from '../../../shared/format.js';
import { UI } from '../config.js';
import { el, fill, labelNode } from './dom.js';
import { iconNode, setIcon } from './icon.js';
import { hideTooltip, showTooltip, tipRow } from './tooltip.js';
import { toast } from './toast.js';

let game = null;
let refs = null;

/**
 * Write a theme's variables onto the document.
 * @param {string} id
 */
export function applyTheme(id) {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }
  root.dataset.theme = theme.id;
  return theme;
}

/** Point the cookie at a skin's colours and glyph. */
export function applySkin(id) {
  const skin = COOKIE_SKINS.find((s) => s.id === id) ?? COOKIE_SKINS[0];
  const root = document.documentElement;
  root.style.setProperty('--cookie-a', skin.colors.c1);
  root.style.setProperty('--cookie-b', skin.colors.c2);
  root.style.setProperty('--cookie-edge', skin.colors.border);
  root.style.setProperty('--cookie-glow', skin.colors.glow);

  for (const node of document.querySelectorAll('[data-cookie-face]')) {
    setIcon(node, skin.icon);
  }
  return skin;
}

/**
 * Scale every text size in the game.
 *
 * Implemented as a font-size on the root element with the whole stylesheet in
 * `rem`. A transform scale would also scale borders and padding, which is why it
 * is not used here despite being the one-line version.
 */
export function applyFontScale(scale) {
  document.documentElement.style.fontSize = `${Math.round(16 * scale * 100) / 100}px`;
}

/** Honour the OS setting on first run, then let the toggle override it. */
export function applyReduceMotion(on) {
  document.documentElement.classList.toggle('reduce-motion', !!on);
}

export function mountLook(controller) {
  game = controller;
  refs = {
    themes: document.getElementById('theme-grid'),
    skins: document.getElementById('skin-grid'),
    scale: document.getElementById('font-scale'),
    motion: document.getElementById('motion-toggle'),
  };

  if (refs.motion) {
    refs.motion.addEventListener('click', () => {
      game.setReduceMotion(!controller.state.prefs.reduceMotion);
      controller.save();
      renderLook(controller);
    });
  }

  game.events.on('skin-changed', () => renderLook(controller));
  game.events.on('theme-changed', () => renderLook(controller));
  renderLook(controller);
}

export function renderLook(controller) {
  if (!refs) return;
  const prefs = controller.state.prefs;

  if (refs.themes) {
    fill(refs.themes, THEMES.map((theme) =>
      el('button.theme', {
        type: 'button',
        class: theme.id === prefs.theme ? 'is-active' : null,
        on: { click: () => chooseTheme(controller, theme.id) },
      }, [
        el('span.theme-name', {}, [labelNode(theme.name)]),
        el('span.theme-swatches', {}, theme.swatches.map((color) =>
          el('span.theme-swatch', { style: { background: color } }))),
      ])));
  }

  if (refs.skins) {
    fill(refs.skins, COOKIE_SKINS.map((skin) => {
      const owned = prefs.ownedSkins.includes(skin.id);
      const active = prefs.skin === skin.id;

      return el('button.skin', {
        type: 'button',
        class: `${active ? 'is-active' : ''}${owned ? '' : ' is-locked'}`.trim() || null,
        title: skin.name,
        on: {
          click: () => (owned ? chooseSkin(controller, skin.id) : buySkin(controller, skin.id)),
          pointerenter: (e) => showSkinTip(e.currentTarget, skin, owned),
          pointerleave: hideTooltip,
        },
      }, [
        el('span.skin-face', {
          style: {
            background: `radial-gradient(circle at 32% 28%, ${skin.colors.c1}, ${skin.colors.c2})`,
            borderColor: skin.colors.border,
          },
        }, [iconNode(skin.icon)]),
        owned
          ? el('span.skin-tag', { text: active ? 'Equipped' : '' })
          : el('span.skin-price', { text: fmt(skin.cost) }),
      ]);
    }));
  }

  if (refs.scale) {
    fill(refs.scale, UI.fontScales.map((step) =>
      el('button.chip.chip--sm', {
        type: 'button',
        class: Math.abs(step.value - prefs.fontScale) < 0.01 ? 'is-active' : null,
        text: step.label,
        on: { click: () => chooseScale(controller, step.value) },
      })));
  }

  if (refs.motion) {
    refs.motion.setAttribute('aria-pressed', String(!!prefs.reduceMotion));
    refs.motion.classList.toggle('is-on', !!prefs.reduceMotion);
  }
}

// Every change goes through the game and is painted by whoever subscribes to the
// preference events in main.js. These functions change the preference and nothing
// else, so there is exactly one code path that can set a theme.

function chooseTheme(controller, id) {
  game.setTheme(id);
  controller.save();
}

function chooseSkin(controller, id) {
  game.setSkin(id);
  controller.save();
}

function buySkin(controller, id) {
  const result = game.buySkin(id);
  if (!result.ok) return;
  controller.save();
  toast(`${result.skin.name} unlocked`, { kind: 'gold', icon: result.skin.icon });
}

function chooseScale(controller, value) {
  game.setFontScale(value);
  controller.save();
  renderLook(controller);
}

function showSkinTip(node, skin, owned) {
  showTooltip(node, {
    title: skin.name,
    icon: skin.icon,
    rows: [
      tipRow({ label: 'Cost', value: owned ? 'owned' : fmt(skin.cost), tone: owned ? 'good' : 'gold' }),
      tipRow({ label: 'Production bonus', value: skin.cpsBonus ? `+${skin.cpsBonus}%` : 'none', tone: skin.cpsBonus ? 'good' : null }),
    ],
    footer: skin.description,
  });
}

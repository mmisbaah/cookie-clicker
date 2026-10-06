/**
 * Modal dialogs.
 *
 * Promise-based rather than callback-based. Every call site in this codebase is
 * "ask, then do the thing if they said yes", and expressing that as
 * `if (await confirm(...))` makes the control flow impossible to get wrong -- a
 * callback API here is how you end up performing an irreversible action in the
 * branch where the player pressed Cancel.
 *
 * Only one dialog is open at a time. Opening a second resolves the first with
 * `false`, so an autosave notification landing on top of a confirmation cannot
 * leave a dangling promise.
 */

import { el, fill } from './dom.js';

const layer = document.getElementById('dialog-layer');
let openResolve = null;

function close(value) {
  if (!openResolve) return;
  const resolve = openResolve;
  openResolve = null;
  fill(layer);
  layer.classList.remove('is-open');
  layer.setAttribute('aria-hidden', 'true');
  resolve(value);
}

/** @returns a promise that resolves true/false. */
function present({ title, icon, body, actions }) {
  if (openResolve) close(false);

  const buttons = actions.map((action) =>
    el('button.dialog-btn', {
      class: action.tone ?? 'ghost',
      type: 'button',
      text: action.label,
      on: { click: () => close(action.value) },
    }));

  const card = el('div.dialog', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
    el('div.dialog-head', {}, [
      el('span.dialog-icon', { icon: icon ?? 'ℹ️', 'aria-hidden': 'true' }),
      el('h2.dialog-title', { text: title }),
    ]),
    el('div.dialog-body', {}, [typeof body === 'string' ? el('p', { text: body }) : body]),
    el('div.dialog-actions', {}, buttons),
  ]);

  fill(layer, card);
  layer.classList.add('is-open');
  layer.setAttribute('aria-hidden', 'false');

  // Focus the safe default so Enter does the expected thing.
  const primary = buttons.find((b) => b.classList.contains('primary')) ?? buttons.at(-1);
  primary?.focus();

  return new Promise((resolve) => {
    openResolve = resolve;
  });
}

/** A message with one button. @returns resolves when dismissed. */
export function alertDialog(title, body, icon = '📢') {
  return present({
    title, body, icon,
    actions: [{ label: 'Got it', value: true, tone: 'primary' }],
  });
}

/** @returns true when the player chose the primary action. */
export function confirmDialog(title, body, { confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'primary', icon = '❓' } = {}) {
  return present({
    title, body, icon,
    actions: [
      { label: cancelLabel, value: false, tone: 'ghost' },
      { label: confirmLabel, value: true, tone },
    ],
  });
}

/** A dialog with a text field. @returns the string, or null if cancelled. */
export function promptDialog(title, body, { placeholder = '', confirmLabel = 'OK', icon = '✏️', multiline = false } = {}) {
  const input = el(multiline ? 'textarea.input' : 'input.input', {
    placeholder,
    spellcheck: 'false',
    autocomplete: 'off',
  });

  const promise = present({
    title, icon,
    body: el('div.prompt-body', {}, [el('p', { text: body }), input]),
    actions: [
      { label: 'Cancel', value: null, tone: 'ghost' },
      { label: confirmLabel, value: '__VALUE__', tone: 'primary' },
    ],
  });

  // The confirm button's sentinel has to become the field's contents, which is
  // the one bit of translation the generic `present` cannot do itself.
  return promise.then((value) => {
    if (value !== '__VALUE__') return null;
    const text = input.value.trim();
    return text.length ? text : null;
  });
}

/** Dismiss whatever is open. Wired to the backdrop and Escape in main.js. */
export function dismissDialog() {
  close(false);
}

export const isDialogOpen = () => openResolve !== null;

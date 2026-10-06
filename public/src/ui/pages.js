/**
 * Page navigation.
 *
 * A single overlay host holds every panel. Only one is visible at a time, and
 * the backing store tracks which -- so a keyboard shortcut, a toast action and a
 * nav tap can all ask "is the shop open?" and get one answer.
 *
 * Opening a panel calls its `onOpen` once. That is what lets the garden and the
 * market refresh on entry rather than running timers while hidden, which is the
 * difference between a panel that costs nothing and one that re-renders sixty
 * times a minute behind a backdrop.
 */

const panels = new Map();

let current = null;
let opener = null;

/**
 * @param {string} id  the panel id, matching a `.page` element
 * @param {() => void} [onOpen]
 */
export function registerPage(id, onOpen) {
  const node = document.getElementById(`page-${id}`);
  if (!node) return;
  panels.set(id, { node, onOpen });
}

/**
 * Show a panel.
 * @returns true if the panel changed.
 */
export function openPage(id) {
  const panel = panels.get(id);
  if (!panel) return false;

  if (current && current !== id) panels.get(current)?.node.classList.remove('is-open');

  const wasClosed = current !== id;
  panel.node.classList.add('is-open');
  current = id;

  if (wasClosed) {
    panel.onOpen?.();
    // Move focus in so keyboard users are not stranded behind the overlay.
    panel.node.querySelector('[data-autofocus], button, input')?.focus?.({ preventScroll: true });
  }
  return wasClosed;
}

/** Hide whatever is open. @returns true if something was open. */
export function closePage() {
  if (!current) return false;
  panels.get(current)?.node.classList.remove('is-open');
  current = null;
  // Focus goes back where it came from, so a keyboard user does not have to tab
  // across the whole HUD to get back to the cookie.
  opener?.focus?.({ preventScroll: true });
  opener = null;
  return true;
}

export function togglePage(id) {
  if (current === id) {
    closePage();
    return false;
  }
  const from = document.activeElement;
  openPage(id);
  opener = from;
  return true;
}

export function isOpen(id) {
  return current === id;
}

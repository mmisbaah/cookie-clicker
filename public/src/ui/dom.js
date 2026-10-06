/**
 * DOM helpers.
 *
 * Two rules the whole UI layer follows, both of them load-bearing:
 *
 *   1. **Text goes in through `textContent`, never `innerHTML`.** Content strings
 *      come from the balance tables, and a theme or a building name containing
 *      an apostrophe or an angle bracket would otherwise be a rendering bug or an
 *      injection. `el()` takes text as a separate argument precisely so there is
 *      no API that invites the wrong thing. The same reasoning covers `icon`: the
 *      emoji goes in as a value and `icon.js` decides what to draw from it, by
 *      parsing XML that it authored itself rather than by concatenating markup.
 *
 *   2. **Listeners are delegated from a container, not attached per node.** The
 *      shop rebuilds its list on every filter change; attaching a listener to
 *      each of sixty tiles sixty times a session is how you get a renderer that
 *      feels sluggish on a phone.
 */

import { iconNode } from './icon.js';

/**
 * Create an element.
 *
 * @param {string} tag       tag name, optionally with `.class` suffixes
 * @param {object} [attrs]   attributes; `class`, `text`, `icon`, `html` and `on` are special
 * @param {Array}  [children]
 */
export function el(tag, attrs = {}, children = []) {
  // Children passed in the attributes slot is the single easiest mistake to make
  // here, and it fails silently: `Object.entries(array)` happily produces keys
  // "0", "1", "2", so the element renders empty and carries attributes called
  // `0="[object HTMLDivElement]"`. That cost an afternoon once, so it throws now.
  if (Array.isArray(attrs) || attrs instanceof Node || typeof attrs === 'string') {
    throw new TypeError(
      `el('${tag}') got children where attributes were expected. `
      + `Pass an attributes object: el('${tag}', {}, children)`);
  }

  const [name, ...classes] = tag.split('.');
  const node = document.createElement(name || 'div');
  if (classes.length) node.className = classes.join(' ');

  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    switch (key) {
      case 'class':
        node.className = node.className ? `${node.className} ${value}` : value;
        break;
      case 'text':
        node.textContent = String(value);
        break;
      case 'icon':
        // Drawn art where we have it, the emoji itself where we do not. Never
        // markup: the art is parsed and cloned in `icon.js`, so there is still
        // no path from a balance-table string to the HTML parser.
        node.replaceChildren(iconNode(value));
        break;
      case 'on':
        for (const [event, fn] of Object.entries(value)) node.addEventListener(event, fn);
        break;
      case 'dataset':
        for (const [k, v] of Object.entries(value)) node.dataset[k] = v;
        break;
      case 'style':
        for (const [k, v] of Object.entries(value)) node.style.setProperty(k, v);
        break;
      default:
        node.setAttribute(key, value === true ? '' : String(value));
    }
  }

  for (const child of [children].flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Replace every child of `parent` with `nodes`. */
export function fill(parent, ...nodes) {
  parent.replaceChildren(...nodes.flat(Infinity).filter(Boolean));
  return parent;
}

/**
 * A label that leads with an emoji: the drawing first, the words after.
 *
 * The tables author these as `"🏭 Production"`, which is the readable way to
 * write a row, and one string keeps a label and its symbol together wherever
 * the pair is reused. This is the one place that takes the pair apart again, so
 * no caller has to know how far the symbol extends.
 *
 * @param {string} label
 * @returns {string|Element} the untouched string when there is nothing to draw
 */
const LEADING_EMOJI = /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/u;

export function labelNode(label) {
  const text = String(label);
  const hit = text.match(LEADING_EMOJI);
  if (!hit) return text;

  return el('span.label', {}, [
    iconNode(hit[1]),
    text.slice(hit[1].length).replace(/^\s+/, ''),
  ]);
}

export const $ = (sel, root = document) => root.querySelector(sel);

/**
 * One delegated listener for a container.
 *
 * @param {Element} root
 * @param {string} selector  a single class or attribute selector, e.g. `.tile`
 * @param {(node:Element, event:Event) => void} handler
 * @param {object} [options]
 */
export function delegate(root, selector, handler, options) {
  root.addEventListener('click', (event) => {
    const node = event.target.closest(selector);
    if (node && root.contains(node)) handler(node, event);
  }, options);
}

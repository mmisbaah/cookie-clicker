/**
 * Icon art: the emoji in the balance tables stays the *key*, and this module
 * swaps in a drawn SVG for it wherever it is shown.
 *
 * Two decisions carry the whole design:
 *
 *   1. **The emoji is the identity, not the presentation.** `balance.js` keeps
 *      handing out `'🍪'` and `'⛏️'`, which are stable, JSON-safe, readable, and
 *      already threaded through every table, the save format and the tooltips.
 *      This module only changes what you *see*. Anything it has no art for falls
 *      back to the emoji it was given, so a half-drawn icon set degrades to the
 *      set we had rather than to a hole.
 *
 *   2. **Art is parsed once with `DOMParser`, never injected with `innerHTML`.**
 *      `el()` deliberately has no markup-taking path -- content strings come from
 *      the balance tables and a name with an angle bracket in it should be a
 *      rendering bug, not an injection. Parsing XML and cloning the result keeps
 *      that property: the strings never meet the HTML parser.
 *
 * Because every icon lives inline in one document, their `id`s would otherwise
 * collide -- twenty icons all declaring `url(#dough)` means twenty gradients
 * resolving to whichever element happened to come first. Registration therefore
 * prefixes every `id` and every reference to it, so authoring stays readable and
 * the document stays unambiguous.
 */

import { ART } from './art.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** emoji -> parsed template element, or null if the art did not parse. */
const templates = new Map();

/** One prefix per registered icon; `a0-`, `a1-`, ... are always valid ids. */
let nextPrefix = 0;

/**
 * Give every id in the tree a unique prefix, and rewrite every reference.
 *
 * @param {Element} root
 * @param {string} prefix
 */
function prefixIds(root, prefix) {
  const rename = new Map();

  const claim = (node) => {
    const id = node.getAttribute && node.getAttribute('id');
    if (!id) return;
    rename.set(id, `${prefix}${id}`);
    node.setAttribute('id', `${prefix}${id}`);
  };

  claim(root);
  for (const node of root.querySelectorAll('[id]')) claim(node);
  if (!rename.size) return;

  for (const node of [root, ...root.querySelectorAll('*')]) {
    if (!node.attributes) continue;
    for (const attr of Array.from(node.attributes)) {
      let value = attr.value;
      let touched = false;
      for (const [from, to] of rename) {
        if (value.includes(`#${from}`)) {
          value = value.split(`#${from}`).join(`#${to}`);
          touched = true;
        }
      }
      if (touched) node.setAttribute(attr.name, value);
    }
  }
}

/**
 * Parse an icon's art into a reusable template, once.
 *
 * @param {string} emoji
 * @returns {Element|null}
 */
function template(emoji) {
  if (templates.has(emoji)) return templates.get(emoji);

  const source = ART[emoji];
  if (!source) {
    templates.set(emoji, null);
    return null;
  }

  let root = null;
  try {
    const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
    root = doc.documentElement;
  } catch {
    root = null;
  }

  const ok = root
    && root.nodeName.toLowerCase() === 'svg'
    && root.namespaceURI === SVG_NS
    && !root.querySelector('parsererror');

  if (!ok) {
    // Loud in the console, silent on screen: the emoji takes over.
    console.warn('[icon] art did not parse, falling back to the emoji', emoji);
    templates.set(emoji, null);
    return null;
  }

  root.setAttribute('class', 'art');
  prefixIds(root, `a${nextPrefix++}-`);
  templates.set(emoji, root);
  return root;
}

/**
 * A node for the given icon: the drawn art if we have it, otherwise a text
 * node holding the emoji itself.
 *
 * @param {string} emoji
 * @returns {Node}
 */
export function iconNode(emoji) {
  const key = emoji == null ? '' : String(emoji);
  const tpl = template(key);
  // Cloned out of the parser's document; the DOM adopts it on insert.
  return tpl ? tpl.cloneNode(true) : document.createTextNode(key);
}

/**
 * Point an existing element at an icon. Used where the node is reused between
 * renders -- a garden plot, a stock row -- rather than rebuilt.
 *
 * @param {Element} node
 * @param {string} emoji
 */
export function setIcon(node, emoji) {
  node.replaceChildren(iconNode(emoji));
}

/**
 * Draw the icons declared in the page's static markup.
 *
 * Anything built through `el()` gets its art as it is created. The markup in
 * `index.html` cannot, so it keeps the emoji as its text and tags it with
 * `data-icon`; this swaps it once on start-up. Leaving the emoji in place is
 * deliberate -- if the art is missing or fails to parse, `iconNode()` hands the
 * same character straight back and the label reads exactly as it did before.
 *
 * @param {ParentNode} [root]
 */
export function hydrateIcons(root = document) {
  for (const node of root.querySelectorAll('[data-icon]')) {
    setIcon(node, node.dataset.icon);
  }
}

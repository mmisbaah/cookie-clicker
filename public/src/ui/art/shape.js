/**
 * Drawing helpers for the icon art.
 *
 * The icons are written as SVG markup strings and parsed once in `icon.js`, so
 * what lives here is string arithmetic: enough shape maths to draw something
 * organic without hand-counting Bézier control points, and enough colour maths
 * to derive a highlight or a shadow from a palette instead of inventing a hex
 * literal for every highlight in the set.
 *
 * Nothing here is exported that a single module wants to keep to itself.
 */

/** Round to two decimals and drop the trailing zeros: `12.00` -> `12`, `3.45` -> `3.45`. */
function n(value) {
  return String(Math.round(value * 100) / 100);
}

/**
 * A closed, smooth path through `points` -- Catmull-Rom converted to cubic
 * Béziers. Uniform tension is fine for the shapes this draws; what matters is
 * that it closes without a corner, because a corner on a cookie silhouette reads
 * as a tear in the dough rather than as a bump.
 *
 * @param {Array<{x:number, y:number}>} points
 * @returns {string} path data
 */
function closedPath(points) {
  const len = points.length;
  const at = (i) => points[((i % len) + len) % len];
  const p = at(0);
  let d = `M${n(p.x)},${n(p.y)}`;

  for (let i = 0; i < len; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${n(c1x)},${n(c1y)} ${n(c2x)},${n(c2y)} ${n(p2.x)},${n(p2.y)}`;
  }
  return `${d}Z`;
}

/**
 * An organic disc: a circle whose radius is sampled at several angles and
 * smoothed through them.
 *
 * @param {number} cx
 * @param {number} cy
 * @param {number[]} radii  radius at each even angular step
 * @param {number} [phase]  rotation of the first sample, in radians
 * @returns {string} path data
 */
export function blob(cx, cy, radii, phase = 0) {
  const step = (Math.PI * 2) / radii.length;
  return closedPath(radii.map((r, i) => {
    const a = phase + i * step;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  }));
}

/**
 * A chocolate chip: an irregular rounded blob, centred on the origin.
 *
 * A circle reads as a dot and a dot reads as a UI element. Real chips spread
 * unevenly, so the radii wobble by about a fifth.
 *
 * @param {number} r        radius
 * @param {number[]} shape  six relative radii; defaults to a plausible spread
 * @returns {string} path data
 */
export function chipPath(r, shape = [1, 0.86, 1.08, 0.9, 1.04, 0.88]) {
  return blob(0, 0, shape.map((k) => r * k));
}

function channel(hex, i) {
  return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
}

/**
 * Blend two `#rrggbb` colours.
 *
 * @param {string} a
 * @param {string} b
 * @param {number} t  0 keeps `a`, 1 keeps `b`
 * @returns {string} `#rrggbb`
 */
export function mix(a, b, t) {
  const out = [0, 1, 2].map((i) => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * t));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Push a colour toward white or black. The whole point of a palette is that a
 * highlight should still look like the material it is highlighting.
 *
 * @param {string} hex
 * @param {number} amount  -1 is black, +1 is white
 * @returns {string} `#rrggbb`
 */
export function shade(hex, amount) {
  return mix(hex, amount < 0 ? '#000000' : '#ffffff', Math.abs(amount));
}

/**
 * `#rrggbb` plus an alpha, as an SVG-compatible `rgba()` string.
 *
 * @param {string} hex
 * @param {number} a  0..1
 * @returns {string}
 */
export function alpha(hex, a) {
  return `rgba(${channel(hex, 0)},${channel(hex, 1)},${channel(hex, 2)},${a})`;
}

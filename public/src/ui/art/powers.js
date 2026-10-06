/**
 * Powers and progression: what the ability bar offers, what prestige buys, and
 * what research costs.
 *
 * `🌟` is the odd one out and the most important icon in the whole set: it is
 * not just the Frenzy-adjacent ability mark, it *is* the golden cookie — the
 * button that appears in the play area, at 2.8rem, and the mark on two
 * achievements and the radar upgrade. Everything else here is drawn to sit at
 * 1rem in a bar; that one is drawn to be clicked.
 *
 * See `tools/ICON-ART.md`.
 */

import { alpha, blob, chipPath, mix, shade } from './shape.js';

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">${body}</svg>`;

/**
 * Ground shadow under an object, plus the filter it needs.
 *
 * The filter is emitted here rather than in each icon's `<defs>`: `ground()`
 * is what writes the reference, so the declaration belongs beside it, and an
 * icon cannot end up with a `url(#bs)` that nothing resolves.
 */
const ground = (cx = 32, cy = 56, rx = 19, opacity = 0.3) =>
  `<filter id="bs"><feGaussianBlur stdDeviation="3"/></filter>`
  + `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${(rx * 0.24).toFixed(2)}"`
  + ` fill="#000000" opacity="${opacity}" filter="url(#bs)"/>`;

/** Three-stop material gradient, lit from the upper-left. */
const lit = (id, stops, cx = 0.33, cy = 0.27, r = 0.85) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops
    .map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`).join('')}
  </radialGradient>`;

// ---------------------------------------------------------------------------

/** The golden cookie. Gold, not yellow: a warm four-stop ramp with a hard spec. */
const GOLD = blob(32, 32, [27.6, 26.4, 28.1, 26.2, 27.3, 27.9, 26.3, 28, 26.6, 27.5, 26.4, 27.8], 0.3);
const GOLD_CHIPS = [[22, 22, 3.4, -14], [41, 25, 3, 26], [30, 35, 3.7, 5],
  [20, 40, 3, -36], [43, 41, 3.2, 16], [31, 48, 3, -20], [46, 32, 2.5, 42]];

const goldenCookie = svg(`
  <defs>
    ${lit('g', [[0, '#fff6cf'], [0.34, '#ffd75f'], [0.72, '#e0a017'], [1, '#8c5a05']])}
    ${lit('ao', [[0.56, '#5a3600', 0], [0.9, '#5a3600', 0.34], [1, '#3a2200', 0.72]], 0.5, 0.5, 0.5)}
    ${lit('sp', [[0, '#ffffff', 0.9], [0.4, '#ffffff', 0.22], [1, '#ffffff', 0]], 0.3, 0.24, 0.52)}
    <clipPath id="c"><path d="${GOLD}"/></clipPath>
  </defs>
  ${ground(32, 57, 20, 0.38)}
  <path d="${GOLD}" fill="url(#g)"/>
  <g clip-path="url(#c)">
    ${GOLD_CHIPS.map(([x, y, r, rot]) => `
    <g transform="translate(${x} ${y}) rotate(${rot})">
      <path d="${chipPath(r)}" fill="#4a2c02"/>
      <path d="${chipPath(r * 0.5)}" fill="#9a6a12" opacity="0.85"
            transform="translate(${(-r * 0.3).toFixed(2)} ${(-r * 0.32).toFixed(2)})"/>
      <path d="${chipPath(r * 0.2)}" fill="#ffe9a8" opacity="0.7"
            transform="translate(${(-r * 0.4).toFixed(2)} ${(-r * 0.42).toFixed(2)})"/>
    </g>`).join('')}
    <path d="${GOLD}" fill="url(#ao)"/>
    <path d="${GOLD}" fill="url(#sp)"/>
    <path d="${GOLD}" fill="none" stroke="#7a4a02" stroke-width="1.6" opacity="0.55"/>
    <path d="M14,26Q21,20 30,23" fill="none" stroke="#fffbe8" stroke-width="2"
          stroke-linecap="round" opacity="0.7"/>
  </g>`);

/**
 * Two strands crossing, with rungs between them: one DNA mark, reused below.
 *
 * Takes the reference for the strands and the hex it was built from separately —
 * `shade()` and `mix()` parse hex, and handing them `url(#h)` produces `NaN`.
 */
const helix = (strokeRef, w, base) => `
  <path d="M23,9Q41,20 23,32T23,55" fill="none" stroke="${strokeRef}" stroke-width="${w}" stroke-linecap="round"/>
  <path d="M41,9Q23,20 41,32T41,55" fill="none" stroke="${shade(base, -0.35)}" stroke-width="${w}" stroke-linecap="round"/>
  ${[14, 21, 28, 35, 42, 49].map((y, i) =>
  `<path d="M25,${y}H39" stroke="${mix(base, '#ffffff', 0.5)}" stroke-width="2.2" stroke-linecap="round" opacity="${i % 2 ? 0.6 : 0.95}"/>`).join('')}`;

/** One cat, three moods. */
const cat = (features) => svg(`
  <defs>${lit('f', [[0, '#f7d9a8'], [0.55, '#d9a566'], [1, '#9a6a34']])}</defs>
  ${ground(32, 55, 17, 0.26)}
  <path d="M14,26L17,10L28,19Q32,17.5 36,19L47,10L50,26Q54,34 54,41Q54,54 32,54Q10,54 10,41Q10,34 14,26Z"
        fill="url(#f)"/>
  <path d="M18,14L20,23L26,20Z" fill="${alpha('#f0a0a8', 0.9)}"/>
  <path d="M46,14L44,23L38,20Z" fill="${alpha('#f0a0a8', 0.9)}"/>
  <ellipse cx="32" cy="44" rx="11" ry="8" fill="${mix('#f7d9a8', '#ffffff', 0.5)}"/>
  <g stroke="${shade('#9a6a34', -0.35)}" stroke-width="1.3" stroke-linecap="round" opacity="0.8">
    <path d="M20,44H10M20,47.5L11,50M44,44H54M44,47.5L53,50"/>
  </g>
  <path d="M32,41.5L35,44.5L32,47L29,44.5Z" fill="${alpha('#d06a72', 0.95)}"/>
  ${features}`);

const catPlain = cat(`
  <g fill="#3a2410"><ellipse cx="24" cy="33" rx="3" ry="3.6"/><ellipse cx="40" cy="33" rx="3" ry="3.6"/></g>
  <g fill="#ffffff" opacity="0.55"><circle cx="23" cy="31.8" r="1.1"/><circle cx="39" cy="31.8" r="1.1"/></g>`);

const catSmile = cat(`
  <g fill="#3a2410"><ellipse cx="24" cy="32" rx="3" ry="3.6"/><ellipse cx="40" cy="32" rx="3" ry="3.6"/></g>
  <g fill="#ffffff" opacity="0.55"><circle cx="23" cy="30.8" r="1.1"/><circle cx="39" cy="30.8" r="1.1"/></g>
  <path d="M27,47Q32,52 37,47Q34,50.5 32,50.5Q30,50.5 27,47Z" fill="${alpha('#b04a52', 0.9)}"/>`);

const catLove = cat(`
  <path d="M24,29.5C24,27.5 26.5,26.8 28,28.4C29.5,26.8 32,27.5 32,29.5C32,32.5 28,35 28,35C28,35 24,32.5 24,29.5Z" fill="#e8556a"/>
  <path d="M36,29.5C36,27.5 38.5,26.8 40,28.4C41.5,26.8 44,27.5 44,29.5C44,32.5 40,35 40,35C40,35 36,32.5 36,29.5Z" fill="#e8556a"/>`);

// ---------------------------------------------------------------------------

export const POWER_ART = {
  // ---- Abilities ----------------------------------------------------------

  '⚡': svg(`
    <defs>${lit('g', [[0, '#fffbe0'], [0.4, '#ffe45e'], [0.8, '#f5a623'], [1, '#b06a00']])}</defs>
    ${ground(33, 55, 13, 0.28)}
    <path d="M37,5L16,35L29,35L25,59L47,28L34,28Z" fill="url(#g)"/>
    <path d="M37,5L16,35L29,35L25,59L47,28L34,28Z" fill="none" stroke="${shade('#b06a00', -0.4)}"
          stroke-width="1.2" stroke-linejoin="round" opacity="0.7"/>
    <path d="M35,10L21,31L27,31Z" fill="#ffffff" opacity="0.75"/>`),

  '🎯': svg(`
    <defs>${lit('w', [[0, '#f6f2ea'], [0.6, '#ddd4c6'], [1, '#a89a86']])}</defs>
    ${ground(32, 56, 18, 0.3)}
    <circle cx="30" cy="31" r="23" fill="url(#w)"/>
    <circle cx="30" cy="31" r="23" fill="none" stroke="${shade('#a89a86', -0.4)}" stroke-width="1.6"/>
    <circle cx="30" cy="31" r="17.5" fill="#d94f3d"/>
    <circle cx="30" cy="31" r="11.5" fill="#f6f2ea"/>
    <circle cx="30" cy="31" r="6" fill="#d94f3d"/>
    <circle cx="30" cy="31" r="2" fill="${shade('#d94f3d', -0.5)}"/>
    <path d="M30,31L54,13" stroke="${shade('#3a3a44', -0.2)}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M54,13L59,9L60,15L56,17Z" fill="#e8ecf2"/>
    <path d="M54,13L59,9L60,15Z" fill="#ffffff"/>
    <ellipse cx="23" cy="21" rx="9" ry="6" fill="#ffffff" opacity="0.3" transform="rotate(-25 23 21)"/>`),

  '🌧️': svg(`
    <defs>${lit('c', [[0, '#ffffff'], [0.5, '#dfe6ee'], [1, '#9fb0c4']])}</defs>
    ${ground(32, 56, 17, 0.24)}
    <path d="M17,38Q10,38 10,31Q10,25 16,24Q17,16 25,15Q33,14 37,21Q45,20 48,27Q51,34 44,38Z"
          fill="url(#c)"/>
    <path d="M17,38Q10,38 10,31Q10,25 16,24Q17,16 25,15Q33,14 37,21" fill="none"
          stroke="#ffffff" stroke-width="1.6" opacity="0.7" stroke-linecap="round"/>
    <g fill="#4aa3e0">
      <path d="M20,44Q23,48 23,50.5A3,3 0 0 1 17,50.5Q17,48 20,44Z"/>
      <path d="M32,42Q35,46.5 35,49.5A3.2,3.2 0 0 1 28.6,49.5Q28.6,46.5 32,42Z" transform="translate(0 3)"/>
      <path d="M44,44Q47,48 47,50.5A3,3 0 0 1 41,50.5Q41,48 44,44Z"/>
    </g>
    <g fill="#ffffff" opacity="0.55">
      <path d="M20,45.5Q21.4,47.6 21.4,49.2A1.4,1.4 0 0 1 18.6,49.2Q18.6,47.6 20,45.5Z"/>
    </g>`),

  '🌟': goldenCookie,

  '⏱️': svg(`
    <defs>
      ${lit('m', [[0, '#f4f6f8'], [0.45, '#c9d0d8'], [0.75, '#8d97a4'], [1, '#5b636e']])}
      ${lit('f', [[0, '#ffffff'], [0.5, '#eef1f5'], [0.82, '#ccd4de'], [1, '#a9b3c0']], 0.34, 0.28, 0.72)}
    </defs>
    ${ground(32, 57, 16, 0.3)}
    <rect x="27" y="6" width="10" height="6" rx="2" fill="${shade('#8d97a4', -0.3)}"/>
    <path d="M42,13L47,8" stroke="#6b7480" stroke-width="3" stroke-linecap="round"/>
    <circle cx="32" cy="36" r="22" fill="url(#m)"/>
    <circle cx="32" cy="36" r="22" fill="none" stroke="${shade('#5b636e', -0.35)}" stroke-width="1.6"/>
    <circle cx="32" cy="36" r="18" fill="url(#f)"/>
    <g stroke="#5b636e" stroke-width="1.6" stroke-linecap="round">
      <path d="M32,20.5V24M47.5,36H44M32,51.5V48M16.5,36H20"/>
    </g>
    <path d="M32,36L32,25" stroke="#c8342c" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M32,36L41,41" stroke="#2b3138" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="32" cy="36" r="2.4" fill="#2b3138"/>
    <path d="M22,26Q25,21 31,20" fill="none" stroke="#ffffff" stroke-width="3"
          stroke-linecap="round" opacity="0.75"/>`),

  // ---- Prestige -----------------------------------------------------------

  '✨': (() => {
    const sparkle = (cx, cy, r, o) => {
      const w = r * 0.22;
      return `<path d="M${cx},${cy - r}Q${cx + w},${cy - w} ${cx + r},${cy}Q${cx + w},${cy + w} ${cx},${cy + r}Q${cx - w},${cy + w} ${cx - r},${cy}Q${cx - w},${cy - w} ${cx},${cy - r}Z"
        fill="#ffe9a0" opacity="${o}"/>`;
    };
    return svg(`
    <defs>${lit('g', [[0, '#fffdf0'], [0.4, '#ffe68a'], [1, '#e0a800']])}</defs>
    ${ground(32, 55, 14, 0.22)}
    ${sparkle(30, 30, 17, 1)}
    ${sparkle(48, 17, 7.5, 0.92)}
    ${sparkle(17, 46, 6, 0.85)}
    ${sparkle(46, 44, 4.5, 0.75)}
    <path d="M30,17Q32,26 30,30" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" opacity="0.7"/>`);
  })(),

  '👐': svg(`
    <defs>${lit('s', [[0, '#ffe3c4'], [0.5, '#f2b98a'], [1, '#c47f4e']])}</defs>
    ${ground(32, 56, 18, 0.28)}
    <path d="M8,42Q8,52 18,53L26,54Q30,54.5 30,50L30,36" fill="url(#s)"/>
    <path d="M56,42Q56,52 46,53L38,54Q34,54.5 34,50L34,36" fill="url(#s)"/>
    <path d="M12,40Q14,30 22,27L30,24" fill="none" stroke="${shade('#c47f4e', -0.3)}" stroke-width="6"
          stroke-linecap="round"/>
    <path d="M52,40Q50,30 42,27L34,24" fill="none" stroke="${shade('#c47f4e', -0.3)}" stroke-width="6"
          stroke-linecap="round"/>
    <path d="M14,38Q17,31 23,29" fill="none" stroke="${shade('#c47f4e', -0.5)}" stroke-width="2.4"
          stroke-linecap="round" opacity="0.6"/>
    <path d="M50,38Q47,31 41,29" fill="none" stroke="${shade('#c47f4e', -0.5)}" stroke-width="2.4"
          stroke-linecap="round" opacity="0.6"/>
    <path d="M32,6Q36,14 32,20Q28,14 32,6Z" fill="#ffe9a0"/>
    <path d="M32,9Q33.4,14 32,17.5Q30.6,14 32,9Z" fill="#ffffff" opacity="0.8"/>`),

  '🏷️': svg(`
    <defs>${lit('t', [[0, '#9fd9c8'], [0.5, '#4fae94'], [1, '#22685a']])}</defs>
    ${ground(33, 54, 16, 0.28)}
    <path d="M34,8L54,26Q57,29 54,32L32,54Q29,57 26,54L8,36Q5,33 8,30L28,10Q31,7 34,8Z"
          fill="url(#t)"/>
    <path d="M34,8L54,26Q57,29 54,32L48,38L26,14Z" fill="#ffffff" opacity="0.18"/>
    <circle cx="43" cy="22" r="5" fill="${shade('#22685a', -0.4)}"/>
    <circle cx="43" cy="22" r="3.2" fill="#e8f4f0"/>
    <path d="M43,22L54,32" stroke="#e8f4f0" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
    <path d="M14,32Q18,34 24,34" fill="none" stroke="#ffffff" stroke-width="2.4"
          stroke-linecap="round" opacity="0.45"/>`),

  '💤': svg(`
    <defs>${lit('m', [[0, '#eef2ff'], [1, '#b9c2e8']])}</defs>
    ${ground(32, 55, 16, 0.24)}
    <path d="M42,8H56L42,26H56" fill="none" stroke="#5b6bbf" stroke-width="4.5"
          stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M32,24H45L32,41H45" fill="none" stroke="#7383d4" stroke-width="4"
          stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M23,37H33L23,51H33" fill="none" stroke="#93a1e4" stroke-width="3.4"
          stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M14,12A11,11 0 0 0 14,34A8.5,8.5 0 0 1 14,12Z" fill="url(#m)" opacity="0.9"/>
    <path d="M42,8H56L42,26" fill="none" stroke="#ffffff" stroke-width="1.4" opacity="0.5"/>`),

  '🍀': svg(`
    <defs>${lit('l', [[0, '#a8e06a'], [0.5, '#5cb544'], [1, '#256b2a']])}</defs>
    ${ground(32, 56, 15, 0.26)}
    <path d="M32,36Q46,34 47,21Q48,10 37,14Q30,17 32,36Z" fill="url(#l)"/>
    <path d="M32,36Q34,50 47,50Q58,50 53,39Q49,30 32,36Z" fill="url(#l)" transform="rotate(0 32 36)"/>
    <path d="M32,36Q18,34 17,21Q16,10 27,14Q34,17 32,36Z" fill="url(#l)"/>
    <path d="M32,36Q30,50 17,50Q6,50 11,39Q15,30 32,36Z" fill="url(#l)"/>
    <g fill="none" stroke="${shade('#256b2a', -0.3)}" stroke-width="1.3" opacity="0.75">
      <path d="M32,36Q38,28 42,20M32,36Q40,42 46,44M32,36Q26,28 22,20M32,36Q24,42 18,44"/>
    </g>
    <path d="M32,36Q33,46 36,56" fill="none" stroke="#2f7a30" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="40" cy="24" rx="4" ry="6" fill="#ffffff" opacity="0.22" transform="rotate(-30 40 24)"/>`),

  '🍬': svg(`
    <defs>${lit('w', [[0, '#ffd9e2'], [0.5, '#f77e9c'], [1, '#c23c62']])}</defs>
    ${ground(32, 55, 16, 0.28)}
    <path d="M8,24L20,32L8,40Q5,41.5 5,38V26Q5,23 8,24Z" fill="${mix('#f77e9c', '#ffffff', 0.25)}"/>
    <path d="M56,24L44,32L56,40Q59,41.5 59,38V26Q59,23 56,24Z" fill="${mix('#f77e9c', '#ffffff', 0.25)}"/>
    <ellipse cx="32" cy="32" rx="17" ry="13" fill="url(#w)"/>
    <path d="M18,28Q24,22 33,21" fill="none" stroke="#ffffff" stroke-width="4"
          stroke-linecap="round" opacity="0.7"/>
    <path d="M24,25Q33,36 42,41" fill="none" stroke="#ffe7ee" stroke-width="5" stroke-linecap="round" opacity="0.55"/>
    <path d="M26,42Q34,45 41,41" fill="none" stroke="${shade('#c23c62', -0.3)}" stroke-width="3"
          stroke-linecap="round" opacity="0.5"/>`),

  '⌛': svg(`
    <defs>
      ${lit('w', [[0, '#e8d9b8'], [0.5, '#c9a76a'], [1, '#8a6a34']], 0.3, 0.25, 0.8)}
      ${lit('s', [[0, '#ffe9a8'], [1, '#e0a800']], 0.4, 0.3, 0.7)}
    </defs>
    ${ground(32, 57, 15, 0.3)}
    <path d="M16,8H48M16,56H48" stroke="#8a6a34" stroke-width="5" stroke-linecap="round"/>
    <path d="M20,11H44L32,30L44,53H20L32,34Z" fill="${alpha('#e8f2f7', 0.75)}"/>
    <path d="M22,14H42L32,30L42,50H22L32,33Z" fill="none" stroke="${alpha('#ffffff', 0.7)}" stroke-width="1.4"/>
    <path d="M24,17H40L32,30Z" fill="url(#s)" opacity="0.95"/>
    <path d="M32,34L38,50H26Z" fill="url(#s)"/>
    <path d="M32,31V44" stroke="#ffe9a0" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
    <path d="M23,15L28,15" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.6"/>`),

  '🌻': svg(`
    <defs>${lit('p', [[0, '#ffe680'], [0.55, '#ffc61a'], [1, '#d18a00']])}</defs>
    ${ground(32, 57, 14, 0.26)}
    <path d="M32,38Q34,48 32,58" fill="none" stroke="#3f8a34" stroke-width="4" stroke-linecap="round"/>
    <path d="M32,48Q42,44 47,50Q40,56 32,52Z" fill="#4fa83f"/>
    <path d="M32,44Q23,41 18,47Q24,53 32,49Z" fill="${shade('#4fa83f', -0.2)}"/>
    ${Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2;
  const x = 32 + Math.cos(a) * 15;
  const y = 32 + Math.sin(a) * 15;
  return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="8.5" ry="4.6"
      fill="url(#p)" transform="rotate(${((a * 180) / Math.PI).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
}).join('')}
    <circle cx="32" cy="32" r="11" fill="#7a4a1f"/>
    <circle cx="32" cy="32" r="11" fill="none" stroke="${shade('#7a4a1f', -0.4)}" stroke-width="1.4"/>
    <g fill="${shade('#7a4a1f', 0.28)}" opacity="0.85">
      <circle cx="29" cy="29" r="1.6"/><circle cx="35" cy="30" r="1.6"/>
      <circle cx="31" cy="34.5" r="1.6"/><circle cx="36" cy="35" r="1.4"/>
      <circle cx="27.5" cy="34" r="1.4"/>
    </g>
    <ellipse cx="27" cy="27" rx="4" ry="3" fill="#ffffff" opacity="0.28" transform="rotate(-30 27 27)"/>`),

  // ---- Research -----------------------------------------------------------

  '🧬': svg(`
    <defs>${lit('h', [[0, '#9fe4ff'], [0.5, '#3aa6e0'], [1, '#1a5f96']])}</defs>
    ${ground(32, 57, 14, 0.26)}
    ${helix('url(#h)', 4.4, '#3aa6e0')}`),

  '⏰': svg(`
    <defs>
      ${lit('m', [[0, '#f4f6f8'], [0.5, '#c4ccd6'], [1, '#7d8794']])}
      ${lit('f', [[0, '#ffffff'], [0.5, '#eef1f5'], [0.82, '#ccd4de'], [1, '#a9b3c0']], 0.34, 0.28, 0.72)}
    </defs>
    ${ground(32, 57, 16, 0.3)}
    <path d="M15,14L23,7" stroke="#5b636e" stroke-width="6" stroke-linecap="round"/>
    <path d="M49,14L41,7" stroke="#5b636e" stroke-width="6" stroke-linecap="round"/>
    <path d="M24,52L19,58M40,52L45,58" stroke="#5b636e" stroke-width="4.5" stroke-linecap="round"/>
    <circle cx="32" cy="34" r="23" fill="url(#m)"/>
    <circle cx="32" cy="34" r="23" fill="none" stroke="${shade('#7d8794', -0.4)}" stroke-width="1.8"/>
    <circle cx="32" cy="34" r="18.5" fill="url(#f)"/>
    <g stroke="#5b636e" stroke-width="1.6" stroke-linecap="round">
      <path d="M32,18.5V22M47.5,34H44M32,49.5V46M16.5,34H20"/>
    </g>
    <path d="M32,34L32,22" stroke="#2b3138" stroke-width="3" stroke-linecap="round"/>
    <path d="M32,34L43,40" stroke="#c8342c" stroke-width="3" stroke-linecap="round"/>
    <circle cx="32" cy="34" r="2.6" fill="#2b3138"/>
    <path d="M21,25Q24,20 30,19" fill="none" stroke="#ffffff" stroke-width="3.4"
          stroke-linecap="round" opacity="0.8"/>`),

  '🐱': catPlain,
  '😺': catSmile,
  '😻': catLove,
};

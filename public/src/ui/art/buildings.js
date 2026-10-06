/**
 * Shop art: the buildings you buy and the tools that improve clicking.
 *
 * These are the tiles read sixty times a session, so silhouette does most of
 * the work — a finger for the cursor, a sawtooth roof for the factory, a crane
 * for the industrialist. Two of them are deliberately kept apart at the
 * silhouette level: the bank and the temple are both "building with columns",
 * so the bank wears a coin and the temple wears an urn.
 *
 * See `tools/ICON-ART.md`.
 */

import { mix, shade } from './shape.js';

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

/** Same idea, but along a line — for faces that are flat rather than round. */
const ramp = (id, stops, x1 = 0, y1 = 0, x2 = 1, y2 = 1) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops
    .map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`).join('')}
  </linearGradient>`;

// ---------------------------------------------------------------------------
// Shared parts
// ---------------------------------------------------------------------------

const SKIN = [[0, '#ffe7cd'], [0.5, '#f2bd90'], [1, '#c48254']];

/** A hand: fist, tucked thumb, three finger creases, one extended digit. */
const fingerHand = () => `
  <defs>${lit('s', SKIN)}
    <clipPath id="fist"><rect x="16" y="27" width="31" height="27" rx="10"/></clipPath>
  </defs>
  ${ground(32, 57, 15, 0.26)}
  <rect x="27" y="7" width="11" height="26" rx="5.5" fill="url(#s)"/>
  <path d="M29.5,11.5Q32.5,9 35.5,11.5L35.5,17.5Q32.5,19.5 29.5,17.5Z" fill="#fff2e4" opacity="0.9"/>
  <rect x="16" y="27" width="31" height="27" rx="10" fill="url(#s)"/>
  <g clip-path="url(#fist)" stroke="${shade('#c48254', -0.35)}" stroke-width="1.6" stroke-linecap="round" opacity="0.75">
    <path d="M31,31H45M31,38H45M31,45H45"/>
  </g>
  <path d="M16,41Q9,41 9,46.5Q9,52 16,52L27,52" fill="none" stroke="${mix('#f2bd90', '#e0a97c', 0.5)}"
        stroke-width="7.5" stroke-linecap="round"/>
  <path d="M17,30Q20,27 25,27" fill="none" stroke="#ffffff" stroke-width="2.6"
        stroke-linecap="round" opacity="0.45"/>`;

/** A head of wheat: stalk, alternating grains, awns. */
const wheat = (x, y, scale, angle, tone) => `
  <g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})">
    <path d="M0,0V-26" stroke="${tone}" stroke-width="2.6" stroke-linecap="round"/>
    ${[-3.4, -8.4, -13.4, -18.4].map((gy, i) => `
      <ellipse cx="${-4.4}" cy="${gy}" rx="3.4" ry="4.6" fill="${tone}" transform="rotate(-26 -4.4 ${gy})"/>
      <ellipse cx="${4.4}" cy="${gy}" rx="3.4" ry="4.6" fill="${shade(tone, -0.18)}" transform="rotate(26 4.4 ${gy})"/>`).join('')}
    <ellipse cx="0" cy="-24" rx="3.6" ry="5" fill="${shade(tone, 0.16)}"/>
    <g stroke="${shade(tone, 0.3)}" stroke-width="1.1" stroke-linecap="round" opacity="0.85">
      <path d="M0,-28V-36M-4,-27L-7,-34M4,-27L7,-34"/>
    </g>
  </g>`;

// ---------------------------------------------------------------------------

export const BUILDING_ART = {
  // ---- Buildings ----------------------------------------------------------

  '👆': svg(fingerHand()),

  '👵': svg(`
    <defs>${lit('f', SKIN)}
      ${lit('h', [[0, '#ffffff'], [0.55, '#e9e9ee'], [1, '#b9bcc8']])}
      ${ramp('w', [[0, '#8fb4d8'], [1, '#4a73a6']])}
    </defs>
    ${ground(32, 57, 16, 0.26)}
    <path d="M12,58Q13,46 24,43L40,43Q51,46 52,58Z" fill="url(#w)"/>
    <path d="M12,58Q13,46 24,43L31,43L31,58Z" fill="#ffffff" opacity="0.12"/>
    <path d="M32,10Q47,10 47,27Q47,42 32,42Q17,42 17,27Q17,10 32,10Z" fill="url(#f)"/>
    <path d="M15,30Q11,17 20,11Q15,24 19,33Z" fill="url(#h)"/>
    <path d="M49,30Q53,17 44,11Q49,24 45,33Z" fill="url(#h)"/>
    <path d="M17,20Q19,8 32,8Q45,8 47,20Q40,14 32,14Q24,14 17,20Z" fill="url(#h)"/>
    <circle cx="32" cy="7" r="6.5" fill="url(#h)"/>
    <g fill="none" stroke="#3f3a3a" stroke-width="1.8">
      <circle cx="25" cy="26" r="6"/><circle cx="39" cy="26" r="6"/>
      <path d="M31,26H33M19,25L15,26M45,25L49,26"/>
    </g>
    <g fill="#2e2a2a"><circle cx="25" cy="26.5" r="2.2"/><circle cx="39" cy="26.5" r="2.2"/></g>
    <g fill="#ffffff" opacity="0.6"><circle cx="24" cy="25.3" r="0.9"/><circle cx="38" cy="25.3" r="0.9"/></g>
    <path d="M28,35Q32,38 36,35" fill="none" stroke="${shade('#c48254', -0.4)}"
          stroke-width="1.6" stroke-linecap="round"/>`),

  '🌾': svg(`
    ${ground(32, 57, 17, 0.28)}
    ${wheat(20, 50, 0.95, -16, '#d9b038')}
    ${wheat(44, 50, 0.95, 16, '#c79a2a')}
    ${wheat(32, 52, 1.12, 0, '#e8c952')}
    ${wheat(26, 53, 0.8, -7, '#cfa62e')}
    ${wheat(38, 53, 0.8, 7, '#c09026')}
    <path d="M17,50Q32,45 47,50Q32,56 17,50Z" fill="#8a6a1e"/>
    <path d="M18.5,49.5Q32,45.5 45.5,49.5" fill="none" stroke="#f0d88a" stroke-width="1.6" opacity="0.7"/>`),

  '⛏️': svg(`
    <defs>
      ${ramp('h', [[0, '#e6ecf2'], [0.42, '#9aa6b4'], [0.7, '#6d7885'], [1, '#464e59']])}
      ${ramp('wd', [[0, '#d8a86a'], [0.5, '#b07a3e'], [1, '#7d5326']], 0, 0, 1, 1)}
    </defs>
    ${ground(33, 57, 17, 0.3)}
    <path d="M14,54L44,17" stroke="url(#wd)" stroke-width="7.5" stroke-linecap="round"/>
    <path d="M14,54L44,17" stroke="${shade('#7d5326', -0.3)}" stroke-width="2.4" stroke-linecap="round"
          opacity="0.5" transform="translate(2.6 2.6)"/>
    <path d="M17,17Q32,4 47,17Q40,15 36,20L34,25L30,25L28,20Q24,15 17,17Z" fill="url(#h)"/>
    <path d="M17,17Q32,4 47,17Q40,15 36,20" fill="none" stroke="#ffffff" stroke-width="1.8" opacity="0.65"/>
    <path d="M32,9Q35,12 35,17" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
    <path d="M30,25L34,25L33,30L31,30Z" fill="${shade('#464e59', -0.3)}"/>`),

  '🏭': svg(`
    <defs>
      ${ramp('w', [[0, '#b8c0ca'], [0.55, '#8a929d'], [1, '#5c636d']])}
      ${ramp('rf', [[0, '#a34b3c'], [1, '#6d2b21']])}
      ${ramp('ch', [[0, '#9aa2ad'], [1, '#5a616b']])}
    </defs>
    ${ground(32, 57, 21, 0.32)}
    <g fill="#cfd6de" opacity="0.85">
      <path d="M40,10Q47,8 47,14Q47,19 41,19Q36,19 36,14Q36,10 40,10Z"/>
      <path d="M50,4Q57,2 57,8Q57,13 51,13Q46,13 46,8Q46,4 50,4Z" opacity="0.7"/>
    </g>
    <rect x="44" y="14" width="9" height="44" rx="1.5" fill="url(#ch)"/>
    <rect x="44" y="14" width="9" height="44" rx="1.5" fill="none" stroke="${shade('#5a616b', -0.4)}" stroke-width="1.4"/>
    <rect x="47.4" y="18" width="2.6" height="40" fill="#ffffff" opacity="0.16"/>
    <path d="M8,58V34L18,26L26,34L34,26L44,34V58Z" fill="url(#w)"/>
    <path d="M8,34L18,26L26,34L34,26L44,34" fill="none" stroke="url(#rf)" stroke-width="4.5" stroke-linejoin="round"/>
    <path d="M8,34L18,26L26,34L34,26L44,34V37L34,29L26,37L18,29L8,37Z" fill="url(#rf)"/>
    <g fill="#f0d87a" opacity="0.9">
      <rect x="13" y="40" width="7" height="6" rx="1"/><rect x="24" y="40" width="7" height="6" rx="1"/>
      <rect x="35" y="40" width="6" height="6" rx="1"/><rect x="13" y="49" width="7" height="6" rx="1"/>
      <rect x="24" y="49" width="7" height="6" rx="1"/><rect x="35" y="49" width="6" height="6" rx="1"/>
    </g>
    <path d="M8,58V34L18,26L26,34" fill="#ffffff" opacity="0.1"/>`),

  '🏦': svg(`
    <defs>
      ${ramp('s', [[0, '#dfe6ee'], [0.5, '#b3bdca'], [1, '#7f8a99']])}
      ${ramp('c', [[0, '#ffffff'], [1, '#aeb8c4']], 0, 0, 1, 0.3)}
      ${lit('coin', [[0, '#ffeeae'], [0.5, '#f2c02c'], [1, '#a97a08']])}
    </defs>
    ${ground(32, 57, 21, 0.32)}
    <path d="M6,58V26L32,10L58,26V58Z" fill="url(#s)"/>
    <path d="M6,26L32,10L58,26V29H6Z" fill="${shade('#7f8a99', -0.35)}"/>
    <path d="M6,26L32,10L44,18V58H6Z" fill="#ffffff" opacity="0.14"/>
    <g fill="url(#c)" stroke="${shade('#aeb8c4', -0.4)}" stroke-width="1.2">
      <rect x="12" y="30" width="6" height="21"/><rect x="24" y="30" width="6" height="21"/>
      <rect x="36" y="30" width="6" height="21"/><rect x="46" y="30" width="6" height="21"/>
    </g>
    <rect x="6" y="51" width="52" height="7" fill="${shade('#7f8a99', -0.25)}"/>
    <rect x="6" y="51" width="52" height="2.5" fill="#ffffff" opacity="0.3"/>
    <circle cx="32" cy="21" r="7.5" fill="url(#coin)"/>
    <circle cx="32" cy="21" r="7.5" fill="none" stroke="${shade('#a97a08', -0.3)}" stroke-width="1.3"/>
    <path d="M32,16.5V25.5M29,19Q29,17.5 32,17.5Q35,17.5 35,19.5Q35,21.5 32,21.5Q29,21.5 29,23.5Q29,25.5 32,25.5Q35,25.5 35,24"
          fill="none" stroke="${shade('#a97a08', -0.45)}" stroke-width="1.7" stroke-linecap="round"/>`),

  '🏛️': svg(`
    <defs>
      ${ramp('m', [[0, '#faf7f0'], [0.5, '#ded8cb'], [1, '#a9a293']])}
      ${ramp('col', [[0, '#ffffff'], [0.45, '#e6e0d3'], [1, '#b3ac9c']], 0, 0, 1, 0.2)}
    </defs>
    ${ground(32, 57, 22, 0.32)}
    <path d="M32,7L57,24H7Z" fill="url(#m)"/>
    <path d="M32,7L57,24H7V27H57Z" fill="${shade('#a9a293', -0.3)}"/>
    <path d="M32,7L57,24H32Z" fill="#ffffff" opacity="0.25"/>
    <rect x="9" y="27" width="46" height="4.5" fill="${shade('#a9a293', -0.18)}"/>
    <g fill="url(#col)" stroke="${shade('#b3ac9c', -0.35)}" stroke-width="1.1">
      <rect x="12" y="31" width="6.5" height="21"/><rect x="22" y="31" width="6.5" height="21"/>
      <rect x="35.5" y="31" width="6.5" height="21"/><rect x="45.5" y="31" width="6.5" height="21"/>
    </g>
    <g stroke="${shade('#b3ac9c', -0.5)}" stroke-width="0.9" opacity="0.65">
      <path d="M15,33V50M25,33V50M38.5,33V50M48.5,33V50"/>
    </g>
    <rect x="7" y="52" width="50" height="3.5" fill="${shade('#a9a293', -0.1)}"/>
    <rect x="5" y="55.5" width="54" height="3.5" fill="${shade('#a9a293', -0.3)}"/>
    <path d="M32,3.5Q35,5 35,7.5Q35,10 32,10Q29,10 29,7.5Q29,5 32,3.5Z" fill="#e8a13c"/>
    <path d="M32,10V14" stroke="#b8762a" stroke-width="3" stroke-linecap="round"/>`),

  '🌀': (() => {
    // Four arms, each a tapering crescent spiralling into a hot centre.
    const arm = (i) => {
      const a = (i * Math.PI) / 2;
      const turn = 2.35;
      const pts = [];
      for (let t = 0; t <= 1.0001; t += 0.1) {
        const ang = a + turn * t;
        const r = 3 + 26 * t;
        pts.push([32 + Math.cos(ang) * r, 32 + Math.sin(ang) * r]);
      }
      const outer = pts.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
      const inner = pts.slice().reverse().map(([x, y], k) => {
        const t = k / pts.length;
        const s = 7 - 5 * t;
        return `L${(x + s * 0.7).toFixed(1)},${(y + s * 0.7).toFixed(1)}`;
      }).join('');
      return `<path d="${outer}${inner}Z"/>`;
    };
    return svg(`
      <defs>${lit('v', [[0, '#e9fbff'], [0.35, '#59d0f0'], [0.72, '#2b7fd6'], [1, '#173f9e']])}</defs>
      ${ground(32, 56, 19, 0.34)}
      <circle cx="32" cy="32" r="27" fill="url(#v)"/>
      <g fill="#ffffff" opacity="0.9">${arm(0)}${arm(1)}${arm(2)}${arm(3)}</g>
      <g fill="#aef0ff" opacity="0.75">${arm(0.5)}${arm(1.5)}${arm(2.5)}${arm(3.5)}</g>
      <circle cx="32" cy="32" r="6.5" fill="#ffffff"/>
      <circle cx="32" cy="32" r="10" fill="#ffffff" opacity="0.35"/>
      <circle cx="32" cy="32" r="27" fill="none" stroke="#0f2f7a" stroke-width="2" opacity="0.55"/>`);
  })(),

  // ---- Click and production upgrades --------------------------------------

  '💪': svg(`
    <defs>${lit('s', SKIN)}</defs>
    ${ground(33, 57, 16, 0.28)}
    <path d="M10,50Q10,36 22,34L34,32Q44,30 46,22Q48,12 40,9Q33,7 30,14L27,21"
          fill="none" stroke="url(#s)" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M40,9Q48,12 46,22Q45,28 40,30" fill="none" stroke="${shade('#c48254', -0.35)}"
          stroke-width="2.6" stroke-linecap="round" opacity="0.7"/>
    <path d="M24,36Q30,44 38,44" fill="none" stroke="${shade('#c48254', -0.45)}"
          stroke-width="2.8" stroke-linecap="round" opacity="0.75"/>
    <path d="M20,38Q26,44 34,45" fill="none" stroke="#ffffff" stroke-width="3.4"
          stroke-linecap="round" opacity="0.4"/>
    <path d="M40,9Q47,13 46,21" fill="none" stroke="#ffffff" stroke-width="3"
          stroke-linecap="round" opacity="0.5"/>
    <rect x="7" y="44" width="14" height="12" rx="4" fill="${shade('#5b7fb5', -0.15)}"/>
    <rect x="7" y="44" width="14" height="4" rx="2" fill="#ffffff" opacity="0.25"/>`),

  '🖱️': svg(`
    <defs>
      ${ramp('b', [[0, '#f4f7fa'], [0.45, '#c8d0da'], [0.8, '#98a2af'], [1, '#6c7481']])}
      ${ramp('top', [[0, '#ffffff'], [1, '#d5dce5']], 0, 0, 0.4, 1)}
    </defs>
    ${ground(32, 57, 14, 0.3)}
    <path d="M32,7Q47,7 49,26L50,42Q51,56 32,56Q13,56 14,42L15,26Q17,7 32,7Z" fill="url(#b)"/>
    <path d="M32,7Q47,7 49,26L49.4,32H14.6L15,26Q17,7 32,7Z" fill="url(#top)"/>
    <path d="M32,7Q47,7 49,26L50,42Q51,56 32,56" fill="none" stroke="${shade('#6c7481', -0.4)}"
          stroke-width="1.7"/>
    <path d="M14.6,32H49.4" stroke="${shade('#6c7481', -0.35)}" stroke-width="1.7"/>
    <path d="M32,7V32" stroke="${shade('#6c7481', -0.3)}" stroke-width="1.6"/>
    <rect x="28.5" y="14" width="7" height="13" rx="3.5" fill="${shade('#6c7481', -0.45)}"/>
    <rect x="29.6" y="15.5" width="4.8" height="8" rx="2.4" fill="#8fd6a0"/>
    <path d="M23,14Q26,10 31,9.5" fill="none" stroke="#ffffff" stroke-width="3"
          stroke-linecap="round" opacity="0.85"/>`),

  '👍': svg(`
    <defs>${lit('s', SKIN)}
      <clipPath id="fist"><rect x="18" y="26" width="30" height="28" rx="10"/></clipPath>
    </defs>
    ${ground(32, 57, 15, 0.26)}
    <rect x="21" y="7" width="11" height="26" rx="5.5" fill="url(#s)"
          transform="rotate(-6 26.5 20)"/>
    <path d="M22,11Q26.5,8.5 31,11.5L30,17.5Q25.5,19.5 22,17Z" fill="#fff2e4" opacity="0.9"
          transform="rotate(-6 26.5 14.5)"/>
    <rect x="18" y="26" width="30" height="28" rx="10" fill="url(#s)"/>
    <g clip-path="url(#fist)" stroke="${shade('#c48254', -0.35)}" stroke-width="1.6" stroke-linecap="round" opacity="0.75">
      <path d="M33,31H46M33,38H46M33,45H46"/>
    </g>
    <path d="M19,44Q13,44 13,49Q13,54 19,54L30,54" fill="none" stroke="${mix('#f2bd90', '#e0a97c', 0.5)}"
          stroke-width="7.5" stroke-linecap="round"/>
    <path d="M21,29Q25,26 30,26" fill="none" stroke="#ffffff" stroke-width="2.6"
          stroke-linecap="round" opacity="0.45"/>`),

  '🙌': svg(`
    <defs>${lit('s', SKIN)}</defs>
    ${ground(32, 57, 19, 0.26)}
    <path d="M17,30Q14,22 18,20Q22,18 24,25L27,34" fill="url(#s)"/>
    <path d="M47,30Q50,22 46,20Q42,18 40,25L37,34" fill="url(#s)"/>
    <path d="M20,34L15,22Q14,19 17,18Q20,17 21,21L25,31" fill="url(#s)"/>
    <path d="M27,32L24,17Q23.5,14 26.5,13.5Q29.5,13 30,16.5L32,31" fill="url(#s)"/>
    <path d="M34,31L37,16Q37.5,12.5 40.5,13Q43.5,13.5 43,17L40,32" fill="url(#s)"/>
    <path d="M40,33L45,21Q46,18 49,19Q52,20 51,23L46,36" fill="url(#s)"/>
    <path d="M14,34Q12,46 22,54L30,58L34,58L42,54Q52,46 50,34Q44,44 32,44Q20,44 14,34Z" fill="url(#s)"/>
    <path d="M32,44V58" stroke="${shade('#c48254', -0.4)}" stroke-width="1.5" opacity="0.7"/>
    <path d="M18,36Q20,46 30,50" fill="none" stroke="#ffffff" stroke-width="2.6"
          stroke-linecap="round" opacity="0.4"/>`),

  '🏗️': svg(`
    <defs>${ramp('y', [[0, '#ffd94a'], [0.5, '#e8a91c'], [1, '#a06f08']])}</defs>
    ${ground(32, 57, 20, 0.32)}
    <rect x="6" y="50" width="20" height="7" rx="2" fill="${shade('#a06f08', 0.12)}"/>
    <g stroke="url(#y)" stroke-width="4.4" stroke-linecap="round" fill="none">
      <path d="M16,52V12"/>
      <path d="M16,14H52"/>
      <path d="M16,14L40,8"/>
    </g>
    <g stroke="${shade('#a06f08', -0.18)}" stroke-width="1.6" opacity="0.85" fill="none">
      <path d="M16,20L26,26L16,32L26,38L16,44L26,50"/>
      <path d="M16,20L6,26M16,32L6,38M16,44L6,50"/>
    </g>
    <rect x="8" y="9" width="14" height="7" rx="1.5" fill="${shade('#a06f08', 0.08)}"/>
    <path d="M48,16V32" stroke="${shade('#5b636e', -0.1)}" stroke-width="2.2"/>
    <path d="M48,32L44,36H52Z" fill="#7d8794"/>
    <rect x="42" y="36" width="12" height="9" rx="1.5" fill="url(#y)"/>
    <rect x="42" y="36" width="12" height="3.5" fill="#ffffff" opacity="0.3"/>
    <path d="M16,14H52" stroke="url(#y)" stroke-width="4.4" stroke-linecap="round"/>`),

  '📦': svg(`
    <defs>
      ${ramp('c', [[0, '#e0b072'], [0.45, '#c48f4f'], [1, '#8a5f2c']])}
    </defs>
    ${ground(32, 57, 20, 0.3)}
    <path d="M16,30L6,20Q4,18 7,17L22,14L32,24Z" fill="${mix('#c48f4f', '#ffffff', 0.35)}"/>
    <path d="M48,30L58,20Q60,18 57,17L42,14L32,24Z" fill="${mix('#c48f4f', '#ffffff', 0.2)}"/>
    <path d="M8,26H56L52,58H12Z" fill="url(#c)"/>
    <path d="M8,26H32V58H12Z" fill="#ffffff" opacity="0.14"/>
    <path d="M32,26V58" stroke="${shade('#8a5f2c', -0.35)}" stroke-width="1.6" opacity="0.75"/>
    <path d="M8,34H56" stroke="${shade('#8a5f2c', -0.3)}" stroke-width="1.4" opacity="0.55"/>
    <rect x="26" y="24" width="12" height="8" rx="1" fill="${mix('#e6c08a', '#ffffff', 0.4)}"
          stroke="${shade('#8a5f2c', -0.3)}" stroke-width="1.2"/>
    <path d="M14,44H27M37,44H50" stroke="${shade('#8a5f2c', -0.4)}" stroke-width="1.4"
          stroke-linecap="round" opacity="0.55"/>`),

  '🧪': svg(`
    <defs>
      ${ramp('g', [[0, '#ffffff', 0.85], [0.5, '#dceaf2', 0.55], [1, '#a9bfcd', 0.7]])}
      ${lit('l', [[0, '#b6f0a8'], [0.55, '#4fbf62'], [1, '#1c7a3c']])}
    </defs>
    ${ground(32, 57, 15, 0.3)}
    <path d="M26,7H38L37,10V30L49,50Q53,57 44,58H20Q11,57 15,50L27,30V10Z" fill="url(#g)"/>
    <clipPath id="body"><path d="M26,7H38L37,10V30L49,50Q53,57 44,58H20Q11,57 15,50L27,30V10Z"/></clipPath>
    <g clip-path="url(#body)">
      <path d="M14,36Q24,32 32,37T52,36V60H12Z" fill="url(#l)"/>
      <path d="M14,36Q24,32 32,37T52,36" fill="none" stroke="#d4f8c8" stroke-width="2.2" opacity="0.85"/>
      <ellipse cx="24" cy="44" rx="4" ry="4.6" fill="#ffffff" opacity="0.4"/>
      <ellipse cx="35" cy="49" rx="3" ry="3.4" fill="#ffffff" opacity="0.32"/>
      <ellipse cx="42" cy="42" rx="2.2" ry="2.6" fill="#ffffff" opacity="0.35"/>
      <path d="M29,7V58" stroke="#ffffff" stroke-width="4" opacity="0.5"/>
    </g>
    <path d="M26,7H38L37,10V30L49,50Q53,57 44,58H20Q11,57 15,50L27,30V10Z"
          fill="none" stroke="${shade('#8fa8b8', -0.4)}" stroke-width="1.8"/>
    <rect x="24" y="4" width="16" height="5" rx="2.5" fill="#c3ced8"/>
    <rect x="24" y="4" width="16" height="2" rx="1" fill="#ffffff" opacity="0.55"/>`),

  '🔬': svg(`
    <defs>
      ${ramp('m', [[0, '#eef2f6'], [0.45, '#b6c0cb'], [1, '#727b88']])}
      ${ramp('d', [[0, '#8f99a6'], [1, '#565e6a']])}
    </defs>
    ${ground(32, 57, 18, 0.32)}
    <path d="M12,56Q10,56 10,52Q10,48 16,48L48,48Q54,48 54,52Q54,56 52,56Z" fill="url(#d)"/>
    <rect x="14" y="44" width="36" height="5" rx="2.5" fill="url(#m)"/>
    <path d="M40,44Q52,40 50,24Q48,10 36,10" fill="none" stroke="url(#m)" stroke-width="7" stroke-linecap="round"/>
    <g transform="rotate(-22 30 30)">
      <rect x="24" y="4" width="11" height="26" rx="3" fill="url(#m)"/>
      <rect x="25.5" y="6" width="4" height="20" rx="2" fill="#ffffff" opacity="0.5"/>
      <rect x="23" y="28" width="13" height="5" rx="2" fill="${shade('#727b88', -0.3)}"/>
    </g>
    <rect x="20" y="34" width="22" height="4.5" rx="1.5" fill="url(#m)"/>
    <rect x="20" y="34" width="22" height="2" rx="1" fill="#ffffff" opacity="0.45"/>
    <rect x="27" y="38" width="8" height="7" rx="1.5" fill="${shade('#727b88', -0.15)}"/>
    <path d="M16,50L44,50" stroke="#ffffff" stroke-width="1.6" opacity="0.35"/>
    <circle cx="46" cy="24" r="4" fill="#9fe4ff" opacity="0.6"/>`),
};

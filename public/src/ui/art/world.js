/**
 * The world: what goes into a cookie, what grows in the garden, what trades on
 * the exchange, and the handful of marks the interface uses for its own
 * messages.
 *
 * The ingredients are the hard part of this file. Honey, chestnut, candy and
 * mooncake are all "a brown blob" in emoji form, which is exactly the problem
 * drawing is solving, so each one is given a different material rather than a
 * different shade: wet amber, glossy shell, hard sugar, matte baked crust.
 *
 * See `tools/ICON-ART.md`.
 */

import { shade } from './shape.js';

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">${body}</svg>`;

/**
 * Ground shadow under an object, plus the filter it needs — declared beside the
 * reference so an icon cannot end up pointing at a filter nothing defines.
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

/** Same idea, along a line — for flat faces rather than round ones. */
const ramp = (id, stops, x1 = 0, y1 = 0, x2 = 1, y2 = 1) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops
    .map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`).join('')}
  </linearGradient>`;

const SKIN = [[0, '#ffe7cd'], [0.5, '#f2bd90'], [1, '#c48254']];

// ---------------------------------------------------------------------------

export const WORLD_ART = {
  // ---- Cookie ingredients -------------------------------------------------

  '🍯': svg(`
    <defs>
      ${lit('pot', [[0, '#f7ead2'], [0.5, '#d8b98a'], [1, '#9a7648']])}
      ${lit('hon', [[0, '#ffe98a'], [0.45, '#f2b21c'], [1, '#b37400']])}
    </defs>
    ${ground(32, 57, 17, 0.32)}
    <path d="M17,22H47L45,50Q44,58 36,58H28Q20,58 19,50Z" fill="url(#pot)"/>
    <path d="M17,22H32L31,58H28Q20,58 19,50Z" fill="#ffffff" opacity="0.22"/>
    <path d="M15,18H49V24H15Z" rx="3" fill="${shade('#9a7648', -0.15)}"/>
    <path d="M15,18H49V21H15Z" fill="#ffffff" opacity="0.4"/>
    <path d="M19,27Q32,23 45,27L45,33Q32,29 19,33Z" fill="url(#hon)"/>
    <path d="M20,33Q24,42 32,42Q40,42 44,33Q40,38 32,38Q24,38 20,33Z" fill="url(#hon)"/>
    <path d="M45,26Q52,30 50,40Q49,48 44,50Q47,42 45,34Z" fill="url(#hon)"/>
    <path d="M45,26Q49,29 49,35" fill="none" stroke="#fff3b8" stroke-width="2.6"
          stroke-linecap="round" opacity="0.8"/>
    <path d="M40,24Q44,26 45,31" fill="none" stroke="#ffffff" stroke-width="3.4"
          stroke-linecap="round" opacity="0.65"/>
    <g stroke="${shade('#b37400', -0.3)}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.6">
      <path d="M23,29Q26,27.5 29,29"/><path d="M34,31Q37,29.5 40,31"/>
    </g>`),

  '🌰': svg(`
    <defs>
      ${lit('ch', [[0, '#a8643a'], [0.4, '#7d3f1e'], [0.78, '#54270f'], [1, '#30160a']])}
      ${lit('husk', [[0, '#d8e07a'], [0.5, '#a3b03a'], [1, '#5e6a1c']])}
    </defs>
    ${ground(32, 57, 16, 0.3)}
    <path d="M10,44Q6,30 16,20Q26,10 40,14Q54,18 56,34Q57,50 44,54Q28,58 10,44Z" fill="url(#husk)"
          opacity="0.9"/>
    <g stroke="${shade('#5e6a1c', -0.35)}" stroke-width="1.5" opacity="0.7" fill="none">
      <path d="M14,34L20,26M22,44L30,32M36,50L44,40M46,44L52,36M12,42L16,50"/>
    </g>
    <path d="M32,8Q46,10 49,26Q52,46 34,52Q16,56 14,36Q12,18 24,11Q28,8 32,8Z" fill="url(#ch)"/>
    <path d="M32,8Q46,10 49,26Q50,34 46,40Q42,22 28,14Z" fill="#ffffff" opacity="0.14"/>
    <path d="M18,44Q32,52 46,44Q42,53 32,53Q22,53 18,44Z" fill="#e8d5a8"/>
    <path d="M32,50Q36,52 40,50" fill="none" stroke="${shade('#a8643a', -0.5)}" stroke-width="1.6"
          stroke-linecap="round" opacity="0.7"/>
    <path d="M30,8Q34,4 38,6" fill="none" stroke="${shade('#54270f', -0.2)}" stroke-width="3"
          stroke-linecap="round"/>
    <path d="M22,17Q26,12 33,11" fill="none" stroke="#f2c9a0" stroke-width="4"
          stroke-linecap="round" opacity="0.65"/>`),

  '🎂': svg(`
    <defs>
      ${lit('sp', [[0, '#fbe8f0'], [0.5, '#eeb8cf'], [1, '#c47a99']])}
      ${lit('cr', [[0, '#fffaf0'], [0.5, '#f4ddbb'], [1, '#cf9f66']])}
      ${ramp('fl', [[0, '#e05a72'], [1, '#a32138']])}
    </defs>
    ${ground(32, 58, 19, 0.32)}
    <path d="M9,56V38Q9,34 13,34H51Q55,34 55,38V56Q55,59 51,59H13Q9,59 9,56Z" fill="url(#cr)"/>
    <path d="M9,56V38Q9,34 13,34H32V59H13Q9,59 9,56Z" fill="#ffffff" opacity="0.24"/>
    <path d="M9,38Q14,33 20,37Q26,41 32,36Q38,31 44,36Q50,41 55,37V34H9Z" fill="url(#sp)"/>
    <rect x="9" y="44" width="46" height="5" fill="url(#fl)" opacity="0.9"/>
    <path d="M13,50H51M13,55H51" stroke="${shade('#cf9f66', -0.35)}" stroke-width="1.6"
          stroke-linecap="round" opacity="0.6"/>
    <rect x="30" y="14" width="4" height="14" rx="2" fill="#f6f2e6"/>
    <rect x="30" y="14" width="1.6" height="14" fill="#d8d2c0"/>
    <path d="M32,4Q36,8 34,13Q32,16 30,13Q28,8 32,4Z" fill="#ffb020"/>
    <path d="M32,7Q33.6,10 32.6,12.5Q32,14 31.4,12.5Q30.6,10 32,7Z" fill="#fff2b0"/>
    <g fill="#ffffff" opacity="0.8">
      <circle cx="20" cy="41" r="1.6"/><circle cx="42" cy="40" r="1.6"/><circle cx="31" cy="42" r="1.4"/>
    </g>
    <path d="M13,37Q15,35 18,36" fill="none" stroke="#ffffff" stroke-width="2.6"
          stroke-linecap="round" opacity="0.7"/>`),

  '🍭': svg(`
    <defs>${lit('c', [[0, '#fff4f6'], [0.4, '#ff8fb0'], [0.78, '#e8407a'], [1, '#9c1448']])}</defs>
    ${ground(32, 58, 14, 0.3)}
    <rect x="30" y="34" width="5" height="25" rx="2.5" fill="#f0ead8"/>
    <rect x="30" y="34" width="2" height="25" fill="#ffffff" opacity="0.75"/>
    <rect x="30" y="34" width="5" height="25" rx="2.5" fill="none" stroke="${shade('#c9c0a8', -0.3)}"
          stroke-width="1.2"/>
    <circle cx="32" cy="26" r="22" fill="url(#c)"/>
    <g fill="none" stroke="#ffffff" stroke-width="4.2" stroke-linecap="round" opacity="0.72">
      <path d="M32,26m0,-15a15,15 0 1,1 -10.6,4.4a11,11 0 1,0 15.6,-6.2a7,7 0 1,1 -4.4,11"/>
    </g>
    <g fill="none" stroke="${shade('#9c1448', -0.2)}" stroke-width="2" stroke-linecap="round" opacity="0.5">
      <path d="M32,26m0,-19a19,19 0 1,1 -13.4,5.6"/>
    </g>
    <path d="M19,15Q23,10 30,9" fill="none" stroke="#ffffff" stroke-width="5"
          stroke-linecap="round" opacity="0.8"/>
    <circle cx="32" cy="26" r="22" fill="none" stroke="${shade('#9c1448', -0.35)}" stroke-width="2"
            opacity="0.6"/>`),

  '🥮': svg(`
    <defs>
      ${lit('ck', [[0, '#f6d9a2'], [0.45, '#dcae62'], [0.8, '#b07f34'], [1, '#7d5520']])}
      ${lit('top', [[0, '#fbeec9'], [1, '#c89a4e']], 0.4, 0.34, 0.65)}
    </defs>
    ${ground(32, 57, 18, 0.32)}
    <path d="M8,34Q8,54 32,54Q56,54 56,34V30H8Z" fill="url(#ck)"/>
    <path d="M8,34Q8,54 32,54V30H8Z" fill="#ffffff" opacity="0.16"/>
    <g stroke="${shade('#7d5520', -0.35)}" stroke-width="2" stroke-linecap="round" opacity="0.75">
      ${Array.from({ length: 11 }, (_, i) => {
  const x = 10 + i * 4.4;
  const top = 30 - Math.sqrt(Math.max(0, 1 - ((x - 32) / 25) ** 2)) * 4;
  return `<path d="M${x.toFixed(1)},${top.toFixed(1)}V52"/>`;
}).join('')}
    </g>
    <ellipse cx="32" cy="30" rx="24" ry="13" fill="url(#top)"/>
    <ellipse cx="32" cy="30" rx="24" ry="13" fill="none" stroke="${shade('#7d5520', -0.4)}"
             stroke-width="1.8"/>
    <ellipse cx="32" cy="30" rx="16" ry="8.5" fill="none" stroke="${shade('#7d5520', -0.3)}"
             stroke-width="1.6" opacity="0.8"/>
    <path d="M32,24Q37,27 36,32Q35,36 32,36Q29,36 28,32Q27,27 32,24Z" fill="none"
          stroke="${shade('#7d5520', -0.45)}" stroke-width="1.8"/>
    <path d="M24,28Q27,25 30,28M34,28Q37,25 40,28M25,33Q28,36 31,33M33,33Q36,36 39,33"
          fill="none" stroke="${shade('#7d5520', -0.4)}" stroke-width="1.6"
          stroke-linecap="round" opacity="0.85"/>
    <path d="M14,25Q20,20 28,19" fill="none" stroke="#fff6dd" stroke-width="3.4"
          stroke-linecap="round" opacity="0.7"/>`),

  '🫚': svg(`
    <defs>${ramp('gn', [[0, '#e8cfa0'], [0.45, '#c9a473'], [0.8, '#a37f4e'], [1, '#775830']], 0.1, 0, 0.9, 1)}</defs>
    ${ground(32, 57, 17, 0.3)}
    <path d="M14,34Q10,26 16,22Q22,18 26,24L30,30Q28,22 34,20Q42,18 44,26L46,34Q50,42 44,48
             Q38,54 30,50L24,46Q16,46 14,34Z" fill="url(#gn)"/>
    <path d="M14,34Q10,26 16,22Q20,19 24,22Q19,26 20,34Q21,42 27,44L24,46Q16,46 14,34Z"
          fill="#ffffff" opacity="0.24"/>
    <path d="M44,26Q48,22 52,26Q54,30 50,34Q47,37 44,34Z" fill="url(#gn)"/>
    <path d="M46,25Q50,22 52,26" fill="none" stroke="#f2e0bd" stroke-width="2.4"
          stroke-linecap="round" opacity="0.75"/>
    <path d="M45,31Q48,34 47,38" fill="none" stroke="${shade('#775830', -0.35)}" stroke-width="1.8"
          stroke-linecap="round" opacity="0.8"/>
    <path d="M33,22Q37,24 38,29" fill="none" stroke="${shade('#775830', -0.4)}" stroke-width="1.7"
          stroke-linecap="round" opacity="0.7"/>
    <path d="M26,26Q24,32 26,38" fill="none" stroke="${shade('#775830', -0.35)}" stroke-width="1.6"
          stroke-linecap="round" opacity="0.55"/>
    <path d="M20,25Q24,21 30,21" fill="none" stroke="#fdf0d8" stroke-width="3.2"
          stroke-linecap="round" opacity="0.65"/>`),

  '🕳️': svg(`
    <defs>
      ${lit('cd', [[0, '#9a7160'], [0.38, '#6b4a3c'], [0.76, '#452c22'], [1, '#241612']])}
      ${lit('rim', [[0, '#0a0505'], [0.6, '#140b08'], [1, '#5a3a2a']], 0.5, 0.5, 0.5)}
      ${ramp('vr', [[0, '#000000', 0], [1, '#000000', 0.92]], 0, 0, 0, 1)}
    </defs>
    ${ground(32, 56, 17, 0.34)}
    <path d="M32,6Q54,6 56,30Q57,54 32,56Q7,58 6,32Q5,8 32,6Z" fill="url(#cd)"/>
    <path d="M32,6Q54,6 56,30Q56,40 52,47Q50,24 30,14Z" fill="#ffffff" opacity="0.16"/>
    <path d="M14,46Q22,54 34,53" fill="none" stroke="${shade('#241612', -0.4)}" stroke-width="4"
          stroke-linecap="round" opacity="0.55"/>
    <circle cx="32" cy="31" r="15" fill="url(#rim)"/>
    <circle cx="32" cy="31" r="15" fill="url(#vr)" transform="rotate(180 32 31)" opacity="0.55"/>
    <circle cx="32" cy="31" r="15" fill="none" stroke="${shade('#241612', -0.5)}" stroke-width="2.6"/>
    <path d="M21,25Q26,19 34,18" fill="none" stroke="#c99a7a" stroke-width="3.4"
          stroke-linecap="round" opacity="0.6"/>
    <path d="M44,41Q46,36 44,29" fill="none" stroke="#7a5445" stroke-width="3"
          stroke-linecap="round" opacity="0.5"/>
    <g fill="#7a5445" opacity="0.9">
      <path d="M12,26Q15,23 18,26Q15,29 12,26Z"/>
      <path d="M46,48Q49,45 52,48Q49,51 46,48Z"/>
      <path d="M44,18Q46,16 48,18Q46,20 44,18Z"/>
      <path d="M20,50Q22,48 24,50Q22,52 20,50Z"/>
    </g>
    <g fill="#c99a7a" opacity="0.75">
      <path d="M17,17Q19,15 21,17Q19,19 17,17Z"/>
      <path d="M49,32Q51,30 53,32Q51,34 49,32Z"/>
    </g>`),

  // ---- Garden -------------------------------------------------------------

  '🌱': svg(`
    <defs>
      ${lit('lf', [[0, '#c4ec8a'], [0.45, '#74bc45'], [1, '#2f7a30']])}
      ${lit('soil', [[0, '#8a6444'], [1, '#4a3220']])}
    </defs>
    ${ground(32, 57, 15, 0.3)}
    <path d="M10,46Q32,40 54,46Q54,56 32,57Q10,56 10,46Z" fill="url(#soil)"/>
    <path d="M10,46Q32,40 54,46Q32,51 10,46Z" fill="#a3785a" opacity="0.7"/>
    <path d="M32,50V30" stroke="#4f9a3a" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M32,40Q22,40 17,31Q27,27 33,35Z" fill="url(#lf)"/>
    <path d="M32,40Q22,40 17,31Q25,30 30,36Z" fill="#ffffff" opacity="0.22"/>
    <path d="M32,34Q42,33 47,24Q37,20 31,29Z" fill="url(#lf)"/>
    <path d="M32,34Q42,33 47,24Q41,23 35,30Z" fill="#ffffff" opacity="0.3"/>
    <path d="M20,34Q25,34 31,38" fill="none" stroke="${shade('#2f7a30', -0.3)}" stroke-width="1.4"
          stroke-linecap="round" opacity="0.7"/>
    <path d="M44,27Q38,28 33,33" fill="none" stroke="${shade('#2f7a30', -0.3)}" stroke-width="1.4"
          stroke-linecap="round" opacity="0.7"/>
    <path d="M32,50Q34,48 35,45" fill="none" stroke="#7ec85a" stroke-width="2"
          stroke-linecap="round" opacity="0.6"/>`),

  '🥕': svg(`
    <defs>${ramp('rt', [[0, '#ffb066'], [0.4, '#f27a1e'], [0.78, '#d15510'], [1, '#933a08']], 0.15, 0, 0.85, 1)}</defs>
    ${ground(32, 57, 15, 0.3)}
    <g stroke="#4f9a3a" stroke-width="3.4" stroke-linecap="round" fill="none">
      <path d="M32,22L24,8"/><path d="M32,22L32,6"/><path d="M32,22L41,9"/>
    </g>
    <path d="M24,9Q20,6 21,11Q22,16 27,17Z" fill="#5faa42"/>
    <path d="M32,6Q28,3 30,9Q31,15 35,16Z" fill="#6fb84e"/>
    <path d="M41,10Q45,7 44,12Q43,17 38,18Z" fill="#5faa42"/>
    <path d="M19,22Q32,17 45,22L36,52Q34,58 32,58Q30,58 28,52Z" fill="url(#rt)"/>
    <path d="M19,22Q32,17 45,22L40,33Q30,27 21,31Z" fill="#ffffff" opacity="0.2"/>
    <g stroke="${shade('#933a08', -0.2)}" stroke-width="1.7" stroke-linecap="round" opacity="0.7" fill="none">
      <path d="M23,29L28,31M37,28L42,30M25,37L30,39M35,36L40,37M27,45L31,46M33,44L37,45"/>
    </g>
    <path d="M23,25Q27,22 32,22" fill="none" stroke="#ffd9b0" stroke-width="3"
          stroke-linecap="round" opacity="0.7"/>`),

  '🌽': svg(`
    <defs>
      ${lit('hb', [[0, '#ffe57a'], [0.45, '#f2c21c'], [1, '#b3860a']])}
      ${lit('hs', [[0, '#b6e07a'], [0.5, '#74b845'], [1, '#3d7a26']])}
    </defs>
    ${ground(32, 57, 16, 0.3)}
    <path d="M20,10Q14,26 20,44Q24,54 32,56Q16,56 10,40Q6,20 14,10Z" fill="url(#hs)"/>
    <path d="M44,10Q50,26 44,44Q40,54 32,56Q48,56 54,40Q58,20 50,10Z" fill="url(#hs)"/>
    <path d="M20,10Q14,26 20,44Q24,54 32,56V14Q26,10 20,10Z" fill="#ffffff" opacity="0.18"/>
    <path d="M32,4Q44,10 45,28Q46,48 33,56Q20,48 19,28Q20,10 32,4Z" fill="url(#hb)"/>
    <g fill="${shade('#b3860a', -0.3)}" opacity="0.75">
      ${Array.from({ length: 6 }, (_, col) => Array.from({ length: 7 }, (_, row) => {
  const x = 23 + col * 3.6;
  const y = 13 + row * 5.6;
  const dx = (x - 32) / 13;
  if (Math.abs(dx) > 1) return '';
  return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="1.7" ry="2.5"/>`;
}).join('')).join('')}
    </g>
    <g fill="#fff0a8" opacity="0.9">
      ${Array.from({ length: 6 }, (_, col) => Array.from({ length: 7 }, (_, row) => {
  const x = 23 + col * 3.6;
  const y = 13 + row * 5.6;
  const dx = (x - 32) / 13;
  if (Math.abs(dx) > 1) return '';
  return `<ellipse cx="${(x - 0.5).toFixed(1)}" cy="${(y - 0.8).toFixed(1)}" rx="1.3" ry="1.9"/>`;
}).join('')).join('')}
    </g>
    <path d="M27,8Q24,26 27,44" fill="none" stroke="#ffffff" stroke-width="3"
          stroke-linecap="round" opacity="0.35"/>`),

  '🎃': svg(`
    <defs>
      ${lit('pk', [[0, '#ffc266'], [0.4, '#f2871e'], [0.78, '#d15f0c'], [1, '#8f3d05']])}
      ${lit('em', [[0, '#ffe98a'], [1, '#f2a01c']], 0.4, 0.3, 0.7)}
    </defs>
    ${ground(32, 57, 19, 0.32)}
    <path d="M30,10Q34,4 40,6Q36,9 34,13Z" fill="#6f8a3a"/>
    <path d="M30,12L34,13" stroke="#4f6a26" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="32" cy="36" rx="26" ry="21" fill="url(#pk)"/>
    <ellipse cx="32" cy="36" rx="8.5" ry="21" fill="${shade('#d15f0c', -0.25)}" opacity="0.55"/>
    <ellipse cx="20" cy="36" rx="7" ry="21" fill="${shade('#d15f0c', -0.18)}" opacity="0.4"/>
    <ellipse cx="44" cy="36" rx="7" ry="21" fill="${shade('#d15f0c', -0.18)}" opacity="0.4"/>
    <path d="M10,30Q14,20 24,17" fill="none" stroke="#ffdda0" stroke-width="4"
          stroke-linecap="round" opacity="0.6"/>
    <path d="M20,30L29,26L27,37Z" fill="url(#em)"/>
    <path d="M44,30L35,26L37,37Z" fill="url(#em)"/>
    <path d="M19,44Q32,54 45,44Q42,50 37,47L35,43L29,47L27,43L25,47Q21,50 19,44Z" fill="url(#em)"/>
    <path d="M20,44Q32,52 44,44" fill="none" stroke="${shade('#8f3d05', -0.3)}" stroke-width="1.6"
          opacity="0.55"/>
    <ellipse cx="32" cy="36" rx="26" ry="21" fill="none" stroke="${shade('#8f3d05', -0.4)}"
             stroke-width="1.8" opacity="0.6"/>`),

  '🍇': svg(`
    <defs>
      ${lit('gp', [[0, '#d0a8f0'], [0.4, '#8a4fc0'], [0.78, '#5a2a8a'], [1, '#33155a']])}
      ${lit('lf', [[0, '#c4ec8a'], [0.5, '#74bc45'], [1, '#2f7a30']])}
    </defs>
    ${ground(32, 57, 15, 0.3)}
    <path d="M34,8Q44,4 50,10Q42,14 36,13Z" fill="url(#lf)"/>
    <path d="M34,8Q44,4 50,10Q44,11 38,11Z" fill="#ffffff" opacity="0.25"/>
    <path d="M34,10Q36,16 34,20" fill="none" stroke="#4f9a3a" stroke-width="3" stroke-linecap="round"/>
    <path d="M34,12Q40,10 42,4Q36,4 34,12Z" fill="#5faa42" opacity="0.9"/>
    ${[[26, 24], [38, 24], [32, 30], [22, 34], [32, 38], [42, 34], [27, 44],
  [37, 44], [32, 50], [32, 56]].map(([x, y], i) => `
      <circle cx="${x}" cy="${y}" r="7" fill="url(#gp)"/>
      <circle cx="${x - 2.2}" cy="${y - 2.4}" r="2.6" fill="#ffffff" opacity="0.55"/>`).join('')}
    <path d="M18,30Q20,26 24,25" fill="none" stroke="#e0c0ff" stroke-width="2.6"
          stroke-linecap="round" opacity="0.5"/>`),

  // ---- Market -------------------------------------------------------------

  '🥛': svg(`
    <defs>
      ${ramp('gl', [[0, '#ffffff', 0.75], [0.5, '#dceaf2', 0.4], [1, '#a9bfcd', 0.6]])}
      ${ramp('mk', [[0, '#ffffff'], [0.6, '#f6f8fa'], [1, '#dfe5ec']], 0, 0, 0.4, 1)}
    </defs>
    ${ground(32, 57, 13, 0.3)}
    <path d="M21,8H43L41,52Q41,57 36,57H28Q23,57 23,52Z" fill="url(#gl)"/>
    <path d="M22,22H42L40.5,52Q40.5,56 36,56H28Q23.5,56 23.5,52Z" fill="url(#mk)"/>
    <path d="M22,22Q32,19 42,22Q32,26 22,22Z" fill="#ffffff"/>
    <ellipse cx="32" cy="22" rx="10" ry="2.6" fill="#ffffff"/>
    <ellipse cx="32" cy="22" rx="10" ry="2.6" fill="none" stroke="#c3d2de" stroke-width="1.2"/>
    <path d="M26,26V52" stroke="#ffffff" stroke-width="4" opacity="0.9"/>
    <path d="M38,28V50" stroke="#c3d2de" stroke-width="2.4" opacity="0.7"/>
    <path d="M21,8H43L41,52Q41,57 36,57H28Q23,57 23,52Z" fill="none" stroke="#93a6b5"
          stroke-width="1.7"/>
    <ellipse cx="32" cy="8" rx="11" ry="3" fill="#f2f6f9"/>
    <ellipse cx="32" cy="8" rx="11" ry="3" fill="none" stroke="#93a6b5" stroke-width="1.7"/>
    <ellipse cx="32" cy="8" rx="7.5" ry="1.8" fill="#ffffff"/>`),

  '🧈': svg(`
    <defs>
      ${lit('bt', [[0, '#fff6c8'], [0.45, '#f7dd7a'], [1, '#d8b13c']])}
      ${ramp('fo', [[0, '#f4f7fa'], [0.45, '#c4ccd6'], [1, '#8d97a4']], 0.2, 0, 0.8, 1)}
    </defs>
    ${ground(32, 57, 18, 0.3)}
    <path d="M6,50L20,44H58L46,56H14Z" fill="url(#fo)"/>
    <path d="M6,50L20,44H36L24,56H14Z" fill="#ffffff" opacity="0.4"/>
    <path d="M20,44L32,26H60L48,44Z" fill="${shade('#8d97a4', 0.15)}"/>
    <path d="M8,26H44L46,46H6Z" fill="url(#bt)"/>
    <path d="M8,26H44L45,34H7Z" fill="#ffffff" opacity="0.42"/>
    <path d="M8,26H44L46,46H6Z" fill="none" stroke="${shade('#d8b13c', -0.35)}" stroke-width="1.7"/>
    <path d="M28,34L46,34L46,46" fill="none" stroke="${shade('#d8b13c', -0.45)}" stroke-width="1.7"/>
    <path d="M28,34L30,46" stroke="${shade('#d8b13c', -0.45)}" stroke-width="1.7"/>
    <path d="M12,30H24" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.85"/>
    <path d="M6,26L8,46" stroke="#ffffff" stroke-width="2" opacity="0.5"/>`),

  // ---- Interface marks ----------------------------------------------------

  '🛠️': svg(`
    <defs>
      ${ramp('st', [[0, '#eef2f6'], [0.42, '#aeb8c4'], [0.75, '#78828f'], [1, '#4d545e']])}
      ${ramp('wd', [[0, '#e0a86a'], [0.5, '#b07a3e'], [1, '#7d5326']])}
    </defs>
    ${ground(32, 57, 18, 0.32)}
    <g transform="rotate(40 32 34)">
      <path d="M27,4H37V16Q37,22 32,22Q27,22 27,16Z" fill="url(#st)"/>
      <rect x="28.5" y="20" width="7" height="34" rx="3" fill="url(#wd)"/>
      <rect x="28.5" y="20" width="3" height="34" fill="#ffffff" opacity="0.3"/>
      <rect x="27" y="48" width="10" height="7" rx="2" fill="${shade('#7d5326', -0.25)}"/>
      <path d="M27,10H37" stroke="${shade('#4d545e', -0.4)}" stroke-width="1.6"/>
    </g>
    <g transform="rotate(-40 32 34)">
      <path d="M22,4H42L38,14H26Z" fill="url(#st)"/>
      <path d="M22,4H32L28,14H26Z" fill="#ffffff" opacity="0.35"/>
      <rect x="28" y="12" width="8" height="40" rx="3.5" fill="url(#wd)"/>
      <rect x="28" y="12" width="3.4" height="40" fill="#ffffff" opacity="0.3"/>
      <rect x="27" y="44" width="10" height="9" rx="3" fill="${shade('#4d545e', -0.1)}"/>
      <rect x="27" y="44" width="10" height="3" rx="1.5" fill="#ffffff" opacity="0.4"/>
    </g>`),

  '♻️': svg(`
    <defs>${lit('g', [[0, '#c4ec8a'], [0.45, '#5faa42'], [1, '#1f6e2c']])}</defs>
    ${ground(32, 56, 16, 0.28)}
    ${[0, 120, 240].map((deg) => `
      <g transform="rotate(${deg} 32 34)">
        <path d="M32,10L42,27H22Z" fill="none" stroke="url(#g)" stroke-width="7"
              stroke-linejoin="round" stroke-linecap="round"/>
        <path d="M32,10L38,21L30,23Z" fill="url(#g)"/>
        <path d="M24,25H38" stroke="url(#g)" stroke-width="7" stroke-linecap="round"/>
      </g>`).join('')}
    <path d="M32,10L36,17" stroke="#eaffd0" stroke-width="2.6" stroke-linecap="round" opacity="0.7"/>`),

  '👋': svg(`
    <defs>${lit('s', SKIN)}</defs>
    ${ground(32, 57, 16, 0.26)}
    <g transform="rotate(-14 32 40)">
      <rect x="24" y="6" width="9.5" height="30" rx="4.7" fill="url(#s)"/>
      <rect x="33" y="8" width="9" height="28" rx="4.5" fill="url(#s)"/>
      <rect x="15" y="12" width="9" height="24" rx="4.5" fill="url(#s)" transform="rotate(-16 19.5 24)"/>
      <rect x="41" y="16" width="8.5" height="22" rx="4.2" fill="url(#s)" transform="rotate(18 45 27)"/>
      <path d="M16,34H48V46Q48,58 35,58H29Q16,58 16,46Z" fill="url(#s)"/>
      <path d="M19,38Q23,34 28,34" fill="none" stroke="#ffffff" stroke-width="2.8"
            stroke-linecap="round" opacity="0.45"/>
      <path d="M26,8Q30,5 33,9" fill="none" stroke="#fff2e4" stroke-width="2.6"
            stroke-linecap="round" opacity="0.8"/>
    </g>
    <g fill="none" stroke="#7fb8e8" stroke-width="3" stroke-linecap="round" opacity="0.85">
      <path d="M8,16Q5,26 7,36"/>
      <path d="M56,16Q59,26 57,36"/>
    </g>`),

  '🏅': svg(`
    <defs>
      ${lit('g', [[0, '#fff3c4'], [0.4, '#f2c94c'], [0.78, '#cf9618'], [1, '#8a5c05']])}
      ${ramp('rb', [[0, '#e05a72'], [1, '#8f1f34']])}
      ${ramp('rb2', [[0, '#4a90d9'], [1, '#1f4a78']])}
    </defs>
    ${ground(32, 58, 14, 0.32)}
    <path d="M15,3L30,3L35,30L26,34Z" fill="url(#rb)"/>
    <path d="M49,3L34,3L29,30L38,34Z" fill="url(#rb2)"/>
    <path d="M15,3H30L32,16H18Z" fill="#ffffff" opacity="0.2"/>
    <circle cx="32" cy="44" r="17" fill="url(#g)"/>
    <circle cx="32" cy="44" r="17" fill="none" stroke="${shade('#8a5c05', -0.35)}" stroke-width="1.8"/>
    <circle cx="32" cy="44" r="13" fill="none" stroke="${shade('#8a5c05', -0.15)}" stroke-width="1.5"
            opacity="0.85"/>
    <path d="M32,34L35,41.5L43,42.4L37,47.8L38.8,55.6L32,51.5L25.2,55.6L27,47.8L21,42.4L29,41.5Z"
          fill="${shade('#fff3c4', 0.1)}"/>
    <path d="M23,38Q25,33 31,32" fill="none" stroke="#ffffff" stroke-width="3"
          stroke-linecap="round" opacity="0.75"/>`),

  '💸': svg(`
    <defs>
      ${ramp('nt', [[0, '#c8ecc0'], [0.5, '#8fd08a'], [1, '#4f9a5a']], 0.2, 0, 0.8, 1)}
      ${ramp('wg', [[0, '#ffffff'], [0.5, '#e6ecf2'], [1, '#b6c0cb']], 0, 0, 1, 0.4)}
    </defs>
    ${ground(32, 56, 17, 0.28)}
    <path d="M8,26L26,20L30,34L12,42Q8,43 8,39Z" fill="url(#wg)"/>
    <path d="M8,26L26,20L28,27L10,33Z" fill="#ffffff"/>
    <path d="M56,26L38,20L34,34L52,42Q56,43 56,39Z" fill="url(#wg)"/>
    <path d="M56,26L38,20L36,27L54,33Z" fill="#ffffff"/>
    <g transform="rotate(-8 32 38)">
      <rect x="15" y="27" width="34" height="22" rx="3" fill="url(#nt)"/>
      <rect x="15" y="27" width="34" height="22" rx="3" fill="none" stroke="${shade('#4f9a5a', -0.4)}"
            stroke-width="1.7"/>
      <rect x="19" y="31" width="26" height="14" rx="1.5" fill="none" stroke="${shade('#4f9a5a', -0.45)}"
            stroke-width="1.3" stroke-dasharray="3 2"/>
      <circle cx="32" cy="38" r="5.5" fill="${shade('#4f9a5a', -0.35)}" opacity="0.7"/>
      <path d="M32,34V42M30,36Q30,34.8 32,34.8Q34,34.8 34,36.4Q34,38 32,38Q30,38 30,39.6Q30,41.2 32,41.2Q34,41.2 34,40"
            fill="none" stroke="#eaffd0" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M18,30Q20,29 24,29" fill="none" stroke="#ffffff" stroke-width="2.4"
            stroke-linecap="round" opacity="0.7"/>
    </g>`),

  '⚠️': svg(`
    <defs>
      ${ramp('tr', [[0, '#ffd466'], [0.45, '#f2a01c'], [1, '#b36a00']], 0.2, 0, 0.8, 1)}
      ${ramp('ed', [[0, '#ffe9a8'], [1, '#8f5a00']], 0, 0, 0.6, 1)}
    </defs>
    ${ground(32, 57, 17, 0.3)}
    <path d="M32,6Q34,6 35.4,8.6L57,46Q58.6,49 56,49H8Q5.4,49 7,46L28.6,8.6Q30,6 32,6Z" fill="url(#tr)"/>
    <path d="M32,6Q34,6 35.4,8.6L57,46Q58.6,49 56,49H32Z" fill="${shade('#b36a00', -0.15)}" opacity="0.35"/>
    <path d="M32,6Q34,6 35.4,8.6L57,46Q58.6,49 56,49H8Q5.4,49 7,46L28.6,8.6Q30,6 32,6Z"
          fill="none" stroke="url(#ed)" stroke-width="3"/>
    <rect x="28.6" y="22" width="6.8" height="17" rx="3.4" fill="#3a2408"/>
    <circle cx="32" cy="45" r="4.2" fill="#3a2408"/>
    <path d="M29.8,25Q31,23 32,25" fill="none" stroke="#ffe9a8" stroke-width="2"
          stroke-linecap="round" opacity="0.8"/>
    <path d="M18,20Q22,14 30,12" fill="none" stroke="#fff6dd" stroke-width="4"
          stroke-linecap="round" opacity="0.65"/>`),

  '📋': svg(`
    <defs>
      ${ramp('bd', [[0, '#ffffff'], [0.5, '#f0f3f7'], [1, '#cfd6e0']], 0.1, 0, 0.9, 1)}
      ${ramp('cl', [[0, '#eef2f6'], [0.5, '#b6c0cb'], [1, '#78828f']])}
    </defs>
    ${ground(32, 57, 17, 0.3)}
    <rect x="11" y="8" width="42" height="50" rx="4" fill="url(#bd)"/>
    <rect x="11" y="8" width="42" height="50" rx="4" fill="none" stroke="${shade('#cfd6e0', -0.4)}"
          stroke-width="1.8"/>
    <rect x="15" y="14" width="34" height="40" rx="2" fill="#f8fafc"/>
    <rect x="25" y="4" width="14" height="10" rx="3" fill="url(#cl)"/>
    <rect x="27" y="6" width="10" height="3" rx="1.5" fill="#ffffff" opacity="0.7"/>
    <g stroke="${shade('#78828f', -0.25)}" stroke-width="1.4" stroke-linecap="round" opacity="0.55">
      <path d="M20,24H44M20,31H44M20,38H40"/>
    </g>
    <path d="M20,45H28" stroke="#4f9a5a" stroke-width="3" stroke-linecap="round"/>
    <path d="M15,14H30" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.9"/>
    <path d="M13,44Q13,56 24,57" fill="none" stroke="#ffffff" stroke-width="2.4" opacity="0.6"/>`),

  '✅': svg(`
    <defs>
      ${lit('sq', [[0, '#a8e6a0'], [0.42, '#4fbb5f'], [0.8, '#1f8a45'], [1, '#0e5c2c']], 0.3, 0.25, 0.85)}
      ${ramp('ck', [[0, '#ffffff'], [1, '#d8f5e0']], 0, 0, 0.5, 1)}
    </defs>
    ${ground(32, 57, 16, 0.3)}
    <rect x="7" y="8" width="50" height="50" rx="12" fill="url(#sq)"/>
    <rect x="7" y="8" width="50" height="50" rx="12" fill="none" stroke="${shade('#0e5c2c', -0.2)}"
          stroke-width="2"/>
    <path d="M7,20Q7,8 19,8H34L7,36Z" fill="#ffffff" opacity="0.22"/>
    <path d="M18,33L27,42L46,22" fill="none" stroke="url(#ck)" stroke-width="7.5"
          stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M18,31.5L27,40.5L46,20.5" fill="none" stroke="#ffffff" stroke-width="3"
          stroke-linecap="round" stroke-linejoin="round" opacity="0.75"/>`),

  '🗑️': svg(`
    <defs>
      ${ramp('bn', [[0, '#eef2f6'], [0.4, '#b6c0cb'], [0.75, '#8d97a4'], [1, '#5f6773']], 0.1, 0, 0.9, 1)}
      ${ramp('ld', [[0, '#f4f7fa'], [1, '#a3adb9']], 0, 0, 1, 0.35)}
    </defs>
    ${ground(32, 58, 16, 0.32)}
    <path d="M16,18H48L45,54Q44.6,58 41,58H23Q19.4,58 19,54Z" fill="url(#bn)"/>
    <path d="M16,18H32L31,58H23Q19.4,58 19,54Z" fill="#ffffff" opacity="0.3"/>
    <g stroke="${shade('#5f6773', -0.4)}" stroke-width="1.8" stroke-linecap="round" opacity="0.65">
      <path d="M24,24L25.5,54M32,24V58M40,24L38.5,54"/>
    </g>
    <rect x="12" y="12" width="40" height="7" rx="3.5" fill="url(#ld)"/>
    <rect x="12" y="12" width="40" height="2.6" rx="1.3" fill="#ffffff" opacity="0.75"/>
    <rect x="27" y="5" width="10" height="7" rx="3.5" fill="url(#ld)"/>
    <rect x="27" y="5" width="10" height="2.6" rx="1.3" fill="#ffffff" opacity="0.8"/>
    <path d="M16,18H48" stroke="${shade('#5f6773', -0.45)}" stroke-width="1.6" opacity="0.7"/>
    <path d="M21,26L23,50" stroke="#ffffff" stroke-width="3" opacity="0.5"/>`),

  '❓': svg(`
    <defs>${lit('q', [[0, '#e9f6ff'], [0.45, '#8fc0e8'], [0.8, '#3f7fbf'], [1, '#1f4a78']])}</defs>
    ${ground(32, 57, 15, 0.3)}
    <path d="M17,24Q17,9 32,9Q47,9 47,23Q47,33 37,38Q34,40 34,45V48H25V44Q25,36 31,31
             Q37,27 37,22Q37,17 32,17Q27,17 27,23Z" fill="url(#q)"/>
    <path d="M17,24Q17,9 32,9Q40,9 44,13Q34,11 27,17Q21,23 21,30Q22,24 27,20Q33,15 40,16
             Q37,12 32,12Q21,12 17,24Z" fill="#ffffff" opacity="0.4"/>
    <path d="M17,24Q17,9 32,9Q47,9 47,23Q47,33 37,38Q34,40 34,45V48H25V44Q25,36 31,31
             Q37,27 37,22Q37,17 32,17Q27,17 27,23Z"
          fill="none" stroke="${shade('#1f4a78', -0.3)}" stroke-width="2"/>
    <circle cx="29.5" cy="55" r="6" fill="url(#q)"/>
    <circle cx="29.5" cy="55" r="6" fill="none" stroke="${shade('#1f4a78', -0.3)}" stroke-width="2"/>
    <path d="M27,13Q24,17 24,22" fill="none" stroke="#dff1ff" stroke-width="3"
          stroke-linecap="round" opacity="0.75"/>`),

  // ---- Chrome -------------------------------------------------------------
  //
  // Nothing the tables ask for -- these are the marks index.html swaps in on
  // boot and the five themes named after a place or a sky rather than a thing.
  // They live here with the other interface marks so that "the emoji in the
  // string and the drawing on the screen" has exactly one home.

  '🛒': (() => {
    const st = [[0, '#f4f8fc'], [0.4, '#c2ccd8'], [0.75, '#8b95a3'], [1, '#5a616c']];
    return svg(`
    <defs>${ramp('st', st, 0, 0, 1, 0.4)}</defs>
    ${ground(32, 59, 17, 0.26)}
    <g fill="none" stroke="url(#st)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7,13H15"/>
      <path d="M15,13L21,51H53"/>
      <path d="M16,23H57L51,49H22Z"/>
    </g>
    <g fill="none" stroke="url(#st)" stroke-width="1.7" stroke-linecap="round" opacity="0.7">
      <path d="M21,32H55M23,41H53"/>
      <path d="M29,23L32,49M41,23L43,49"/>
    </g>
    <g fill="url(#st)">
      <circle cx="27" cy="55.5" r="4.6"/><circle cx="47" cy="55.5" r="4.6"/>
    </g>
    <g fill="#3a4049">
      <circle cx="27" cy="55.5" r="1.9"/><circle cx="47" cy="55.5" r="1.9"/>
    </g>
    <path d="M19,26H54" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" opacity="0.65"/>`);
  })(),

  '⚙️': (() => {
    const teeth = Array.from({ length: 8 }, (_, i) =>
      `<rect x="29.2" y="4" width="5.6" height="15" rx="2.4" transform="rotate(${i * 45} 32 32)"/>`)
      .join('');
    return svg(`
    <defs>${lit('m', [[0, '#f4f8fc'], [0.38, '#c8d2de'], [0.72, '#8b95a3'], [1, '#5a616c']])}</defs>
    ${ground(32, 57, 17, 0.32)}
    <g fill="url(#m)">${teeth}<circle cx="32" cy="32" r="21"/></g>
    <circle cx="32" cy="32" r="16.5" fill="none" stroke="${shade('#5a616c', -0.45)}" stroke-width="1.8"
            opacity="0.65"/>
    <circle cx="32" cy="32" r="9" fill="#3a4049"/>
    <circle cx="32" cy="32" r="9" fill="none" stroke="${shade('#5a616c', -0.2)}" stroke-width="2.2"/>
    <path d="M17,24Q21,17 30,15" fill="none" stroke="#ffffff" stroke-width="3.6"
          stroke-linecap="round" opacity="0.85"/>
    <path d="M46,44Q44,49 38,52" fill="none" stroke="#ffffff" stroke-width="2.4"
          stroke-linecap="round" opacity="0.35"/>`);
  })(),

  '🔍': svg(`
    <defs>
      ${ramp('st', [[0, '#f4f8fc'], [0.4, '#c2ccd8'], [0.75, '#8b95a3'], [1, '#5a616c']], 0, 0, 1, 0.4)}
      ${lit('gl', [[0, '#ffffff', 0.92], [0.5, '#d4eaf6', 0.6], [1, '#93bcd8', 0.72]])}
    </defs>
    ${ground(32, 58, 17, 0.3)}
    <path d="M38,38L55,55" stroke="url(#st)" stroke-width="9.5" stroke-linecap="round"/>
    <path d="M38,38L50,50" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
    <circle cx="26" cy="26" r="17" fill="url(#gl)"/>
    <circle cx="26" cy="26" r="17" fill="none" stroke="url(#st)" stroke-width="5.5"/>
    <circle cx="26" cy="26" r="13.5" fill="none" stroke="${shade('#5a616c', -0.4)}" stroke-width="1.6"
            opacity="0.45"/>
    <path d="M15,21Q18,14 26,13" fill="none" stroke="#ffffff" stroke-width="4.4"
          stroke-linecap="round" opacity="0.9"/>
    <path d="M36,34Q38,38 38,42" fill="none" stroke="#ffffff" stroke-width="2.6"
          stroke-linecap="round" opacity="0.5"/>`),

  '🔤': svg(`
    <defs>${ramp('a', [[0, '#f2f7fb'], [0.45, '#a9b6c6'], [1, '#5d6979']], 0, 0, 1, 1)}</defs>
    ${ground(32, 57, 18, 0.3)}
    <g fill="none" stroke="url(#a)" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9,50L22,11L35,50" stroke-width="8.5"/>
      <path d="M15,36H29" stroke-width="7.5"/>
      <path d="M38,50L46,26L54,50" stroke-width="6"/>
      <path d="M41,42H49" stroke-width="5.5"/>
    </g>
    <path d="M15,44L20,29" fill="none" stroke="#ffffff" stroke-width="2.6"
          stroke-linecap="round" opacity="0.55"/>`),

  '💾': svg(`
    <defs>
      ${ramp('bd', [[0, '#9fc0e0'], [0.45, '#5f87b4'], [1, '#31506f']], 0.15, 0, 0.85, 1)}
      ${ramp('sh', [[0, '#f6f8fa'], [0.5, '#c4ccd6'], [1, '#78828f']], 0, 0, 1, 0.4)}
      ${ramp('lb', [[0, '#ffffff'], [1, '#dde3ea']], 0, 0, 0.5, 1)}
    </defs>
    ${ground(32, 58, 16, 0.32)}
    <path d="M8,11Q8,7 12,7H44L56,19V53Q56,57 52,57H12Q8,57 8,53Z" fill="url(#bd)"/>
    <path d="M8,11Q8,7 12,7H44L56,19V30H8Z" fill="#ffffff" opacity="0.16"/>
    <path d="M8,11Q8,7 12,7H44L56,19" fill="none" stroke="${shade('#31506f', -0.3)}" stroke-width="1.7"/>
    <rect x="20" y="7" width="23" height="21" rx="2.5" fill="url(#sh)"/>
    <rect x="20" y="7" width="23" height="5" fill="#ffffff" opacity="0.6"/>
    <rect x="25.5" y="12" width="7" height="15" rx="1.5" fill="#4d545e"/>
    <rect x="14" y="34" width="36" height="20" rx="2.5" fill="url(#lb)"/>
    <g fill="none" stroke="#8d97a4" stroke-width="1.7" stroke-linecap="round" opacity="0.85">
      <path d="M18,40H46M18,45H46M18,50H34"/>
    </g>
    <rect x="8" y="34" width="7" height="20" fill="#31506f" opacity="0.35"/>
    <path d="M12,10Q13,8 16,8" fill="none" stroke="#ffffff" stroke-width="2.6"
          stroke-linecap="round" opacity="0.75"/>`),

  // ---- Theme scenery ------------------------------------------------------

  '🏝️': svg(`
    <defs>
      ${ramp('sea', [[0, '#8fe4f5'], [0.5, '#2fa8cc'], [1, '#116a90']], 0.3, 0, 0.7, 1)}
      ${lit('sand', [[0, '#fff3d4'], [0.5, '#f0d296'], [1, '#c19a55']])}
      ${lit('fr', [[0, '#a8e08a'], [0.5, '#5faa42'], [1, '#2f7a30']])}
      ${ramp('tr', [[0, '#d0a06a'], [1, '#7d5326']], 0, 0, 1, 0.6)}
    </defs>
    ${ground(32, 58, 19, 0.3)}
    <ellipse cx="32" cy="51" rx="27" ry="10" fill="url(#sea)"/>
    <path d="M11,51Q14,33 32,32Q50,33 53,51Q32,59 11,51Z" fill="url(#sand)"/>
    <path d="M11,51Q14,33 32,32Q24,40 22,55Q15,54 11,51Z" fill="#ffffff" opacity="0.22"/>
    <path d="M34,45Q38,32 33,22" fill="none" stroke="url(#tr)" stroke-width="4.6" stroke-linecap="round"/>
    <path d="M33,22Q25,17 16,22Q25,26 33,22Z" fill="url(#fr)"/>
    <path d="M33,22Q41,17 50,22Q41,26 33,22Z" fill="url(#fr)"/>
    <path d="M33,22Q30,13 23,9Q32,14 34,21Z" fill="url(#fr)"/>
    <path d="M33,22Q38,13 46,10Q37,15 32,21Z" fill="url(#fr)"/>
    <circle cx="31" cy="25" r="2.5" fill="#8a6030"/>
    <circle cx="35.5" cy="25.5" r="2.5" fill="#6f4619"/>
    <path d="M20,36Q26,33 33,33" fill="none" stroke="#fff8e2" stroke-width="3"
          stroke-linecap="round" opacity="0.6"/>`),

  '🌙': (() => {
    // Outer edge is the left half of a circle; inner edge is a shallower arc
    // bending the same way, which is what makes the two ends meet in points.
    const crescent = 'M34,7A25,25 0 1 0 34,57A31,31 0 0 0 34,7Z';
    return svg(`
    <defs>${lit('m', [[0, '#fffef2'], [0.42, '#f2ecda'], [0.78, '#cbc4b0'], [1, '#8e8776']])}</defs>
    ${ground(28, 59, 14, 0.3)}
    <path d="${crescent}" fill="url(#m)"/>
    <g fill="#b3ab96" opacity="0.7">
      <circle cx="17" cy="22" r="3.4"/><circle cx="15" cy="41" r="2.7"/><circle cx="19" cy="32" r="2.2"/>
    </g>
    <path d="M31,11Q21,17 17,29" fill="none" stroke="#ffffff" stroke-width="4"
          stroke-linecap="round" opacity="0.8"/>
    <path d="M33,53Q25,50 21,43" fill="none" stroke="#ffffff" stroke-width="2.6"
          stroke-linecap="round" opacity="0.45"/>`);
  })(),

  '🌸': (() => {
    const petal = `<path d="M32,33Q23,27 25,16Q32,5 39,16Q41,27 32,33Z"/>`;
    const spins = [0, 72, 144, 216, 288].map((d) =>
      `<g transform="rotate(${d} 32 32)">${petal}</g>`).join('');
    return svg(`
    <defs>${lit('p', [[0, '#fff4f8'], [0.45, '#ffc2d6'], [1, '#e8618a']])}</defs>
    ${ground(32, 57, 15, 0.28)}
    <g fill="url(#p)">${spins}</g>
    <g fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity="0.55">
      ${[0, 72, 144, 216, 288].map((d) =>
  `<g transform="rotate(${d} 32 32)"><path d="M32,30Q28,24 28,17"/></g>`).join('')}
    </g>
    <circle cx="32" cy="32" r="7" fill="#ffd166"/>
    <circle cx="32" cy="32" r="7" fill="none" stroke="#c98a12" stroke-width="1.4" opacity="0.7"/>
    <g fill="#a86a08">
      <circle cx="32" cy="28.5" r="1.5"/><circle cx="35.2" cy="31" r="1.5"/>
      <circle cx="33.8" cy="35" r="1.5"/><circle cx="30.2" cy="35" r="1.5"/>
      <circle cx="28.8" cy="31" r="1.5"/>
    </g>
    <circle cx="29.8" cy="29.6" r="1.8" fill="#fff2c4" opacity="0.85"/>`);
  })(),

  '🌿': (() => {
    // One leaf shape, placed five times along a stem that leans as it rises.
    const leaf = 'M0,0Q10,-9 22,-3Q12,4 0,0Z';
    const sprig = [
      { x: 31, y: 46, r: -32 },
      { x: 33, y: 37, r: 34 },
      { x: 32, y: 29, r: -28 },
      { x: 34, y: 21, r: 36 },
    ].map(({ x, y, r }) =>
      `<path d="${leaf}" transform="translate(${x} ${y}) rotate(${r})"/>`).join('');
    return svg(`
    <defs>${lit('lf', [[0, '#b6e88f'], [0.45, '#5faa42'], [1, '#256a28']])}</defs>
    ${ground(32, 57, 15, 0.3)}
    <path d="M30,57Q28,45 32,34Q35,24 37,14" fill="none" stroke="#3f8a34" stroke-width="3.6"
          stroke-linecap="round"/>
    <g fill="url(#lf)">${sprig}
      <path d="${leaf}" transform="translate(36 18) rotate(-150)"/>
      <path d="M37,14Q44,5 53,8Q46,17 37,14Z"/>
    </g>
    <g fill="none" stroke="#e6ffd0" stroke-width="1.3" stroke-linecap="round" opacity="0.6">
      <path d="M33,44Q39,41 44,43M35,33Q41,31 45,33"/>
    </g>`);
  })(),

  '☀️': (() => {
    const rays = Array.from({ length: 8 }, (_, i) =>
      `<rect x="29.5" y="4" width="5" height="15" rx="2.5" transform="rotate(${i * 45} 32 32)"/>`)
      .join('');
    return svg(`
    <defs>${lit('s', [[0, '#fffbe0'], [0.4, '#ffe066'], [0.75, '#f2a01c'], [1, '#c05f00']])}</defs>
    ${ground(32, 57, 16, 0.26)}
    <g fill="url(#s)">${rays}<circle cx="32" cy="32" r="14.5"/></g>
    <circle cx="32" cy="32" r="14.5" fill="none" stroke="${shade('#c05f00', -0.3)}" stroke-width="1.8"
            opacity="0.55"/>
    <path d="M24,25Q27,20 33,19" fill="none" stroke="#fffdf0" stroke-width="3.6"
          stroke-linecap="round" opacity="0.9"/>
    <circle cx="37" cy="37" r="4" fill="#fff2b0" opacity="0.45"/>`);
  })(),
};

/**
 * Awards: the achievement badges, the count medals, and the padlock that stands
 * in for one you have not earned.
 *
 * These are shown in two states — earned and locked — and the locked state is a
 * filter laid over the art, so the art itself must not already be dark or the
 * two states collapse into each other. That is why `🔒` is drawn as a bright
 * brass lock rather than a grey one: the CSS supplies the grey.
 *
 * See `tools/ICON-ART.md`.
 */

import { alpha, shade } from './shape.js';

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

/**
 * One medal, three metals.
 *
 * The geometry is written once on purpose: bronze, silver and gold are the same
 * object in three palettes, and three hand-written copies would drift apart the
 * first time someone moved the ribbon.
 *
 * @param {string[]} ribbon two ribbon tones
 * @param {string[]} metal  [lit, local, shaded] for the disc
 */
const medal = ([r1, r2], [m1, m2, m3]) => `
  <defs>
    ${lit('m', [[0, m1], [0.45, m2], [1, m3]])}
    ${ramp('r', [[0, r1], [1, r2]], 0, 0, 0.6, 1)}
  </defs>
  ${ground(32, 58, 14, 0.3)}
  <path d="M15,4H29L34,27L27,29Z" fill="url(#r)"/>
  <path d="M49,4H35L30,27L37,29Z" fill="${shade(r2, -0.22)}"/>
  <path d="M15,4H29L32,17H20Z" fill="#ffffff" opacity="0.2"/>
  <circle cx="32" cy="43" r="17" fill="url(#m)"/>
  <circle cx="32" cy="43" r="17" fill="none" stroke="${shade(m3, -0.3)}" stroke-width="1.6"/>
  <circle cx="32" cy="43" r="13.5" fill="none" stroke="${shade(m3, -0.15)}" stroke-width="1.2" opacity="0.8"/>
  <path d="M32,32L35.2,39.4L43,40.2L37.2,45.6L38.9,53.4L32,49.4L25.1,53.4L26.8,45.6L21,40.2L28.8,39.4Z"
        fill="${shade(m1, 0.25)}" opacity="0.95"/>
  <path d="M23,36Q25,31 31,30" fill="none" stroke="#ffffff" stroke-width="3"
        stroke-linecap="round" opacity="0.7"/>`;

/** A hand made of separate digits plus a palm — used for the two hand badges. */
const palm = (fingers) => `
  <defs>${lit('s', SKIN)}</defs>
  ${ground(32, 57, 15, 0.26)}
  ${fingers}
  <path d="M17,33H47V44Q47,56 34,56H30Q17,56 17,44Z" fill="url(#s)"/>
  <path d="M20,36Q23,33 28,33" fill="none" stroke="#ffffff" stroke-width="2.6"
        stroke-linecap="round" opacity="0.42"/>`;

// ---------------------------------------------------------------------------

export const AWARD_ART = {
  '✌️': svg(palm(`
    <rect x="17" y="7" width="10.5" height="30" rx="5.2" fill="url(#s)" transform="rotate(-15 22 22)"/>
    <rect x="33" y="7" width="10.5" height="30" rx="5.2" fill="url(#s)" transform="rotate(13 38 22)"/>
    <path d="M19,12Q23,9 27,13" fill="none" stroke="#fff2e4" stroke-width="3" stroke-linecap="round" opacity="0.85"/>
    <path d="M35,13Q39,10 43,14" fill="none" stroke="#fff2e4" stroke-width="3" stroke-linecap="round" opacity="0.85"/>`)),

  '🖐️': svg(palm(`
    <rect x="12" y="12" width="9" height="26" rx="4.5" fill="url(#s)" transform="rotate(-26 16 25)"/>
    <rect x="21" y="5" width="9.5" height="33" rx="4.7" fill="url(#s)" transform="rotate(-7 25 21)"/>
    <rect x="31" y="5" width="9.5" height="33" rx="4.7" fill="url(#s)" transform="rotate(6 36 21)"/>
    <rect x="41" y="11" width="9" height="27" rx="4.5" fill="url(#s)" transform="rotate(24 45 24)"/>
    <path d="M18,10Q21,7 24,11" fill="none" stroke="#fff2e4" stroke-width="2.6" stroke-linecap="round" opacity="0.8"/>
    <path d="M27,5Q31,3 34,7" fill="none" stroke="#fff2e4" stroke-width="2.6" stroke-linecap="round" opacity="0.8"/>`)),

  '🏆': svg(`
    <defs>
      ${lit('g', [[0, '#fff3c4'], [0.4, '#f2c94c'], [0.78, '#cf9618'], [1, '#8a5c05']])}
      ${ramp('st', [[0, '#f0d089'], [1, '#9a6f1c']])}
    </defs>
    ${ground(32, 58, 15, 0.32)}
    <rect x="21" y="52" width="22" height="6" rx="2" fill="url(#st)"/>
    <rect x="25" y="45" width="14" height="8" rx="1.5" fill="${shade('#9a6f1c', -0.15)}"/>
    <rect x="25" y="45" width="14" height="3" fill="#ffffff" opacity="0.28"/>
    <path d="M28,45V36Q28,34 30,34H34Q36,34 36,36V45Z" fill="url(#st)"/>
    <path d="M17,10H47V22Q47,36 32,40Q17,36 17,22Z" fill="url(#g)"/>
    <path d="M17,10H32V40Q17,36 17,22Z" fill="#ffffff" opacity="0.16"/>
    <path d="M17,14Q9,14 9,22Q9,32 19,34" fill="none" stroke="url(#g)" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M47,14Q55,14 55,22Q55,32 45,34" fill="none" stroke="url(#g)" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M21,13Q23,11 27,11" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
    <path d="M32,17L35,24L42,25L37,30L38.5,37L32,33.5L25.5,37L27,30L22,25L29,24Z"
          fill="${shade('#f2c94c', 0.4)}" opacity="0.9"/>`),

  '🦾': svg(`
    <defs>
      ${ramp('mt', [[0, '#eef2f6'], [0.4, '#aeb8c4'], [0.72, '#78828f'], [1, '#4d545e']])}
      ${ramp('jr', [[0, '#9fe4ff'], [1, '#2f7fbf']])}
    </defs>
    ${ground(32, 57, 17, 0.32)}
    <rect x="24" y="48" width="24" height="10" rx="4" fill="url(#mt)"/>
    <rect x="24" y="48" width="24" height="3.5" rx="1.75" fill="#ffffff" opacity="0.35"/>
    <path d="M34,50L24,36" stroke="url(#mt)" stroke-width="12" stroke-linecap="round"/>
    <path d="M34,50L24,36" stroke="${shade('#4d545e', -0.3)}" stroke-width="3" stroke-linecap="round"
          opacity="0.45" transform="translate(3 3)"/>
    <circle cx="23" cy="34" r="7.5" fill="url(#jr)"/>
    <circle cx="23" cy="34" r="4" fill="${shade('#2f7fbf', -0.35)}"/>
    <path d="M23,34L33,20" stroke="url(#mt)" stroke-width="11" stroke-linecap="round"/>
    <path d="M33,20L38,13" stroke="url(#mt)" stroke-width="9" stroke-linecap="round"/>
    <circle cx="33" cy="20" r="6" fill="url(#jr)"/>
    <circle cx="33" cy="20" r="3" fill="${shade('#2f7fbf', -0.35)}"/>
    <path d="M35,15Q30,7 34,5Q38,4 38,10" fill="none" stroke="url(#mt)" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M39,16Q44,9 41,6Q38,5 37,10" fill="none" stroke="url(#mt)" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M26,44L36,30" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" opacity="0.4"/>`),

  '🥫': svg(`
    <defs>
      ${ramp('mt', [[0, '#f6f8fa'], [0.3, '#c4ccd6'], [0.62, '#8d97a4'], [1, '#5b636e']], 0, 0, 1, 0.15)}
      ${lit('lb', [[0, '#f6e2c4'], [0.5, '#e0b98a'], [1, '#a3763f']])}
    </defs>
    ${ground(32, 57, 15, 0.32)}
    <rect x="15" y="9" width="34" height="46" rx="4" fill="url(#mt)"/>
    <rect x="15" y="9" width="34" height="46" rx="4" fill="none" stroke="${shade('#5b636e', -0.4)}" stroke-width="1.6"/>
    <rect x="15" y="9" width="8" height="46" fill="#ffffff" opacity="0.45"/>
    <rect x="17" y="7" width="30" height="5" rx="2.5" fill="#d7dde4"/>
    <rect x="17" y="7" width="30" height="2" rx="1" fill="#ffffff" opacity="0.7"/>
    <rect x="15" y="20" width="34" height="4" fill="${shade('#5b636e', -0.35)}" opacity="0.55"/>
    <rect x="15" y="44" width="34" height="4" fill="${shade('#5b636e', -0.35)}" opacity="0.55"/>
    <rect x="18" y="25" width="28" height="18" rx="2" fill="url(#lb)"/>
    <path d="M22,31Q27,28 34,30M22,35Q29,33 36,35M22,39Q27,37 33,38"
          fill="none" stroke="${shade('#a3763f', -0.4)}" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>
    <ellipse cx="42" cy="14" rx="4" ry="3" fill="#ffffff" opacity="0.6"/>`),

  '💰': svg(`
    <defs>${lit('b', [[0, '#e6c07a'], [0.45, '#c4933f'], [1, '#7d5620']])}</defs>
    ${ground(32, 57, 17, 0.32)}
    <path d="M25,8Q32,5 39,8L37,16H27Z" fill="${shade('#7d5620', -0.2)}"/>
    <path d="M24,14Q14,26 13,38Q12,54 32,54Q52,54 51,38Q50,26 40,14Q32,11 24,14Z" fill="url(#b)"/>
    <path d="M24,14Q18,22 16,32Q20,20 30,16Z" fill="#ffffff" opacity="0.25"/>
    <path d="M24,17H40" stroke="${shade('#7d5620', -0.45)}" stroke-width="2.4" stroke-linecap="round"/>
    <g fill="none" stroke="${shade('#7d5620', -0.5)}" stroke-width="3" stroke-linecap="round">
      <path d="M32,27V45M27,31Q27,28 32,28Q37,28 37,32Q37,36 32,36Q27,36 27,40Q27,44 32,44Q37,44 37,41"/>
    </g>
    <path d="M22,24Q24,19 29,17" fill="none" stroke="#ffe9b8" stroke-width="3.4"
          stroke-linecap="round" opacity="0.6"/>`),

  '🗿': svg(`
    <defs>${ramp('r', [[0, '#a8a49a'], [0.4, '#87837a'], [0.75, '#615e57'], [1, '#413f3a']], 0.1, 0, 0.9, 1)}</defs>
    ${ground(32, 58, 17, 0.34)}
    <path d="M20,58L18,40Q16,20 24,11Q32,3 40,11Q48,20 46,40L44,58Z" fill="url(#r)"/>
    <path d="M20,58L18,40Q16,20 24,11Q30,4 32,4L32,58Z" fill="#ffffff" opacity="0.12"/>
    <path d="M22,20Q32,15 42,20L42,26Q32,22 22,26Z" fill="${shade('#413f3a', -0.25)}"/>
    <path d="M23,27Q32,24 41,27L39,33Q32,30 25,33Z" fill="${shade('#413f3a', -0.1)}"/>
    <path d="M32,27L37,44L27,44Z" fill="${shade('#615e57', 0.1)}"/>
    <path d="M32,27L34,44L30,44Z" fill="${shade('#413f3a', -0.3)}"/>
    <path d="M25,47Q32,51 39,47Q37,52 32,52Q27,52 25,47Z" fill="${shade('#413f3a', -0.35)}"/>
    <path d="M23,14Q27,9 33,8" fill="none" stroke="#ffffff" stroke-width="3.4"
          stroke-linecap="round" opacity="0.35"/>`),

  '👑': svg(`
    <defs>${lit('g', [[0, '#fff3c4'], [0.4, '#f2c94c'], [0.78, '#cf9618'], [1, '#8a5c05']])}</defs>
    ${ground(32, 57, 17, 0.32)}
    <path d="M8,46L12,18L23,31L32,12L41,31L52,18L56,46Z" fill="url(#g)"/>
    <path d="M8,46L12,18L23,31L32,12L32,46Z" fill="#ffffff" opacity="0.16"/>
    <rect x="8" y="46" width="48" height="9" rx="3" fill="url(#g)"/>
    <rect x="8" y="46" width="48" height="3" fill="#ffffff" opacity="0.35"/>
    <circle cx="12" cy="17" r="4" fill="url(#g)"/>
    <circle cx="52" cy="17" r="4" fill="url(#g)"/>
    <circle cx="32" cy="11" r="4.5" fill="url(#g)"/>
    <circle cx="32" cy="11" r="2.4" fill="#fff8dd" opacity="0.9"/>
    <circle cx="20" cy="50.5" r="3" fill="#d94f6a"/>
    <circle cx="32" cy="50.5" r="3" fill="#4fae94"/>
    <circle cx="44" cy="50.5" r="3" fill="#4a90d9"/>
    <g fill="#ffffff" opacity="0.55">
      <circle cx="19" cy="49.5" r="1"/><circle cx="31" cy="49.5" r="1"/><circle cx="43" cy="49.5" r="1"/>
    </g>
    <path d="M13,22Q16,19 20,24" fill="none" stroke="#fffbe8" stroke-width="3"
          stroke-linecap="round" opacity="0.75"/>`),

  '🕉️': svg(`
    <defs>${ramp('s', [[0, '#e9e2d4'], [0.45, '#c3b9a6'], [1, '#8b8271']])}</defs>
    ${ground(32, 57, 18, 0.3)}
    <circle cx="32" cy="32" r="26" fill="url(#s)"/>
    <circle cx="32" cy="32" r="26" fill="none" stroke="${shade('#8b8271', -0.4)}" stroke-width="2"/>
    <circle cx="32" cy="32" r="21" fill="${shade('#8b8271', -0.12)}"/>
    <g fill="none" stroke="${shade('#5f5749', -0.25)}" stroke-linecap="round">
      <path d="M17,37Q23,45 31,45Q39,45 41,37" stroke-width="3.4"/>
      <path d="M17,37Q23,29 31,29Q37,29 39,33" stroke-width="3.4"/>
      <path d="M41,37L46,33" stroke-width="3"/>
      <path d="M26,34Q30,30 34,34Q30,38 26,34Z" stroke-width="2.6"/>
      <path d="M43,26Q46,22 43,19Q40,22 43,26Z" stroke-width="3"/>
    </g>
    <g fill="none" stroke="#ffffff" stroke-width="1.1" opacity="0.4">
      <path d="M17,37Q23,45 31,45Q39,45 41,37"/>
      <path d="M43,26Q46,22 43,19Q40,22 43,26Z"/>
    </g>
    <path d="M16,20Q22,13 31,12" fill="none" stroke="#ffffff" stroke-width="4"
          stroke-linecap="round" opacity="0.4"/>`),

  '💠': svg(`
    <defs>${lit('g', [[0, '#e9ffff'], [0.35, '#7fdcea'], [0.72, '#2f9ec4'], [1, '#14557a']])}</defs>
    ${ground(32, 56, 15, 0.3)}
    <path d="M32,6L54,28L32,58L10,28Z" fill="url(#g)"/>
    <path d="M32,6L54,28L32,30Z" fill="#ffffff" opacity="0.4"/>
    <path d="M10,28L32,6L32,30Z" fill="#ffffff" opacity="0.18"/>
    <path d="M32,30L54,28L32,58Z" fill="${shade('#14557a', -0.25)}" opacity="0.55"/>
    <g fill="none" stroke="${alpha('#ffffff', 0.55)}" stroke-width="1.3">
      <path d="M10,28H54M32,6V58M10,28L32,30L54,28"/>
    </g>
    <path d="M32,11L42,27L32,25Z" fill="#ffffff" opacity="0.6"/>
    <path d="M18,26L32,12L28,27Z" fill="#ffffff" opacity="0.3"/>`),

  '🧁': svg(`
    <defs>
      ${ramp('wr', [[0, '#f0e3d0'], [0.4, '#d9c3a5'], [1, '#a68b68']])}
      ${lit('fr', [[0, '#ffe3ee'], [0.5, '#f9a7c3'], [1, '#d9638f']])}
    </defs>
    ${ground(32, 57, 16, 0.3)}
    <path d="M18,32H46L43,52Q42,57 37,57H27Q22,57 21,52Z" fill="url(#wr)"/>
    <g stroke="${shade('#a68b68', -0.45)}" stroke-width="1.5" opacity="0.7" fill="none">
      <path d="M25,34L27,55M32,34V57M39,34L37,55"/>
    </g>
    <path d="M18,32H32L31,57H27Q22,57 21,52Z" fill="#ffffff" opacity="0.22"/>
    <path d="M17,33Q15,24 22,21Q21,13 29,13Q31,7 38,9Q45,11 44,18Q50,21 47,28Q45,33 39,32Q35,36 29,34Q22,36 17,33Z"
          fill="url(#fr)"/>
    <path d="M20,27Q23,22 28,21" fill="none" stroke="#ffffff" stroke-width="3.4"
          stroke-linecap="round" opacity="0.75"/>
    <circle cx="34" cy="7" r="4.5" fill="#d93b4a"/>
    <path d="M34,3Q36,-1 40,0" fill="none" stroke="#4f7a2f" stroke-width="2" stroke-linecap="round"/>
    <circle cx="32.4" cy="5.4" r="1.6" fill="#ffffff" opacity="0.65"/>`),

  '💫': svg(`
    <defs>${lit('g', [[0, '#fffbe8'], [0.4, '#ffe066'], [0.8, '#f2a01c'], [1, '#a35f00']])}</defs>
    ${ground(32, 56, 15, 0.26)}
    <path d="M40,10Q44,26 56,30Q44,34 40,50Q36,34 24,30Q36,26 40,10Z" fill="url(#g)"/>
    <path d="M22,16Q24,25 31,27Q24,29 22,38Q20,29 13,27Q20,25 22,16Z" fill="url(#g)" opacity="0.75"/>
    <path d="M46,38Q47,43 52,44Q47,45 46,50Q45,45 40,44Q45,43 46,38Z" fill="url(#g)" opacity="0.6"/>
    <path d="M40,14Q41,24 38,29" fill="none" stroke="#fffdf0" stroke-width="2.6"
          stroke-linecap="round" opacity="0.8"/>
    <circle cx="24" cy="47" r="3" fill="url(#g)" opacity="0.85"/>`),

  '🔮': svg(`
    <defs>
      ${lit('gl', [[0, '#f4ffff'], [0.35, '#a9dff0'], [0.72, '#4f8fc0'], [1, '#1f4a78']])}
      ${lit('st', [[0, '#f0d089'], [1, '#9a6f1c']])}
    </defs>
    ${ground(32, 58, 16, 0.32)}
    <path d="M20,58Q18,52 24,50H40Q46,52 44,58Z" fill="url(#st)"/>
    <path d="M25,50Q26,44 32,44Q38,44 39,50Z" fill="${shade('#9a6f1c', -0.2)}"/>
    <circle cx="32" cy="29" r="22" fill="url(#gl)"/>
    <path d="M14,32A18,18 0 0 1 32,14" fill="none" stroke="#ffffff" stroke-width="5"
          stroke-linecap="round" opacity="0.75"/>
    <path d="M44,38A14,14 0 0 1 38,45" fill="none" stroke="#ffffff" stroke-width="3"
          stroke-linecap="round" opacity="0.4"/>
    <path d="M26,34Q32,28 40,30Q36,37 26,34Z" fill="#b48fff" opacity="0.7"/>
    <path d="M28,24Q33,20 38,23" fill="none" stroke="#d9f4ff" stroke-width="2.4"
          stroke-linecap="round" opacity="0.8"/>
    <circle cx="36" cy="33" r="2.2" fill="#ffffff" opacity="0.9"/>
    <circle cx="32" cy="29" r="22" fill="none" stroke="${shade('#1f4a78', -0.3)}" stroke-width="1.6" opacity="0.7"/>`),

  '🧺': svg(`
    <defs>
      ${ramp('wt', [[0, '#e2b678'], [0.45, '#bf8d4a'], [1, '#8a6030']])}
      ${ramp('wt2', [[0, '#c99a5c'], [1, '#8a6030']], 0, 0, 1, 0.4)}
    </defs>
    ${ground(32, 57, 18, 0.3)}
    <path d="M14,30Q32,20 50,30" fill="none" stroke="url(#wt2)" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M10,30H54L48,54Q47,58 43,58H21Q17,58 16,54Z" fill="url(#wt)"/>
    <path d="M10,30H32L31,58H21Q17,58 16,54Z" fill="#ffffff" opacity="0.18"/>
    <g stroke="${shade('#8a6030', -0.45)}" stroke-width="1.7" opacity="0.75" fill="none">
      <path d="M11,38H53M13,46H51M15,53H49"/>
      <path d="M20,31L23,57M31,31V58M44,31L41,57"/>
    </g>
    <rect x="8" y="27" width="48" height="6" rx="3" fill="${shade('#8a6030', -0.1)}"/>
    <rect x="8" y="27" width="48" height="2.2" rx="1.1" fill="#f2d4a4" opacity="0.7"/>`),

  '💱': svg(`
    <defs>${ramp('a', [[0, '#8fd6a0'], [1, '#2f8a52']])}</defs>
    ${ground(32, 56, 16, 0.28)}
    <path d="M14,26H42L36,18" fill="none" stroke="url(#a)" stroke-width="7"
          stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M14,26H42" fill="none" stroke="${shade('#2f8a52', -0.3)}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M50,38H22L28,46" fill="none" stroke="${shade('#2f8a52', -0.15)}" stroke-width="7"
          stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M50,38H22" fill="none" stroke="${shade('#2f8a52', -0.4)}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M14,26L22,32" stroke="url(#a)" stroke-width="7" stroke-linecap="round"/>
    <path d="M50,38L42,32" stroke="${shade('#2f8a52', -0.15)}" stroke-width="7" stroke-linecap="round"/>`),

  '📈': svg(`
    <defs>${ramp('b', [[0, '#9fe4ff'], [1, '#2f7fbf']], 0, 1, 1, 0)}</defs>
    ${ground(32, 56, 17, 0.3)}
    <rect x="9" y="8" width="46" height="44" rx="3" fill="#f4f7fa"/>
    <rect x="9" y="8" width="46" height="44" rx="3" fill="none" stroke="${shade('#c4ccd6', -0.3)}" stroke-width="1.6"/>
    <g stroke="${shade('#c4ccd6', -0.15)}" stroke-width="1.3" opacity="0.9">
      <path d="M9,44H55M9,34H55M9,24H55"/>
    </g>
    <path d="M14,45L24,35L31,40L43,24" fill="none" stroke="url(#b)" stroke-width="4"
          stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M43,24L47,27L42,30L45,25Z" fill="#2f7fbf"/>
    <path d="M37,24H48V34L43,29Z" fill="${shade('#2f7fbf', -0.15)}"/>
    <path d="M37,24H45L37,31Z" fill="#5fb8ff"/>
    <path d="M13,47L24,36" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.4"/>`),

  '🪙': svg(`
    <defs>${lit('g', [[0, '#fff6cf'], [0.38, '#ffd75f'], [0.75, '#e0a017'], [1, '#8c5a05']])}</defs>
    ${ground(32, 57, 15, 0.32)}
    <ellipse cx="34" cy="34" rx="20" ry="25" fill="${shade('#8c5a05', -0.25)}"/>
    <ellipse cx="31" cy="33" rx="20" ry="25" fill="url(#g)"/>
    <ellipse cx="31" cy="33" rx="20" ry="25" fill="none" stroke="${shade('#8c5a05', -0.35)}" stroke-width="1.8"/>
    <ellipse cx="31" cy="33" rx="15.5" ry="20" fill="none" stroke="${shade('#8c5a05', -0.2)}" stroke-width="1.6"
             opacity="0.85"/>
    <g stroke="${shade('#8c5a05', -0.4)}" stroke-width="1.4" opacity="0.65" fill="none">
      ${Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  const x1 = 31 + Math.cos(a) * 20;
  const y1 = 33 + Math.sin(a) * 25;
  const x2 = 31 + Math.cos(a) * 17;
  const y2 = 33 + Math.sin(a) * 21;
  return `<path d="M${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}"/>`;
}).join('')}
    </g>
    <path d="M31,24V42M26,28Q26,25 31,25Q36,25 36,29Q36,33 31,33Q26,33 26,37Q26,41 31,41Q36,41 36,38"
          fill="none" stroke="${shade('#8c5a05', -0.5)}" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M20,20Q23,14 30,12" fill="none" stroke="#fffbe8" stroke-width="4"
          stroke-linecap="round" opacity="0.8"/>`),

  '📊': svg(`
    <defs>
      ${ramp('b1', [[0, '#ffb3a0'], [1, '#d9553a']], 0, 0, 0, 1)}
      ${ramp('b2', [[0, '#a8e6a0'], [1, '#2f9e4f']], 0, 0, 0, 1)}
      ${ramp('b3', [[0, '#a8cff5'], [1, '#2f7fbf']], 0, 0, 0, 1)}
    </defs>
    ${ground(32, 57, 18, 0.3)}
    <rect x="9" y="9" width="46" height="42" rx="3" fill="#f4f7fa"/>
    <rect x="9" y="9" width="46" height="42" rx="3" fill="none" stroke="${shade('#c4ccd6', -0.3)}" stroke-width="1.6"/>
    <rect x="15" y="32" width="10" height="15" rx="1.5" fill="url(#b1)"/>
    <rect x="27" y="22" width="10" height="25" rx="1.5" fill="url(#b2)"/>
    <rect x="39" y="15" width="10" height="32" rx="1.5" fill="url(#b3)"/>
    <rect x="15" y="32" width="10" height="4" fill="#ffffff" opacity="0.4"/>
    <rect x="27" y="22" width="10" height="4" fill="#ffffff" opacity="0.4"/>
    <rect x="39" y="15" width="10" height="4" fill="#ffffff" opacity="0.4"/>
    <path d="M13,47H51" stroke="${shade('#c4ccd6', -0.4)}" stroke-width="2" stroke-linecap="round"/>`),

  '🎨': svg(`
    <defs>${ramp('pl', [[0, '#f4e6cf'], [0.5, '#dcbe95'], [1, '#a8825a']], 0.2, 0, 0.8, 1)}</defs>
    ${ground(32, 56, 17, 0.3)}
    <path d="M32,7Q54,7 55,30Q56,50 34,54Q26,55 25,48Q24,42 31,41Q37,40 37,34Q37,27 27,26Q10,25 10,30Q7,8 32,7Z"
          fill="url(#pl)"/>
    <path d="M32,7Q54,7 55,30L37,30Q37,20 27,26Q14,27 11,29Q9,9 32,7Z" fill="#ffffff" opacity="0.22"/>
    <path d="M32,7Q54,7 55,30Q56,50 34,54Q26,55 25,48Q24,42 31,41Q37,40 37,34Q37,27 27,26Q10,25 10,30Q7,8 32,7Z"
          fill="none" stroke="${shade('#a8825a', -0.4)}" stroke-width="1.7"/>
    <ellipse cx="30" cy="34" rx="6" ry="5.6" fill="#f4e6cf"/>
    <ellipse cx="30" cy="34" rx="6" ry="5.6" fill="none" stroke="${shade('#a8825a', -0.4)}" stroke-width="1.6"/>
    <ellipse cx="20" cy="17" rx="5" ry="4.6" fill="#d94f6a"/>
    <ellipse cx="33" cy="14" rx="5" ry="4.6" fill="#4a90d9"/>
    <ellipse cx="45" cy="21" rx="5" ry="4.6" fill="#4fae94"/>
    <ellipse cx="48" cy="35" rx="5" ry="4.6" fill="#f2b93b"/>
    <g fill="#ffffff" opacity="0.55">
      <ellipse cx="18.5" cy="15.5" rx="1.8" ry="1.5"/>
      <ellipse cx="31.5" cy="12.5" rx="1.8" ry="1.5"/>
      <ellipse cx="43.5" cy="19.5" rx="1.8" ry="1.5"/>
      <ellipse cx="46.5" cy="33.5" rx="1.8" ry="1.5"/>
    </g>`),

  '🥼': svg(`
    <defs>${ramp('c', [[0, '#ffffff'], [0.5, '#eef1f5'], [1, '#c3cbd6']], 0.1, 0, 0.9, 1)}</defs>
    ${ground(32, 58, 18, 0.3)}
    <path d="M22,7L32,15L42,7Q52,11 54,24L56,54Q56,58 52,58H12Q8,58 8,54L10,24Q12,11 22,7Z" fill="url(#c)"/>
    <path d="M22,7L32,15L26,58H12Q8,58 8,54L10,24Q12,11 22,7Z" fill="#ffffff" opacity="0.45"/>
    <path d="M22,7L32,15L27,26L18,12Z" fill="${shade('#c3cbd6', -0.35)}"/>
    <path d="M42,7L32,15L37,26L46,12Z" fill="${shade('#c3cbd6', -0.5)}"/>
    <path d="M32,15V58" stroke="${shade('#c3cbd6', -0.45)}" stroke-width="1.7" opacity="0.8"/>
    <g fill="#ffffff" stroke="${shade('#c3cbd6', -0.5)}" stroke-width="1.1">
      <circle cx="36" cy="26" r="2.4"/><circle cx="36" cy="36" r="2.4"/><circle cx="36" cy="46" r="2.4"/>
    </g>
    <path d="M12,44H24V52H12Z" fill="${shade('#c3cbd6', -0.35)}" stroke="${shade('#c3cbd6', -0.55)}"
          stroke-width="1.3"/>
    <path d="M40,44H52V52H40Z" fill="${shade('#c3cbd6', -0.35)}" stroke="${shade('#c3cbd6', -0.55)}"
          stroke-width="1.3"/>
    <path d="M14,14Q16,11 20,10" fill="none" stroke="#ffffff" stroke-width="3"
          stroke-linecap="round" opacity="0.9"/>`),

  '🥉': svg(medal(['#e07a4a', '#8f3d1f'], ['#f6c49a', '#cd7f44', '#8a4a1c'])),
  '🥈': svg(medal(['#7fa8d9', '#33578c'], ['#ffffff', '#c9d0d8', '#7f8794'])),
  '🥇': svg(medal(['#e8556a', '#8f1f34'], ['#fff3c4', '#f2c94c', '#9a6a08'])),

  '🔒': svg(`
    <defs>
      ${lit('b', [[0, '#fff0c0'], [0.45, '#f2c02c'], [1, '#9a6a08']])}
      ${ramp('st', [[0, '#e6ebf1'], [0.5, '#b6c0cb'], [1, '#78828f']])}
    </defs>
    ${ground(32, 58, 15, 0.32)}
    <path d="M20,30V22Q20,10 32,10Q44,10 44,22V30" fill="none" stroke="url(#st)" stroke-width="9"
          stroke-linecap="round"/>
    <path d="M20,30V22Q20,10 32,10Q38,10 41,14" fill="none" stroke="#ffffff" stroke-width="3"
          stroke-linecap="round" opacity="0.55"/>
    <rect x="12" y="29" width="40" height="29" rx="6" fill="url(#b)"/>
    <rect x="12" y="29" width="40" height="29" rx="6" fill="none" stroke="${shade('#9a6a08', -0.35)}"
          stroke-width="1.8"/>
    <rect x="12" y="29" width="14" height="29" rx="6" fill="#ffffff" opacity="0.24"/>
    <circle cx="32" cy="41" r="5.5" fill="${shade('#9a6a08', -0.55)}"/>
    <path d="M32,44L30,52H34Z" fill="${shade('#9a6a08', -0.55)}"/>
    <circle cx="30.4" cy="39.4" r="1.8" fill="#ffe9a8" opacity="0.85"/>
    <path d="M17,34Q19,31 24,31" fill="none" stroke="#fffbe8" stroke-width="3"
          stroke-linecap="round" opacity="0.7"/>`),
};

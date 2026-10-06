/**
 * The cookie itself, drawn.
 *
 * One generator, ten skins. The palettes are read out of `COOKIE_SKINS` rather
 * than copied, so a skin's art cannot drift away from the colours the rest of
 * the game shows for it -- and the art for `'🍪'` is the same art the hero
 * cookie wears, which is the only reason a 16px achievement badge and the
 * 240px thing you click look like the same object.
 *
 * Deliberately no `feTurbulence` here. The grain on the big cookie comes from
 * the stylesheet instead: noise is frequency-bound, so a texture tuned for
 * 240px rasterises as sub-pixel mush at 16px, while gradients and silhouettes
 * are resolution-independent and survive both.
 */

import { COOKIE_SKINS } from '../../../../shared/balance.js';
import { alpha, blob, chipPath, mix, shade } from './shape.js';

/** Silhouette: a disc that wobbles, so it looks baked rather than moulded. */
const BODY = blob(32, 32, [30.8, 29.6, 31.4, 29.2, 30.4, 31.2, 29.4, 31, 29.8, 30.6, 29.5, 31.3], 0.2);

/** The hole in a ring-shaped skin, as a second subpath for evenodd fill. */
const HOLE = 'M25,32A7,7 0 1 1 39,32A7,7 0 1 1 25,32Z';

/** Hand-placed so chips cluster the way they do when dough spreads. */
const CHIP_LAYOUT = [
  [21.5, 20.5, 3.6, -14], [41, 23, 3.1, 28], [30, 34, 3.9, 6],
  [19.5, 39, 3.2, -38], [43, 40, 3.5, 18], [30.5, 48, 3.3, -22],
  [45.5, 31.5, 2.7, 44], [17.5, 29.5, 2.6, -6],
];

function starPath(cx, cy, r, points = 5, inner = 0.44, rot = -Math.PI / 2) {
  const step = Math.PI / points;
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 ? r * inner : r;
    const a = rot + i * step;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * radius).toFixed(2)},${(cy + Math.sin(a) * radius).toFixed(2)}`;
  }
  return `${d}Z`;
}

/** A four-point flare: the shape a highlight takes on a hard, wet surface. */
function sparklePath(cx, cy, r) {
  const w = r * 0.24;
  return `M${cx},${cy - r}Q${cx + w},${cy - w} ${cx + r},${cy}Q${cx + w},${cy + w} ${cx},${cy + r}`
    + `Q${cx - w},${cy + w} ${cx - r},${cy}Q${cx - w},${cy - w} ${cx},${cy - r}Z`;
}

function chips(count, dark) {
  const light = mix(dark, '#8a5a34', 0.55);
  return CHIP_LAYOUT.slice(0, count).map(([x, y, r, rot]) => `
    <g transform="translate(${x} ${y}) rotate(${rot})">
      <path d="${chipPath(r)}" fill="${dark}"/>
      <path d="${chipPath(r * 0.52)}" fill="${light}" opacity="0.75"
            transform="translate(${(-r * 0.3).toFixed(2)} ${(-r * 0.32).toFixed(2)})"/>
      <path d="${chipPath(r * 0.2)}" fill="#ffffff" opacity="0.5"
            transform="translate(${(-r * 0.38).toFixed(2)} ${(-r * 0.4).toFixed(2)})"/>
    </g>`).join('');
}

/** Cracks: thin, branching, darker than the dough. Real cookies have them. */
function cracks(color) {
  return `
    <g stroke="${color}" fill="none" stroke-linecap="round" opacity="0.5">
      <path d="M32,14Q34.5,20 33,24T34.5,30" stroke-width="1.5"/>
      <path d="M33.4,25.5Q37,26.5 39.5,29.5" stroke-width="1.1"/>
      <path d="M14.5,34Q20,33.5 23.5,36T29,37.5" stroke-width="1.3"/>
      <path d="M46,44Q43,46.5 41.5,50" stroke-width="1"/>
    </g>`;
}

function doughDefs(colors) {
  const { c1, c2 } = colors;
  return `
    <radialGradient id="dough" cx="0.34" cy="0.27" r="0.86">
      <stop offset="0" stop-color="${mix(c1, '#ffffff', 0.34)}"/>
      <stop offset="0.4" stop-color="${c1}"/>
      <stop offset="0.76" stop-color="${c2}"/>
      <stop offset="1" stop-color="${shade(c2, -0.4)}"/>
    </radialGradient>
    <radialGradient id="ao" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0.58" stop-color="#000000" stop-opacity="0"/>
      <stop offset="0.9" stop-color="#000000" stop-opacity="0.3"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.62"/>
    </radialGradient>
    <radialGradient id="gloss" cx="0.32" cy="0.25" r="0.56">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.62"/>
      <stop offset="0.46" stop-color="#ffffff" stop-opacity="0.17"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="1.5"/></filter>
    <filter id="soft3"><feGaussianBlur stdDeviation="3"/></filter>`;
}

// ---------------------------------------------------------------------------
// Per-skin surfaces. Each returns what sits between the dough and the gloss.
// ---------------------------------------------------------------------------

const SURFACE = {
  classic: (colors) => `
    ${chips(8, mix('#2a1508', '#000000', colors.c2 === '#b87333' ? 0 : 0.15))}
    ${cracks(shade(colors.c2, -0.5))}`,

  chocolate: (colors) => `
    ${chips(10, '#160a06')}
    <g fill="none" stroke="#1d0d07" stroke-linecap="round" opacity="0.55">
      <path d="M16,26Q24,21 32,25T48,24" stroke-width="2.4"/>
      <path d="M17,44Q26,40 34,44T49,42" stroke-width="2"/>
    </g>`,

  peanut: (colors) => `
    <g stroke="${shade(colors.c2, -0.45)}" stroke-linecap="round" fill="none" opacity="0.55">
      <path d="M15,24H25" stroke-width="2.6"/><path d="M15,28.5H25" stroke-width="2.6"/>
      <path d="M39,38H49" stroke-width="2.6"/><path d="M39,42.5H49" stroke-width="2.6"/>
      <path d="M39,47H49" stroke-width="2.6"/>
    </g>
    ${chips(5, '#3a2410')}`,

  donut: () => `
    <path d="${blob(32, 31.5, [26.4, 25.6, 26.8, 25.4, 26.2, 26.6, 25.5, 26.7, 25.8, 26.4], 0.4)} ${HOLE}"
          fill-rule="evenodd" fill="#ff9ec4"/>
    <path d="${blob(32, 31.5, [26.4, 25.6, 26.8, 25.4, 26.2, 26.6, 25.5, 26.7, 25.8, 26.4], 0.4)} ${HOLE}"
          fill-rule="evenodd" fill="url(#gloss)"/>
    ${sprinkles([[24, 24, -30], [38, 22, 15], [43, 33, -50], [40, 43, 30], [27, 45, -15],
      [20, 36, 60], [32, 19, 5], [46, 26, -70], [23, 41, 40]])}`,

  rainbow: (colors) => `
    <path d="${blob(32, 31.5, [26.6, 25.8, 27, 25.6, 26.4, 26.8, 25.7, 26.9, 26, 26.6], 0.9)}"
          fill="${mix(colors.c1, '#ffffff', 0.45)}"/>
    <g opacity="0.85">
      <path d="M7,36Q32,10 57,36" fill="none" stroke="#ff6b6b" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M9,40Q32,17 55,40" fill="none" stroke="#ffd166" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M12,44Q32,24 52,44" fill="none" stroke="#06d6a0" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M16,48Q32,32 48,48" fill="none" stroke="#4cc9f0" stroke-width="3.4" stroke-linecap="round"/>
    </g>
    ${sprinkles([[20, 24, -30], [42, 24, 40], [30, 20, 10], [46, 37, -55],
      [17, 39, 25], [33, 47, -10], [44, 48, 60], [23, 51, -40]])}`,

  star: () => `
    <path d="${blob(32, 31.5, [26.5, 25.7, 26.9, 25.5, 26.3, 26.7, 25.6, 26.8, 25.9, 26.5], 1.6)}"
          fill="#f2b93b"/>
    <path d="${blob(32, 31.5, [26.5, 25.7, 26.9, 25.5, 26.3, 26.7, 25.6, 26.8, 25.9, 26.5], 1.6)}"
          fill="url(#gloss)"/>
    <g fill="#fff4c2">
      <path d="${starPath(23, 24, 4.4)}"/><path d="${starPath(43, 30, 3.6)}"/>
      <path d="${starPath(28, 44, 4)}"/><path d="${starPath(45, 45, 3)}"/>
      <path d="${starPath(31, 28, 2.6)}"/>
    </g>
    <g fill="#fff" opacity="0.8">
      <circle cx="18" cy="34" r="1.3"/><circle cx="37" cy="19" r="1.1"/>
      <circle cx="40" cy="41" r="1.2"/><circle cx="24" cy="52" r="1"/>
    </g>`,

  flaming: (colors) => `
    <path d="${BODY}" fill="none" stroke="#2b0d04" stroke-width="7" opacity="0.75"/>
    <g stroke="#ff7a1a" fill="none" stroke-linecap="round" opacity="0.9">
      <path d="M32,17Q35,24 32,30T34,41" stroke-width="2.4" filter="url(#soft)"/>
      <path d="M32,17Q35,24 32,30T34,41" stroke-width="1.4"/>
      <path d="M18,32Q23,35 27,34" stroke-width="2" filter="url(#soft)"/>
      <path d="M18,32Q23,35 27,34" stroke-width="1.1"/>
      <path d="M42,38Q45,43 43,48" stroke-width="1.8" filter="url(#soft)"/>
    </g>
    <path d="M32,6Q37,11 34,16Q31,13 30,10Q28,13 29,16Q26,11 32,6Z"
          fill="${alpha('#ffb020', 0.85)}"/>
    ${chips(5, '#2a0f04')}`,

  frosted: (colors) => `
    <path d="M5,30Q13,25 20,29Q26,33 33,29Q41,25 47,30Q53,34 59,31L59,4L5,4Z"
          fill="#f4fbff" opacity="0.96" transform="translate(0 4)"/>
    <path d="M5,34Q13,29 20,33Q26,37 33,33Q41,29 47,34Q53,38 59,35"
          fill="none" stroke="${alpha('#ffffff', 0.9)}" stroke-width="2" stroke-linecap="round"/>
    <g stroke="#cfe9ff" fill="none" stroke-width="1.4" stroke-linecap="round" opacity="0.95">
      <path d="M18,44v6M15,46.5l6,3M21,46.5l-6,3"/>
      <path d="M44,42v6M41,44.5l6,3M47,44.5l-6,3"/>
      <path d="M31,47v5M28.5,48.5l5,2.5M33.5,48.5l-5,2.5"/>
    </g>
    <g fill="${alpha('#ffffff', 0.85)}">
      <circle cx="24" cy="17" r="1.4"/><circle cx="37" cy="14" r="1.1"/>
      <circle cx="46" cy="21" r="1.3"/><circle cx="16" cy="23" r="1.1"/>
    </g>`,

  gem: () => `
    <path d="${blob(32, 31.5, [26.6, 25.9, 27, 25.7, 26.4, 26.8, 25.8, 26.9, 26.1, 26.5], 2.2)}"
          fill="${alpha('#ffffff', 0.16)}"/>
    <g stroke="${alpha('#ffffff', 0.75)}" fill="none" stroke-width="1.3" stroke-linejoin="round">
      <path d="M32,5.5L47,22L41,50L23,50L17,22Z"/>
      <path d="M17,22H47M23,50L32,22L41,50M32,5.5V22"/>
    </g>
    <path d="M32,5.5L47,22L32,22Z" fill="${alpha('#ffffff', 0.4)}"/>
    <path d="M17,22L32,5.5V22Z" fill="${alpha('#ffffff', 0.24)}"/>
    <g fill="#ffffff">
      <path d="${sparklePath(22, 19, 6)}" opacity="0.95"/>
      <path d="${sparklePath(45, 37, 4.6)}" opacity="0.85"/>
      <path d="${sparklePath(27, 45, 3.4)}" opacity="0.7"/>
    </g>`,

  cosmic: () => `
    <path d="${blob(32, 31.5, [26.7, 25.9, 27.1, 25.7, 26.5, 26.9, 25.8, 27, 26.1, 26.6], 2.8)}"
          fill="#1a1050" opacity="0.9"/>
    <path d="M14,30Q22,20 33,24T50,20Q46,32 34,34T14,30Z" fill="${alpha('#7b4dff', 0.65)}"/>
    <path d="M17,42Q26,34 37,38T50,44Q42,52 31,50T17,42Z" fill="${alpha('#2ec5ff', 0.5)}"/>
    <path d="M26,26Q33,23 38,28" fill="none" stroke="${alpha('#ffffff', 0.55)}" stroke-width="1.6" stroke-linecap="round"/>
    <g fill="#ffffff">
      <circle cx="21" cy="25" r="1.3"/><circle cx="44" cy="24" r="1.1"/>
      <circle cx="46" cy="38" r="1.4"/><circle cx="24" cy="45" r="1.2"/>
      <circle cx="34" cy="46" r="1"/><circle cx="17" cy="37" r="1"/>
      <circle cx="37" cy="17" r="1.1"/><circle cx="30" cy="33" r="0.9"/>
    </g>
    <path d="${starPath(28, 22, 3.2)}" fill="#fff8d6" opacity="0.9"/>
    <path d="${starPath(43, 47, 2.6)}" fill="#fff8d6" opacity="0.8"/>`,
};

function sprinkles(list) {
  const palette = ['#ff5d73', '#ffd166', '#06d6a0', '#4cc9f0', '#ffffff', '#c77dff'];
  return `<g>${list.map(([x, y, a], i) => `
    <rect x="-3" y="-1.2" width="6" height="2.4" rx="1.2" fill="${palette[i % palette.length]}"
          transform="translate(${x} ${y}) rotate(${a})"/>`).join('')}</g>`;
}

/**
 * A complete, opaque cookie for one skin.
 *
 * @param {{colors:{c1:string,c2:string,border:string,glow:string}}} skin
 * @returns {string} SVG markup
 */
function cookieArt(skin) {
  const { colors } = skin;
  const ring = skin.id === 'donut';
  const surface = (SURFACE[skin.id] ?? SURFACE.classic)(colors);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <defs>${doughDefs(colors)}</defs>
  <ellipse cx="32" cy="59" rx="21" ry="5" fill="#000000" opacity="0.34" filter="url(#soft3)"/>
  <path d="${BODY}${ring ? HOLE : ''}" fill-rule="${ring ? 'evenodd' : 'nonzero'}" fill="url(#dough)"/>
  <clipPath id="clip"><path d="${BODY}"/></clipPath>
  <g clip-path="url(#clip)">
    ${surface}
    <path d="${BODY}" fill="url(#ao)"/>
    <path d="${BODY}" fill="url(#gloss)"/>
    <path d="${BODY}" fill="none" stroke="${shade(colors.c2, -0.55)}" stroke-width="1.6" opacity="0.5"/>
  </g>
</svg>`;
}

const ART = {};
for (const skin of COOKIE_SKINS) ART[skin.icon] = cookieArt(skin);

export const COOKIE_ART = ART;

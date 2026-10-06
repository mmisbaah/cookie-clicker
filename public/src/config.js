/**
 * Client-side configuration and refresh rates.
 *
 * The refresh rates live here rather than scattered through the renderers
 * because they are a single design decision: **how often is each part of the UI
 * allowed to be out of date.**
 *
 * The previous single-file version of this game rebuilt the shop list, the garden
 * and the ability bar on every animation frame. With a dozen buildings that is
 * harmless; with the shop search box focused it re-runs every price calculation
 * sixty times a second while the player is trying to type. Everything below is
 * either cheap enough to run every frame, or throttled to the slowest rate at
 * which a human would notice the staleness.
 */

/** Frame budget categories. */
export const REFRESH = {
  /** Cookie counter and /sec. Text nodes only -- every frame is genuinely free. */
  hud: 0,

  /** Anything driven by a countdown has to tick visibly to feel alive. */
  ability: 200,
  garden: 250,
  stocks: 250,

  /** Nav badges and the shop affordability ring. Cheap, but not per-frame. */
  badges: 500,

  /** Playtime, portfolio value, the lot. Once a second is plenty. */
  stats: 1000,

  /**
   * Achievement evaluation. Once a second rather than per-frame: the predicates
   * are cheap but they are pure functions of the whole state, and there is no
   * version of this where running them at 60 Hz is the right call.
   */
  achievements: 1000,
};

export const UI = {
  /** How long a toast or achievement card stays on screen. */
  toastMs: 4000,

  /** Golden cookies allowed on screen at once from any source. */
  maxGoldens: 3,

  /** Debounce before a search query re-renders the shop, in ms. */
  searchDebounceMs: 120,

  /** Shop page sizes come from SHOP_PANELS in the balance tables. */
  pageSizes: { buildings: 6, click: 8, cookies: 6, research: 6, prestige: 5 },

  /** Font scale steps offered in the Look panel. */
  fontScales: [
    { value: 0.9, label: 'S' },
    { value: 1, label: 'M' },
    { value: 1.15, label: 'L' },
  ],
};

/**
 * The production multiplier stack, in the order it is displayed in the tooltip.
 *
 * Keyed by the field name `productionMults` returns, so adding a multiplier to
 * the economy means adding one row here and it shows up everywhere.
 */
export const MULTIPLIER_ROWS = [
  { key: 'cookie', label: 'Cookies', hint: 'cookie upgrades' },
  { key: 'research', label: 'Research', hint: 'global tech' },
  { key: 'kitten', label: 'Kittens', hint: 'per achievement' },
  { key: 'buffCps', label: 'Buffs', hint: 'timed effects' },
  { key: 'prestigeCps', label: 'Ascension', hint: 'heavenly boost' },
  { key: 'ach', label: 'Achievements', hint: '+2% each' },
  { key: 'skin', label: 'Skin', hint: 'equipped cookie' },
];

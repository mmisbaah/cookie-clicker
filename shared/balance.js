/**
 * All game content and tuning constants.
 *
 * This module is **pure data**: every value here survives `JSON.stringify`.
 * Behaviour lives in the content modules that consume these tables --
 * `economy.js` for buildings and upgrades, `garden.js`, `market.js`, `golden.js`
 * and `abilities.js`. Effects are described declaratively as
 * `{kind: 'buff', ...}` descriptors that `effects.js` knows how to apply, so an
 * ability and a golden cookie that grant the same thing share one implementation.
 *
 * That is what lets both the browser client and the Node test suite import the
 * exact same tables, and it is why BALANCE_VERSION exists -- the save file
 * records the version it was written against so a balance change can be told
 * apart from a corrupted or foreign save.
 */

/**
 * Bump when the *shape* of the content changes (ids added/removed/renamed, or
 * any effect whose meaning changed). Purely cosmetic or numeric-balance edits
 * do not need a bump.
 */
export const BALANCE_VERSION = 4;

// ---------------------------------------------------------------------------
// Buildings
//
// costGrowth 1.15 is the canonical cookie-clicker curve. The base cost ladder
// follows the vanilla game, so the time-to-first-grandma and the wall you hit
// around the bank are familiar; the cps values are unchanged for the same
// reason.
// ---------------------------------------------------------------------------

const building = (id, name, icon, description, lore, baseCost, cps) => ({
  id, name, icon, description, lore, baseCost, cps,
  costGrowth: 1.15,
});

export const BUILDINGS = [
  building('cursor', 'Cursor', '👆',
    'Autoclicks once every 10 seconds.',
    'A sharpened stick. It clicks. That is the whole business plan.', 15, 0.1),
  building('grandma', 'Grandma', '👵',
    'A nice grandma to bake cookies.',
    'She has not stopped since 1847 and she will not discuss it.', 100, 1),
  building('farm', 'Cookie Farm', '🌾',
    'Grows cookie plants.',
    'Wheat, but the wheat is gingerbread and the field is sugar.', 1_100, 8),
  building('mine', 'Cookie Mine', '⛏️',
    'Mines cookie dough.',
    'The ore is dough. The seam is frosting. Nobody has filed a report.', 12_000, 47),
  building('factory', 'Cookie Factory', '🏭',
    'Mass produces cookies.',
    'Unionised. The cookie rests every four hours and so do you.', 130_000, 260),
  building('bank', 'Cookie Bank', '🏦',
    'Generates cookies from interest.',
    'Your deposit is 3.4% annually, paid in crumbs.', 1_400_000, 1_400),
  building('temple', 'Cookie Temple', '🏛️',
    'Converts prayers into cookies.',
    'Cookie blessings upon you, whose hunger is now a fiscal matter.', 20_000_000, 7_800),
  building('portal', 'Cookie Portal', '🌀',
    'Opens a portal to the Cookieverse.',
    'You can see the other side. It is also ovens. It is only ovens.', 330_000_000, 44_000),
];

// ---------------------------------------------------------------------------
// Click upgrades
//
// `goldenChance` is a per-click probability rather than a flat bonus, which is
// what makes Golden Cookie Radar interesting to buy before the cookies unlock
// on their own.
// ---------------------------------------------------------------------------

const clickUpgrade = (id, name, icon, description, cost, effect) => ({
  id, name, icon, description, cost, ...effect,
});

export const CLICK_UPGRADES = [
  clickUpgrade('strongerFinger', 'Stronger Finger', '💪',
    '+1 cookie per click.', 100, { cpcBonus: 1 }),
  clickUpgrade('doubleClick', 'Double Click', '🖱️',
    '×2 cookies per click.', 500, { cpcMultiplier: 2 }),
  clickUpgrade('thumbOfFortune', 'Thumb of Fortune', '👍',
    'Every click has a 5% chance to summon a golden cookie.', 2_500, { goldenChance: 0.05 }),
  clickUpgrade('goldenRadar', 'Golden Cookie Radar', '🌟',
    'Golden cookies start appearing on their own.', 10_000, { unlocksGolden: true }),
  clickUpgrade('ambidextrous', 'Ambidextrous', '🙌',
    '×2 cookies per click again. Multiply, not add.', 150_000, { cpcMultiplier: 2 }),
  clickUpgrade('overclockedThumb', 'Overclocked Thumb', '⚡',
    '+50% click power.', 5_000_000, { cpcPercent: 0.5 }),
];

// ---------------------------------------------------------------------------
// Cookie upgrades
//
// These are additive percentage points on top of a base multiplier of 1. At 12
// of them that is +86% before any research or prestige, which is a meaningful
// mid-game spike without being a wall that trivialises buildings.
// ---------------------------------------------------------------------------

const cookieUpgrade = (id, name, icon, description, cost, cpsBonus) =>
  ({ id, name, icon, description, cost, cpsBonus });

export const COOKIE_UPGRADES = [
  cookieUpgrade('choco', 'Chocolate Chip Cookie', '🍫', '+1% CPS.', 10_000, 1),
  cookieUpgrade('peanut', 'Peanut Butter Cookie', '🥜', '+2% CPS.', 100_000, 2),
  cookieUpgrade('oatmeal', 'Oatmeal Cookie', '🍪', '+3% CPS.', 1_000_000, 3),
  cookieUpgrade('honey', 'Honey Cookie', '🍯', '+4% CPS.', 10_000_000, 4),
  cookieUpgrade('macadamia', 'Macadamia Cookie', '🌰', '+5% CPS.', 100_000_000, 5),
  cookieUpgrade('sugar', 'Sugar Cookie', '🍬', '+6% CPS.', 1_000_000_000, 6),
  cookieUpgrade('cake', 'Birthday Cake Cookie', '🎂', '+7% CPS.', 10_000_000_000, 7),
  cookieUpgrade('candy', 'Candy Cookie', '🍭', '+8% CPS.', 100_000_000_000, 8),
  cookieUpgrade('moon', 'Moon Cookie', '🥮', '+10% CPS.', 1_000_000_000_000, 10),
  cookieUpgrade('donut', 'Donut Cookie', '🍩', '+15% CPS.', 100_000_000_000_000, 15),
  cookieUpgrade('gingerbread', 'Gingerbread Cookie', '🫚', '+20% CPS.', 10_000_000_000_000_000, 20),
  cookieUpgrade('blackhole', 'Black Hole Cookie', '🕳️', '+25% CPS.', 1_000_000_000_000_000_000, 25),
];

// ---------------------------------------------------------------------------
// Research
//
// Three effect shapes, each a different field on the record, so the CPS engine
// can switch on kind rather than sniffing properties:
//   synergy     -- target building gains a rate per `source` building owned
//   buildingMult-- one building's output is multiplied outright
//   globalMult  -- everything is multiplied
// Plus two unique ones: goldenSpeed and kitten.
// ---------------------------------------------------------------------------

const synergy = (id, name, icon, description, cost, source, target, rate) =>
  ({ id, name, icon, description, cost, kind: 'synergy', source, target, rate });

const tech = (id, name, icon, description, cost, effect) =>
  ({ id, name, icon, description, cost, kind: 'tech', ...effect });

const kitten = (id, name, icon, description, cost, perMilestone) =>
  ({ id, name, icon, description, cost, kind: 'kitten', perMilestone });

export const RESEARCH = [
  synergy('grandmaSynergy', 'Grandma Synergy', '👵',
    'Grandmas gain +1% output per Cookie Farm you own.', 500_000, 'farm', 'grandma', 0.01),
  synergy('farmSynergy', 'Farm Synergy', '🌾',
    'Farms gain +1% output per Cookie Mine you own.', 5_000_000, 'mine', 'farm', 0.01),
  synergy('mineSynergy', 'Mine Synergy', '⛏️',
    'Mines gain +1% output per Cookie Factory you own.', 50_000_000, 'factory', 'mine', 0.01),
  synergy('factorySynergy', 'Factory Synergy', '🏭',
    'Factories gain +1% output per Cookie Bank you own.', 500_000_000, 'bank', 'factory', 0.01),
  synergy('bankSynergy', 'Bank Synergy', '🏦',
    'Banks gain +1% output per Cookie Temple you own.', 5_000_000_000, 'temple', 'bank', 0.01),
  tech('nanoBakers', 'Nanobakers', '🔬',
    'Cursors produce 10× as much.', 1_000_000, { buildingMult: { target: 'cursor', multiplier: 10 } }),
  tech('genetics', 'Genetic Engineering', '🧬',
    'Grandmas produce 5× as much.', 10_000_000, { buildingMult: { target: 'grandma', multiplier: 5 } }),
  tech('quantumOvens', 'Quantum Ovens', '🌌',
    '×1.25 total production.', 1_000_000_000, { globalMult: 1.25 }),
  tech('cookieSingularity', 'Cookie Singularity', '🕳️',
    '×1.5 total production.', 100_000_000_000, { globalMult: 1.5 }),
  tech('condensedMilk', 'Condensed Milk', '🥛',
    '×1.15 total production.', 10_000_000_000_000, { globalMult: 1.15 }),
  tech('overclockedCore', 'Overclocked Core', '🌀',
    '×1.2 total production.', 1_000_000_000_000_000, { globalMult: 1.2 }),
  tech('timeCompression', 'Time Compression', '⏰',
    'Golden cookies spawn twice as often.', 100_000_000_000, { goldenSpeed: 2 }),
  kitten('kittenHelpers', 'Kitten Helpers', '🐱',
    '+2% production per achievement.', 5_000_000, 0.02),
  kitten('kittenWorkers', 'Kitten Workers', '😺',
    '+5% production per achievement.', 500_000_000, 0.05),
  kitten('kittenManagers', 'Kitten Managers', '😻',
    '+10% production per achievement.', 50_000_000_000, 0.10),
];

// ---------------------------------------------------------------------------
// Prestige upgrades
//
// Bought with Heavenly Chips, which survive ascension. `maxLevel` is a hard cap
// rather than a soft one because each of these is a power curve, and a chip
// sink with no ceiling turns the first ascension into the only interesting one.
//
// `effect` is declarative so the prestige panel can render "what level 3 does"
// without a switch statement per upgrade.
// ---------------------------------------------------------------------------

const prestigeUpgrade = (id, name, icon, description, lore, costPerLevel, maxLevel, effect) =>
  ({ id, name, icon, description, lore, costPerLevel, maxLevel, effect });

export const PRESTIGE_UPGRADES = [
  prestigeUpgrade('heavenlyBoost', 'Heavenly Boost', '✨',
    '+1% production per level.', 'The first chip is the expensive one.', 1, 100,
    { stat: 'cpsPercent', perLevel: 0.01 }),
  prestigeUpgrade('divineFingers', 'Divine Fingers', '👐',
    '+10% click power per level.', 'Two hands. Then four. Do not think too hard about it.', 1, 50,
    { stat: 'cpcPercent', perLevel: 0.10 }),
  prestigeUpgrade('bulkDiscount', 'Bulk Discount', '🏷️',
    'Buildings cost 1% less each, to a floor of 50%.', 'Ask about our tiered pricing.', 3, 25,
    { stat: 'costDiscount', perLevel: 0.01, min: 0.5 }),
  prestigeUpgrade('dreamBakery', 'Dream Bakery', '💤',
    '+5% offline efficiency. Base rate is 50%.', 'You bake in your sleep now, badly, but you bake.', 3, 10,
    { stat: 'offlineEfficiency', perLevel: 0.05, base: 0.5, max: 1 }),
  prestigeUpgrade('goldenLuck', 'Golden Luck', '🍀',
    'Golden cookies arrive 5% sooner each level.', 'Statistically irrelevant. Felt immediately.', 4, 10,
    { stat: 'goldenDelay', perLevel: -0.05, min: 0.3 }),
  prestigeUpgrade('sugarRush', 'Sugar Rush', '🍬',
    'Start every ascension with 1M cookies per level.', 'A small, unreasonable inheritance.', 2, 50,
    { stat: 'ascensionCookies', perLevel: 1_000_000 }),
  prestigeUpgrade('timeCapsule', 'Time Capsule', '⌛',
    'Offline earnings cap +1h per level.', 'Catches up on the centuries you skipped.', 2, 12,
    { stat: 'offlineCapMs', perLevel: 3_600_000 }),
  prestigeUpgrade('gardenExpansion', 'Garden Expansion', '🌻',
    '+1 garden plot per level.', 'The plot count is a storage problem, not a prestige one.', 5, 6,
    { stat: 'gardenPlots', perLevel: 1 }),
];

// ---------------------------------------------------------------------------
// Abilities
//
// `durationMs: 0` means instant. `effect` is a declarative descriptor applied by
// effects.js; `unlockCost` is what it costs to unlock the ability permanently,
// paid once with cookies. Abilities are re-usable on a cooldown afterwards.
// ---------------------------------------------------------------------------

const ability = (id, name, icon, description, unlockCost, cooldownMs, durationMs, effect) =>
  ({ id, name, icon, description, unlockCost, cooldownMs, durationMs, effect });

export const ABILITIES = [
  {
    id: 'frenzy', name: 'Frenzy', icon: '🌀', key: '1',
    description: '×7 production for 30s.',
    unlockCost: 25_000, cooldownMs: 180_000, durationMs: 30_000,
    effect: { kind: 'buff', buff: 'cpsMult', mult: 7, durationMs: 30_000 },
  },
  {
    id: 'clickStorm', name: 'Click Storm', icon: '⚡', key: '2',
    description: '×11 click power for 15s.',
    unlockCost: 100_000, cooldownMs: 120_000, durationMs: 15_000,
    effect: { kind: 'buff', buff: 'clickMult', mult: 11, durationMs: 15_000 },
  },
  {
    id: 'comboRush', name: 'Combo Rush', icon: '🎯', key: '3',
    description: '×25 click power for 8s.',
    unlockCost: 2_000_000, cooldownMs: 120_000, durationMs: 8_000,
    effect: { kind: 'buff', buff: 'clickMult', mult: 25, durationMs: 8_000 },
  },
  {
    id: 'cookieRain', name: 'Cookie Rain', icon: '🌧️', key: '4',
    description: 'Instantly gain 300 seconds of production.',
    unlockCost: 500_000, cooldownMs: 300_000, durationMs: 0,
    effect: { kind: 'cookies', seconds: 300 },
  },
  {
    id: 'goldenTouch', name: 'Golden Touch', icon: '🌟', key: '5',
    description: 'Summon a golden cookie right now.',
    unlockCost: 5_000_000, cooldownMs: 480_000, durationMs: 0,
    effect: { kind: 'golden', count: 1 },
  },
  {
    id: 'harvestRush', name: 'Harvest Rush', icon: '🌾', key: '6',
    description: 'Every growing plant ripens instantly.',
    unlockCost: 25_000_000, cooldownMs: 600_000, durationMs: 0,
    effect: { kind: 'ripen' },
  },
  {
    id: 'chronoWarp', name: 'Chrono Warp', icon: '⏱️', key: '7',
    description: 'Clear every ability cooldown, including this one.',
    unlockCost: 50_000_000, cooldownMs: 600_000, durationMs: 0,
    effect: { kind: 'resetCooldowns' },
  },
];

// ---------------------------------------------------------------------------
// Achievements
//
// `check` receives the whole state plus derived numbers, so an achievement can
// be written against anything the game tracks without a bespoke hook. They are
// pure predicates -- never mutate, never throw.
// ---------------------------------------------------------------------------

export const MILESTONES = [
  { count: 5, icon: '🥉', label: 'Bronze', mult: 1.10 },
  { count: 10, icon: '🥈', label: 'Silver', mult: 1.25 },
  { count: 15, icon: '🥇', label: 'Gold', mult: 1.50 },
];

export const ACHIEVEMENT_CPS_PER = 0.02;

const idCount = (table, record) => table.filter((u) => record[u.id]).length;

export const ACHIEVEMENTS = [
  // --- clicking ---
  { id: 'firstClick', name: 'First Click', icon: '👆', group: 'Clicking',
    check: (s) => s.totalClicks >= 1 },
  { id: 'click100', name: 'Clicker', icon: '✌️', group: 'Clicking',
    check: (s) => s.totalClicks >= 100 },
  { id: 'click1k', name: 'Click Master', icon: '🖐️', group: 'Clicking',
    check: (s) => s.totalClicks >= 1_000 },
  { id: 'click10k', name: 'Click Legend', icon: '🏆', group: 'Clicking',
    check: (s) => s.totalClicks >= 10_000 },
  { id: 'click1m', name: 'Carpal Legend', icon: '🦾', group: 'Clicking',
    check: (s) => s.totalClicks >= 1_000_000 },

  // --- baking ---
  { id: 'jar', name: 'Cookie Jar', icon: '🍪', group: 'Baking',
    check: (s) => s.totalCookies >= 100 },
  { id: 'pantry', name: 'Pantry', icon: '🥫', group: 'Baking',
    check: (s) => s.totalCookies >= 10_000 },
  { id: 'millionaire', name: 'Millionaire', icon: '💰', group: 'Baking',
    check: (s) => s.totalCookies >= 1e6 },
  { id: 'billionaire', name: 'Billionaire', icon: '💎', group: 'Baking',
    check: (s) => s.totalCookies >= 1e9 },
  { id: 'quadrillionaire', name: 'Quadrillionaire', icon: '🗿', group: 'Baking',
    check: (s) => s.totalCookies >= 1e15 },
  { id: 'cps100', name: 'Small Business', icon: '🏭', group: 'Baking',
    check: (s, d) => d.cps >= 100 },
  { id: 'cps10k', name: 'Cookie Empire', icon: '👑', group: 'Baking',
    check: (s, d) => d.cps >= 10_000 },
  { id: 'cps1m', name: 'Galactic Bakery', icon: '🌌', group: 'Baking',
    check: (s, d) => d.cps >= 1_000_000 },

  // --- ascension ---
  { id: 'ascend1', name: 'Ascended', icon: '✨', group: 'Ascension',
    check: (s) => s.ascensions >= 1 },
  { id: 'ascend5', name: 'Transcendent', icon: '🌟', group: 'Ascension',
    check: (s) => s.ascensions >= 5 },
  { id: 'ascend20', name: 'Cookie Deity', icon: '🕉️', group: 'Ascension',
    check: (s) => s.ascensions >= 20 },
  { id: 'chips10', name: 'Chip Collector', icon: '💠', group: 'Ascension',
    check: (s) => s.totalChips >= 10 },
  { id: 'chips100', name: 'Chip Baron', icon: '🏦', group: 'Ascension',
    check: (s) => s.totalChips >= 100 },

  // --- upgrades ---
  { id: 'cookieCollector', name: 'Cookie Collector', icon: '🧁', group: 'Upgrades',
    check: (s) => idCount(COOKIE_UPGRADES, s.upgrades.cookie) >= 10 },
  { id: 'researcher', name: 'Researcher', icon: '🔬', group: 'Upgrades',
    check: (s) => idCount(RESEARCH, s.upgrades.research) >= 5 },
  { id: 'madScientist', name: 'Mad Scientist', icon: '🧪', group: 'Upgrades',
    check: (s) => idCount(RESEARCH, s.upgrades.research) === RESEARCH.length },
  { id: 'bulkBuyer', name: 'Bulk Buyer', icon: '📦', group: 'Upgrades',
    check: (s) => BUILDINGS.some((b) => (s.buildings[b.id] ?? 0) >= 100) },
  { id: 'industrialist', name: 'Industrialist', icon: '🏗️', group: 'Upgrades',
    check: (s) => BUILDINGS.every((b) => (s.buildings[b.id] ?? 0) >= 1) },

  // --- abilities ---
  { id: 'powerUnleashed', name: 'Power Unleashed', icon: '💫', group: 'Abilities',
    check: (s) => Object.values(s.abilities).some((a) => a.unlocked) },
  { id: 'masterOfMagic', name: 'Master of Magic', icon: '🔮', group: 'Abilities',
    check: (s) => Object.values(s.abilities).every((a) => a.unlocked) },

  // --- garden ---
  { id: 'firstHarvest', name: 'First Harvest', icon: '🌱', group: 'Garden',
    check: (s) => s.stats.harvests >= 1 },
  { id: 'greenThumb', name: 'Green Thumb', icon: '🌾', group: 'Garden',
    check: (s) => s.stats.harvests >= 25 },
  { id: 'fullPlot', name: 'Nothing Left to Plant', icon: '🌻', group: 'Garden',
    check: (s) => s.garden.plots.filter(Boolean).length >= s.garden.plotCount },
  { id: 'marketGardener', name: 'Market Gardener', icon: '🧺', group: 'Garden',
    check: (s) => s.stats.harvests >= 100 },

  // --- market ---
  { id: 'firstTrade', name: 'First Trade', icon: '💱', group: 'Market',
    check: (s) => s.stats.trades >= 1 },
  { id: 'dayTrader', name: 'Day Trader', icon: '📈', group: 'Market',
    check: (s) => s.stats.trades >= 50 },
  { id: 'goldenHolder', name: 'Golden Holder', icon: '🪙', group: 'Market',
    check: (s) => s.market.some((m) => m.symbol === 'GOLD' && m.shares >= 5) },
  { id: 'diversified', name: 'Diversified Portfolio', icon: '📊', group: 'Market',
    check: (s) => s.market.every((m) => m.shares > 0) },

  // --- golden cookies ---
  { id: 'golden5', name: 'Lucky Fingers', icon: '🍀', group: 'Golden',
    check: (s) => s.stats.goldenClicked >= 5 },
  { id: 'golden50', name: 'Golden Touch', icon: '🌟', group: 'Golden',
    check: (s) => s.stats.goldenClicked >= 50 },

  // --- cosmetics ---
  { id: 'themeExplorer', name: 'Theme Explorer', icon: '🎨', group: 'Style',
    check: (s) => s.prefs.themesUsed.length >= 3 },
  { id: 'firstSkin', name: 'Fresh Coat', icon: '🥼', group: 'Style',
    check: (s) => s.prefs.ownedSkins.length >= 2 },
  { id: 'skinCollector', name: 'Skin Collector', icon: '✨', group: 'Style',
    check: (s) => s.prefs.ownedSkins.length >= 5 },
  { id: 'skinMaster', name: 'Skin Master', icon: '👑', group: 'Style',
    check: (s) => s.prefs.ownedSkins.length >= COOKIE_SKINS.length },
];

// ---------------------------------------------------------------------------
// Garden
//
// Seed cost is a multiple of current production rather than a fixed number, so
// the garden scales with the empire instead of becoming irrelevant at 1e15.
// costFactor > 1 means planting is always a net loss in the moment and the
// return is the yield -- there is no arbitrage loop.
// ---------------------------------------------------------------------------

export const GARDEN = {
  basePlots: 6,
  costFactor: 2,
};

const seed = (id, name, icon, description, growMs, yieldMult, buff = null) =>
  ({ id, name, icon, description, growMs, yieldMult, buff });

export const SEEDS = [
  seed('carrot', 'Carrot', '🥕', 'Thirty seconds. Honest work.', 30_000, 10),
  seed('corn', 'Corn', '🌽', 'Two minutes of golden silence.', 120_000, 50),
  seed('pumpkin', 'Pumpkin', '🎃', 'Slow, heavy, worth it.', 300_000, 250),
  seed('grape', 'Grape', '🍇', 'Fifteen minutes of patience.', 900_000, 1_000),
  seed('starFruit', 'Star Fruit', '🌟',
    'An hour of growing, then ten minutes of ×1.05 production.', 3_600_000, 10_000,
    { kind: 'cpsMult', mult: 1.05, durationMs: 600_000 }),
];

// ---------------------------------------------------------------------------
// Market
//
// Prices are a mean-reverting random walk: each tick a price is pulled a
// fraction of the way back toward `startPrice` and then pushed by a
// volatility-scaled shock. Pure drift alone lets COOK run away to its clamp in
// an hour, which makes every trade decision trivially "wait"; pure noise alone
// makes every trade a coin flip. The pull term is what gives the market a
// tradeable baseline.
// ---------------------------------------------------------------------------

export const MARKET = {
  tickMs: 15_000,
  historyLength: 24,
  meanReversion: 0.06,
  drift: 0.0015,
  minPriceRatio: 0.1,
  maxPriceRatio: 20,
};

const stock = (symbol, name, icon, startPrice, volatility, maxShares) =>
  ({ symbol, name, icon, startPrice, volatility, maxShares });

export const STOCKS = [
  stock('COOK', 'Cookie Corp', '🍪', 100, 0.03, 10),
  stock('MILK', 'Milk Industries', '🥛', 250, 0.05, 10),
  stock('CHOC', 'Choco Traders', '🍫', 600, 0.08, 10),
  stock('GOLD', 'Golden Investments', '🌟', 2_000, 0.15, 10),
  stock('DOUGH', 'Dough Futures', '🧈', 5_000, 0.25, 5),
];

// ---------------------------------------------------------------------------
// Cookies look
// ---------------------------------------------------------------------------

const skin = (id, name, icon, cost, cpsBonus, colors, description) =>
  ({ id, name, icon, cost, cpsBonus, colors, description });

export const COOKIE_SKINS = [
  skin('classic', 'Classic', '🍪', 0, 0,
    { c1: '#f4a460', c2: '#b87333', border: '#e8d4b8', glow: '#f4a460' },
    'The original chocolate chip. Everything else is a sequel.'),
  skin('chocolate', 'Double Chocolate', '🍫', 100_000, 0,
    { c1: '#a06a3a', c2: '#5a3417', border: '#8b5a2b', glow: '#a06a3a' },
    'Extra chips, extra flavour, extra shame.'),
  skin('peanutButter', 'Peanut Butter', '🥜', 1_000_000, 0,
    { c1: '#d4a866', c2: '#8a6a30', border: '#e8c890', glow: '#d4a866' },
    'Smooth, nutty, quietly excellent.'),
  skin('donut', 'Donut', '🍩', 10_000_000, 0,
    { c1: '#f5c5a0', c2: '#c4886a', border: '#ffccee', glow: '#ff99cc' },
    'Technically a cookie. Legally a pastry.'),
  skin('rainbow', 'Rainbow', '🌈', 100_000_000, 0,
    { c1: '#ff99cc', c2: '#99ccff', border: '#ffdd66', glow: '#ff99cc' },
    'Every flavour at once, none of them chocolate.'),
  skin('star', 'Starry', '⭐', 1_000_000_000, 0.01,
    { c1: '#ffe066', c2: '#c9a020', border: '#ffcc00', glow: '#ffe066' },
    'Ground from stardust. +1% production.'),
  skin('flaming', 'Flaming', '🔥', 10_000_000_000, 0,
    { c1: '#ff7a33', c2: '#8a2010', border: '#ffcc33', glow: '#ff5a20' },
    'Baked in eternal fire. Do not microwave.'),
  skin('frosted', 'Frosted', '❄️', 100_000_000_000, 0,
    { c1: '#a0d8ff', c2: '#4a8ac0', border: '#e0f4ff', glow: '#a0d8ff' },
    'Keeps for a geological era.'),
  skin('diamond', 'Diamond', '💎', 1_000_000_000_000, 0.05,
    { c1: '#a0e8ff', c2: '#5a9ec0', border: '#e0faff', glow: '#a0e8ff' },
    'Crystallised sugar, cut by hand. +5% production.'),
  skin('cosmic', 'Cosmic', '🌌', 100_000_000_000_000, 0.10,
    { c1: '#6a3aff', c2: '#1a1060', border: '#a080ff', glow: '#8a5aff' },
    'A slice of the Cookieverse. +10% production.'),
];

// ---------------------------------------------------------------------------
// Themes
//
// Each theme is a flat map of CSS custom properties. Light themes are real
// themes rather than an inverted dark one, which is why `--panel` and not a
// computed `invert()` decides the page background.
// ---------------------------------------------------------------------------

const theme = (id, name, swatches, vars) => ({ id, name, swatches, vars });

export const THEMES = [
  // Lagoon Bakery: the house theme, and the default. A beach bakery after dark --
  // deep lagoon water for the chrome, baked-gold for anything worth reading.
  //
  // It is the one theme whose palette is borrowed rather than invented: the teal,
  // mint and ink are Atollingo's, the navy and cyan are OceanHub's, and the gold
  // is the cookie itself. Both sites are light, but this game puts its accent to
  // work as a background as well as a label (`.chip.is-active`, the buy button),
  // so it is built on OceanHub's dark ground where one accent can be legible in
  // both directions. Every contrast below is >= 6:1 against the panel.
  theme('lagoon', '🏝️ Lagoon Bakery', ['#04121a', '#082b38', '#00b4d8', '#ffcf5c'], {
    '--bg': '#04121a', '--bg-2': '#062430',
    '--panel': '#082b38', '--panel-hi': '#0b3746', '--panel-deep': '#041a24',
    '--border': '#1d5a6b',
    '--text': '#eaf7f3', '--text-dim': '#8fb7bd', '--text-mute': '#5d878f',
    '--accent': '#00b4d8', '--accent-2': '#ffcf5c',
    '--success': '#02c39a', '--danger': '#ff8a72', '--info': '#7bdff2', '--purple': '#b9a3ff',
  }),
  theme('classic', '🍪 Classic', ['#1a1a2e', '#16213e', '#f4a460', '#ffd700'], {
    '--bg': '#0a0e1a', '--bg-2': '#16213e',
    '--panel': '#131e3b', '--panel-hi': '#1a2547', '--panel-deep': '#0d1730',
    '--border': '#2a3a5a',
    '--text': '#ffffff', '--text-dim': '#a8b4cc', '--text-mute': '#6b7a99',
    '--accent': '#f4a460', '--accent-2': '#ffd700',
    '--success': '#00ff88', '--danger': '#ff6b6b', '--info': '#00e5ff', '--purple': '#dda0dd',
  }),
  theme('midnight', '🌙 Midnight', ['#05070f', '#0c1220', '#00e5ff', '#ff3df0'], {
    '--bg': '#05070f', '--bg-2': '#0c1220',
    '--panel': '#0a0f1c', '--panel-hi': '#0f1728', '--panel-deep': '#06090f',
    '--border': '#1b2740',
    '--text': '#e8f5ff', '--text-dim': '#7a8aa8', '--text-mute': '#556478',
    '--accent': '#00e5ff', '--accent-2': '#ff3df0',
    '--success': '#3dffb0', '--danger': '#ff5c7a', '--info': '#00e5ff', '--purple': '#c08cff',
  }),
  theme('sakura', '🌸 Sakura', ['#fdf3f6', '#ffe6ef', '#e88aa0', '#c44a6c'], {
    '--bg': '#fdf3f6', '--bg-2': '#ffe6ef',
    '--panel': '#ffffff', '--panel-hi': '#fff7fa', '--panel-deep': '#f7e9ee',
    '--border': '#f0cdd8',
    '--text': '#3c1f2a', '--text-dim': '#8a6873', '--text-mute': '#ab8f99',
    '--accent': '#e88aa0', '--accent-2': '#c44a6c',
    '--success': '#3a9e6c', '--danger': '#d94a4a', '--info': '#4a8fc0', '--purple': '#a05ea8',
  }),
  theme('forest', '🌿 Forest', ['#0f1c14', '#16281d', '#7fd67f', '#c9a961'], {
    '--bg': '#0f1c14', '--bg-2': '#16281d',
    '--panel': '#132218', '--panel-hi': '#1a2c20', '--panel-deep': '#0d1810',
    '--border': '#2a4a32',
    '--text': '#e8f5e8', '--text-dim': '#8fae92', '--text-mute': '#65836a',
    '--accent': '#7fd67f', '--accent-2': '#c9a961',
    '--success': '#7fd67f', '--danger': '#e07a6a', '--info': '#7ec8c8', '--purple': '#a896d6',
  }),
  theme('ember', '🔥 Ember', ['#0a0504', '#1a0c08', '#ff7a1f', '#ff2a2a'], {
    '--bg': '#0a0504', '--bg-2': '#1a0c08',
    '--panel': '#150806', '--panel-hi': '#200e08', '--panel-deep': '#0e0403',
    '--border': '#3a1a10',
    '--text': '#ffe8d0', '--text-dim': '#b08c78', '--text-mute': '#7d6257',
    '--accent': '#ff7a1f', '--accent-2': '#ffcc33',
    '--success': '#7fd67f', '--danger': '#ff2a2a', '--info': '#7ec8e8', '--purple': '#c060a0',
  }),
  theme('daylight', '☀️ Daylight', ['#f5f5ef', '#e8e6dd', '#5a9edc', '#e8a44a'], {
    '--bg': '#f5f5ef', '--bg-2': '#e8e6dd',
    '--panel': '#ffffff', '--panel-hi': '#fafaf7', '--panel-deep': '#eeece2',
    '--border': '#d4d0c4',
    '--text': '#2a2a2a', '--text-dim': '#6a6a6a', '--text-mute': '#9a9a92',
    '--accent': '#e8a44a', '--accent-2': '#c47a10',
    '--success': '#3a9e6c', '--danger': '#c44a4a', '--info': '#3a7ec8', '--purple': '#a05ea8',
  }),
  theme('candy', '🍬 Candy', ['#2b0a3d', '#4a1263', '#ff6ec7', '#7bf1a8'], {
    '--bg': '#2b0a3d', '--bg-2': '#4a1263',
    '--panel': '#37104d', '--panel-hi': '#4a1a63', '--panel-deep': '#250838',
    '--border': '#6b2d8a',
    '--text': '#fff0ff', '--text-dim': '#d5a8e0', '--text-mute': '#a274b3',
    '--accent': '#ff6ec7', '--accent-2': '#7bf1a8',
    '--success': '#7bf1a8', '--danger': '#ff7a7a', '--info': '#7ad7ff', '--purple': '#c9a8ff',
  }),
  theme('void', '🕳️ Void', ['#000000', '#0b0b12', '#6a3aff', '#ff3df0'], {
    '--bg': '#000000', '--bg-2': '#0b0b12',
    '--panel': '#08080f', '--panel-hi': '#101020', '--panel-deep': '#000000',
    '--border': '#242440',
    '--text': '#dcdcf0', '--text-dim': '#6e6e90', '--text-mute': '#484868',
    '--accent': '#6a3aff', '--accent-2': '#ff3df0',
    '--success': '#4dffc3', '--danger': '#ff5470', '--info': '#4dd2ff', '--purple': '#b388ff',
  }),
];

// ---------------------------------------------------------------------------
// Golden cookies
//
// Effects are chosen by weight so that a lucky player sees a lucky distribution
// rather than the same three outcomes in rotation.
// ---------------------------------------------------------------------------

export const GOLDEN = {
  baseDelayMs: 70_000,
  jitterMs: 130_000,
  minDelayMs: 6_000,
  onScreenMs: 9_000,
  /**
   * Effects are chosen by cumulative `weight`, so a rarer outcome is made rarer
   * by changing a number rather than by editing a random draw. Each entry's
   * `effect` descriptor is applied by effects.js -- the same code path an
   * ability uses, which is why Frenzy grants exactly the same multiplier
   * whether it came from a golden cookie or from the ability bar.
   */
  effects: [
    { id: 'frenzy', weight: 3, label: 'Frenzy! ×7 production for 60s',
      effect: { kind: 'buff', buff: 'cpsMult', mult: 7, durationMs: 60_000 } },
    { id: 'blessing', weight: 3, label: 'Blessing! +13% production for 45s',
      effect: { kind: 'buff', buff: 'cpsMult', mult: 1.13, durationMs: 45_000 } },
    { id: 'clickStorm', weight: 2, label: 'Click Storm! ×77 click power for 13s',
      effect: { kind: 'buff', buff: 'clickMult', mult: 77, durationMs: 13_000 } },
    { id: 'lucky', weight: 2, label: 'Luck! +900 seconds of production',
      effect: { kind: 'cookies', seconds: 900 } },
    { id: 'jackpot', weight: 1, label: 'Jackpot! +5% production for 4 minutes',
      effect: { kind: 'buff', buff: 'cpsMult', mult: 1.05, durationMs: 240_000 } },
  ],
};

// ---------------------------------------------------------------------------
// Timing and persistence
// ---------------------------------------------------------------------------

export const TIMING = {
  autosaveMs: 20_000,
  /** Save on page hide as well -- mobile browsers rarely fire `beforeunload`. */
  saveOnHide: true,
  /** Offline earnings below this are ignored, to keep a tab-switch from rounding up. */
  minOfflineMs: 60_000,
};

export const PERSISTENCE = {
  storageKey: 'cookie-clicker.slot.v1',
  saveVersion: 4,
  /** Refuse to import a blob larger than this; a real save is a few kB. */
  maxImportChars: 512_000,
};

export const ASCENSION = {
  /** Total lifetime cookies required before the first chip. */
  firstChipCookies: 1e12,
  /**
   * Chips earned = floor(cbrt(totalCookies / firstChipCookies)) minus chips
   * already banked. This is the vanilla curve: it grows slower than the
   * empire does, so each ascension is a modest step rather than a new game.
   */
  gain: (totalCookies, totalChips) =>
    Math.max(0, Math.floor(Math.cbrt(totalCookies / ASCENSION.firstChipCookies)) - totalChips),
};

export const PRESTIGE = {
  baseCostDiscount: 1,
  minCostDiscount: 0.5,
  baseOfflineEfficiency: 0.5,
  offlineEfficiencyPerLevel: 0.05,
  baseOfflineCapMs: 2 * 3_600_000,
  offlineCapPerLevelMs: 3_600_000,
  baseGoldenDelayFactor: 1,
};

// ---------------------------------------------------------------------------
// Lookup tables
//
// Built once at module load. Every render path resolves items through these
// instead of Array.find, because the shop re-renders on every filter keystroke
// and an O(n) scan per tile is exactly the kind of thing that makes a phone
// stutter.
// ---------------------------------------------------------------------------

const byId = (list) => Object.fromEntries(list.map((it) => [it.id, it]));

export const BUILDING_BY_ID = byId(BUILDINGS);
export const PRESTIGE_BY_ID = byId(PRESTIGE_UPGRADES);
export const ABILITY_BY_ID = byId(ABILITIES);
export const SEED_BY_ID = byId(SEEDS);
export const THEME_BY_ID = byId(THEMES);

/**
 * Stocks are keyed by `symbol`, not `id` -- a ticker is their identity in the
 * UI and in every trade call, and `byId` would silently produce a table keyed by
 * `undefined`, where every lookup returns the last stock in the list.
 */
export const STOCK_BY_ID = Object.fromEntries(STOCKS.map((s) => [s.symbol, s]));

/** Cards shown in the shop, in panel order. */
export const SHOP_PANELS = [
  {
    id: 'buildings', label: '🏭 Buildings', primary: 'production',
    buyAmount: true, pageSize: 6,
  },
  {
    id: 'click', label: '👆 Click', primary: 'production',
    buyAmount: false, pageSize: 8,
  },
  {
    id: 'cookies', label: '🍪 Cookies', primary: 'enhancement',
    buyAmount: false, pageSize: 6,
  },
  {
    id: 'research', label: '🧪 Research', primary: 'enhancement',
    buyAmount: false, pageSize: 6,
  },
  {
    id: 'prestige', label: '✨ Prestige', primary: 'meta',
    buyAmount: true, pageSize: 5,
  },
];

export const PRIMARY_TABS = [
  { id: 'production', label: '🏭 Production' },
  { id: 'enhancement', label: '🍪 Enhance' },
  { id: 'meta', label: '✨ Meta' },
];

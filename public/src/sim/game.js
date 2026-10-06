/**
 * The game controller.
 *
 * One instance owns the mutable state, the clock, and the rules about *when*
 * things happen. It contains no DOM code -- every renderer reads from it and
 * calls into it, never the other way round. That split is what lets the whole
 * rules layer be tested under `node --test` and lets a renderer be wrong without
 * being able to corrupt the game.
 *
 * The clock is injectable (`now`). Tests and the frame loop both pass their own
 * timestamps explicitly, so nothing in here calls `Date.now()` except the
 * default provider.
 */

import {
  ABILITIES, BALANCE_VERSION, BUILDINGS, BUILDING_BY_ID, CLICK_UPGRADES, COOKIE_SKINS,
  COOKIE_UPGRADES, PRESTIGE_BY_ID, RESEARCH, THEMES, TIMING,
} from '../../shared/balance.js';
import { allAbilityStatuses, cleanAbilities, activateAbility, unlockAbility } from '../../shared/abilities.js';
import { syncAchievements } from '../../shared/achievements.js';
import { grantCookies } from '../../shared/effects.js';
import {
  applyBuyPlan, applyPrestigePlan, ascend as applyAscend, buyPlan, chipsGain,
  cleanBuffs, cps as cpsFor, derived, prestigePlan,
} from '../../shared/economy.js';
import { harvest as gardenHarvest, plant as gardenPlant, ripenAll } from '../../shared/garden.js';
import {
  clickGolden, goldensUnlocked, liveGoldens, nextDelayMs, summonGolden,
} from '../../shared/golden.js';
import { buyShares, dueSteps, sellShare, tickMarket } from '../../shared/market.js';
import { applyOffline, offlineReport } from '../../shared/offline.js';
import { createRng } from '../../shared/rng.js';
import { save as saveToStorage } from '../../shared/save.js';
import { reconcileState } from '../../shared/state.js';
import { REFRESH, UI } from '../config.js';

/** Minimal synchronous event bus. Handlers that throw cannot stop the loop. */
class Emitter {
  #handlers = new Map();

  on(name, fn) {
    if (!this.#handlers.has(name)) this.#handlers.set(name, new Set());
    this.#handlers.get(name).add(fn);
    return () => this.#handlers.get(name)?.delete(fn);
  }

  emit(name, payload) {
    for (const fn of this.#handlers.get(name) ?? []) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[cookie-clicker] handler for "${name}" threw`, err);
      }
    }
  }
}

export class Game {
  /**
   * @param {object} options
   * @param {object} options.state   a loaded or freshly created state
   * @param {() => number} [options.now]
   * @param {() => void} [options.onSave]
   */
  constructor({ state, now = () => Date.now(), seed = 1 } = {}) {
    this.events = new Emitter();
    this.now = now;
    this.rng = createRng(seed);

    this.state = reconcileState(state);
    this.derived = derived(this.state, this.now());

    this.lastTickAt = this.now();
    this.lastAchCheck = 0;
    this.lastAutosave = this.now();
    this.goldenAt = Infinity;

    // A save with `marketLastTick === 0` has never ticked, and `dueSteps` reads
    // that as "no time owed" -- which would leave a fresh run's prices frozen
    // until the player happened to buy something. Anchoring to now starts the
    // clock at boot instead.
    this.marketAt = this.state.marketLastTick || this.lastTickAt;

    this.accumulatedMs = 0;
    this.dirty = { shop: true, badges: true, stats: true, achievements: true };
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Advance the simulation to `now`.
   *
   * Called once per animation frame. Everything time-based is derived from the
   * gap between calls rather than from an accumulating timer, so a stalled tab
   * or a laptop lid produces the same result as a smooth one.
   */
  tick(now = this.now()) {
    const dtMs = now - this.lastTickAt;
    // A negative gap means the device clock moved backwards. Clamping to zero
    // rather than paying out negative time is the only sane response.
    const dt = Math.max(0, dtMs) / 1000;

    this.state.playMs += Math.max(0, dtMs);
    this.lastTickAt = now;

    if (dt > 0) {
      const gain = this.derived.cps * dt;
      this.state.cookies += gain;
      this.state.totalCookies += gain;
    }

    if (this.derived.cps > (this.state.stats.bestCps ?? 0)) {
      this.state.stats.bestCps = this.derived.cps;
    }

    cleanBuffs(this.state, now);
    cleanAbilities(this.state, now);

    this.advanceMarket(now);
    this.advanceGoldens(now);

    this.derived = derived(this.state, now);

    if (now - this.lastAchCheck >= REFRESH.achievements) {
      this.lastAchCheck = now;
      const fresh = syncAchievements(this.state, now, () => this.derived);
      if (fresh.length) {
        this.dirty.stats = true;
        this.dirty.badges = true;
        this.dirty.achievements = true;
        this.events.emit('achievements', fresh);
      }
    }

    if (now - this.lastAutosave >= TIMING.autosaveMs) {
      this.lastAutosave = now;
      this.save(now);
    }

    return this.derived;
  }

  /** Mark derived values stale so the next frame recomputes them. */
  invalidate() {
    this.derived = derived(this.state, this.now());
    this.dirty.shop = true;
    this.dirty.badges = true;
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  save(now = this.now()) {
    const result = saveToStorage(this.state, now);
    if (!result.ok) this.events.emit('save-failed', result);
    return result;
  }

  /**
   * Grant whatever accrued while the tab was hidden.
   *
   * `lastSeenAt` is only moved on save, so the gap is measured from the last
   * moment the game was actually running rather than from the last frame.
   */
  resume(now = this.now()) {
    const report = offlineReport(this.state, now);
    if (report.cookies > 0 || report.awayMs > 0) {
      applyOffline(this.state, report);
      this.events.emit('offline', report);
    }
    this.state.lastSeenAt = now;
    this.lastTickAt = now;
    this.invalidate();
    this.save(now);
    return report;
  }

  /** Called when the tab goes hidden. */
  suspend(now = this.now()) {
    this.save(now);
  }

  // -------------------------------------------------------------------------
  // Baking
  // -------------------------------------------------------------------------

  /**
   * Click the cookie.
   *
   * @param {{x:number,y:number}} [at] screen position for the floating number
   * @returns {{gain:number, at?:object, golden:boolean}}
   */
  click(at) {
    const now = this.now();
    const gain = this.derived.cpc;
    grantCookies(this.state, gain);
    this.state.totalClicks += 1;
    this.state.stats.clicksSinceGolden = (this.state.stats.clicksSinceGolden ?? 0) + 1;

    this.events.emit('click', { gain, at, now });
    this.events.emit('sound', 'click');

    // Thumb of Fortune is a per-click roll rather than a scheduled spawn, so it
    // works before the radar is bought -- which is the whole reason to buy it.
    const chance = this.derived.click.goldenChance;
    let golden = false;
    if (chance > 0 && this.rng() < chance && liveGoldens(this.state, now).length < UI.maxGoldens) {
      summonGolden(this.state, now, 1, now);
      golden = true;
      this.dirty.badges = true;
      this.events.emit('goldens-changed');
    }

    return { gain, at, golden };
  }

  /** Buy `amount` (or 'max') of a building. */
  buyBuilding(id) {
    const building = BUILDING_BY_ID[id];
    if (!building) return { ok: false, reason: 'no-such-building' };

    const plan = buyPlan(this.state, building, this.state.prefs.buyAmount);
    const bought = applyBuyPlan(this.state, building, plan);
    if (!bought) {
      this.events.emit('denied', { reason: 'too-expensive', item: building });
      return { ok: false, reason: 'too-expensive', plan };
    }

    this.invalidate();
    this.events.emit('bought', { item: building, count: bought, cost: plan.total });
    this.events.emit('sound', 'buy');
    return { ok: true, count: bought, plan };
  }

  /** Buy a one-shot upgrade from the click/cookie/research families. */
  buyUpgrade(family, id) {
    const table = { click: CLICK_UPGRADES, cookie: COOKIE_UPGRADES, research: RESEARCH }[family];
    const item = table?.find((u) => u.id === id);
    if (!item) return { ok: false, reason: 'no-such-upgrade' };
    if (this.state.upgrades[family][id]) return { ok: false, reason: 'owned' };
    if (this.state.cookies < item.cost) {
      this.events.emit('denied', { reason: 'too-expensive', item });
      return { ok: false, reason: 'too-expensive' };
    }

    this.state.cookies -= item.cost;
    this.state.upgrades[family][id] = true;

    // The radar is the gate on scheduled goldens, so buying it starts one.
    if (id === 'goldenRadar') this.scheduleGolden(this.now());

    this.invalidate();
    this.events.emit('bought', { item, count: 1, cost: item.cost });
    this.events.emit('sound', 'buy');
    return { ok: true };
  }

  /** Buy levels of a prestige upgrade with Heavenly Chips. */
  buyPrestige(id) {
    const upgrade = PRESTIGE_BY_ID[id];
    if (!upgrade) return { ok: false, reason: 'no-such-upgrade' };

    const plan = prestigePlan(this.state, upgrade, this.state.prefs.buyAmount);
    const bought = applyPrestigePlan(this.state, upgrade, plan);
    if (!bought) {
      this.events.emit('denied', { reason: 'not-enough-chips', item: upgrade });
      return { ok: false, reason: 'not-enough-chips', plan };
    }

    // Garden Expansion changes the plot count, so the garden must re-render.
    if (id === 'gardenExpansion') {
      this.state.garden.plots.length = this.state.garden.plotCount;
      this.events.emit('garden-changed');
    }

    this.invalidate();
    this.events.emit('bought', { item: upgrade, count: bought, cost: plan.cost });
    this.events.emit('sound', 'buy');
    return { ok: true, count: bought, plan };
  }

  // -------------------------------------------------------------------------
  // Ascension
  // -------------------------------------------------------------------------

  get chipGain() {
    return chipsGain(this.state);
  }

  /** Ascend. `confirmed` is set by the caller after the player agrees. */
  ascend() {
    const gain = this.chipGain;
    if (gain <= 0) return { ok: false, reason: 'not-enough-cookies' };

    applyAscend(this.state, this.now(), gain);
    this.scheduleGolden(Infinity);
    this.goldenAt = Infinity;

    this.invalidate();
    this.events.emit('ascended', { gain });
    this.events.emit('sound', 'ascend');
    return { ok: true, gain };
  }

  // -------------------------------------------------------------------------
  // Garden
  // -------------------------------------------------------------------------

  plant(plotIndex, seedId) {
    const result = gardenPlant(this.state, plotIndex, seedId, this.now(), this.derived.cps);
    if (result.ok) {
      this.events.emit('garden-changed');
      this.events.emit('sound', 'plant');
      // Harvesting early would be worth more than the printed price, so the shop
      // numbers have to be re-read once the balance moved.
      this.dirty.shop = true;
    }
    return result;
  }

  harvest(plotIndex) {
    const result = gardenHarvest(this.state, plotIndex, this.now());
    if (result.ok) {
      this.invalidate();
      this.events.emit('garden-changed');
      this.events.emit('harvested', result);
      this.events.emit('sound', 'harvest');
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // Market
  // -------------------------------------------------------------------------

  advanceMarket(now) {
    const steps = dueSteps(this.marketAt, now);
    if (steps > 0) {
      tickMarket(this.state, steps, this.rng);
      this.marketAt = now;
      this.state.marketLastTick = now;
      this.dirty.stats = true;
      this.events.emit('market-changed');
    }
  }

  buyStock(symbol, qty = 1) {
    const result = buyShares(this.state, symbol, qty, this.now(), this.rng);
    if (result.ok) {
      this.dirty.stats = true;
      this.dirty.shop = true;
      this.events.emit('traded', result);
      this.events.emit('sound', 'buy');
    } else if (result.reason === 'too-expensive') {
      this.events.emit('denied', { reason: 'too-expensive' });
    }
    return result;
  }

  sellStock(symbol) {
    const result = sellShare(this.state, symbol, this.now());
    if (result.ok) {
      this.invalidate();
      this.dirty.stats = true;
      this.events.emit('traded', result);
      this.events.emit('sound', 'sell');
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // Goldens and abilities
  // -------------------------------------------------------------------------

  scheduleGolden(now = this.now()) {
    const delay = nextDelayMs(this.state, this.rng);
    this.goldenAt = delay === null ? Infinity : now + delay;
  }

  advanceGoldens(now) {
    if (!goldensUnlocked(this.state)) {
      this.goldenAt = Infinity;
      return;
    }
    if (now < this.goldenAt) return;

    if (liveGoldens(this.state, now).length < UI.maxGoldens) {
      summonGolden(this.state, now, 1, now);
      this.events.emit('goldens-changed');
    }
    this.scheduleGolden(now);
  }

  clickGolden(goldenId) {
    const now = this.now();
    const result = clickGolden(this.state, goldenId, now, this.effectContext(now), this.rng);
    if (!result) return null;

    this.invalidate();
    this.events.emit('golden-clicked', result);
    this.events.emit('sound', 'golden');
    this.events.emit('goldens-changed');
    return result;
  }

  /** The bundle every effect receives. The two callbacks keep the rules decoupled. */
  effectContext(now = this.now()) {
    return {
      now,
      cps: this.derived.cps,
      cpc: this.derived.cpc,
      summonGolden: (count, when) => {
        summonGolden(this.state, when ?? now, count, when ?? now);
        this.events.emit('goldens-changed');
        return count;
      },
      ripenAll: (when) => {
        const n = ripenAll(this.state, when ?? now);
        if (n) this.events.emit('garden-changed');
        return n;
      },
    };
  }

  /** Press an ability slot: unlocks it if that is what the press means. */
  useAbility(id) {
    const ability = ABILITIES.find((a) => a.id === id);
    if (!ability) return { ok: false, reason: 'no-such-ability' };

    const now = this.now();
    const ctx = this.effectContext(now);

    if (!this.state.abilities[id]?.unlocked) {
      const result = unlockAbility(this.state, id);
      if (!result.ok) {
        this.events.emit('denied', { reason: result.reason, item: ability });
        this.events.emit('ability-locked', { ability, reason: result.reason });
        return result;
      }
      this.invalidate();
      this.events.emit('ability-unlocked', { ability });
      this.events.emit('sound', 'buy');
      return result;
    }

    const result = activateAbility(this.state, id, ctx);
    if (!result.ok) {
      this.events.emit('denied', { reason: result.reason, item: ability });
      return result;
    }

    this.invalidate();
    this.events.emit('ability-fired', { ability, summary: result.summary });
    this.events.emit('sound', 'ability');
    if (result.summary.kind === 'cookies') this.dirty.shop = true;
    return result;
  }

  abilityStates(now = this.now()) {
    return allAbilityStatuses(this.state, now);
  }

  // -------------------------------------------------------------------------
  // Cosmetics
  // -------------------------------------------------------------------------

  setTheme(id) {
    const theme = THEMES.find((t) => t.id === id);
    if (!theme) return false;
    this.state.prefs.theme = id;
    if (!this.state.prefs.themesUsed.includes(id)) this.state.prefs.themesUsed.push(id);
    this.events.emit('theme-changed', theme);
    this.dirty.achievements = true;
    return true;
  }

  setSkin(id) {
    if (!this.state.prefs.ownedSkins.includes(id)) return false;
    this.state.prefs.skin = id;
    this.events.emit('skin-changed', COOKIE_SKINS.find((s) => s.id === id));
    this.invalidate();
    return true;
  }

  buySkin(id) {
    const skin = COOKIE_SKINS.find((s) => s.id === id);
    if (!skin) return { ok: false, reason: 'no-such-skin' };
    if (this.state.prefs.ownedSkins.includes(id)) return { ok: false, reason: 'owned' };
    if (this.state.cookies < skin.cost) {
      this.events.emit('denied', { reason: 'too-expensive', item: skin });
      return { ok: false, reason: 'too-expensive' };
    }

    this.state.cookies -= skin.cost;
    this.state.prefs.ownedSkins.push(id);
    this.state.prefs.skin = id;
    this.invalidate();
    this.events.emit('skin-changed', skin);
    this.events.emit('skin-unlocked', skin);
    this.events.emit('sound', 'buy');
    return { ok: true };
  }

  setFontScale(value) {
    this.state.prefs.fontScale = value;
    this.events.emit('font-scale-changed', value);
    return true;
  }

  setReduceMotion(on) {
    this.state.prefs.reduceMotion = !!on;
    this.events.emit('reduce-motion-changed', !!on);
    return true;
  }

  setBuyAmount(amount) {
    this.state.prefs.buyAmount = amount;
    this.dirty.shop = true;
    this.events.emit('buy-amount-changed', amount);
    return true;
  }

  // -------------------------------------------------------------------------
  // Readouts for the UI
  // -------------------------------------------------------------------------

  /** Count of shop items the player could buy right now, for the nav badge. */
  affordableCount() {
    const s = this.state;
    let n = 0;

    for (const b of BUILDINGS) {
      if (buyPlan(s, b, s.prefs.buyAmount).affordable) n++;
    }
    for (const u of CLICK_UPGRADES) if (!s.upgrades.click[u.id] && s.cookies >= u.cost) n++;
    for (const u of COOKIE_UPGRADES) if (!s.upgrades.cookie[u.id] && s.cookies >= u.cost) n++;
    for (const u of RESEARCH) if (!s.upgrades.research[u.id] && s.cookies >= u.cost) n++;

    return n;
  }

  /** Preview the /sec gain from buying `count` more of a building. */
  previewBuildingGain(building, count = 1) {
    const owned = this.state.buildings[building.id] ?? 0;
    return cpsFor(this.state, this.now(), { id: building.id, owned: owned + count })
      - this.derived.cps;
  }

  /** Elapsed playtime, including the current un-flushed session. */
  playtimeMs(now = this.now()) {
    return (this.state.playMs ?? 0) + Math.max(0, now - this.lastTickAt);
  }

  get version() {
    return BALANCE_VERSION;
  }
}

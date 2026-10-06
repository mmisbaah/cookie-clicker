# 🍪 Cookie Empire

An idle cookie game. Click the cookie, buy buildings, research, ascend, grow a
garden, and gamble on the cookie market. Everything runs in the browser, nothing
is sent anywhere, and the whole thing is plain ES modules with no build step.

```
npm start          # http://127.0.0.1:5173
npm test           # 169 tests
npm run verify     # dead-code sweep + icon-art check + tests
```

No dependencies. `npm install` does nothing because there is nothing to install.

---

## What is in here

| Layer | Location | Rule |
|---|---|---|
| Content | `shared/balance.js` | Pure data. Every building, upgrade, theme and stock price. |
| Rules | `shared/*.js` | Pure functions of `(state, now)`. No DOM, no timers, no `Math.random`. |
| Controller | `public/src/sim/game.js` | Owns the state and the clock. Knows when things happen, not how they look. |
| View | `public/src/ui/*.js` | Reads the controller, draws the DOM, calls back into it. |

The split that matters: **`shared/` is imported verbatim by both the browser and
the test suite.** There is no build step, no copy, and nothing to keep in sync, so
a passing test is a statement about the code that actually ships.

---

## The decisions worth knowing about

Most of the interesting engineering here is about avoiding specific bugs rather
than adding features.

### Time is absolute, never counted

Crops, cooldowns, buffs, golden cookies and autosaves all store **absolute
timestamps**, never a countdown or an accumulator.

```js
state.garden.plots[i] = { seedId, plantedAt: now, readyAt: now + seed.growMs }
```

The consequence is that a crop grows correctly across a closed tab, a reload, a
sleeping laptop and a clock correction, with no catch-up code and nothing to
reconcile. Maturity is a fact about the world, not a timer the page owns.

### Offline earnings integrate across buff boundaries

The obvious implementation is *departure rate × gap*. That pays a 30-second
Frenzy for a four-hour absence, which is both wrong and exploitable — leave just
after a golden cookie and come back tomorrow.

`integrateCookies` walks the absence in slices, breaking at each buff expiry, so
a timed effect is paid only for the part of the gap it was actually alive for.

### Two loops, on purpose

Rendering runs on `requestAnimationFrame`, which browsers pause in a background
tab. A simulation driven only by rAF makes no progress while hidden, which is
wrong for an idle game. So a `setInterval` backstop advances the simulation
(tick only, never render). `tick` is idempotent with respect to elapsed time — it
works out how far the clock moved since its last call — so the two loops cannot
double-count. A second tick in the same millisecond adds exactly zero cookies.

### Prices never round upward

`fmt` truncates rather than rounds. The same formatter prices shop buttons and
reports balances, and rounding up means a player holding 123,500 sees a button
reading `124K` with the button greyed out and no way to work out why.

Truncating can only ever *understate* a price. Rates get their own formatter
(`fmtRate`) for the opposite reason: a fresh save makes 0.1 cookies a second, and
a HUD reading `0/sec` next to a cookie that visibly does nothing is the most
confusing first thirty seconds in the game.

### The garden cannot be farmed

Seed price and seed yield derive from one number:

```js
cost  = max(1, value * 2)
yield = value
```

so `cost > yield` holds structurally at every production rate, including zero.
An earlier version floored both at 1, which made an infinite-money glitch out of
a fresh save.

### Saving cannot brick the game

Every field on load is validated and coerced; `load` returns a report of what it
had to repair rather than throwing. A player who edited a number into nonsense
gets a working save and a warning, not a white screen.

Writes go to a backup key first. If the primary is found corrupt on load, the
backup is tried — a tab closed mid-`JSON.stringify` otherwise loses the run.

### Content evolves without invalidating saves

Every collection is a plain object keyed by id, never an array. A save from an
older version loads with new items present and at zero, which is what a player
expects. `reconcileState` adds what is missing, drops what no longer exists, and
clamps what should not be negative.

### One clock per concern

`main.js` reads `game.now()` (a `Date.now()` epoch) and uses the rAF timestamp
*only* to schedule. Passing the rAF timestamp into the game — which is
`performance.now()`-based elapsed time since page load — makes a carrot planted
"in the future by 56 years" and stalls production entirely.

### Refresh rates are a design decision

`config.js` holds how often each view may be out of date. The cookie counter runs
every frame because it is three text nodes; the shop rebuilds only when a filter
or a purchase changes it. The garden and the market do not tick at all while
their panel is closed.

### Appearance is applied in one place

`main.js` subscribes to `theme-changed`, `skin-changed`, `font-scale-changed` and
`reduce-motion-changed` and does the painting. Panels only change state. The
alternative — each panel painting its own change — means an imported save, a
settings reset, or a console call updates the state and silently leaves the DOM
showing the old colours.

---

## Layout

```
shared/
  balance.js      all content and tuning constants (pure data)
  state.js        save shape + reconcile against a changed balance
  economy.js      costs, the multiplier stack, prestige, ascension
  effects.js      the closed vocabulary of timed/lump effects
  abilities.js    unlock, cooldowns, activation
  achievements.js predicate evaluation and milestones
  garden.js       plots, growth, harvest
  market.js       the mean-reverting random walk
  golden.js       golden cookies and their schedule
  offline.js      integrating production across an absence
  save.js         serialise, validate, repair, import/export
  format.js       number and duration formatting
  rng.js          seeded random
  test/           169 tests, node:test, no framework

public/
  index.html      the shell
  style.css       one stylesheet, rem units, theme custom properties
  src/
    main.js       boot order, input, the frame loop
    config.js     refresh rates
    sim/          game controller, audio
    ui/           hud, shop, garden, market, awards, look, settings,
                  dialog, toast, tooltip, pages, dom

server/serve.js   dependency-free static server
tools/            dead-code sweep
```

---

## The game

**Buildings** — eight, on the classic 1.15 cost curve.

**Click upgrades** — six, including Golden Cookie Radar and a per-click 5% chance
to summon a golden that works *before* the radar is bought.

**Cookie & research** — twelve percentage-point upgrades, and research with four
effect shapes: synergies (Farm Synergy pays +1% per Mine you own, so it is a bet
on Mines), outright building multipliers, global multipliers, and kittens that
scale with achievement count.

**Abilities** — seven, hotkeys `1`–`7`, each unlocking once and then recharging.
Cookie Rain grants 300 seconds of production; Harvest Rush ripens every crop;
Chrono Warp clears every cooldown including its own.

**Ascension** — resets the run for Heavenly Chips on a cube-root curve, which
grows slower than the empire does. Eight permanent upgrades spend those chips.

**Garden** — eight plots at the start, more with Garden Expansion. Seeds are
priced from your production, so the garden scales with you, and the payout is
locked in at planting so a big upgrade mid-growth cannot inflate the reward.

**Market** — five tickers on a mean-reverting random walk. Without the pull term
toward the starting price, COOK trends to its clamp within the hour and every
decision is "wait".

**Achievements** — thirty-nine, each worth +2% production, with milestone
multipliers at 5, 10 and 15.

**Cosmetics** — eight themes and ten cookie skins, some of which grant a
production bonus. A theme is one row of CSS custom properties; adding a ninth
needs no CSS at all.

---

## Testing

169 tests under `node:test`, no framework, no mocks. Because `shared/` is pure,
most tests are arithmetic on a hand-built state:

```js
test('cookie upgrades are additive percentage points, not compounding', () => {
  const s = stateWith(0, { grandma: 100 });
  const baseline = cps(s, NOW);

  s.upgrades.cookie.choco = true;    // +1%
  assert.ok(Math.abs(cps(s, NOW) / baseline - 1.01) < 1e-9);

  s.upgrades.cookie.peanut = true;   // +2%
  assert.ok(Math.abs(cps(s, NOW) / baseline - 1.03) < 1e-9, '+1 then +2 must be +3, not +3.02');
});
```

`maxAffordable` is checked against a brute-force oracle across 30 combinations of
owned-count and budget. The market's mean reversion is checked by running 2000
steps from a price shoved 10× off its baseline and asserting it comes back. Every
golden-cookie effect and every ability is checked to actually change state and to
match the multiplier its description promises.

`npm run check` sweeps for imported-but-unused bindings and exports no module
imports. Test files count as consumers there, because a helper that exists so a
test can reach it is a legitimate seam — `isKnownEffect` validates the balance
tables, `applyGoldenEffect` gives a deterministic entry point into a randomised
system.

---

## Deployment

The game is live at **<https://cookieclicker.atollingo.com>**, on Cloudflare Pages
(project `cookieclicker-atollingo`).

In development the game is served from two roots — `public/` at `/` and `shared/`
at `/shared/` — because the client imports the rules layer directly and the tests
must see the same files. A static host has one root, so before deploying:

```
node tools/deploy.mjs   # assembles dist/ = public/ + shared/
```

`dist/` is byte-identical to the repo: packaging, not a build step. `dist/` is
gitignored; the site in git plus `node tools/deploy.mjs` is reproducible.


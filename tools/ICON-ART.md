# Icon art contract

Every emoji in the balance tables is a **key**. `public/src/ui/icon.js` looks the
key up in `public/src/ui/art.js` and draws the SVG it finds; if it finds nothing
it renders the emoji it was given. A key with no art is therefore not a bug, but
it is a visible seam — the set should end up complete.

Read `public/src/ui/art/cookie.js` before writing anything. It is the reference
for everything below.

## What "realistic" means here

These are 16px to 40px illustrations, not photographs. Realism at that size is
carried by four things, in order of how much they matter:

1. **Silhouette.** It has to read with the detail turned off. Test it by
   squinting: if two icons in the set become the same shape, redraw one.
2. **A single light source, upper-left.** Every object in the set is lit from
   the same place. Highlights go up and to the left, shadows down and to the
   right, cast shadows offset down-right.
3. **Material, not fill.** No flat colour on a surface that is meant to be an
   object. Three stops on a gradient — lit, local colour, shaded — is the
   minimum. Metal wants a hard band of highlight; dough wants a soft one; glass
   wants a rim and a small blown-out spec.
4. **Weight underneath.** A soft dark ellipse below and slightly behind the
   object. Without it objects float; with it they sit.

Things that read as *cartoon* and must be avoided:

- black outlines around a shape (use a darker shade of the material instead)
- pure `#000` on anything small (it fills in and turns to a blob)
- neon saturation on something that is meant to be wood, dough or stone
- drop-shadow `filter`s on the whole icon (draw the shadow instead — it scales
  with the art, and a filter tuned for 40px is wrong at 16px)

## Technical rules

Hard constraints. A broken icon falls back to its emoji, so a mistake here shows
up as "my icon did nothing" rather than as a parse failure.

- Root: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">`
- Well-formed XML. Every tag closed, self-closing with `/>`, attributes in
  double quotes, `&` written as `&amp;`. This is parsed with `DOMParser` as
  `image/svg+xml`, which is strict in a way the HTML parser is not: one bare `&`
  or one unclosed `<g>` and the whole icon fails.
- No `feTurbulence`. The grain on the big cookie comes from the stylesheet, and
  noise that is tuned for 240px rasterises as sub-pixel mush at 16px.
  `feGaussianBlur` is fine and is used for shadows.
- No `<image>`, no `xlink:href` to a URL, no `<style>`, no `class` on children
  (the root's class is overwritten on registration), no `<script>`.
- `id`s **may** be used and are automatically namespaced on registration, so
  `url(#dough)` in one icon and `url(#dough)` in another cannot collide. Use
  short, obvious names.
- Keep the artwork inside roughly `4..60` on both axes — a couple of units of
  margin so the icon does not touch its box — while leaving the object large
  enough to read.
- Aim for under ~2.5 KB of markup per icon.

## Tools available

`public/src/ui/art/shape.js` exports the helpers `cookie.js` uses. Use them
rather than inventing parallel maths:

| helper | what it does |
| --- | --- |
| `blob(cx, cy, radii, phase?)` | an organic closed disc — a circle sampled at several angles and smoothed through them |
| `chipPath(r, shape?)` | a small irregular blob centred on the origin, for chips, crumbs, blobs |
| `mix(a, b, t)` | blend two `#rrggbb` colours |
| `shade(hex, amount)` | `+1` toward white, `-1` toward black — derive highlights from the material |
| `alpha(hex, a)` | `#rrggbb` plus alpha, as an `rgba()` string |

`mix` and `shade` are the important ones: a highlight should still look like the
material it is highlighting, so derive it from the palette rather than reaching
for `#ffffff`.

## Where the art goes

One module per category, each exporting a flat `emoji -> svg string` map. The
emoji in the map **must** be the exact emoji used in `shared/balance.js` — or,
for the chrome, the exact emoji written in `public/index.html`.

| file | export | contents |
| --- | --- | --- |
| `art/cookie.js` | `COOKIE_ART` | the ten cookie skins |
| `art/buildings.js` | `BUILDING_ART` | buildings, click upgrades, research tools |
| `art/powers.js` | `POWER_ART` | abilities, prestige, research |
| `art/awards.js` | `AWARD_ART` | achievements, medals, stat marks |
| `art/world.js` | `WORLD_ART` | ingredients, crops, market, interface, chrome, scenery |
| `art.js` | `ART` | composes the above — edit this to add a module |

`world.js` is the overflow module: interface marks (`🛠️ ♻️ 👋 …`), the glyphs in
`index.html` (`🛒 ⚙️ 🔍 🔤 💾`), and the five themes named after a place or a sky
rather than a thing (`🏝️ 🌙 🌸 🌿 ☀️`). Reach for a new module only when a
category has enough art of its own to justify the file.

## How art reaches the screen

There are exactly three ways, and every call site uses one of them:

| where | what to write | who draws |
| --- | --- | --- |
| a node you are building | `el('span.tile-icon', { icon: item.icon })` | `el()`'s `icon:` case |
| a node you reuse between renders | `setIcon(node, emoji)` | you, when it changes |
| markup already in `index.html` | `data-icon="🍪"` on the element | `hydrateIcons()` at boot |

Emoji-led **label strings** (`"🏭 Production"`, `"✨ Meta"`, `"🍪 Classic"`) are
a fourth case, because splitting them by hand in every caller would be the same
four lines in six files. `labelNode()` in `dom.js` takes them apart — drawing
first, words after — and hands the string straight back when there is no leading
emoji. Use it anywhere a table's label is rendered as a whole.

Two rules that fall out of this:

- Never set an emoji with `text:` or `textContent` if it has art. That is the
  one way to end up with a hole in the set: the fallback works, so nothing
  breaks, and the seam only shows.
- The garden repaints four times a second, so `setIcon()` on a plot goes through
  `setPlotIcon()`, which skips the rebuild when the emoji has not changed. Swap
  wholesale on a 250 ms timer and you pay for a cloned SVG subtree per plot,
  sixteen times a second, for an identical result.

`index.html` keeps the emoji as its element's text as well as in `data-icon`.
That is deliberate: if art is missing or fails to parse, `iconNode()` returns the
character it was given, so the label reads exactly as it did before the art
existed.

## Checking your work

From the repo root:

```
npm run check        # no orphaned exports, no unused imports
npm run verify-art   # 102 icons: hex literals, NaN, tag balance
npm test             # 169 tests, none of which may change
npm run verify       # all three
```

`verify-art` exists because `DOMParser` will accept `fill="#NaNNaNNaN"` happily
— it is a well-formed attribute value — so a `shade()` handed a `url(#...)`
instead of a hex paints black and the browser reports nothing. Geometry is the
other half, and that one needs a DOM.

Open a tab on `http://127.0.0.1:5173/` (the server is `npm start`) for that half.
The cache-busting query is what makes the import pick up the file you just
edited. Evaluate this against **your** module:

```js
(async () => {
  const mod = await import('/src/ui/art/powers.js?v=' + Date.now());
  const art = Object.values(mod)[0];
  const problems = [];
  for (const [emoji, source] of Object.entries(art)) {
    if (!source) { problems.push(emoji + ' -> still null'); continue; }
    const root = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
    if (root.nodeName === 'parsererror' || root.querySelector('parsererror')) {
      problems.push(emoji + ' -> parse error'); continue;
    }
    if (root.getAttribute('viewBox') !== '0 0 64 64') problems.push(emoji + ' -> wrong viewBox');
    const declared = new Set([...root.querySelectorAll('[id]')].map((e) => e.id));
    for (const el of root.querySelectorAll('*')) {
      for (const a of Array.from(el.attributes)) {
        for (const hit of a.value.match(/url\\(#([^)]+)\\)/g) || []) {
          const id = hit.slice(5, -1);
          if (!declared.has(id)) problems.push(emoji + ' -> unresolved url(#' + id + ')');
        }
      }
    }
    document.body.append(root);
    try {
      const b = root.getBBox();
      if (b.width < 6 || b.height < 6) problems.push(emoji + ' -> empty geometry');
      if (b.x < -4 || b.y < -4 || b.x + b.width > 68 || b.y + b.height > 68) problems.push(emoji + ' -> outside the viewBox');
    } catch { problems.push(emoji + ' -> getBBox threw'); }
    root.remove();
  }
  return problems;
})()
```

An empty array is the goal. `browser.console({ tabID, level: 'warning' })` must
also come back empty — `icon.js` warns on any icon that does not parse.

The last check is the one that matters, and it is not about any single module:
**no emoji that has art may still be sitting in the page as text.** Drawn art
that never gets installed is indistinguishable from art that does not exist, and
the fallback hides it. This walks every text node in the document:

```js
(async () => {
  const { ART } = await import('/src/ui/art.js?v=' + Date.now());
  const keys = Object.keys(ART).filter((k) => ART[k]);
  const leaks = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (!n.textContent || !n.textContent.trim()) continue;
    for (const k of keys) if (n.textContent.includes(k)) {
      leaks.push(k + ' in <' + n.parentElement.tagName.toLowerCase() + '.'
        + (n.parentElement.className || '') + '> :: ' + n.textContent.trim().slice(0, 60));
    }
  }
  return leaks;
})()
```

Empty means done. To be sure the answer is not just a panel that never rendered,
drive the UI first — click every `[data-page]`, then every `[data-panel]` and
every `[data-filter]` inside the shop, auditing after each — because `shop.js`
builds its tiles when the tab is opened rather than at boot. The only entries
worth leaving behind are geometric arrows (`◀ ▶`), which are type rather than
emoticons and read better as glyphs than as drawings.


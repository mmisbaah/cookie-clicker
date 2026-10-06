// Structural validation of the icon art, from Node where no DOM is needed.
//
// This is deliberately separate from the browser pass in `tools/ICON-ART.md`.
// `DOMParser` accepts `fill="#NaNNaNNaN"` without complaint -- it is a valid
// XML attribute value -- so a `shade()` or `mix()` that was handed a `url(#...)`
// instead of a hex silently paints black or nothing at all. That is the one
// failure mode a browser cannot see, and it is the one that has bitten twice
// (a stray Devanagari digit and a word pasted into a hex literal), so the
// colour literals are checked here and the geometry is checked there.
//
// Run: npm run verify-art [module...]
const modules = process.argv.slice(2);

// Only report on the modules we were asked about, by re-importing them.
const selected = [];
for (const name of (modules.length ? modules : ['cookie', 'buildings', 'powers', 'awards', 'world'])) {
  const mod = await import(`../public/src/ui/art/${name}.js`);
  selected.push([name, Object.values(mod)[0]]);
}

const HEX_VALUE = /(fill|stroke|stop-color|stop-opacity|flood-color|lighting-color)="([^"]*)"/g;
const LEGAL = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const problems = [];
let total = 0;

for (const [name, art] of selected) {
  for (const [emoji, source] of Object.entries(art)) {
    total++;
    if (!source) { problems.push(`${name} ${emoji} -> still null`); continue; }
    if (!source.startsWith('<svg ')) problems.push(`${name} ${emoji} -> does not start with <svg`);
    if (!source.trimEnd().endsWith('</svg>')) problems.push(`${name} ${emoji} -> does not end with </svg>`);

    // A colour attribute that starts with # must be a real hex. `url(#id)` is a
    // reference, not a colour, so it is deliberately not matched here.
    for (const m of source.matchAll(HEX_VALUE)) {
      const [, attr, value] = m;
      if (value.startsWith('#') && !LEGAL.test(value)) {
        problems.push(`${name} ${emoji} -> bad ${attr} ${JSON.stringify(value)}`);
      }
      if (value.includes('NaN')) {
        problems.push(`${name} ${emoji} -> ${attr} contains NaN (a mix()/shade() got a url or a non-hex)`);
      }
    }
    // Tag balance: every opened non-void tag must close.
    const stack = [];
    for (const m of source.matchAll(/<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g)) {
      const [, close, tag, , self] = m;
      if (self === '/' || ['path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline',
        'stop', 'feGaussianBlur', 'feTurbulence', 'feColorMatrix', 'use', 'image'].includes(tag)) continue;
      if (close) {
        const top = stack.pop();
        if (top !== tag) { problems.push(`${name} ${emoji} -> </${tag}> closes <${top ?? 'nothing'}>`); break; }
      } else stack.push(tag);
    }
    if (stack.length) problems.push(`${name} ${emoji} -> unclosed <${stack.join('>, <')}>`);
  }
}

console.log(`checked ${total} icons across ${selected.length} modules`);
console.log(problems.length ? `PROBLEMS (${problems.length}):\n` + problems.join('\n') : 'no problems');
if (problems.length) process.exitCode = 1;

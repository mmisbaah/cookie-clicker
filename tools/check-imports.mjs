/**
 * Dead-code sweep.
 *
 * Two failure modes it catches, both invisible in normal play:
 *
 *   - an imported binding nobody reads, and
 *   - an exported symbol no other module imports.
 *
 * Test files count as consumers, because a helper that exists only so a test can
 * reach it is a legitimate testing seam -- `isKnownEffect` validates the balance
 * tables, `applyGoldenEffect` gives a deterministic entry point into a
 * randomised system. Removing those would be removing the tests.
 *
 * Run: node tools/check-imports.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = fileURLToPathSafe(new URL('..', import.meta.url));

function fileURLToPathSafe(url) {
  // Windows gives "/C:/x/y"; strip the leading slash so path.join behaves.
  return decodeURIComponent(url.pathname).replace(/^\/([A-Za-z]:)/, '$1');
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (extname(full) === '.js') out.push(full);
  }
  return out;
}

const files = [
  ...walk(join(ROOT, 'shared')),
  ...walk(join(ROOT, 'public')),
  ...walk(join(ROOT, 'server')),
  ...walk(join(ROOT, 'test')),
];

const sources = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
const problems = [];

/** Word boundary that also works for `$` and `_`, which `\b` does not cover. */
const boundary = (name) => `(?<![\\w$])${name.replace(/[$]/g, '\\$')}(?![\\w$])`;

const IMPORT_RE = /import\s+\{([^}]+)\}\s+from\s+['"][^'"]+['"]/g;

for (const [file, text] of sources) {
  const body = text.replace(IMPORT_RE, '');
  const rel = relative(ROOT, file);

  for (const match of text.matchAll(IMPORT_RE)) {
    for (const raw of match[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/).pop().trim();
      if (!name) continue;
      if (!(body.match(new RegExp(boundary(name), 'g')) ?? []).length) {
        problems.push(`${rel}: unused import "${name}"`);
      }
    }
  }
}

const EXPORT_RE = /export\s+(?:async\s+)?(?:function|const|class|let)\s+([A-Za-z_$][\w$]*)/g;

for (const [file, text] of sources) {
  const rel = relative(ROOT, file);
  for (const match of text.matchAll(EXPORT_RE)) {
    const name = match[1];
    const importedElsewhere = [...sources.entries()]
      .filter(([f]) => f !== file)
      .some(([, t]) => new RegExp(boundary(name)).test(t));
    if (importedElsewhere) continue;

    // No external importer: only acceptable if it is used more than once inside
    // its own module (a declaration plus at least one call site).
    const selfUses = (text.match(new RegExp(boundary(name), 'g')) ?? []).length;
    if (selfUses <= 1) problems.push(`${rel}: exported "${name}" is never imported anywhere`);
  }
}

if (problems.length === 0) {
  console.log('clean: no unused imports, no orphaned exports');
} else {
  console.log(problems.join('\n'));
  console.log(`\n${problems.length} issue(s)`);
  process.exitCode = 1;
}

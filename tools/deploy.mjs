/**
 * Assemble the deployable site into `dist/`.
 *
 * In development the game is served from two roots: `public/` at `/` and
 * `shared/` at `/shared/`. That split is deliberate -- the client imports the
 * rules layer directly, so the browser and the test suite are provably running
 * the same files, with no bundler and no copy step to keep in sync.
 *
 * A static host has one root, so this copies both trees into one directory:
 *
 *     dist/index.html      <- public/index.html
 *     dist/src/...         <- public/src/...
 *     dist/shared/...      <- shared/...
 *
 * Nothing is transformed. This is packaging, not a build: the files in `dist/`
 * are byte-identical to the ones in the repo, and `npm start` still runs the
 * game straight from source.
 *
 * Run: node tools/deploy.mjs
 */
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = join(ROOT, 'dist');

async function copyTree(from, to) {
  await mkdir(to, { recursive: true });
  let files = 0;
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const src = join(from, entry.name);
    const dest = join(to, entry.name);
    if (entry.isDirectory()) {
      files += await copyTree(src, dest);
    } else {
      await cp(src, dest);
      files++;
    }
  }
  return files;
}

// Start from empty: a file deleted from the source must not survive into the
// next deploy, or the host serves something the repo no longer contains.
await rm(OUT, { recursive: true, force: true });

const publicFiles = await copyTree(join(ROOT, 'public'), OUT);
const sharedFiles = await copyTree(join(ROOT, 'shared'), join(OUT, 'shared'));

console.log(`dist/ ready: ${publicFiles + sharedFiles} files`);
console.log(`  from public/  ${publicFiles}`);
console.log(`  from shared/  ${sharedFiles}`);

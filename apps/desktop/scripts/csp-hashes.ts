// `bun run build:csp`: hashes every inline <script> of the web static export (apps/web/out) into dist/csp-hashes.json,
// which the packaged main process reads to build its Content-Security-Policy. Run it after `next build`.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CSP_HASHES_FILE, inlineScriptHashes } from '../src/csp';

const desktop = path.join(import.meta.dir, '..');
const webOut = path.join(desktop, '..', 'web', 'out');

const entries = await readdir(webOut, { recursive: true }).catch(() => {
	console.error(`No web export at ${webOut}: run \`bun run --filter @tempi/web build\` first.`);
	process.exit(1);
});
const pages = entries.filter(entry => entry.endsWith('.html'));
if (pages.length === 0) {
	console.error(`No HTML pages in ${webOut}.`);
	process.exit(1);
}

const hashes = new Set<string>();
for (const page of pages) {
	for (const hash of inlineScriptHashes(await readFile(path.join(webOut, page), 'utf8'))) hashes.add(hash);
}

const target = path.join(desktop, 'dist', CSP_HASHES_FILE);
await mkdir(path.dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify([...hashes].sort(), null, '\t')}\n`);
console.log(`Wrote ${hashes.size} inline script hashes from ${pages.length} pages to ${path.relative(desktop, target)}`);

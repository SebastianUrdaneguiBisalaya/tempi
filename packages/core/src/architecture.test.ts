import { expect, test } from 'bun:test';

// Core must stay portable to any adapter (Electron, web, sync): it may import only its own modules and zod.
test('core source imports only its own modules and zod', async () => {
	const offenders: string[] = [];
	for await (const path of new Bun.Glob('**/*.ts').scan({ cwd: import.meta.dir })) {
		// Test code may use bun:test; only shipped source is checked.
		if (path.endsWith('.test.ts') || path.endsWith('test-fakes.ts')) continue;
		const source = await Bun.file(`${import.meta.dir}/${path}`).text();
		for (const [, specifier] of source.matchAll(/from\s+'([^']+)'/g)) {
			if (specifier !== undefined && !specifier.startsWith('.') && specifier !== 'zod') offenders.push(`${path}: ${specifier}`);
		}
	}
	expect(offenders).toEqual([]);
});

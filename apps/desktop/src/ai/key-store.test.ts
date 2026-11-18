import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Cipher } from '../google/token-store';
import { createAiKeyStore } from './key-store';

// Stands in for safeStorage: reversible, and the result never contains the plain text.
const cipher = (available = true): Cipher => ({
	decrypt: data => Promise.resolve(Buffer.from(data.toString('utf8'), 'base64').reverse().toString('utf8')),
	encrypt: text => Promise.resolve(Buffer.from(Buffer.from(text, 'utf8').reverse().toString('base64'), 'utf8')),
	isAvailable: () => Promise.resolve(available),
});

const none = { anthropic: false, elevenlabs: false, google: false, groq: false, openai: false, xai: false };

let dir: string;
let file: string;

beforeEach(async () => {
	dir = await mkdtemp(path.join(tmpdir(), 'tempi-ai-keys-'));
	file = path.join(dir, 'ai-keys.bin');
});

afterEach(() => rm(dir, { force: true, recursive: true }));

describe('AI key store', () => {
	test('starts with no keys', async () => {
		const store = createAiKeyStore(file, cipher());
		expect(await store.flags()).toEqual(none);
		expect(await store.get('openai')).toBeNull();
	});

	test('keeps each provider’s key, surviving a new store on the same file (a restart)', async () => {
		await createAiKeyStore(file, cipher()).save('openai', 'sk-openai');
		await createAiKeyStore(file, cipher()).save('elevenlabs', 'xi-eleven');
		const restarted = createAiKeyStore(file, cipher());
		expect(await restarted.get('openai')).toBe('sk-openai');
		expect(await restarted.get('elevenlabs')).toBe('xi-eleven');
		expect(await restarted.flags()).toEqual({ ...none, elevenlabs: true, openai: true });
	});

	test('never writes a key in clear, and keeps the file private to the user', async () => {
		await createAiKeyStore(file, cipher()).save('anthropic', 'sk-ant-secret');
		expect(await readFile(file, 'utf8')).not.toContain('sk-ant-secret');
		if (process.platform !== 'win32') expect((await stat(file)).mode & 0o777).toBe(0o600);
	});

	test('refuses to save when encryption is unavailable', async () => {
		const store = createAiKeyStore(file, cipher(false));
		await expect(store.save('groq', 'gsk-secret')).rejects.toThrow('encryption is unavailable');
		expect(await Bun.file(file).exists()).toBe(false);
	});

	test('remove deletes only that key, and the file once none is left', async () => {
		const store = createAiKeyStore(file, cipher());
		await store.save('openai', 'sk-openai');
		await store.save('xai', 'xai-key');
		await store.remove('openai');
		expect(await store.flags()).toEqual({ ...none, xai: true });
		await store.remove('xai');
		await store.remove('xai');
		expect(await Bun.file(file).exists()).toBe(false);
	});

	test('treats a file it cannot decrypt or parse as no keys', async () => {
		const store = createAiKeyStore(file, cipher());
		await writeFile(file, 'not encrypted');
		expect(await store.flags()).toEqual(none);
		await writeFile(file, await cipher().encrypt(JSON.stringify({ openai: '' })));
		expect(await store.get('openai')).toBeNull();
	});
});

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type Cipher, createTokenStore, type StoredAccount } from './token-store';

// Stands in for safeStorage: reversible, and the result never contains the plain text.
const cipher = (available = true): Cipher => ({
	decrypt: data => Promise.resolve(Buffer.from(data.toString('utf8'), 'base64').reverse().toString('utf8')),
	encrypt: text => Promise.resolve(Buffer.from(Buffer.from(text, 'utf8').reverse().toString('base64'), 'utf8')),
	isAvailable: () => Promise.resolve(available),
});

const account: StoredAccount = {
	accessToken: 'ya29.access',
	email: 'ada@example.com',
	expiresAt: '2026-11-16T11:00:00.000Z',
	refreshToken: '1//refresh-secret',
	scope: 'openid email',
	subject: '1234567890',
};

let dir: string;
let file: string;

beforeEach(async () => {
	dir = await mkdtemp(path.join(tmpdir(), 'tempi-tokens-'));
	file = path.join(dir, 'google-account.bin');
});

afterEach(() => rm(dir, { force: true, recursive: true }));

describe('token store', () => {
	test('reads back what it wrote', async () => {
		const store = createTokenStore(file, cipher());
		expect(await store.read()).toBeNull();
		await store.write(account);
		expect(await store.read()).toEqual(account);
	});

	test('never writes the tokens in clear, and keeps the file private to the user', async () => {
		await createTokenStore(file, cipher()).write(account);
		const raw = await readFile(file, 'utf8');
		expect(raw).not.toContain(account.refreshToken);
		expect(raw).not.toContain(account.accessToken);
		if (process.platform !== 'win32') expect((await stat(file)).mode & 0o777).toBe(0o600);
	});

	test('refuses to write when encryption is unavailable', async () => {
		const store = createTokenStore(file, cipher(false));
		await expect(store.write(account)).rejects.toThrow('encryption is unavailable');
		expect(await Bun.file(file).exists()).toBe(false);
	});

	test('treats a file it cannot decrypt or parse as no account', async () => {
		const store = createTokenStore(file, cipher());
		await writeFile(file, 'not encrypted');
		expect(await store.read()).toBeNull();
		await writeFile(file, await cipher().encrypt(JSON.stringify({ email: 'ada@example.com' })));
		expect(await store.read()).toBeNull();
	});

	test('clear deletes the tokens, and is safe to repeat', async () => {
		const store = createTokenStore(file, cipher());
		await store.write(account);
		await store.clear();
		await store.clear();
		expect(await Bun.file(file).exists()).toBe(false);
		expect(await store.read()).toBeNull();
	});
});

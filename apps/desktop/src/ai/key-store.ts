import { chmod, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { AI_PROVIDERS, type AiKeyFlags, type AiProvider, aiKeyFlagsSchema } from '@tempi/core';
import { z } from 'zod';
import type { Cipher } from '../google/token-store';

const storedKeysSchema = z.partialRecord(z.enum(AI_PROVIDERS), z.string().min(1));

type StoredKeys = z.output<typeof storedKeysSchema>;

/** The user's AI provider keys, kept in one file encrypted with the OS key. Nothing here is ever written in clear. */
export type AiKeyStore = {
	/** False when the OS can't really protect the key; keys are then never saved. */
	isAvailable: () => boolean;
	/** Whether each provider has a key. */
	flags: () => Promise<AiKeyFlags>;
	/** A provider's key, or null if none is saved or the file can't be read. */
	get: (provider: AiProvider) => Promise<string | null>;
	/** Saves or replaces a provider's key. Throws when encryption is unavailable instead of writing plain text. */
	save: (provider: AiProvider, key: string) => Promise<void>;
	/** Deletes a provider's key; safe to repeat. */
	remove: (provider: AiProvider) => Promise<void>;
};

const isMissing = (error: unknown): boolean => error instanceof Error && 'code' in error && error.code === 'ENOENT';

export const createAiKeyStore = (file: string, cipher: Cipher): AiKeyStore => {
	const read = async (): Promise<StoredKeys> => {
		let data: Buffer;
		try {
			data = await readFile(file);
		} catch (error) {
			if (isMissing(error)) return {};
			throw error;
		}
		try {
			const parsed = storedKeysSchema.safeParse(JSON.parse(cipher.decrypt(data)));
			if (parsed.success) return parsed.data;
			// Never log the parse error itself: its input holds the keys.
			console.error('The stored AI keys are malformed; treating them as absent');
		} catch {
			console.error('The stored AI keys could not be decrypted; treating them as absent');
		}
		return {};
	};

	const write = async (keys: StoredKeys): Promise<void> => {
		if (Object.keys(keys).length === 0) {
			await rm(file, { force: true });
			return;
		}
		if (!cipher.isAvailable()) throw new Error('Refusing to store AI keys: encryption is unavailable');
		const data = cipher.encrypt(JSON.stringify(keys));
		// Written aside and renamed over, so a crash never leaves half a file; readable by this OS user only.
		const staged = `${file}.tmp`;
		await writeFile(staged, data, { mode: 0o600 });
		await chmod(staged, 0o600);
		await rename(staged, file);
	};

	return {
		flags: async () => {
			const keys = await read();
			return aiKeyFlagsSchema.parse(Object.fromEntries(AI_PROVIDERS.map(provider => [provider, keys[provider] !== undefined])));
		},
		get: async provider => (await read())[provider] ?? null,
		isAvailable: cipher.isAvailable,
		remove: async provider => {
			const { [provider]: _, ...rest } = await read();
			await write(rest);
		},
		save: async (provider, key) => {
			if (!cipher.isAvailable()) throw new Error('Refusing to store AI keys: encryption is unavailable');
			await write({ ...(await read()), [provider]: key });
		},
	};
};

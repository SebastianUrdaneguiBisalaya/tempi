import { chmod, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { z } from 'zod';

/** What `safeStorage` offers: encryption with a key the OS keeps (Keychain, DPAPI, the Secret Service). */
export type Cipher = {
	/** False when the OS can't really protect the key; tokens are then never stored. */
	isAvailable: () => boolean;
	encrypt: (text: string) => Buffer;
	decrypt: (data: Buffer) => string;
};

const storedAccountSchema = z.object({
	accessToken: z.string().min(1),
	email: z.email(),
	expiresAt: z.iso.datetime({ offset: true }),
	refreshToken: z.string().min(1),
	scope: z.string(),
	subject: z.string().min(1),
});

/** The connected account as kept on disk, encrypted. Only one at a time. */
export type StoredAccount = z.output<typeof storedAccountSchema>;

export type TokenStore = {
	isAvailable: () => boolean;
	/** The stored account, or null if there is none or it can't be read (another OS user's key, a damaged file). */
	read: () => Promise<StoredAccount | null>;
	/** Replaces the stored account. Throws when encryption is unavailable instead of writing plain text. */
	write: (account: StoredAccount) => Promise<void>;
	clear: () => Promise<void>;
};

const isMissing = (error: unknown): boolean => error instanceof Error && 'code' in error && error.code === 'ENOENT';

/** Keeps the account in one file under `userData`, encrypted with `cipher`; nothing about it is ever written in clear. */
export const createTokenStore = (file: string, cipher: Cipher): TokenStore => ({
	clear: () => rm(file, { force: true }),
	isAvailable: cipher.isAvailable,
	read: async () => {
		let data: Buffer;
		try {
			data = await readFile(file);
		} catch (error) {
			if (isMissing(error)) return null;
			throw error;
		}
		try {
			const parsed = storedAccountSchema.safeParse(JSON.parse(cipher.decrypt(data)));
			if (parsed.success) return parsed.data;
			console.error('The stored Google account is malformed; treating it as disconnected', parsed.error.message);
		} catch (error) {
			console.error('The stored Google account could not be decrypted; treating it as disconnected', error);
		}
		return null;
	},
	write: async account => {
		if (!cipher.isAvailable()) throw new Error('Refusing to store Google tokens: encryption is unavailable');
		const data = cipher.encrypt(JSON.stringify(storedAccountSchema.parse(account)));
		// Written aside and renamed over, so a crash never leaves half a file; readable by this OS user only.
		const staged = `${file}.tmp`;
		await writeFile(staged, data, { mode: 0o600 });
		await chmod(staged, 0o600);
		await rename(staged, file);
	},
});

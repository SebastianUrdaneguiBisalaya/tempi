import { z } from 'zod';

/** Image formats an avatar can be stored in. */
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AvatarType = (typeof AVATAR_TYPES)[number];

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const satisfies Record<AvatarType, string>;

/** Avatars are small, already resized images; anything bigger is a raw photo or a bug. */
export const MAX_AVATAR_BYTES = 512 * 1024;

/** An avatar image to store: its encoded bytes and their format. */
export const avatarImageSchema = z.object({
	bytes: z
		.instanceof(Uint8Array)
		.refine(bytes => bytes.byteLength > 0, 'validation.required')
		.refine(bytes => bytes.byteLength <= MAX_AVATAR_BYTES, 'avatar.tooLarge'),
	type: z.enum(AVATAR_TYPES),
});

export type AvatarImage = z.output<typeof avatarImageSchema>;

/**
 * The stored avatar's file name: an id plus the extension of its format. No slashes or extra dots are accepted, so the
 * name never carries a path and adapters can resolve it inside their own avatar folder safely.
 */
export const avatarFileNameSchema = z.string().regex(/^[0-9a-z-]{1,64}\.(jpg|png|webp)$/, 'avatar.fileName');

export const avatarFileName = (id: string, type: AvatarType): string => `${id}.${EXTENSIONS[type]}`;

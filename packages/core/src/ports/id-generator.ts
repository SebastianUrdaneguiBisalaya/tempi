import { uuidv7 } from '../domain/uuidv7';

export type IdGenerator = {
	/** Returns a new UUIDv7 as text. */
	next(): string;
};

export const uuidv7Ids: IdGenerator = { next: () => uuidv7() };

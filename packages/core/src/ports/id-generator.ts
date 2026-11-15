export type IdGenerator = {
	/** Returns a new UUIDv7 as text. */
	next(): string;
};

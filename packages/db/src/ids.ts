import type { Clock, IdGenerator } from '@tempi/core';

/** RFC 9562 UUIDv7: 48-bit Unix ms timestamp, then random bits, so ids sort by creation time. */
export const uuidv7 = (nowMs: number = Date.now()): string => {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	let timestamp = nowMs;
	for (let index = 5; index >= 0; index--) {
		bytes[index] = timestamp % 256;
		timestamp = Math.floor(timestamp / 256);
	}
	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
	const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const uuidv7Ids: IdGenerator = { next: () => uuidv7() };

export const systemClock: Clock = { now: () => new Date() };

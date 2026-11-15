// Requires an explicit offset so a value never depends on the machine's local zone.
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

/** Normalizes an ISO-8601 instant with offset to UTC (`…Z`), or returns null if invalid. */
export const toUtcInstant = (value: string): string | null => {
	if (!ISO_INSTANT.test(value)) return null;
	const ms = Date.parse(value);
	return Number.isNaN(ms) ? null : new Date(ms).toISOString();
};

export const isValidTimeZone = (value: string): boolean => {
	if (value.trim() === '') return false;
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: value });
		return true;
	} catch {
		return false;
	}
};

/** Trims text and maps blank values to null. */
export const optionalText = (value: string | null | undefined): string | null => {
	const trimmed = value?.trim() ?? '';
	return trimmed === '' ? null : trimmed;
};
